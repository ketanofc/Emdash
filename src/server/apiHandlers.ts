import express from "express";
import { callLLM } from "../lib/llm/router.ts";
import { NoAvailableProviderError, type RouteStage } from "../lib/llm/types.ts";
import { runPipeline } from "../lib/pipeline.ts";
import type { AttachedFile, BuildPlan, DesignBrief, GeneratedFiles, PipelineStage } from "../types.ts";
import { resolveAuthenticatedUser, type ServerContext } from "./adminRouter.ts";

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

  return router;
}
