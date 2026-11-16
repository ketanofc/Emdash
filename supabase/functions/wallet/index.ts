import { authenticateRequest } from "../_shared/auth.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

function getLocalDayKey(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return jsonResponse(req, { error: "Method not allowed." }, 405);
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return jsonResponse(req, { error: auth.message }, auth.status);
  }

  const { supabaseAdmin, userId, role, status } = auth.ctx;

  const { data: config } = await supabaseAdmin
    .from("app_config")
    .select("*")
    .eq("id", 1)
    .single();

  const dailyGrant = Number(config?.daily_grant ?? 100);
  const resetTimezone = String(config?.reset_timezone ?? "UTC");
  const buildCost = Number(config?.costs?.build ?? 10);
  const repairCost = Number(config?.costs?.repair ?? 0);

  let { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!wallet) {
    const { data: inserted } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: userId, balance: dailyGrant, last_grant_at: new Date().toISOString() })
      .select("*")
      .single();
    wallet = inserted;
  }

  const now = new Date();
  const todayKey = getLocalDayKey(now, resetTimezone);
  const lastGrantKey = wallet?.last_grant_at
    ? getLocalDayKey(new Date(wallet.last_grant_at), resetTimezone)
    : null;

  if (status === "active" && dailyGrant > 0 && lastGrantKey !== todayKey) {
    await supabaseAdmin.rpc("adjust_coins", {
      p_user_id: userId,
      p_delta: dailyGrant,
      p_reason: "daily_grant",
      p_actor_id: null,
    });
    await supabaseAdmin
      .from("wallets")
      .update({ last_grant_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("user_id", userId);
  }

  const [{ data: updatedWallet }, { data: ledger }] = await Promise.all([
    supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).single(),
    supabaseAdmin
      .from("coin_ledger")
      .select("id, delta, balance_after, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return jsonResponse(req, {
    balance: Number(updatedWallet?.balance ?? 0),
    dailyGrant,
    buildCost,
    repairCost,
    maintenance: Boolean(config?.maintenance),
    signupsEnabled: config?.signups_enabled !== false,
    resetTimezone,
    role,
    status,
    ledger: ledger ?? [],
  });
});
