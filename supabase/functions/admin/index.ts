import { requireAdminAal2 } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";
import {
  decryptApiKey,
  encryptApiKey,
  getMasterKeyringFromEnv,
  redactSecrets,
} from "../_shared/crypto.ts";

function extractAdminPath(urlStr: string): string {
  const url = new URL(urlStr);
  const parts = url.pathname.split("/").filter(Boolean);
  const adminIdx = parts.lastIndexOf("admin");
  const sub = adminIdx >= 0 ? parts.slice(adminIdx + 1) : parts;
  return "/" + sub.join("/");
}

function sanitizeProviderRow(row: Record<string, unknown>) {
  const { api_key_enc: _omit, ...rest } = row;
  return rest;
}

async function writeAuditLog(params: {
  supabaseAdmin: any;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  ip: string;
}) {
  await params.supabaseAdmin.from("audit_log").insert({
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    before: params.before === undefined ? null : redactSecrets(params.before),
    after: params.after === undefined ? null : redactSecrets(params.after),
    ip: params.ip,
  });
}

async function runProviderConnectionTest(provider: {
  protocol: string;
  base_url: string;
  slug: string;
  apiKey: string;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    if (provider.protocol === "gemini") {
      const base = (provider.base_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
      const res = await fetch(`${base}/models?pageSize=50`, {
        method: "GET",
        headers: { "x-goog-api-key": provider.apiKey },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, status: res.status, message: `Gemini test returned HTTP ${res.status}`, models: [] };
      }
      const data = await res.json();
      const models = (data.models ?? [])
        .map((m: { name?: string; displayName?: string }) => ({
          model_id: (m.name || "").replace(/^models\//, ""),
          label: m.displayName || (m.name || "").replace(/^models\//, ""),
        }))
        .filter((m: { model_id: string }) => m.model_id);
      return { ok: true, status: res.status, message: `Connected (${models.length} models)`, models };
    }

    const base = (provider.base_url || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${provider.apiKey}`,
    };
    if (base.includes("openrouter.ai") || provider.slug.includes("openrouter")) {
      headers["X-Title"] = "Emdash";
    }
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, message: `Provider returned HTTP ${res.status}`, models: [] };
    }
    const data = await res.json();
    const models = (data.data ?? [])
      .slice(0, 100)
      .map((m: { id?: string; name?: string }) => ({
        model_id: m.id || "",
        label: m.name || m.id || "",
      }))
      .filter((m: { model_id: string }) => m.model_id);
    return { ok: true, status: res.status, message: `Connected (${models.length} models)`, models };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const auth = await requireAdminAal2(req);
  if (!auth.ok) {
    return jsonResponse(req, { error: auth.message }, auth.status);
  }

  const { supabaseAdmin, userId: actorId, ip } = auth.ctx;
  const subPath = extractAdminPath(req.url);
  const url = new URL(req.url);

  // 1. OVERVIEW
  if (req.method === "GET" && subPath === "/overview") {
    const rangeParam = url.searchParams.get("range") || "7d";
    const days = rangeParam === "1d" ? 1 : rangeParam === "30d" ? 30 : 7;

    const utcToday = new Date();
    utcToday.setUTCHours(0, 0, 0, 0);
    const todayIso = utcToday.toISOString();

    const [
      { data: callsTodayRows },
      { data: daySeries },
      { data: providerUsage },
      { data: providers },
      { data: healthRows },
      { data: ledgerSpend },
      { data: config },
    ] = await Promise.all([
      supabaseAdmin
        .from("llm_calls")
        .select("user_id, status, total_tokens")
        .gte("created_at", todayIso),
      supabaseAdmin.rpc("get_usage_by_day", { p_days: days }),
      supabaseAdmin.rpc("get_usage_by_provider", { p_days: 1 }),
      supabaseAdmin.from("providers").select("id, name, slug, protocol, enabled, rpm_limit, rpd_limit, daily_token_limit, key_last4"),
      supabaseAdmin.from("provider_health").select("*"),
      supabaseAdmin
        .from("coin_ledger")
        .select("delta")
        .lt("delta", 0)
        .gte("created_at", todayIso),
      supabaseAdmin.from("app_config").select("*").eq("id", 1).single(),
    ]);

    const callsToday = (callsTodayRows ?? []).filter((r: any) => r.status !== "skipped");
    const callsCount = callsToday.length;
    const errorsCount = callsToday.filter((r: any) => r.status === "error").length;
    const rateLimitedCount = callsToday.filter((r: any) => r.status === "rate_limited").length;
    const tokensToday = callsToday.reduce((sum: number, r: any) => sum + Number(r.total_tokens || 0), 0);
    const activeUsers = new Set(callsToday.map((r: any) => r.user_id).filter(Boolean)).size;
    const coinsSpent = (ledgerSpend ?? []).reduce((sum: number, r: any) => sum + Math.abs(Number(r.delta || 0)), 0);

    const healthMap = new Map((healthRows ?? []).map((h: any) => [h.provider_id, h]));
    const usageMap = new Map((providerUsage ?? []).map((u: any) => [u.provider_id, u]));
    const threshold = Number(config?.high_demand_threshold ?? 0.8);

    const alerts: Array<{ level: "error" | "warn"; providerId?: string; message: string }> = [];
    const perProvider = (providers ?? []).map((p: any) => {
      const h: any = healthMap.get(p.id);
      const u: any = usageMap.get(p.id) ?? { calls: 0, errors: 0, rate_limited: 0, total_tokens: 0 };
      const inCooldown = Boolean(h?.cooldown_until && Date.parse(h.cooldown_until) > Date.now());
      if (h?.key_invalid) {
        alerts.push({ level: "error", providerId: p.id, message: `${p.name}: API key invalid (401/403)` });
      } else if (inCooldown) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: Provider on cooldown until ${h.cooldown_until}` });
      }
      if (p.rpd_limit && Number(u.calls) >= p.rpd_limit * threshold) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: Reached ${Math.round((Number(u.calls) / p.rpd_limit) * 100)}% of daily call limit` });
      }
      if (p.daily_token_limit && Number(u.total_tokens) >= p.daily_token_limit * threshold) {
        alerts.push({ level: "warn", providerId: p.id, message: `${p.name}: Reached ${Math.round((Number(u.total_tokens) / p.daily_token_limit) * 100)}% of daily token limit` });
      }
      return {
        ...p,
        callsToday: Number(u.calls || 0),
        errorsToday: Number(u.errors || 0),
        rateLimitedToday: Number(u.rate_limited || 0),
        tokensToday: Number(u.total_tokens || 0),
        health: h ?? null,
      };
    });

    return jsonResponse(req, {
      callsToday: callsCount,
      tokensToday,
      errorRate: callsCount > 0 ? errorsCount / callsCount : 0,
      errorsToday: errorsCount,
      rateLimitedToday: rateLimitedCount,
      activeUsers,
      coinsSpent,
      dailySeries: daySeries ?? [],
      perProvider,
      alerts,
    });
  }

  // 2. PROVIDERS
  if (req.method === "GET" && subPath === "/providers") {
    const [{ data: providers }, { data: healthRows }, { data: usageRows }] = await Promise.all([
      supabaseAdmin.from("providers").select("*").order("priority", { ascending: true }),
      supabaseAdmin.from("provider_health").select("*"),
      supabaseAdmin.rpc("get_usage_by_provider", { p_days: 1 }),
    ]);
    const hMap = new Map((healthRows ?? []).map((h: any) => [h.provider_id, h]));
    const uMap = new Map((usageRows ?? []).map((u: any) => [u.provider_id, u]));
    return jsonResponse(req, {
      providers: (providers ?? []).map((p: any) => ({
        ...sanitizeProviderRow(p),
        health: hMap.get(p.id) ?? null,
        usageToday: uMap.get(p.id) ?? { calls: 0, errors: 0, rate_limited: 0, total_tokens: 0 },
      })),
    });
  }

  if (req.method === "POST" && subPath === "/providers") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
    if (!apiKey || !body.name || !body.slug || !body.protocol || !body.base_url) {
      return jsonResponse(req, { error: "name, slug, protocol, base_url, and api_key are required." }, 400);
    }
    const masterSecret = Deno.env.get("KEY_ENCRYPTION_SECRET") || "";
    const enc = await encryptApiKey(apiKey, masterSecret, 1);

    const { data: created, error } = await supabaseAdmin
      .from("providers")
      .insert({
        name: String(body.name).trim(),
        slug: String(body.slug).trim().toLowerCase(),
        protocol: body.protocol === "gemini" ? "gemini" : "openai",
        base_url: String(body.base_url).trim(),
        api_key_enc: enc.encryptedHex,
        key_last4: enc.keyLast4,
        key_version: enc.keyVersion,
        enabled: body.enabled !== false,
        priority: Number(body.priority ?? 100),
        rpm_limit: body.rpm_limit ? Number(body.rpm_limit) : null,
        rpd_limit: body.rpd_limit ? Number(body.rpd_limit) : null,
        daily_token_limit: body.daily_token_limit ? Number(body.daily_token_limit) : null,
        blocked_regions: Array.isArray(body.blocked_regions) ? body.blocked_regions : [],
        supports_json_schema: Boolean(body.supports_json_schema),
      })
      .select("*")
      .single();

    if (error || !created) {
      return jsonResponse(req, { error: error?.message || "Failed to create provider." }, 400);
    }

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "provider.create",
      targetType: "provider",
      targetId: created.id,
      before: null,
      after: sanitizeProviderRow(created),
      ip,
    });

    return jsonResponse(req, { provider: sanitizeProviderRow(created) }, 201);
  }

  const providerMatch = subPath.match(/^\/providers\/([^/]+)$/);
  if (providerMatch && req.method === "PATCH") {
    const id = providerMatch[1];
    const { data: before } = await supabaseAdmin.from("providers").select("*").eq("id", id).single();
    if (!before) return jsonResponse(req, { error: "Provider not found." }, 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      "name",
      "base_url",
      "enabled",
      "priority",
      "rpm_limit",
      "rpd_limit",
      "daily_token_limit",
      "blocked_regions",
      "supports_json_schema",
    ]) {
      if (key in body) updates[key] = body[key];
    }

    const { data: updated, error } = await supabaseAdmin
      .from("providers")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !updated) {
      return jsonResponse(req, { error: error?.message || "Update failed." }, 400);
    }

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "provider.update",
      targetType: "provider",
      targetId: id,
      before: sanitizeProviderRow(before),
      after: sanitizeProviderRow(updated),
      ip,
    });

    return jsonResponse(req, { provider: sanitizeProviderRow(updated) });
  }

  if (providerMatch && req.method === "DELETE") {
    const id = providerMatch[1];
    const { data: before } = await supabaseAdmin.from("providers").select("*").eq("id", id).single();
    if (!before) return jsonResponse(req, { error: "Provider not found." }, 404);

    await supabaseAdmin.from("providers").delete().eq("id", id);
    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "provider.delete",
      targetType: "provider",
      targetId: id,
      before: sanitizeProviderRow(before),
      after: null,
      ip,
    });
    return jsonResponse(req, { ok: true });
  }

  const rotateMatch = subPath.match(/^\/providers\/([^/]+)\/rotate-key$/);
  if (rotateMatch && req.method === "POST") {
    const id = rotateMatch[1];
    const body = (await req.json().catch(() => ({}))) as { api_key?: string };
    const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
    if (!apiKey) return jsonResponse(req, { error: "api_key is required." }, 400);

    const { data: before } = await supabaseAdmin.from("providers").select("*").eq("id", id).single();
    if (!before) return jsonResponse(req, { error: "Provider not found." }, 404);

    const nextVer = Number(before.key_version ?? 1) + 1;
    const enc = await encryptApiKey(apiKey, Deno.env.get("KEY_ENCRYPTION_SECRET") || "", nextVer);
    const { data: updated } = await supabaseAdmin
      .from("providers")
      .update({
        api_key_enc: enc.encryptedHex,
        key_last4: enc.keyLast4,
        key_version: enc.keyVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    await supabaseAdmin.from("provider_health").upsert({
      provider_id: id,
      cooldown_until: null,
      consecutive_failures: 0,
      last_error: null,
      key_invalid: false,
      updated_at: new Date().toISOString(),
    });

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "provider.rotate_key",
      targetType: "provider",
      targetId: id,
      before: { key_last4: before.key_last4, key_version: before.key_version },
      after: { key_last4: enc.keyLast4, key_version: enc.keyVersion },
      ip,
    });

    return jsonResponse(req, { provider: sanitizeProviderRow(updated) });
  }

  const testMatch = subPath.match(/^\/providers\/([^/]+)\/test$/);
  if (testMatch && req.method === "POST") {
    const id = testMatch[1];
    const body = (await req.json().catch(() => ({}))) as { saveModels?: boolean };
    const { data: provider } = await supabaseAdmin.from("providers").select("*").eq("id", id).single();
    if (!provider) return jsonResponse(req, { error: "Provider not found." }, 404);

    const { plaintext } = await decryptApiKey(provider.api_key_enc, getMasterKeyringFromEnv());
    const result = await runProviderConnectionTest({
      protocol: provider.protocol,
      base_url: provider.base_url,
      slug: provider.slug,
      apiKey: plaintext,
    });

    await supabaseAdmin
      .from("providers")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: result.ok ? "ok" : `error_${result.status}`,
      })
      .eq("id", id);

    if (result.ok && body.saveModels && result.models.length > 0) {
      await supabaseAdmin.from("provider_models").upsert(
        result.models.map((m: { model_id: string; label: string }) => ({
          provider_id: id,
          model_id: m.model_id,
          label: m.label,
          enabled: true,
        })),
        { onConflict: "provider_id,model_id" }
      );
    }

    return jsonResponse(req, result);
  }

  // 3. PROVIDER MODELS
  const modelsMatch = subPath.match(/^\/providers\/([^/]+)\/models$/);
  if (modelsMatch && req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("provider_models")
      .select("*")
      .eq("provider_id", modelsMatch[1])
      .order("model_id", { ascending: true });
    return jsonResponse(req, { models: data ?? [] });
  }

  if (modelsMatch && req.method === "PATCH") {
    const providerId = modelsMatch[1];
    const body = (await req.json().catch(() => ({}))) as {
      models?: Array<{
        model_id: string;
        label?: string;
        enabled?: boolean;
        input_cost_per_mtok?: number;
        output_cost_per_mtok?: number;
      }>;
    };
    const items = Array.isArray(body.models) ? body.models : [];
    const { data: before } = await supabaseAdmin
      .from("provider_models")
      .select("*")
      .eq("provider_id", providerId);

    if (items.length > 0) {
      await supabaseAdmin.from("provider_models").upsert(
        items.map((m) => ({
          provider_id: providerId,
          model_id: m.model_id,
          label: m.label || m.model_id,
          enabled: m.enabled !== false,
          input_cost_per_mtok: Number(m.input_cost_per_mtok ?? 0),
          output_cost_per_mtok: Number(m.output_cost_per_mtok ?? 0),
        })),
        { onConflict: "provider_id,model_id" }
      );
    }

    const { data: after } = await supabaseAdmin
      .from("provider_models")
      .select("*")
      .eq("provider_id", providerId);

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "provider_models.update",
      targetType: "provider",
      targetId: providerId,
      before,
      after,
      ip,
    });

    return jsonResponse(req, { models: after ?? [] });
  }

  // 4. ROUTES
  if (req.method === "GET" && subPath === "/routes") {
    const { data } = await supabaseAdmin.from("routes").select("*").order("stage", { ascending: true });
    return jsonResponse(req, { routes: data ?? [] });
  }

  if (req.method === "PUT" && subPath === "/routes") {
    const body = (await req.json().catch(() => ({}))) as {
      routes?: Array<{
        stage: "brief" | "plan" | "build" | "repair";
        chain: Array<{ provider_id: string; model_id: string }>;
        temperature: number;
        max_output_tokens: number;
      }>;
    };
    const routes = Array.isArray(body.routes) ? body.routes : [];
    const [{ data: validProviders }, { data: validModels }, { data: before }] = await Promise.all([
      supabaseAdmin.from("providers").select("id"),
      supabaseAdmin.from("provider_models").select("provider_id, model_id"),
      supabaseAdmin.from("routes").select("*"),
    ]);

    const providerSet = new Set((validProviders ?? []).map((p: any) => p.id));
    const modelSet = new Set((validModels ?? []).map((m: any) => `${m.provider_id}::${m.model_id}`));

    for (const r of routes) {
      for (const item of r.chain ?? []) {
        if (!providerSet.has(item.provider_id)) {
          return jsonResponse(req, { error: `Unknown provider_id: ${item.provider_id}` }, 400);
        }
        if (modelSet.size > 0 && !modelSet.has(`${item.provider_id}::${item.model_id}`)) {
          return jsonResponse(req, { error: `Unknown model ${item.model_id} for provider ${item.provider_id}` }, 400);
        }
      }
      await supabaseAdmin
        .from("routes")
        .upsert({
          stage: r.stage,
          chain: r.chain ?? [],
          temperature: Number(r.temperature ?? 0.5),
          max_output_tokens: Number(r.max_output_tokens ?? 8192),
          updated_at: new Date().toISOString(),
        });
    }

    const { data: after } = await supabaseAdmin.from("routes").select("*");
    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "routes.update",
      targetType: "routes",
      targetId: "all",
      before,
      after,
      ip,
    });
    return jsonResponse(req, { routes: after ?? [] });
  }

  // 5. USERS
  if (req.method === "GET" && subPath === "/users") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const statusFilter = url.searchParams.get("status") || "";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = 25;

    let query = supabaseAdmin.from("profiles").select("*", { count: "exact" });
    if (statusFilter === "active" || statusFilter === "suspended") {
      query = query.eq("status", statusFilter);
    }
    if (q) {
      query = query.ilike("email", `%${q}%`);
    }
    const { data: profiles, count } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const [{ data: wallets }, { data: usageByUser }] = await Promise.all([
      supabaseAdmin.from("wallets").select("user_id, balance"),
      supabaseAdmin.rpc("get_usage_by_user", { p_days: 1 }),
    ]);

    const walletMap = new Map((wallets ?? []).map((w: any) => [w.user_id, Number(w.balance ?? 0)]));
    const usageMap = new Map((usageByUser ?? []).map((u: any) => [u.user_id, u]));

    return jsonResponse(req, {
      total: count ?? 0,
      page,
      users: (profiles ?? []).map((p: any) => ({
        ...p,
        coins: walletMap.get(p.user_id) ?? 0,
        tokensToday: Number((usageMap.get(p.user_id) as any)?.total_tokens ?? 0),
      })),
    });
  }

  const userDetailMatch = subPath.match(/^\/users\/([^/]+)$/);
  if (userDetailMatch && req.method === "GET") {
    const targetId = userDetailMatch[1];
    const [{ data: profile }, { data: wallet }, { data: ledger }, { data: jobs }, { data: calls }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("user_id", targetId).single(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", targetId).maybeSingle(),
      supabaseAdmin.from("coin_ledger").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("jobs").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("llm_calls").select("total_tokens").eq("user_id", targetId),
    ]);
    if (!profile) return jsonResponse(req, { error: "User not found." }, 404);
    const totalTokens = (calls ?? []).reduce((s: number, c: any) => s + Number(c.total_tokens || 0), 0);
    return jsonResponse(req, { profile, wallet, ledger: ledger ?? [], jobs: jobs ?? [], totalTokens });
  }

  const userCoinsMatch = subPath.match(/^\/users\/([^/]+)\/coins$/);
  if (userCoinsMatch && req.method === "POST") {
    const targetId = userCoinsMatch[1];
    const body = (await req.json().catch(() => ({}))) as { delta?: number; reason?: string };
    const delta = Math.trunc(Number(body.delta));
    const reason = (body.reason || "").trim();
    if (!Number.isFinite(delta) || delta === 0 || !reason) {
      return jsonResponse(req, { error: "Non-zero integer delta and reason are required." }, 400);
    }

    const { data: beforeWallet } = await supabaseAdmin.from("wallets").select("*").eq("user_id", targetId).maybeSingle();
    const { data: newBalance, error } = await supabaseAdmin.rpc("adjust_coins", {
      p_user_id: targetId,
      p_delta: delta,
      p_reason: reason,
      p_actor_id: actorId,
    });
    if (error) return jsonResponse(req, { error: error.message }, 400);

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "user.adjust_coins",
      targetType: "user",
      targetId,
      before: { balance: beforeWallet?.balance ?? 0 },
      after: { balance: newBalance, delta, reason },
      ip,
    });

    return jsonResponse(req, { balance: newBalance });
  }

  const userSuspendMatch = subPath.match(/^\/users\/([^/]+)\/(suspend|reactivate)$/);
  if (userSuspendMatch && req.method === "POST") {
    const targetId = userSuspendMatch[1];
    const nextStatus = userSuspendMatch[2] === "suspend" ? "suspended" : "active";
    const { data: before } = await supabaseAdmin.from("profiles").select("*").eq("user_id", targetId).single();
    if (!before) return jsonResponse(req, { error: "User not found." }, 404);

    const { data: after } = await supabaseAdmin
      .from("profiles")
      .update({ status: nextStatus })
      .eq("user_id", targetId)
      .select("*")
      .single();

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: `user.${userSuspendMatch[2]}`,
      targetType: "user",
      targetId,
      before,
      after,
      ip,
    });

    return jsonResponse(req, { profile: after });
  }

  // 6. USAGE
  if (req.method === "GET" && subPath === "/usage") {
    const group = url.searchParams.get("group") || "day";
    const rangeParam = url.searchParams.get("range") || "7d";
    const days = rangeParam === "1d" ? 1 : rangeParam === "30d" ? 30 : 7;
    const rpcName =
      group === "provider"
        ? "get_usage_by_provider"
        : group === "model"
          ? "get_usage_by_model"
          : group === "user"
            ? "get_usage_by_user"
            : "get_usage_by_day";
    const { data } = await supabaseAdmin.rpc(rpcName, { p_days: days });
    return jsonResponse(req, { group, days, rows: data ?? [] });
  }

  // 7. CONFIG
  if (req.method === "GET" && subPath === "/config") {
    const { data } = await supabaseAdmin.from("app_config").select("*").eq("id", 1).single();
    return jsonResponse(req, { config: data });
  }

  if (req.method === "PUT" && subPath === "/config") {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const { data: before } = await supabaseAdmin.from("app_config").select("*").eq("id", 1).single();

    const dailyGrant = Number(body.daily_grant);
    const buildCost = Number(body.costs?.build);
    const repairCost = Number(body.costs?.repair);
    const globalLimit = Number(body.global_daily_call_limit);
    const threshold = Number(body.high_demand_threshold);

    if (
      !Number.isInteger(dailyGrant) ||
      dailyGrant < 0 ||
      !Number.isInteger(buildCost) ||
      buildCost < 0 ||
      !Number.isInteger(repairCost) ||
      repairCost < 0 ||
      !Number.isInteger(globalLimit) ||
      globalLimit < 1 ||
      !Number.isFinite(threshold) ||
      threshold <= 0 ||
      threshold > 1
    ) {
      return jsonResponse(req, { error: "Invalid configuration values." }, 400);
    }

    const { data: after, error } = await supabaseAdmin
      .from("app_config")
      .update({
        daily_grant: dailyGrant,
        costs: { build: buildCost, repair: repairCost },
        reset_timezone: String(body.reset_timezone || "UTC"),
        global_daily_call_limit: globalLimit,
        maintenance: Boolean(body.maintenance),
        signups_enabled: Boolean(body.signups_enabled),
        high_demand_threshold: threshold,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("*")
      .single();

    if (error) return jsonResponse(req, { error: error.message }, 400);

    await writeAuditLog({
      supabaseAdmin,
      actorId,
      action: "config.update",
      targetType: "app_config",
      targetId: "1",
      before,
      after,
      ip,
    });

    return jsonResponse(req, { config: after });
  }

  // 8. AUDIT LOG
  if (req.method === "GET" && subPath === "/audit") {
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = 30;
    const { data, count } = await supabaseAdmin
      .from("audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    return jsonResponse(req, { total: count ?? 0, page, entries: data ?? [] });
  }

  return jsonResponse(req, { error: "Admin endpoint not found." }, 404);
});
