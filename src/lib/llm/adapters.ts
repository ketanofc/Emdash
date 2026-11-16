import type { AttachedFile } from "../../types.ts";
import { toGeminiSchema } from "./schema.ts";
import { AdapterHttpError, type ProviderProtocol, type TokenUsage } from "./types.ts";

export interface ProviderAdapterInput {
  protocol: ProviderProtocol;
  baseUrl: string;
  slug: string;
  apiKey: string;
  modelId: string;
  system: string;
  prompt: string;
  attachments?: AttachedFile[];
  temperature?: number;
  maxOutputTokens?: number;
  schema?: Record<string, unknown>;
  supportsJsonSchema?: boolean;
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
}

export interface ProviderAdapterOutput {
  text: string;
  tokens: TokenUsage;
  httpStatus: number;
}

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function normalizeBaseUrl(baseUrl: string, fallback: string): string {
  const clean = (baseUrl || "").trim().replace(/\/+$/, "");
  return clean || fallback;
}

function buildGeminiContents(prompt: string, attachments?: AttachedFile[]) {
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const file of attachments.slice(0, 4)) {
      if (!file || typeof file !== "object") continue;
      if ((file.kind === "image" || file.kind === "inline") && file.base64Data) {
        parts.push({
          inlineData: {
            mimeType: file.mimeType || "application/octet-stream",
            data: file.base64Data,
          },
        });
      } else if (file.kind === "text" && file.content) {
        parts.push({
          text: `Attached file (${file.name || "attachment"}):\n${file.content.slice(0, 12000)}`,
        });
      }
    }
  }

  parts.push({ text: prompt });
  return [{ role: "user", parts }];
}

function buildOpenAiMessages(
  system: string,
  prompt: string,
  attachments?: AttachedFile[]
) {
  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const file of attachments.slice(0, 4)) {
      if (!file || typeof file !== "object") continue;
      if (file.kind === "image" && file.base64Data) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${file.mimeType || "image/png"};base64,${file.base64Data}`,
          },
        });
      } else if (file.kind === "text" && file.content) {
        contentParts.push({
          type: "text",
          text: `Attached file (${file.name || "attachment"}):\n${file.content.slice(0, 12000)}`,
        });
      }
    }
  }

  const userContent =
    contentParts.length === 0
      ? prompt
      : [{ type: "text" as const, text: prompt }, ...contentParts];

  const messages: Array<{ role: "system" | "user"; content: unknown }> = [];
  if (system.trim()) {
    messages.push({ role: "system", content: system });
  }
  messages.push({ role: "user", content: userContent });
  return messages;
}

export async function invokeGeminiAdapter(
  input: ProviderAdapterInput
): Promise<ProviderAdapterOutput> {
  const fetchImpl = input.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(input.baseUrl, DEFAULT_GEMINI_BASE_URL);
  const cleanModel = input.modelId.trim().replace(/^models\//, "");
  const url = `${baseUrl}/models/${encodeURIComponent(cleanModel)}:generateContent`;

  const generationConfig: Record<string, unknown> = {};
  if (
    typeof input.temperature === "number" &&
    !/^gemini-4-/i.test(cleanModel)
  ) {
    generationConfig.temperature = input.temperature;
  }
  if (typeof input.maxOutputTokens === "number" && input.maxOutputTokens > 0) {
    generationConfig.maxOutputTokens = input.maxOutputTokens;
  }
  if (input.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = toGeminiSchema(input.schema);
  }

  const bodyPayload: Record<string, unknown> = {
    contents: buildGeminiContents(input.prompt, input.attachments),
    generationConfig,
  };
  if (input.system.trim()) {
    bodyPayload.systemInstruction = {
      parts: [{ text: input.system }],
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify(bodyPayload),
      signal: input.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AdapterHttpError(504, "TIMEOUT", "Provider request timed out.");
    }
    throw new AdapterHttpError(
      502,
      "NETWORK",
      err instanceof Error ? err.message : "Network error calling Gemini provider."
    );
  }

  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch {
      errText = "";
    }
    throw new AdapterHttpError(
      res.status,
      res.status === 429
        ? "RATE_LIMIT"
        : res.status === 401 || res.status === 403
          ? "INVALID_KEY"
          : `HTTP_${res.status}`,
      `Gemini provider returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`
    );
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new AdapterHttpError(
      502,
      "EMPTY_RESPONSE",
      "Provider returned an empty response."
    );
  }

  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
  const totalTokens =
    json.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

  return {
    text,
    tokens: { inputTokens, outputTokens, totalTokens },
    httpStatus: res.status,
  };
}

export async function invokeOpenAiAdapter(
  input: ProviderAdapterInput
): Promise<ProviderAdapterOutput> {
  const fetchImpl = input.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(
    input.baseUrl,
    "https://openrouter.ai/api/v1"
  );
  const url = `${baseUrl}/chat/completions`;

  const isOpenRouter =
    baseUrl.includes("openrouter.ai") || input.slug.includes("openrouter");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (isOpenRouter) {
    headers["X-Title"] = "Emdash";
  }

  const bodyPayload: Record<string, unknown> = {
    model: input.modelId,
    messages: buildOpenAiMessages(input.system, input.prompt, input.attachments),
  };

  if (typeof input.temperature === "number") {
    bodyPayload.temperature = input.temperature;
  }
  if (typeof input.maxOutputTokens === "number" && input.maxOutputTokens > 0) {
    bodyPayload.max_tokens = input.maxOutputTokens;
  }

  if (input.schema && input.supportsJsonSchema) {
    bodyPayload.response_format = {
      type: "json_schema",
      json_schema: {
        name: "structured_output",
        strict: true,
        schema: input.schema,
      },
    };
  }

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: input.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AdapterHttpError(504, "TIMEOUT", "Provider request timed out.");
    }
    throw new AdapterHttpError(
      502,
      "NETWORK",
      err instanceof Error ? err.message : "Network error calling OpenAI provider."
    );
  }

  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch {
      errText = "";
    }
    throw new AdapterHttpError(
      res.status,
      res.status === 429
        ? "RATE_LIMIT"
        : res.status === 401 || res.status === 403
          ? "INVALID_KEY"
          : `HTTP_${res.status}`,
      `OpenAI-compatible provider returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const text = (json.choices?.[0]?.message?.content ?? "").trim();
  if (!text) {
    throw new AdapterHttpError(
      502,
      "EMPTY_RESPONSE",
      "Provider returned an empty response."
    );
  }

  const inputTokens = json.usage?.prompt_tokens ?? 0;
  const outputTokens = json.usage?.completion_tokens ?? 0;
  const totalTokens =
    json.usage?.total_tokens ?? inputTokens + outputTokens;

  return {
    text,
    tokens: { inputTokens, outputTokens, totalTokens },
    httpStatus: res.status,
  };
}

export interface DiscoveredModel {
  model_id: string;
  label: string;
}

export async function testProviderConnection(options: {
  protocol: ProviderProtocol;
  baseUrl: string;
  slug: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}): Promise<{ ok: boolean; statusText: string; models: DiscoveredModel[] }> {
  const fetchImpl = options.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    if (options.protocol === "gemini") {
      const base = normalizeBaseUrl(options.baseUrl, DEFAULT_GEMINI_BASE_URL);
      const res = await fetchImpl(`${base}/models?pageSize=100`, {
        method: "GET",
        headers: {
          "x-goog-api-key": options.apiKey,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          ok: false,
          statusText:
            res.status === 401 || res.status === 403
              ? "Key invalid"
              : `HTTP ${res.status}`,
          models: [],
        };
      }

      const payload = (await res.json()) as {
        models?: Array<{
          name?: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }>;
      };

      const models: DiscoveredModel[] = (payload.models ?? [])
        .filter((m) => {
          if (!m.name) return false;
          if (
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.length > 0 &&
            !m.supportedGenerationMethods.includes("generateContent")
          ) {
            return false;
          }
          const clean = m.name.replace(/^models\//, "");
          return !/(?:tts|audio|image|live|robotics|computer-use|embedding)/i.test(clean);
        })
        .map((m) => {
          const cleanId = (m.name ?? "").replace(/^models\//, "");
          return {
            model_id: cleanId,
            label: m.displayName?.trim() || cleanId,
          };
        })
        .slice(0, 100);

      return {
        ok: true,
        statusText: `OK · ${models.length} models`,
        models,
      };
    }

    const base = normalizeBaseUrl(
      options.baseUrl,
      "https://openrouter.ai/api/v1"
    );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.apiKey}`,
    };
    if (base.includes("openrouter.ai") || options.slug.includes("openrouter")) {
      headers["X-Title"] = "Emdash";
    }

    const res = await fetchImpl(`${base}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (res.ok) {
      const payload = (await res.json()) as {
        data?: Array<{ id?: string; name?: string }>;
      };
      const models: DiscoveredModel[] = (payload.data ?? [])
        .filter((m): m is { id: string; name?: string } => Boolean(m.id))
        .map((m) => ({
          model_id: m.id,
          label: m.name?.trim() || m.id,
        }))
        .slice(0, 150);

      return {
        ok: true,
        statusText: `OK · ${models.length} models`,
        models,
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        statusText: "Key invalid",
        models: [],
      };
    }

    // Fallback: 1-token chat completions probe when /models isn't implemented
    const probeRes = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    if (probeRes.ok) {
      return { ok: true, statusText: "OK (probe)", models: [] };
    }

    return {
      ok: false,
      statusText:
        probeRes.status === 401 || probeRes.status === 403
          ? "Key invalid"
          : `HTTP ${probeRes.status}`,
      models: [],
    };
  } catch (err) {
    return {
      ok: false,
      statusText: err instanceof Error ? err.message.slice(0, 60) : "Connection failed",
      models: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
