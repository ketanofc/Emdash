import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AuthenticatedContext {
  supabaseAdmin: SupabaseClient;
  userId: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  aal: string;
  country: string | null;
  ip: string;
}

const adminRateWindows = new Map<string, { count: number; resetAt: number }>();
const ADMIN_RATE_LIMIT_MAX = 120;
const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;

export function checkAdminRateLimit(actorId: string, ip: string): boolean {
  const key = `${actorId}:${ip}`;
  const now = Date.now();
  const entry = adminRateWindows.get(key);
  if (!entry || entry.resetAt <= now) {
    adminRateWindows.set(key, { count: 1, resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= ADMIN_RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

function decodeJwtAal(token: string): string {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "aal1";
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { aal?: string };
    return typeof json.aal === "string" ? json.aal : "aal1";
  } catch {
    return "aal1";
  }
}

export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateRequest(
  req: Request
): Promise<{ ok: true; ctx: AuthenticatedContext } | { ok: false; status: number; message: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, message: "Authentication required." };
  }

  const supabaseAdmin = createServiceRoleClient();
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, message: "Invalid or expired session." };
  }

  const user = userData.user;
  const aal = decodeJwtAal(token);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    null;

  // Always verify role & status directly from database (never trust client claims)
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("role, status, country")
    .eq("user_id", user.id)
    .single();

  if (profErr || !profile) {
    return { ok: false, status: 403, message: "User profile not found." };
  }

  await supabaseAdmin
    .from("profiles")
    .update({
      last_seen_at: new Date().toISOString(),
      ...(headerCountry ? { country: headerCountry } : {}),
    })
    .eq("user_id", user.id);

  return {
    ok: true,
    ctx: {
      supabaseAdmin,
      userId: user.id,
      email: user.email || "",
      role: profile.role === "admin" ? "admin" : "user",
      status: profile.status === "suspended" ? "suspended" : "active",
      aal,
      country: headerCountry || profile.country || null,
      ip,
    },
  };
}

export async function requireAdminAal2(
  req: Request
): Promise<{ ok: true; ctx: AuthenticatedContext } | { ok: false; status: number; message: string }> {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return auth;

  if (auth.ctx.status === "suspended") {
    return { ok: false, status: 403, message: "Account is suspended." };
  }

  if (auth.ctx.role !== "admin") {
    return { ok: false, status: 403, message: "Admin access required." };
  }

  if (auth.ctx.aal !== "aal2") {
    return {
      ok: false,
      status: 403,
      message: "Two-factor authentication (aal2) required.",
    };
  }

  if (!checkAdminRateLimit(auth.ctx.userId, auth.ctx.ip)) {
    return { ok: false, status: 429, message: "Admin rate limit exceeded." };
  }

  return auth;
}
