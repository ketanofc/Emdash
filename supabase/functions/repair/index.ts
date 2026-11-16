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

  if (!body.brief || !body.files || !Array.isArray(body.runtimeErrors)) {
    return jsonResponse(req, { error: "brief, files, and runtimeErrors are required." }, 400);
  }

  const { data: config } = await supabaseAdmin.from("app_config").select("*").eq("id", 1).single();
  if (config?.maintenance) {
    return jsonResponse(
      req,
      { code: "HIGH_DEMAND", error: "High demand right now, please try again later" },
      503
    );
  }

  const repairCost = Number(config?.costs?.repair ?? 0);
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .insert({ user_id: userId, stage: "repair", status: "running", coin_cost: repairCost })
    .select("*")
    .single();

  if (!job) {
    return jsonResponse(req, { error: "Failed to initialize repair job." }, 500);
  }

  if (repairCost > 0) {
    const { error: spendErr } = await supabaseAdmin.rpc("spend_coins", {
      p_user_id: userId,
      p_amount: repairCost,
      p_reason: "repair_job",
      p_job_id: job.id,
    });
    if (spendErr) {
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      return jsonResponse(req, { code: "INSUFFICIENT_COINS", error: "Insufficient Dash Coins." }, 402);
    }
  }

  const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream");
  const executeRepair = async (onStage?: (s: string) => void) => {
    try {
      const result = await runEdgePipeline({
        supabaseAdmin,
        userId,
        jobId: job.id,
        country,
        prompt: body.prompt || "Fix runtime errors",
        brief: body.brief,
        files: body.files,
        runtimeErrors: body.runtimeErrors,
        onStage,
      });
      await supabaseAdmin
        .from("jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);
      return result;
    } catch (err) {
      if (repairCost > 0) {
        await supabaseAdmin.rpc("refund_coins", {
          p_user_id: userId,
          p_amount: repairCost,
          p_reason: "repair_refund",
          p_job_id: job.id,
        });
      }
      await supabaseAdmin.from("jobs").update({ status: "failed" }).eq("id", job.id);
      throw err;
    }
  };

  if (!wantsStream) {
    try {
      const result = await executeRepair();
      return jsonResponse(req, result, 200);
    } catch (err) {
      const msg =
        err instanceof NoAvailableProviderError
          ? err.message
          : "High demand right now, please try again later";
      return jsonResponse(req, { code: "HIGH_DEMAND", error: msg }, 503);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await executeRepair((stage) => send("stage", { stage }));
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
