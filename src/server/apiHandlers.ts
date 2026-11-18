import express from "express";
import { invokeGeminiAdapter, invokeOpenAiAdapter } from "../lib/llm/adapters.ts";
import { redactSecrets } from "../lib/llm/crypto.ts";
import { callLLM } from "../lib/llm/router.ts";
import { AdapterHttpError, NoAvailableProviderError, type RouteStage } from "../lib/llm/types.ts";
import { runPipeline } from "../lib/pipeline.ts";
import type { AttachedFile, BuildPlan, DesignBrief, GeneratedFiles, PipelineStage } from "../types.ts";
import { resolveAuthenticatedUser, type ServerContext } from "./adminRouter.ts";

type WebAgentProvider = "gemini" | "openai" | "anthropic" | "openrouter";

function resolveWebAgentModelId(provider: WebAgentProvider, selectedModel: string): string {
  const clean = selectedModel.trim();
  if (provider === "gemini") {
    if (/^gemini-/i.test(clean)) return clean;
    if (/pro/i.test(clean)) return "gemini-2.5-pro";
    return "gemini-2.5-flash";
  }
  if (provider === "openai") {
    if (/^(gpt-|o[134]-)/i.test(clean)) return clean;
    return "gpt-4o-mini";
  }
  if (provider === "anthropic") {
    if (/^claude-/i.test(clean)) return clean;
    return "claude-sonnet-4-20250514";
  }
  // openrouter
  if (clean.includes("/")) return clean;
  if (/pro/i.test(clean)) return "google/gemini-2.5-pro";
  if (/claude/i.test(clean)) return "anthropic/claude-sonnet-4";
  if (/gpt/i.test(clean)) return "openai/gpt-4o-mini";
  return "google/gemini-2.5-flash";
}

export function createPublicApiRouter(ctx: ServerContext): express.Router {
  const router = express.Router();

  router.get("/wallet", async (req, res) => {
    const config = await ctx.store.getConfig();
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      res.json({
        balance: config.daily_grant,
        dailyGrant: config.daily_grant,
        buildCost: config.costs.build,
        repairCost: config.costs.repair,
        maintenance: config.maintenance,
        signupsEnabled: config.signups_enabled,
        resetTimezone: config.reset_timezone,
        ledger: [],
      });
      return;
    }

    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const wallet = ctx.store.ensureDailyGrant(auth.userId);
    const ledger = ctx.store.getUserLedger(auth.userId, 25);
    res.json({
      balance: wallet.balance,
      dailyGrant: config.daily_grant,
      buildCost: config.costs.build,
      repairCost: config.costs.repair,
      maintenance: config.maintenance,
      signupsEnabled: config.signups_enabled,
      resetTimezone: config.reset_timezone,
      role: auth.profile.role,
      status: auth.profile.status,
      ledger,
    });
  });

  const handlePipelineEndpoint = async (
    req: express.Request,
    res: express.Response,
    isRepairRoute: boolean
  ) => {
    const authHeader = req.headers.authorization || "";
    let userId: string | null = null;
    let country: string | null =
      typeof req.headers["cf-ipcountry"] === "string"
        ? req.headers["cf-ipcountry"]
        : typeof req.headers["x-user-country"] === "string"
          ? req.headers["x-user-country"]
          : null;

    if (authHeader.startsWith("Bearer ")) {
      const auth = await resolveAuthenticatedUser(req, ctx);
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }
      if (auth.profile.status === "suspended") {
        res.status(403).json({ code: "SUSPENDED", error: "Your account is suspended." });
        return;
      }
      userId = auth.userId;
      country = auth.country || country;
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
    if (!prompt && !isRepairRoute) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const config = await ctx.store.getConfig();
    if (config.maintenance) {
      res.status(503).json({
        code: "HIGH_DEMAND",
        error: "High demand right now, please try again later",
      });
      return;
    }

    const coinCost = isRepairRoute ? config.costs.repair : config.costs.build;
    let jobId: string | null = null;
    let walletBalance: number | undefined;

    if (userId) {
      const job = ctx.store.createJob(userId, isRepairRoute ? "repair" : "build", coinCost);
      jobId = job.id;
      try {
        walletBalance = ctx.store.spendCoins(
          userId,
          coinCost,
          isRepairRoute ? "repair_job" : "build_job",
          jobId
        );
      } catch (err) {
        ctx.store.completeJob(jobId, "failed", "Insufficient Dash Coins");
        if (err instanceof Error && err.message === "INSUFFICIENT_COINS") {
          res.status(402).json({
            code: "INSUFFICIENT_COINS",
            error: "Insufficient Dash Coins for this build.",
          });
          return;
        }
        res.status(500).json({ error: "Failed to process Dash Coins." });
        return;
      }
    }

    const wantsStream = (req.headers.accept || "").includes("text/event-stream");
    const abortController = new AbortController();
    req.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const executeRun = async (onStage?: (stage: PipelineStage) => void) => {
      try {
        const result = await runPipeline(
          prompt || "Fix runtime errors",
          {
            model: body.model || "router",
            brief: body.brief,
            files: body.files,
            runtimeErrors: Array.isArray(body.runtimeErrors) ? body.runtimeErrors : undefined,
            attachments: Array.isArray(body.attachments) ? body.attachments : undefined,
            generateFn: async (opts) => {
              const out = await callLLM(
                {
                  stage: (opts.stage ?? (isRepairRoute ? "repair" : "build")) as RouteStage,
                  system: opts.system,
                  prompt: opts.prompt,
                  schema: opts.schema,
                  attachments: opts.attachments,
                  userId,
                  jobId,
                  country,
                  signal: abortController.signal,
                },
                {
                  store: ctx.store,
                  keyring: ctx.keyring,
                  fetchFn: ctx.fetchFn,
                }
              );
              return out.text;
            },
          },
          onStage
        );

        if (jobId) {
          ctx.store.completeJob(jobId, "completed");
        }
        return { ...result, walletBalance };
      } catch (err) {
        if (userId && jobId && coinCost > 0) {
          walletBalance = ctx.store.refundCoins(
            userId,
            coinCost,
            isRepairRoute ? "repair_refund" : "build_refund",
            jobId
          );
        } else if (jobId) {
          ctx.store.completeJob(
            jobId,
            "failed",
            err instanceof Error ? err.message.slice(0, 200) : "Build failed"
          );
        }
        throw err;
      }
    };

    if (!wantsStream) {
      try {
        const result = await executeRun();
        res.json(result);
      } catch (err) {
        const message =
          err instanceof NoAvailableProviderError
            ? err.message
            : "High demand right now, please try again later";
        res.status(503).json({ code: "HIGH_DEMAND", error: message });
      }
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
      const result = await executeRun((stage) => sendEvent("stage", { stage }));
      sendEvent("result", result);
      res.end();
    } catch (err) {
      const message =
        err instanceof NoAvailableProviderError
          ? err.message
          : "High demand right now, please try again later";
      sendEvent("error", {
        code: "HIGH_DEMAND",
        message,
        status: 503,
      });
      res.end();
    }
  };

  router.post("/generate", (req, res) => void handlePipelineEndpoint(req, res, false));
  router.post("/gemini/pipeline", (req, res) => void handlePipelineEndpoint(req, res, false));
  router.post("/repair", (req, res) => void handlePipelineEndpoint(req, res, true));

  router.post("/web-agent/chat", async (req, res) => {
    const body = (req.body || {}) as {
      provider?: string;
      apiKey?: string;
      model?: string;
      mode?: "build" | "plan";
      prompt?: string;
      history?: Array<{ role: "user" | "assistant"; text: string }>;
      projectName?: string;
      branch?: string;
    };

    const rawProvider = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "gemini";
    const provider: WebAgentProvider =
      rawProvider === "openai" || rawProvider === "anthropic" || rawProvider === "openrouter"
        ? rawProvider
        : "gemini";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode === "plan" ? "plan" : "build";
    const selectedModel = typeof body.model === "string" ? body.model : "Gemini Flash";

    if (!apiKey) {
      res.status(400).json({ code: "MISSING_KEY", error: "Please enter your API key in Settings to run the agent." });
      return;
    }
    if (!prompt) {
      res.status(400).json({ code: "MISSING_PROMPT", error: "Prompt is required." });
      return;
    }

    const modelId = resolveWebAgentModelId(provider, selectedModel);
    const repoContext = body.projectName
      ? `Active repository: ${body.projectName} (branch: ${body.branch || "main"}).`
      : "No repository connected yet (standalone web agent session).";

    const system =
      mode === "plan"
        ? `You are Emdash Web Agent in PLAN mode. ${repoContext} Provide a concise, structured technical plan with clear files, architecture decisions, and actionable steps.`
        : `You are Emdash Web Agent in BUILD mode. ${repoContext} Deliver concise, production-ready engineering guidance, exact code snippets, and concrete implementation steps.`;

    const historyBlock = Array.isArray(body.history) && body.history.length > 0
      ? body.history
          .slice(-8)
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.text || "").slice(0, 3000)}`)
          .join("\n\n")
      : "";

    const composedPrompt = historyBlock
      ? `Previous conversation:\n${historyBlock}\n\nCurrent request:\n${prompt}`
      : prompt;

    const abortController = new AbortController();
    req.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const fetchImpl = ctx.fetchFn ?? fetch;

    try {
      if (provider === "gemini") {
        const out = await invokeGeminiAdapter({
          protocol: "gemini",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
          slug: "byok-gemini",
          apiKey,
          modelId,
          system,
          prompt: composedPrompt,
          maxOutputTokens: 2048,
          signal: abortController.signal,
          fetchFn: fetchImpl,
        });
        res.json({ text: out.text, modelId, provider, tokens: out.tokens });
        return;
      }

      if (provider === "anthropic") {
        const anthropicRes = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 2048,
            system,
            messages: [{ role: "user", content: composedPrompt }],
          }),
          signal: abortController.signal,
        });

        if (!anthropicRes.ok) {
          const errText = await anthropicRes.text().catch(() => "");
          const status = anthropicRes.status;
          const code = status === 401 || status === 403 ? "INVALID_KEY" : status === 429 ? "RATE_LIMIT" : `HTTP_${status}`;
          res.status(status >= 400 && status < 600 ? status : 502).json({
            code,
            error: String(redactSecrets(`Anthropic returned HTTP ${status}${errText ? `: ${errText.slice(0, 200)}` : ""}`)),
          });
          return;
        }

        const data = (await anthropicRes.json()) as {
          content?: Array<{ type?: string; text?: string }>;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text = (data.content ?? [])
          .filter((c) => c.type === "text" && typeof c.text === "string")
          .map((c) => c.text)
          .join("\n")
          .trim();

        if (!text) {
          res.status(502).json({ code: "EMPTY_RESPONSE", error: "Anthropic returned an empty response." });
          return;
        }

        const inputTokens = data.usage?.input_tokens ?? 0;
        const outputTokens = data.usage?.output_tokens ?? 0;
        res.json({
          text,
          modelId,
          provider,
          tokens: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        });
        return;
      }

      const out = await invokeOpenAiAdapter({
        protocol: "openai",
        baseUrl: provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
        slug: provider === "openrouter" ? "byok-openrouter" : "byok-openai",
        apiKey,
        modelId,
        system,
        prompt: composedPrompt,
        maxOutputTokens: 2048,
        signal: abortController.signal,
        fetchFn: fetchImpl,
      });
      res.json({ text: out.text, modelId, provider, tokens: out.tokens });
    } catch (err) {
      if (err instanceof AdapterHttpError) {
        res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
          code: err.errorCode,
          error: String(redactSecrets(err.message)),
        });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to run agent request.";
      res.status(500).json({ code: "AGENT_ERROR", error: String(redactSecrets(message)) });
    }
  });

  return router;
}
