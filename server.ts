import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, type ContentListUnion, type Schema } from "@google/genai";
import {
  FALLBACK_GEMINI_MODEL,
  GeminiError,
  pickDefaultFlashModel,
  type GeminiErrorCode,
  type GeminiRequestOptions,
} from "./src/lib/gemini.ts";
import { runPipeline } from "./src/lib/pipeline.ts";
import type {
  AttachedFile,
  BuildPlan,
  DesignBrief,
  GeminiModelOption,
  GeneratedFiles,
  PipelineStage,
} from "./src/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";
const GEMINI_TIMEOUT_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 1200;
const DEPRECATED_MODEL_RE = /^gemini-(?:1\.|2\.0|pro\b)/i;
const GEMINI_4_MODEL_RE = /^gemini-4-/i;

interface PublishedSite {
  slug: string;
  title: string;
  html: string;
  updatedAt: string;
}

const publishedSites = new Map<string, PublishedSite>();

function getAiClient(req?: express.Request): GoogleGenAI | null {
  const headerKey =
    typeof req?.headers?.["x-goog-api-key"] === "string"
      ? req.headers["x-goog-api-key"].trim()
      : typeof req?.headers?.["authorization"] === "string" &&
          req.headers["authorization"].startsWith("Bearer ")
        ? req.headers["authorization"].slice(7).trim()
        : "";

  const envKey = process.env.GEMINI_API_KEY?.trim();

  const rawKey = headerKey || envKey;
  const apiKey = rawKey && rawKey !== "MY_GEMINI_API_KEY" ? rawKey : null;
  if (!apiKey) return null;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "untitled-app";
}

function normalizeModelId(model?: string): string {
  const clean = (model || "").trim().replace(/^models\//, "");
  if (!clean || DEPRECATED_MODEL_RE.test(clean)) {
    return FALLBACK_GEMINI_MODEL;
  }
  return clean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiSdkError(err: unknown): {
  status: number;
  code: GeminiErrorCode;
  message: string;
} {
  if (err instanceof GeminiError) {
    return {
      status:
        err.status ??
        (err.code === "RATE_LIMIT"
          ? 429
          : err.code === "INVALID_KEY"
            ? 403
            : err.code === "MISSING_KEY"
              ? 503
              : 500),
      code: err.code,
      message: err.message,
    };
  }

  const errObj = err as { status?: number; code?: number; message?: string };
  const rawMessage =
    err instanceof Error ? err.message : String(err || "Gemini request failed.");
  const statusFromErr =
    typeof errObj?.status === "number"
      ? errObj.status
      : typeof errObj?.code === "number"
        ? errObj.code
        : undefined;

  if (
    statusFromErr === 429 ||
    rawMessage.includes("429") ||
    rawMessage.includes("RESOURCE_EXHAUSTED")
  ) {
    return {
      status: 429,
      code: "RATE_LIMIT",
      message:
        "Gemini API rate limit reached (429). Wait a moment and try again, or check your API key in Settings > Models.",
    };
  }

  if (
    statusFromErr === 400 ||
    statusFromErr === 401 ||
    statusFromErr === 403 ||
    rawMessage.includes("PERMISSION_DENIED") ||
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("UNAUTHENTICATED") ||
    rawMessage.includes("403") ||
    rawMessage.includes("401")
  ) {
    return {
      status: 403,
      code: "INVALID_KEY",
      message:
        "Your Gemini API key was rejected (400/401/403). Open Settings > Models to check or update your key.",
    };
  }

  if (statusFromErr === 404 || rawMessage.includes("NOT_FOUND")) {
    return {
      status: 404,
      code: "GEMINI_404",
      message:
        "The selected Gemini model was not found or is unsupported. Try switching models in Settings > Models.",
    };
  }

  if (rawMessage.toLowerCase().includes("timed out")) {
    return {
      status: 504,
      code: "TIMEOUT",
      message: "Gemini request timed out after 60 seconds. Please try again.",
    };
  }

  return {
    status:
      statusFromErr && statusFromErr >= 400 && statusFromErr < 600
        ? statusFromErr
        : 500,
    code: `GEMINI_${statusFromErr ?? 500}`,
    message: rawMessage,
  };
}

function buildContents(prompt: string, attachments?: AttachedFile[]): ContentListUnion {
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new GeminiError("TIMEOUT", "Request timed out after 60 seconds.", 504));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function serverGeminiGenerate(
  ai: GoogleGenAI,
  options: GeminiRequestOptions & { stream?: boolean }
): Promise<string> {
  const cleanModel = normalizeModelId(options.model);
  const contents = buildContents(options.prompt, options.attachments);
  const config: Record<string, unknown> = {
    systemInstruction: options.system,
  };

  if (
    typeof options.temperature === "number" &&
    !GEMINI_4_MODEL_RE.test(cleanModel)
  ) {
    config.temperature = options.temperature;
  }

  if (options.schema) {
    config.responseMimeType = "application/json";
    config.responseSchema = options.schema as unknown as Schema;
  }

  const runOnce = async (): Promise<string> => {
    if (options.stream && !options.schema) {
      const stream = await withTimeout(
        ai.models.generateContentStream({
          model: cleanModel,
          contents,
          config,
        }),
        GEMINI_TIMEOUT_MS
      );
      let fullText = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          fullText += chunk.text;
        }
      }
      if (!fullText.trim()) {
        throw new GeminiError(
          "MALFORMED",
          "Received an empty streamed response from Gemini.",
          502
        );
      }
      return fullText;
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: cleanModel,
        contents,
        config,
      }),
      GEMINI_TIMEOUT_MS
    );

    const text = (response.text ?? "").trim();
    if (!text) {
      throw new GeminiError(
        "MALFORMED",
        "Received an empty response from Gemini.",
        502
      );
    }
    return text;
  };

  try {
    return await runOnce();
  } catch (err: unknown) {
    const parsed = parseGeminiSdkError(err);
    if (parsed.code === "RATE_LIMIT") {
      await sleep(RATE_LIMIT_BACKOFF_MS);
      return await runOnce();
    }
    throw new GeminiError(parsed.code, parsed.message, parsed.status);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/gemini/models", async (req, res) => {
    const ai = getAiClient(req);
    if (!ai) {
      res.status(503).json({
        code: "MISSING_KEY",
        error:
          "Gemini API key is not configured. Open Settings > Models to connect your API key.",
      });
      return;
    }

    const defaultModels: GeminiModelOption[] = [
      { id: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash Lite" },
      { id: "gemini-4-hydrogen", displayName: "Gemini 4 Hydrogen" },
      { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
      { id: "gemini-4-argon", displayName: "Gemini 4 Argon" },
    ];

    try {
      const pager = await withTimeout(
        ai.models.list({ config: { pageSize: 100 } }),
        GEMINI_TIMEOUT_MS
      );
      const list: GeminiModelOption[] = [];
      for await (const m of pager) {
        if (!m.name) continue;
        const id = m.name.trim().replace(/^models\//, "");
        if (!id || DEPRECATED_MODEL_RE.test(id)) continue;
        if (
          Array.isArray(m.supportedActions) &&
          m.supportedActions.length > 0 &&
          !m.supportedActions.includes("generateContent")
        ) {
          continue;
        }
        list.push({
          id,
          displayName: m.displayName?.trim() || id,
          description: m.description,
        });
        if (list.length >= 100) break;
      }

      const merged = list.length > 0 ? list : defaultModels;
      for (const dm of defaultModels) {
        if (!merged.some((m) => m.id === dm.id)) {
          merged.push(dm);
        }
      }

      res.json({
        models: merged,
        defaultModel: pickDefaultFlashModel(merged),
      });
    } catch (err: unknown) {
      const parsed = parseGeminiSdkError(err);
      res.status(parsed.status).json({
        code: parsed.code,
        error: parsed.message,
      });
    }
  });

  app.post("/api/gemini/generate", async (req, res) => {
    const ai = getAiClient(req);
    if (!ai) {
      res.status(503).json({
        code: "MISSING_KEY",
        error:
          "Gemini API key is not configured. Open Settings > Models to connect your API key.",
      });
      return;
    }

    const body = (req.body || {}) as {
      model?: string;
      system?: string;
      prompt?: string;
      schema?: Record<string, unknown>;
      temperature?: number;
      attachments?: AttachedFile[];
    };

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const system = typeof body.system === "string" ? body.system : "";
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    try {
      const text = await serverGeminiGenerate(ai, {
        model: normalizeModelId(body.model),
        system,
        prompt,
        schema: body.schema,
        temperature: body.temperature,
        attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
      });
      res.json({ text });
    } catch (err: unknown) {
      const parsed = parseGeminiSdkError(err);
      res.status(parsed.status).json({
        code: parsed.code,
        error: parsed.message,
      });
    }
  });

  app.post("/api/gemini/pipeline", async (req, res) => {
    const ai = getAiClient(req);
    if (!ai) {
      res.status(503).json({
        code: "MISSING_KEY",
        error:
          "Gemini API key is not configured. Open Settings > Models to connect your API key.",
      });
      return;
    }

    const body = (req.body || {}) as {
      prompt?: string;
      model?: string;
      brief?: DesignBrief;
      files?: GeneratedFiles;
      runtimeErrors?: string[];
      attachments?: AttachedFile[];
    };

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await runPipeline(
        prompt,
        {
          model: normalizeModelId(body.model),
          brief: body.brief,
          files: body.files,
          runtimeErrors: Array.isArray(body.runtimeErrors)
            ? body.runtimeErrors
            : undefined,
          attachments: Array.isArray(body.attachments)
            ? body.attachments
            : undefined,
          generateFn: (opts) =>
            serverGeminiGenerate(ai, {
              ...opts,
              stream: !opts.schema,
            }),
        },
        (stage: PipelineStage) => {
          sendEvent("stage", { stage });
        }
      );

      sendEvent("result", result);
      res.end();
    } catch (err: unknown) {
      const parsed = parseGeminiSdkError(err);
      sendEvent("error", {
        code: parsed.code,
        message: parsed.message,
        status: parsed.status,
      });
      res.end();
    }
  });

  app.post("/api/publish", (req, res) => {
    const body = (req.body || {}) as {
      slug?: string;
      title?: string;
      html?: string;
    };
    const html = typeof body.html === "string" ? body.html : "";
    if (!html) {
      res.status(400).json({ error: "Nothing to publish yet." });
      return;
    }
    const slug = sanitizeSlug(body.slug || body.title || "untitled");
    const site: PublishedSite = {
      slug,
      title: (body.title || "Untitled App").slice(0, 80),
      html,
      updatedAt: new Date().toISOString(),
    };
    publishedSites.set(slug, site);
    res.json({
      slug,
      path: `/p/${slug}`,
      updatedAt: site.updatedAt,
    });
  });

  app.get("/p/:slug", (req, res) => {
    const slug = sanitizeSlug(req.params.slug || "");
    const site = publishedSites.get(slug);
    if (!site) {
      res
        .status(404)
        .type("html")
        .send(
          `<!doctype html><html><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#09090b"><div style="text-align:center"><h1 style="font-size:20px;margin:0 0 8px">Site not found</h1><p style="color:#71717a;margin:0">Publish an app from the Emdash workspace to preview it here.</p></div></body></html>`
        );
      return;
    }
    res.type("html").send(site.html);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Emdash server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
