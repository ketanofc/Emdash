import type {
  AttachedFile,
  BuildPlan,
  DesignBrief,
  GeminiModelOption,
  GeneratedFiles,
  PipelineStage,
} from "../types.ts";
import { loadEncryptedApiKey } from "./storage.ts";

export const FALLBACK_GEMINI_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 60_000;
const PIPELINE_TIMEOUT_MS = 180_000;
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 1200;
const DEPRECATED_MODEL_RE = /^gemini-(?:1\.|2\.0|pro\b)/i;
const GEMINI_4_MODEL_RE = /^gemini-4-/i;

export const DEFAULT_GEMINI_MODELS: GeminiModelOption[] = [
  { id: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash" },
  { id: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash Lite" },
  { id: "gemini-4-hydrogen", displayName: "Gemini 4 Hydrogen" },
  { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
  { id: "gemini-4-argon", displayName: "Gemini 4 Argon" },
];

export type GeminiErrorCode =
  | "RATE_LIMIT"
  | "INVALID_KEY"
  | "MISSING_KEY"
  | "NETWORK"
  | "TIMEOUT"
  | "MALFORMED"
  | `GEMINI_${number}`;

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  readonly status?: number;

  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

export interface GeminiRequestOptions {
  model: string;
  system: string;
  prompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  attachments?: AttachedFile[];
  retryDelayMs?: number;
}

export interface PipelineStreamOptions {
  model: string;
  brief?: DesignBrief;
  files?: GeneratedFiles;
  runtimeErrors?: string[];
  attachments?: AttachedFile[];
  signal?: AbortSignal;
}

export interface PipelineStreamResult {
  brief: DesignBrief;
  plan: BuildPlan;
  files: GeneratedFiles;
  summary: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeModelId(model: string): string {
  const clean = model.trim().replace(/^models\//, "");
  return clean || FALLBACK_GEMINI_MODEL;
}

function buildContents(prompt: string, attachments?: AttachedFile[]) {
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
  return { parts };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  try {
    const savedKey = await loadEncryptedApiKey();
    const headers = new Headers(init.headers || {});
    if (savedKey && !headers.has("x-goog-api-key")) {
      headers.set("x-goog-api-key", savedKey);
    }
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (err: unknown) {
    if (init.signal?.aborted) {
      throw err;
    }
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      throw new GeminiError(
        "TIMEOUT",
        "Request timed out. Please try again."
      );
    }
    throw new GeminiError(
      "NETWORK",
      "Network error while contacting the Emdash server. Check your connection."
    );
  } finally {
    clearTimeout(timer);
  }
}

async function extractServerError(
  res: Response
): Promise<{ code?: GeminiErrorCode; message: string }> {
  try {
    const json = (await res.json()) as {
      code?: GeminiErrorCode;
      error?: string;
    };
    return {
      code: json?.code,
      message: json?.error || "",
    };
  } catch {
    return { message: "" };
  }
}

function mapStatusToError(
  status: number,
  detail: { code?: GeminiErrorCode; message: string }
): GeminiError {
  if (status === 429 || detail.code === "RATE_LIMIT") {
    return new GeminiError(
      "RATE_LIMIT",
      detail.message || "API rate limit reached (429). Please wait a moment and try again.",
      429
    );
  }
  if (status === 503 || detail.code === "MISSING_KEY") {
    return new GeminiError(
      "MISSING_KEY",
      detail.message ||
        "API key is not configured. Open Settings > Models to connect your API key.",
      status
    );
  }
  if (status === 400 || status === 401 || status === 403 || detail.code === "INVALID_KEY") {
    return new GeminiError(
      "INVALID_KEY",
      detail.message ||
        "Your API key was rejected (400/401/403). Please verify your API key above and click Test Key.",
      status
    );
  }
  return new GeminiError(
    detail.code ?? `GEMINI_${status}`,
    detail.message || `Server request failed with status ${status}.`,
    status
  );
}

const NON_GENERAL_FLASH_RE = /(?:tts|audio|image|live|robotics|computer-use)/i;

export function formatModelDisplayName(modelId: string, displayName?: string): string {
  const clean = modelId.trim().replace(/^models\//, "");
  if (/^gemini-3\.5-flash-lite$/i.test(clean)) return "Gemini 3.5 Flash Lite";
  if (/^gemini-3\.5-flash$/i.test(clean)) return "Gemini 3.5 Flash";
  if (/^gemini-4-hydrogen$/i.test(clean)) return "Gemini 4 Hydrogen";
  if (/^gemini-2\.5-flash$/i.test(clean)) return "Gemini 2.5 Flash";
  if (/^gemini-4-argon$/i.test(clean)) return "Gemini 4 Argon";
  if (/^gemini-2\.5-pro$/i.test(clean)) return "Gemini 2.5 Pro";

  if (displayName && displayName.trim() && displayName !== modelId) {
    const trimmed = displayName.trim();
    if (/^gemini\b/i.test(trimmed)) {
      return trimmed.replace(/^gemini[\s-_]*/i, "Gemini ");
    }
    return `Gemini ${trimmed}`;
  }

  const formatted = clean
    .replace(/^gemini[\s-_]*/i, "")
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return formatted ? `Gemini ${formatted}` : clean;
}

export function pickDefaultFlashModel(models: GeminiModelOption[]): string {
  const general = models.filter((m) => !NON_GENERAL_FLASH_RE.test(m.id));
  const preferredExact =
    general.find((m) => /^gemini-3\.5-flash$/i.test(m.id)) ??
    general.find((m) => /^gemini-3\.5-flash-lite$/i.test(m.id)) ??
    general.find((m) => /^gemini-4-hydrogen$/i.test(m.id)) ??
    general.find((m) => /^gemini-2\.5-flash$/i.test(m.id));
  if (preferredExact) return preferredExact.id;

  const isFlashLike = (m: GeminiModelOption) => {
    const lowerId = m.id.toLowerCase();
    const lowerName = m.displayName.toLowerCase();
    return (
      lowerId.includes("hydrogen") ||
      lowerId.includes("flash") ||
      lowerName.includes("hydrogen") ||
      lowerName.includes("flash")
    );
  };

  const generalFlash = general.find(isFlashLike);
  const anyFlash = models.find(isFlashLike);
  return generalFlash?.id ?? anyFlash?.id ?? models[0]?.id ?? FALLBACK_GEMINI_MODEL;
}

export async function fetchDirectGeminiModels(apiKey: string): Promise<GeminiModelOption[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new GeminiError(
          "INVALID_KEY",
          "Your API key was rejected (400/401/403). Please verify your API key above and click Test Key.",
          res.status
        );
      }
      if (res.status === 429) {
        throw new GeminiError(
          "RATE_LIMIT",
          "API rate limit reached (429). Please wait a moment and try again.",
          429
        );
      }
      throw new GeminiError(
        `GEMINI_${res.status}`,
        `Google API request failed with status ${res.status}.`,
        res.status
      );
    }

    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    const rawList = Array.isArray(data.models) ? data.models : [];
    const list: GeminiModelOption[] = [];
    for (const m of rawList) {
      if (!m.name) continue;
      const id = m.name.replace(/^models\//, "");
      if (!id || DEPRECATED_MODEL_RE.test(id)) continue;
      if (
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.length > 0 &&
        !m.supportedGenerationMethods.includes("generateContent")
      ) {
        continue;
      }
      list.push({
        id,
        displayName: formatModelDisplayName(id, m.displayName),
        description: m.description,
      });
      if (list.length >= 100) break;
    }

    const merged = list.length > 0 ? list : DEFAULT_GEMINI_MODELS;
    for (const dm of DEFAULT_GEMINI_MODELS) {
      if (!merged.some((m) => m.id === dm.id)) {
        merged.push(dm);
      }
    }
    return merged;
  } catch (err: unknown) {
    if (err instanceof GeminiError) throw err;
    if (/AIza[0-9A-Za-z-_]{35}/.test(apiKey)) {
      return DEFAULT_GEMINI_MODELS;
    }
    throw new GeminiError(
      "INVALID_KEY",
      "Your API key was rejected (400/401/403). Please verify your API key above and click Test Key.",
      403
    );
  }
}

export async function directGeminiGenerate(
  apiKey: string,
  options: GeminiRequestOptions
): Promise<string> {
  const cleanModel = normalizeModelId(options.model);
  const contents = buildContents(options.prompt, options.attachments);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contentsPayload = [
    {
      role: "user",
      parts: contents.parts.map((p) => {
        if ("inlineData" in p) {
          return {
            inlineData: {
              mimeType: p.inlineData.mimeType,
              data: p.inlineData.data,
            },
          };
        }
        return { text: p.text };
      }),
    },
  ];

  const bodyObj: Record<string, unknown> = {
    contents: contentsPayload,
  };

  if (options.system && options.system.trim()) {
    bodyObj.systemInstruction = {
      parts: [{ text: options.system }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (
    typeof options.temperature === "number" &&
    !GEMINI_4_MODEL_RE.test(cleanModel)
  ) {
    generationConfig.temperature = options.temperature;
  }
  if (options.schema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.schema;
  }
  if (Object.keys(generationConfig).length > 0) {
    bodyObj.generationConfig = generationConfig;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new GeminiError(
        "INVALID_KEY",
        "Your API key was rejected (400/401/403). Please verify your API key above and click Test Key.",
        res.status
      );
    }
    if (res.status === 429) {
      throw new GeminiError(
        "RATE_LIMIT",
        "API rate limit reached (429). Please wait a moment and try again.",
        429
      );
    }
    throw new GeminiError(
      `GEMINI_${res.status}`,
      `Gemini request failed with status ${res.status}.`,
      res.status
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new GeminiError(
      "MALFORMED",
      "Received an empty response from Gemini."
    );
  }
  return text;
}

export async function listGeminiModels(explicitKey?: string): Promise<GeminiModelOption[]> {
  const headers: Record<string, string> = {};
  if (explicitKey && explicitKey.trim()) {
    headers["x-goog-api-key"] = explicitKey.trim();
  }

  let res: Response;
  try {
    res = await fetchWithTimeout("/api/gemini/models", {
      method: "GET",
      headers,
    });
  } catch (err: unknown) {
    const keyToTest = (explicitKey && explicitKey.trim()) || (await loadEncryptedApiKey());
    if (keyToTest) {
      return await fetchDirectGeminiModels(keyToTest);
    }
    throw err;
  }

  if (!res.ok) {
    if (res.status === 404) {
      const keyToTest = (explicitKey && explicitKey.trim()) || (await loadEncryptedApiKey());
      if (keyToTest) {
        return await fetchDirectGeminiModels(keyToTest);
      }
      return DEFAULT_GEMINI_MODELS;
    }
    const detail = await extractServerError(res);
    throw mapStatusToError(res.status, detail);
  }

  const payload = (await res.json()) as {
    models?: GeminiModelOption[];
  };
  return Array.isArray(payload.models) ? payload.models : [];
}

export async function gemini({
  model,
  system,
  prompt,
  schema,
  temperature,
  attachments,
  retryDelayMs = DEFAULT_RATE_LIMIT_BACKOFF_MS,
}: GeminiRequestOptions): Promise<string> {
  const cleanModel = normalizeModelId(model);
  const body = JSON.stringify({
    model: cleanModel,
    system,
    prompt,
    schema,
    temperature,
    attachments,
  });

  const executeRequest = () =>
    fetchWithTimeout("/api/gemini/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

  let res = await executeRequest();
  if (res.status === 429) {
    await sleep(retryDelayMs);
    res = await executeRequest();
    if (res.status === 429) {
      const detail = await extractServerError(res);
      throw mapStatusToError(429, detail);
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      const savedKey = await loadEncryptedApiKey();
      if (savedKey) {
        return await directGeminiGenerate(savedKey, {
          model,
          system,
          prompt,
          schema,
          temperature,
          attachments,
        });
      }
    }
    const detail = await extractServerError(res);
    throw mapStatusToError(res.status, detail);
  }

  const data = (await res.json()) as { text?: string };
  if (!data?.text || !data.text.trim()) {
    throw new GeminiError(
      "MALFORMED",
      "Received an empty or malformed response from Gemini."
    );
  }
  return data.text;
}

export async function runPipelineViaServer(
  userPrompt: string,
  options: PipelineStreamOptions,
  onStage?: (stage: PipelineStage) => void
): Promise<PipelineStreamResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      "/api/gemini/pipeline",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          prompt: userPrompt,
          model: normalizeModelId(options.model),
          brief: options.brief,
          files: options.files,
          runtimeErrors: options.runtimeErrors,
          attachments: options.attachments,
        }),
        signal: options.signal,
      },
      PIPELINE_TIMEOUT_MS
    );
  } catch (err: unknown) {
    const savedKey = await loadEncryptedApiKey();
    if (savedKey) {
      const { runPipeline } = await import("./pipeline.ts");
      return await runPipeline(
        userPrompt,
        {
          model: normalizeModelId(options.model),
          brief: options.brief,
          files: options.files,
          runtimeErrors: options.runtimeErrors,
          attachments: options.attachments,
          generateFn: (opts) => directGeminiGenerate(savedKey, opts),
        },
        onStage
      );
    }
    throw err;
  }

  if (!res.ok) {
    if (res.status === 404) {
      const savedKey = await loadEncryptedApiKey();
      if (!savedKey) {
        throw new GeminiError(
          "MISSING_KEY",
          "API key is not configured. Open Settings > Models to connect your API key.",
          503
        );
      }
      const { runPipeline } = await import("./pipeline.ts");
      return await runPipeline(
        userPrompt,
        {
          model: normalizeModelId(options.model),
          brief: options.brief,
          files: options.files,
          runtimeErrors: options.runtimeErrors,
          attachments: options.attachments,
          generateFn: (opts) => directGeminiGenerate(savedKey, opts),
        },
        onStage
      );
    }
    const detail = await extractServerError(res);
    throw mapStatusToError(res.status, detail);
  }

  if (!res.body) {
    throw new GeminiError(
      "NETWORK",
      "Streaming response body was unavailable from the server."
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: PipelineStreamResult | null = null;

  const processEventBlock = (block: string) => {
    const lines = block.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "");
      if (trimmed.startsWith("event:")) {
        eventName = trimmed.slice(6).trim();
      } else if (trimmed.startsWith("data:")) {
        dataLines.push(trimmed.slice(5).trim());
      }
    }
    if (dataLines.length === 0) return;
    const rawData = dataLines.join("\n");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
      return;
    }

    if (eventName === "stage" && typeof parsed.stage === "string") {
      onStage?.(parsed.stage as PipelineStage);
    } else if (eventName === "result") {
      finalResult = parsed as unknown as PipelineStreamResult;
    } else if (eventName === "error") {
      const code =
        typeof parsed.code === "string"
          ? (parsed.code as GeminiErrorCode)
          : "GEMINI_500";
      const message =
        typeof parsed.message === "string"
          ? parsed.message
          : "Failed to build application.";
      const status = typeof parsed.status === "number" ? parsed.status : undefined;
      throw new GeminiError(code, message, status);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (block.trim()) {
        processEventBlock(block);
      }
    }
  }

  if (buffer.trim()) {
    processEventBlock(buffer);
  }

  if (!finalResult) {
    throw new GeminiError(
      "MALFORMED",
      "Pipeline stream ended before delivering generated application files."
    );
  }

  return finalResult;
}
