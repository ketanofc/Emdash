import { decryptApiKey, type Keyring } from "./crypto.ts";
import { invokeGeminiAdapter, invokeOpenAiAdapter } from "./adapters.ts";
import { parseAndValidateWithSchema } from "./schema.ts";
import {
  AdapterHttpError,
  NoAvailableProviderError,
  type CallLLMInput,
  type CallLLMOutput,
  type LlmRouterStore,
} from "./types.ts";

const PROVIDER_CALL_TIMEOUT_MS = 60_000;
const COOLDOWN_BACKOFF_SECONDS = [60, 120, 300, 900]; // 60s, 2m, 5m, capped at 15m
const KEY_INVALID_COOLDOWN_SECONDS = 24 * 60 * 60; // 24h long cooldown for 401/403

export function computeCooldownSeconds(consecutiveFailures: number): number {
  const index = Math.max(0, Math.min(consecutiveFailures - 1, COOLDOWN_BACKOFF_SECONDS.length - 1));
  return COOLDOWN_BACKOFF_SECONDS[index];
}

export interface CallLLMDependencies {
  store: LlmRouterStore;
  keyring: Keyring;
  fetchFn?: typeof fetch;
  nowMs?: () => number;
  timeoutMs?: number;
}

export async function callLLM(
  input: CallLLMInput,
  deps: CallLLMDependencies
): Promise<CallLLMOutput> {
  const now = deps.nowMs ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? PROVIDER_CALL_TIMEOUT_MS;
  const fetchFn = deps.fetchFn ?? fetch;

  const [config, route, globalDailyCalls] = await Promise.all([
    deps.store.getConfig(),
    deps.store.getRoute(input.stage),
    deps.store.getGlobalDailyCallCount(),
  ]);

  if (config.maintenance) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  if (globalDailyCalls >= config.global_daily_call_limit) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  if (!route || !Array.isArray(route.chain) || route.chain.length === 0) {
    throw new NoAvailableProviderError("High demand right now, please try again later");
  }

  const normalizedCountry = (input.country || "").trim().toUpperCase();

  for (const candidate of route.chain) {
    if (input.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const provider = await deps.store.getProvider(candidate.provider_id);
    if (!provider || !provider.enabled) {
      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider?.id ?? null,
        model_id: candidate.model_id,
        status: "skipped",
        http_status: null,
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: "PROVIDER_DISABLED",
      });
      continue;
    }

    const modelRecord = await deps.store.getProviderModel(
      provider.id,
      candidate.model_id
    );
    if (modelRecord && !modelRecord.enabled) {
      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        http_status: null,
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: "MODEL_DISABLED",
      });
      continue;
    }

    if (
      normalizedCountry &&
      provider.blocked_regions.some(
        (r) => r.trim().toUpperCase() === normalizedCountry
      )
    ) {
      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        http_status: null,
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: "REGION_BLOCKED",
      });
      continue;
    }

    const health = await deps.store.getProviderHealth(provider.id);
    if (health?.cooldown_until) {
      const cooldownEnd = Date.parse(health.cooldown_until);
      if (Number.isFinite(cooldownEnd) && cooldownEnd > now()) {
        await deps.store.insertLlmCall({
          user_id: input.userId,
          job_id: input.jobId,
          stage: input.stage,
          provider_id: provider.id,
          model_id: candidate.model_id,
          status: "skipped",
          http_status: null,
          latency_ms: 0,
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          error_code: health.key_invalid ? "KEY_INVALID" : "COOLDOWN",
        });
        continue;
      }
    }

    const windowUsage = await deps.store.getProviderWindowUsage(provider.id);
    if (
      (provider.rpm_limit && windowUsage.rpm_count >= provider.rpm_limit) ||
      (provider.rpd_limit && windowUsage.rpd_count >= provider.rpd_limit) ||
      (provider.daily_token_limit &&
        windowUsage.daily_tokens >= provider.daily_token_limit)
    ) {
      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "skipped",
        http_status: null,
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: "LIMIT_REACHED",
      });
      continue;
    }

    // Decrypt API key ONLY at call time inside server/Edge Function
    let apiKey: string;
    try {
      const decrypted = await decryptApiKey(provider.api_key_enc, deps.keyring);
      apiKey = decrypted.plaintext;
    } catch {
      await deps.store.upsertProviderHealth({
        provider_id: provider.id,
        cooldown_until: new Date(
          now() + KEY_INVALID_COOLDOWN_SECONDS * 1000
        ).toISOString(),
        consecutive_failures: (health?.consecutive_failures ?? 0) + 1,
        last_error: "Key decryption failed",
        key_invalid: true,
        updated_at: new Date(now()).toISOString(),
      });
      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "error",
        http_status: null,
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: "DECRYPT_FAILED",
      });
      continue;
    }

    const callController = new AbortController();
    const timer = setTimeout(() => callController.abort(), timeoutMs);
    const onCallerAbort = () => callController.abort();
    if (input.signal) {
      input.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    const startedAt = now();

    const executeAttempt = async (promptToSend: string) => {
      if (provider.protocol === "gemini") {
        return await invokeGeminiAdapter({
          protocol: "gemini",
          baseUrl: provider.base_url,
          slug: provider.slug,
          apiKey,
          modelId: candidate.model_id,
          system: input.system,
          prompt: promptToSend,
          attachments: input.attachments,
          temperature: route.temperature,
          maxOutputTokens: route.max_output_tokens,
          schema: input.schema,
          signal: callController.signal,
          fetchFn,
        });
      }

      const effectivePrompt =
        input.schema && !provider.supports_json_schema
          ? `${promptToSend}\n\nRespond with JSON only matching this schema:\n${JSON.stringify(input.schema)}`
          : promptToSend;

      return await invokeOpenAiAdapter({
        protocol: "openai",
        baseUrl: provider.base_url,
        slug: provider.slug,
        apiKey,
        modelId: candidate.model_id,
        system: input.system,
        prompt: effectivePrompt,
        attachments: input.attachments,
        temperature: route.temperature,
        maxOutputTokens: route.max_output_tokens,
        schema: input.schema,
        supportsJsonSchema: provider.supports_json_schema,
        signal: callController.signal,
        fetchFn,
      });
    };

    try {
      let attemptResult = await executeAttempt(input.prompt);
      let finalInputTokens = attemptResult.tokens.inputTokens;
      let finalOutputTokens = attemptResult.tokens.outputTokens;
      let finalTotalTokens = attemptResult.tokens.totalTokens;
      let finalText = attemptResult.text;

      if (input.schema && provider.protocol === "openai") {
        const validation = parseAndValidateWithSchema(
          attemptResult.text,
          input.schema
        );
        if (!validation.ok) {
          // Retry once with the Zod validation error
          const retryPrompt = `${input.prompt}\n\nYour previous JSON response failed schema validation: ${validation.error}\nFix the output and respond with valid JSON only.`;
          const retryResult = await executeAttempt(retryPrompt);
          finalInputTokens += retryResult.tokens.inputTokens;
          finalOutputTokens += retryResult.tokens.outputTokens;
          finalTotalTokens += retryResult.tokens.totalTokens;

          const retryValidation = parseAndValidateWithSchema(
            retryResult.text,
            input.schema
          );
          if (!retryValidation.ok) {
            throw new AdapterHttpError(
              422,
              "SCHEMA_VALIDATION_FAILED",
              retryValidation.error
            );
          }
          finalText = retryValidation.jsonText;
        } else {
          finalText = validation.jsonText;
        }
      }

      const latencyMs = Math.max(0, now() - startedAt);
      await deps.store.upsertProviderHealth({
        provider_id: provider.id,
        cooldown_until: null,
        consecutive_failures: 0,
        last_error: null,
        key_invalid: false,
        updated_at: new Date(now()).toISOString(),
      });

      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: "ok",
        http_status: attemptResult.httpStatus,
        latency_ms: latencyMs,
        input_tokens: finalInputTokens,
        output_tokens: finalOutputTokens,
        total_tokens: finalTotalTokens,
        error_code: null,
      });

      return {
        text: finalText,
        provider: provider.name,
        providerId: provider.id,
        model: candidate.model_id,
        tokens: {
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          totalTokens: finalTotalTokens,
        },
      };
    } catch (err: unknown) {
      if (input.signal?.aborted) {
        throw err;
      }

      const latencyMs = Math.max(0, now() - startedAt);
      const httpStatus =
        err instanceof AdapterHttpError ? err.status : 500;
      const errorCode =
        err instanceof AdapterHttpError ? err.errorCode : "UNKNOWN";

      const isRateLimit = httpStatus === 429;
      const isAuthFailure = httpStatus === 401 || httpStatus === 403;
      const isServerOrTransient =
        isRateLimit || httpStatus >= 500 || httpStatus === 422;

      const nextFailures = (health?.consecutive_failures ?? 0) + 1;

      if (isAuthFailure) {
        await deps.store.upsertProviderHealth({
          provider_id: provider.id,
          cooldown_until: new Date(
            now() + KEY_INVALID_COOLDOWN_SECONDS * 1000
          ).toISOString(),
          consecutive_failures: nextFailures,
          last_error: "key invalid",
          key_invalid: true,
          updated_at: new Date(now()).toISOString(),
        });
      } else if (isServerOrTransient) {
        const cooldownSeconds = computeCooldownSeconds(nextFailures);
        await deps.store.upsertProviderHealth({
          provider_id: provider.id,
          cooldown_until: new Date(now() + cooldownSeconds * 1000).toISOString(),
          consecutive_failures: nextFailures,
          last_error:
            err instanceof Error ? err.message.slice(0, 200) : "Provider error",
          key_invalid: false,
          updated_at: new Date(now()).toISOString(),
        });
      }

      await deps.store.insertLlmCall({
        user_id: input.userId,
        job_id: input.jobId,
        stage: input.stage,
        provider_id: provider.id,
        model_id: candidate.model_id,
        status: isRateLimit ? "rate_limited" : "error",
        http_status: httpStatus,
        latency_ms: latencyMs,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        error_code: errorCode,
      });
    } finally {
      clearTimeout(timer);
      if (input.signal) {
        input.signal.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  throw new NoAvailableProviderError("High demand right now, please try again later");
}
