import { authenticateRequest } from "../_shared/auth.ts";
import { buildCorsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import { NoAvailableProviderError } from "../_shared/llm.ts";
import { runEdgePipeline, type DesignBrief, type GeneratedFiles } from "../_shared/pipeline.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return jsonResponse(req, { error: auth.message }, auth.status);
  }

  const { supabaseAdmin, userId, status, country } = auth.ctx;
  if (status === "suspended") {
    return jsonResponse(req, { code: "SUSPENDED", error: "Your account is suspended." }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string;
    brief?: DesignBrief;
    files?: GeneratedFiles;
    runtimeErrors?: string[];
  };

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return jsonResponse(req, { error: "Prompt is required." }, 400);
  }

  const { data: config } = await supabaseAdmin.from("app_config").select("*").eq("id", 1).single();
  if (config?.maintenance) {
    return jsonResponse(
      req,
      { code: "HIGH_DEMAND", error: "High demand right now, please try again later" },
      503
    );
  }

  const buildCost = Number(config?.costs?.build ?? 10);
  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .insert({ user_id: userId, stage: "build", status: "running", coin_cost: buildCost })
    .select("*")
    .single();

  if (jobErr || !job) {
    return jsonResponse(req, { error: "Failed to initialize build job." }, 500);
  }

  let newBalance = 0;
  try {
    const { data: bal, error: spendErr } = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: buildCost,
      p_reason: "build_job",
      p_job_id: job.id,
    });
    if (spendErr) {
      throw spendErr;
    }
    newBalance = Number(bal ?? 0);
  } catch (err) {
    await supabaseAdmin.from("jobs").update({ status: "failed", error_message: "Insufficient coins" }).eq("id", job.id);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("INSUFFICIENT_COINS")) {
      return jsonResponse(req, { code: "INSUFFICIENT_COINS", error: "Insufficient Dash Coins for this build." }, 402);
    }
    return jsonResponse(req, { error: "Failed to charge Dash Coins." }, 500);
  }

  const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream");

  const runAndRefundOnFail = async (onStage?: (stage: string) => void) => {
    try {
      const result = await runEdgePipeline({
        supabaseAdmin,
        userId,
        jobId: job.id,
        country,
        prompt,
        brief: body.brief,
        files: body.files,
        runtimeErrors: Array.isArray(body.runtimeErrors) ? body.runtimeErrors : undefined,
        onStage,
      });

      await supabaseAdmin
        .from("jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);

      return { ...result, walletBalance: newBalance };
    } catch (err) {
      // Idempotent single coin refund on build failure
      await supabaseAdmin.rpc("refund_coins", {
        p_user_id: userId,
        p_amount: buildCost,
        p_reason: "build_refund",
        p_job_id: job.id,
      });
      await supabaseAdmin
        .from("jobs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message.slice(0, 200) : "Build failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      throw err;
    }
  };

  if (!wantsStream) {
    try {
      const result = await runAndRefundOnFail();
      return jsonResponse(req, result, 200);
    } catch (err) {
      if (err instanceof NoAvailableProviderError) {
        return jsonResponse(req, { code: "HIGH_DEMAND", error: err.message }, 503);
      }
      return jsonResponse(
        req,
        { code: "HIGH_DEMAND", error: "High demand right now, please try again later" },
        503
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await runAndRefundOnFail((stage) => send("stage", { stage }));
        send("result", result);
      } catch (err) {
        const msg =
          err instanceof NoAvailableProviderError
            ? err.message
            : "High demand right now, please try again later";
        send("error", { code: "HIGH_DEMAND", message: msg, status: 503 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...buildCorsHeaders(req),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
});
