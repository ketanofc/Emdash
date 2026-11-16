import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decryptApiKey, getMasterKeyringFromEnv } from "./crypto.ts";
import { parseAndValidateWithSchema, toGeminiSchema } from "./schema.ts";

export type RouteStage = "brief" | "plan" | "build" | "repair";
export type ProviderProtocol = "gemini" | "openai";

const COOLDOWN_SECONDS = [60, 120, 300, 900];
const KEY_INVALID_COOLDOWN_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 60_000;

export class NoAvailableProviderError extends Error {
  readonly code = "HIGH_DEMAND";
  readonly status = 503;
  constructor(message = "High demand right now, please try again later") {
    super(message);
    this.name = "NoAvailableProviderError";
  }
}

class AdapterHttpError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string
  ) {
    super(message);
  }
}

export interface CallLLMParams {
  supabaseAdmin: SupabaseClient;
  stage: RouteStage;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  userId: string;
  jobId: string;
  country?: string | null;
}

export interface CallLLMResult {
  text: string;
  provider: string;
  model: string;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

async function invokeGemini(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  schema?: Record<string, unknown>;
  signal: AbortSignal;
}) {
  const base = (params.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const cleanModel = params.modelId.replace(/^models\//, "");
  const url = `${base}/models/${encodeURIComponent(cleanModel)}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: params.maxOutputTokens,
  };
  if (!/^gemini-4-/i.test(cleanModel)) {
    generationConfig.temperature = params.temperature;
  }
  if (params.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = toGeminiSchema(params.schema);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": params.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: params.system ? { parts: [{ text: params.system }] } : undefined,
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    throw new AdapterHttpError(
      res.status,
      res.status === 429 ? "RATE_LIMIT" : res.status === 401 || res.status === 403 ? "INVALID_KEY" : `HTTP_${res.status}`,
      `Gemini HTTP ${res.status}`
    );
  }

  const json = await res.json();
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AdapterHttpError(502, "EMPTY_RESPONSE", "Empty Gemini response");
  }

  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens = json.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

  return {
    text,
    httpStatus: res.status,
    tokens: { inputTokens, outputTokens, totalTokens },
  };
}

async function invokeOpenAi(params: {
  baseUrl: string;
  slug: string;
  apiKey: string;
  modelId: string;
  system: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  schema?: Record<string, unknown>;
  supportsJsonSchema: boolean;
  signal: AbortSignal;
}) {
  const base = (params.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${params.apiKey}`,
  };
  if (base.includes("openrouter.ai") || params.slug.includes("openrouter")) {
    headers["X-Title"] = "Emdash";
  }

  const body: Record<string, unknown> = {
    model: params.modelId,
    messages: [
      ...(params.system ? [{ role: "system", content: params.system }] : []),
      { role: "user", content: params.prompt },
    ],
    temperature: params.temperature,
    max_tokens: params.maxOutputTokens,
  };

  if (params.schema && params.supportsJsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "structured_output", strict: true, schema: params.schema },
    };
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok) {
    throw new AdapterHttpError(
      res.status,
      res.status === 429 ? "RATE_LIMIT" : res.status === 401 || res.status === 403 ? "INVALID_KEY" : `HTTP_${res.status}`,
      `OpenAI HTTP ${res.status}`
    );
  }

  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    throw new AdapterHttpError(502, "EMPTY_RESPONSE", "Empty OpenAI response");
  }

  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;
  const totalTokens = json.usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    text,
    httpStatus: res.status,
    tokens: { inputTokens, outputTokens, totalTokens },
  };
}

export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const { supabaseAdmin } = params;
  const keyring = getMasterKeyringFromEnv();

  const [{ data: config }, { data: route }] = await Promise.all([
    supabaseAdmin.from("app_config").select("*").eq("id", 1).single(),
    supabaseAdmin.from("routes").select("*").eq("stage", params.stage).single(),
  ]);

  if (config?.maintenance) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  const utcDayStart = new Date();
  utcDayStart.setUTCHours(0, 0, 0, 0);
  const { count: globalDailyCalls } = await supabaseAdmin
    .from("llm_calls")
    .select("*", { count: "exact", head: true })
    .gte("created_at", utcDayStart.toISOString())
    .neq("status", "skipped");

  if ((globalDailyCalls ?? 0) >= (config?.global_daily_call_limit ?? 5000)) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  const chain = (route?.chain as Array<{ provider_id: string; model_id: string }>) ?? [];
  if (chain.length === 0) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  const normalizedCountry = (params.country || "").trim().toUpperCase();

  for (const candidate of chain) {
    const { data: provider } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("id", candidate.provider_id)
      .single();

    if (!provider || !provider.enabled) {
      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider?.id ?? null,
        model_id: candidate.model_id,
        status: "skipped",
        error_code: "PROVIDER_DISABLED",
      });
      continue;
    }

    const { data: modelRow } = await supabaseAdmin
      .from("provider_models")
      .select("enabled")
      .eq("provider_id", provider.id)
      .eq("model_id", candidate.model_id)
      .maybeSingle();

    if (modelRow && !modelRow.enabled) {
      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        error_code: "MODEL_DISABLED",
      });
      continue;
    }

    const blockedRegions = Array.isArray(provider.blocked_regions) ? provider.blocked_regions : [];
    if (
      normalizedCountry &&
      blockedRegions.some((r: string) => r.trim().toUpperCase() === normalizedCountry)
    ) {
      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        error_code: "REGION_BLOCKED",
      });
      continue;
    }

    const { data: health } = await supabaseAdmin
      .from("provider_health")
      .select("*")
      .eq("provider_id", provider.id)
      .maybeSingle();

    if (health?.cooldown_until && Date.parse(health.cooldown_until) > Date.now()) {
      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        error_code: health.key_invalid ? "KEY_INVALID" : "COOLDOWN",
      });
      continue;
    }

    const { data: usageRows } = await supabaseAdmin.rpc("get_provider_window_usage", {
      p_provider_id: provider.id,
    });
    const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
    if (
      usage &&
      ((provider.rpm_limit && Number(usage.rpm_count) >= provider.rpm_limit) ||
        (provider.rpd_limit && Number(usage.rpd_count) >= provider.rpd_limit) ||
        (provider.daily_token_limit && Number(usage.daily_tokens) >= provider.daily_token_limit))
    ) {
      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        error_code: "LIMIT_REACHED",
      });
      continue;
    }

    const { plaintext: apiKey } = await decryptApiKey(provider.api_key_enc, keyring);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const temperature = Number(route?.temperature ?? 0.5);
      const maxOutputTokens = Number(route?.max_output_tokens ?? 8192);

      const attemptOnce = async (promptText: string) => {
        if (provider.protocol === "gemini") {
          return await invokeGemini({
            baseUrl: provider.base_url,
            apiKey,
            modelId: candidate.model_id,
            system: params.system,
            prompt: promptText,
            temperature,
            maxOutputTokens,
            schema: params.schema,
            signal: controller.signal,
          });
        }
        const effectivePrompt =
          params.schema && !provider.supports_json_schema
            ? `${promptText}\n\nRespond with JSON only matching this schema:\n${JSON.stringify(params.schema)}`
            : promptText;
        return await invokeOpenAi({
          baseUrl: provider.base_url,
          slug: provider.slug,
          apiKey,
          modelId: candidate.model_id,
          system: params.system,
          prompt: effectivePrompt,
          temperature,
          maxOutputTokens,
          schema: params.schema,
          supportsJsonSchema: Boolean(provider.supports_json_schema),
          signal: controller.signal,
        });
      };

      const res = await attemptOnce(params.prompt);
      let finalText = res.text;
      let tokens = res.tokens;

      if (params.schema && provider.protocol === "openai") {
        const validated = parseAndValidateWithSchema(res.text, params.schema);
        if (!validated.ok) {
          const retry = await attemptOnce(
            `${params.prompt}\n\nYour JSON failed validation: ${validated.error}\nRespond with valid JSON only.`
          );
          tokens = {
            inputTokens: tokens.inputTokens + retry.tokens.inputTokens,
            outputTokens: tokens.outputTokens + retry.tokens.outputTokens,
            totalTokens: tokens.totalTokens + retry.tokens.totalTokens,
          };
          const retryValidated = parseAndValidateWithSchema(retry.text, params.schema);
          if (!retryValidated.ok) {
            throw new AdapterHttpError(422, "SCHEMA_VALIDATION_FAILED", retryValidated.error);
          }
          finalText = retryValidated.jsonText;
        } else {
          finalText = validated.jsonText;
        }
      }

      const latencyMs = Date.now() - startedAt;
      await supabaseAdmin.from("provider_health").upsert({
        provider_id: provider.id,
        cooldown_until: null,
        consecutive_failures: 0,
        last_error: null,
        key_invalid: false,
        updated_at: new Date().toISOString(),
      });

      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "ok",
        http_status: res.httpStatus,
        latency_ms: latencyMs,
        input_tokens: tokens.inputTokens,
        output_tokens: tokens.outputTokens,
        total_tokens: tokens.totalTokens,
        error_code: null,
      });

      return {
        text: finalText,
        provider: provider.name,
        model: candidate.model_id,
        tokens,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startedAt;
      const status = err instanceof AdapterHttpError ? err.status : 500;
      const errorCode = err instanceof AdapterHttpError ? err.errorCode : "UNKNOWN";
      const nextFailures = (health?.consecutive_failures ?? 0) + 1;

      if (status === 401 || status === 403) {
        await supabaseAdmin.from("provider_health").upsert({
          provider_id: provider.id,
          cooldown_until: new Date(Date.now() + KEY_INVALID_COOLDOWN_SECONDS * 1000).toISOString(),
          consecutive_failures: nextFailures,
          last_error: "key invalid",
          key_invalid: true,
          updated_at: new Date().toISOString(),
        });
      } else if (status === 429 || status >= 500 || status === 422) {
        const secs = COOLDOWN_SECONDS[Math.min(nextFailures - 1, COOLDOWN_SECONDS.length - 1)];
        await supabaseAdmin.from("provider_health").upsert({
          provider_id: provider.id,
          cooldown_until: new Date(Date.now() + secs * 1000).toISOString(),
          consecutive_failures: nextFailures,
          last_error: err instanceof Error ? err.message.slice(0, 200) : "Provider error",
          key_invalid: false,
          updated_at: new Date().toISOString(),
        });
      }

      await supabaseAdmin.from("llm_calls").insert({
        user_id: params.userId,
        job_id: params.jobId,
        stage: params.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: status === 429 ? "rate_limited" : "error",
        http_status: status,
        latency_ms: latencyMs,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: errorCode,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  throw new NoAvailableProviderError("High demand right now, please try again later");
}
