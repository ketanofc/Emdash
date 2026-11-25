import express from "express";
import { invokeGeminiAdapter, invokeOpenAiAdapter } from "../lib/llm/adapters.ts";
import { redactSecrets } from "../lib/llm/crypto.ts";
import { callLLM } from "../lib/llm/router.ts";
import { AdapterHttpError, NoAvailableProviderError, type RouteStage } from "../lib/llm/types.ts";
import { runPipeline } from "../lib/pipeline.ts";
import { getRepoFileContent, getRepoTree, GitHubApiError } from "../lib/github/api.ts";
import {
  buildRepoAgentSystemPrompt,
  isExplicitDeleteRequested,
  parseAgentStructuredResponse,
  selectContextFiles,
  validateAndBuildDiffs,
} from "../lib/github/agent.ts";
import type { AttachedFile, BuildPlan, DesignBrief, GeneratedFiles, PipelineStage } from "../types.ts";
import { getSupabaseAdmin, resolveAuthenticatedUser, type ServerContext } from "./adminRouter.ts";
import { getDecryptedGitHubTokenForUser } from "./githubRouter.ts";

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

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        let { data: sbWallet } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("user_id", auth.userId)
          .maybeSingle();

        if (!sbWallet) {
          const { data: inserted } = await supabaseAdmin
            .from("wallets")
            .insert({
              user_id: auth.userId,
              balance: config.daily_grant,
              last_grant_at: new Date().toISOString(),
            })
            .select("*")
            .single();
          sbWallet = inserted;
        }

        const { data: sbLedger } = await supabaseAdmin
          .from("coin_ledger")
          .select("id, delta, balance_after, reason, created_at")
          .eq("user_id", auth.userId)
          .order("created_at", { ascending: false })
          .limit(25);

        res.json({
          balance: Number(sbWallet?.balance ?? config.daily_grant),
          dailyGrant: config.daily_grant,
          buildCost: config.costs.build,
          repairCost: config.costs.repair,
          maintenance: config.maintenance,
          signupsEnabled: config.signups_enabled,
          resetTimezone: config.reset_timezone,
          role: auth.profile.role,
          status: auth.profile.status,
          ledger: sbLedger ?? [],
        });
        return;
      } catch (err) {
        console.warn("[emdash] Supabase wallet query failed, using local store:", err);
      }
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

  // Strictly authenticated user dashboard endpoint (zero-trust, user-scoped)
  router.get("/dashboard", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    if (auth.profile.status === "suspended") {
      res.status(403).json({ error: "Account is suspended." });
      return;
    }

    const config = await ctx.store.getConfig();
    const supabaseAdmin = getSupabaseAdmin();

    if (supabaseAdmin) {
      try {
        const [{ data: sbWallet }, { data: sbLedger }, { data: sbJobs }, { data: sbGh }, { data: sbSessions }] =
          await Promise.all([
            supabaseAdmin.from("wallets").select("*").eq("user_id", auth.userId).maybeSingle(),
            supabaseAdmin
              .from("coin_ledger")
              .select("id, delta, balance_after, reason, created_at")
              .eq("user_id", auth.userId)
              .order("created_at", { ascending: false })
              .limit(20),
            supabaseAdmin
              .from("jobs")
              .select("id, stage, status, coin_cost, refunded, created_at, completed_at")
              .eq("user_id", auth.userId)
              .order("created_at", { ascending: false })
              .limit(15),
            supabaseAdmin
              .from("github_connections")
              .select("github_user_id, username, avatar_url, scope, connected_at")
              .eq("user_id", auth.userId)
              .maybeSingle(),
            supabaseAdmin
              .from("github_agent_sessions")
              .select("id, repo_owner, repo_name, base_branch, working_branch, pr_url, pr_number, status, updated_at")
              .eq("user_id", auth.userId)
              .order("updated_at", { ascending: false })
              .limit(10),
          ]);

        res.json({
          profile: {
            id: auth.profile.user_id,
            email: auth.profile.email,
            name: auth.profile.name,
            role: auth.profile.role,
            status: auth.profile.status,
            country: auth.country,
            createdAt: auth.profile.created_at,
            lastSeenAt: auth.profile.last_seen_at,
          },
          wallet: {
            balance: Number(sbWallet?.balance ?? config.daily_grant),
            dailyGrant: config.daily_grant,
            buildCost: config.costs.build,
            repairCost: config.costs.repair,
            resetTimezone: config.reset_timezone,
            ledger: sbLedger ?? [],
          },
          jobs: sbJobs ?? [],
          github: sbGh
            ? {
                connected: true,
                username: sbGh.username,
                avatarUrl: sbGh.avatar_url || "",
                scope: sbGh.scope,
                connectedAt: sbGh.connected_at,
              }
            : { connected: false, username: null, avatarUrl: null },
          githubSessions: sbSessions ?? [],
        });
        return;
      } catch {
        // fallback to local store
      }
    }

    const wallet = ctx.store.ensureDailyGrant(auth.userId);
    const ledger = ctx.store.getUserLedger(auth.userId, 20);
    const jobs = ctx.store.getUserJobs(auth.userId).slice(0, 15);
    const localGh = ctx.store.getGitHubConnection(auth.userId);

    res.json({
      profile: {
        id: auth.profile.user_id,
        email: auth.profile.email,
        name: auth.profile.name,
        role: auth.profile.role,
        status: auth.profile.status,
        country: auth.country,
        createdAt: auth.profile.created_at,
        lastSeenAt: auth.profile.last_seen_at,
      },
      wallet: {
        balance: wallet.balance,
        dailyGrant: config.daily_grant,
        buildCost: config.costs.build,
        repairCost: config.costs.repair,
        resetTimezone: config.reset_timezone,
        ledger,
      },
      jobs,
      github: localGh
        ? {
            connected: true,
            username: localGh.username,
            avatarUrl: localGh.avatar_url || "",
            scope: localGh.scope,
            connectedAt: localGh.connected_at,
          }
        : { connected: false, username: null, avatarUrl: null },
      githubSessions: [],
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
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin && coinCost > 0) {
        try {
          const { data: newBal, error: rpcErr } = await supabaseAdmin.rpc("spend_coins", {
            p_user_id: userId,
            p_amount: coinCost,
            p_reason: isRepairRoute ? "repair_job" : "build_job",
            p_job_id: jobId,
          });
          if (rpcErr) {
            ctx.store.completeJob(jobId, "failed", "Insufficient Dash Coins");
            res.status(402).json({
              code: "INSUFFICIENT_COINS",
              error: "Insufficient Dash Coins for this build.",
            });
            return;
          }
          walletBalance = typeof newBal === "number" ? newBal : undefined;
        } catch {
          // fallback to store
        }
      }
      if (walletBalance === undefined) {
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
          const supabaseAdmin = getSupabaseAdmin();
          if (supabaseAdmin) {
            try {
              await supabaseAdmin.rpc("refund_coins", {
                p_user_id: userId,
                p_amount: coinCost,
                p_reason: isRepairRoute ? "repair_refund" : "build_refund",
                p_job_id: jobId,
              });
            } catch {
              // ignore Supabase refund error and fall back to local store
            }
          }
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
      repoOwner?: string;
      repoName?: string;
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

    const fetchImpl = ctx.fetchFn ?? fetch;
    const repoOwner = typeof body.repoOwner === "string" ? body.repoOwner.trim() : "";
    const repoName = typeof body.repoName === "string" ? body.repoName.trim() : "";
    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
    const hasRepo = Boolean(repoOwner && repoName);

    let githubToken: string | null = null;
    let inspectedFiles: string[] = [];
    const existingFilesCache = new Map<string, string>();
    let system: string;

    if (hasRepo) {
      const auth = await resolveAuthenticatedUser(req, ctx);
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({
          code: "GITHUB_NOT_CONNECTED",
          error: "Connect your GitHub account before running repository tasks.",
        });
        return;
      }
      githubToken = conn.token;

      try {
        const tree = await getRepoTree(githubToken, repoOwner, repoName, branch, fetchImpl);
        const contextPaths = selectContextFiles(tree, prompt, 10);
        const fileContexts: Array<{ path: string; content: string }> = [];

        for (const p of contextPaths) {
          try {
            const f = await getRepoFileContent(githubToken, repoOwner, repoName, p, branch, fetchImpl);
            fileContexts.push({ path: f.path, content: f.content });
            existingFilesCache.set(f.path, f.content);
            inspectedFiles.push(f.path);
          } catch {
            // skip unreadable file
          }
        }

        system = buildRepoAgentSystemPrompt({
          owner: repoOwner,
          repo: repoName,
          branch,
          mode,
          treePaths: tree.filter((t) => t.type === "blob").map((t) => t.path),
          fileContexts,
        });
      } catch (err) {
        if (err instanceof GitHubApiError) {
          res.status(err.status).json({ code: err.code, error: err.message });
          return;
        }
        throw err;
      }
    } else {
      const repoContext = body.projectName
        ? `Active repository: ${body.projectName} (branch: ${branch}).`
        : "No repository connected yet (standalone web agent session).";

      system =
        mode === "plan"
          ? `You are Emdash Web Agent in PLAN mode. ${repoContext} Provide a concise, structured technical plan with clear files, architecture decisions, and actionable steps.`
          : `You are Emdash Web Agent in BUILD mode. ${repoContext} Deliver concise, production-ready engineering guidance, exact code snippets, and concrete implementation steps.`;
    }

    const modelId = resolveWebAgentModelId(provider, selectedModel);
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

    const maxTokens = hasRepo && mode === "build" ? 8192 : 2048;

    const finalizeResponse = async (rawText: string, tokens: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
      if (!hasRepo || mode === "plan" || !githubToken) {
        res.json({ text: rawText, modelId, provider, tokens, inspectedFiles });
        return;
      }

      const parsed = parseAgentStructuredResponse(rawText, prompt);
      const { operations, diffs } = await validateAndBuildDiffs({
        token: githubToken,
        owner: repoOwner,
        repo: repoName,
        baseBranch: branch,
        operations: parsed.operations,
        existingFilesCache,
        explicitDeleteAllowed: isExplicitDeleteRequested(prompt),
        fetchFn: fetchImpl,
      });

      res.json({
        text: parsed.summary,
        modelId,
        provider,
        tokens,
        inspectedFiles,
        operations,
        diffs,
        suggestedBranch: parsed.suggestedBranch,
        suggestedCommitMessage: parsed.commitMessage,
        suggestedPrTitle: parsed.prTitle,
        suggestedPrBody: parsed.prBody,
      });
    };

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
          maxOutputTokens: maxTokens,
          signal: abortController.signal,
          fetchFn: fetchImpl,
        });
        await finalizeResponse(out.text, out.tokens);
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
            max_tokens: maxTokens,
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
        await finalizeResponse(text, { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens });
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
        maxOutputTokens: maxTokens,
        signal: abortController.signal,
        fetchFn: fetchImpl,
      });
      await finalizeResponse(out.text, out.tokens);
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
