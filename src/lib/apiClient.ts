import type { UserSession, WalletSummary } from "@/src/types";
import {
  getAuthHeaders,
  getLocalSessionToken,
  getSupabaseClient,
  getSupabaseUrl,
  isSupabaseConfigured,
  setLocalSessionToken,
} from "./supabase";

export class ApiClientError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildApiUrl(edgeFunction: "wallet" | "generate" | "repair" | "admin", subPath = ""): string {
  if (isSupabaseConfigured()) {
    return `${getSupabaseUrl()}/functions/v1/${edgeFunction}${subPath}`;
  }
  return `/api/${edgeFunction}${subPath}`;
}

async function apiFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (json as { error?: string }).error || `Request failed (${res.status})`
    );
  }
  return json as T;
}

// ---- Auth & MFA ----
export interface AuthMeState {
  aal: "aal1" | "aal2";
  mfaEnrolled: boolean;
  user: UserSession | null;
}

export async function fetchAuthState(): Promise<AuthMeState> {
  const client = getSupabaseClient();
  if (client) {
    const { data: sessionData } = await client.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
      return { aal: "aal1", mfaEnrolled: false, user: null };
    }

    const [profileRes, aalRes, factorsRes] = await Promise.all([
      client
        .from("profiles")
        .select("user_id, email, role, status")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then((res) => res, () => ({ data: null })),
      client.auth.mfa
        .getAuthenticatorAssuranceLevel()
        .then((res) => res, () => ({ data: null })),
      client.auth.mfa
        .listFactors()
        .then((res) => res, () => ({ data: null })),
    ]);

    const profile = profileRes.data;
    const verifiedTotp = (factorsRes.data?.totp ?? []).some((f) => f.status === "verified");
    return {
      aal: aalRes.data?.currentLevel === "aal2" ? "aal2" : "aal1",
      mfaEnrolled: verifiedTotp,
      user: {
        id: session.user.id,
        email: profile?.email || session.user.email || "",
        name:
          (session.user.user_metadata?.name as string | undefined) ||
          (session.user.email || "Builder").split("@")[0],
        plan: "free",
        role: profile?.role === "admin" ? "admin" : "user",
        status: profile?.status === "suspended" ? "suspended" : "active",
      },
    };
  }

  const localToken = getLocalSessionToken();
  if (!localToken) {
    return { aal: "aal1", mfaEnrolled: false, user: null };
  }
  try {
    const res = await apiFetch<{
      aal: "aal1" | "aal2";
      mfaEnrolled: boolean;
      user: { id: string; email: string; name: string; role: "user" | "admin"; status: "active" | "suspended" };
    }>("/api/auth/me");
    return {
      aal: res.aal,
      mfaEnrolled: res.mfaEnrolled,
      user: {
        ...res.user,
        plan: "free",
      },
    };
  } catch {
    setLocalSessionToken(null);
    return { aal: "aal1", mfaEnrolled: false, user: null };
  }
}

export type SignInAccountResult =
  | { status: "signed_in"; user: UserSession }
  | { status: "confirmation_required"; email: string };

export async function signInAccount(params: {
  email: string;
  password?: string;
  name?: string;
  mode: "signin" | "signup";
}): Promise<SignInAccountResult> {
  const client = getSupabaseClient();
  if (client) {
    let authedUser: { id: string; email?: string; user_metadata?: Record<string, unknown>; identities?: unknown[] } | null = null;
    let hasSession = false;

    if (params.mode === "signup") {
      const { data, error } = await client.auth.signUp({
        email: params.email,
        password: params.password || "",
        options: { data: { name: params.name || params.email.split("@")[0] } },
      });
      if (error || !data.user) throw new Error(error?.message || "Signup failed.");
      authedUser = data.user;
      hasSession = Boolean(data.session);

      if (!hasSession) {
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Please sign in instead.");
        }
        return {
          status: "confirmation_required",
          email: data.user.email || params.email,
        };
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({
        email: params.email,
        password: params.password || "",
      });
      if (error || !data.user) throw new Error(error?.message || "Sign in failed.");
      authedUser = data.user;
      hasSession = Boolean(data.session);
    }

    const state = await fetchAuthState();
    if (state.user) {
      return { status: "signed_in", user: state.user };
    }

    if (authedUser && hasSession) {
      const { data: profile } = await client
        .from("profiles")
        .select("user_id, email, role, status")
        .eq("user_id", authedUser.id)
        .maybeSingle()
        .then((res) => res, () => ({ data: null }));

      return {
        status: "signed_in",
        user: {
          id: authedUser.id,
          email: profile?.email || authedUser.email || params.email,
          name:
            (authedUser.user_metadata?.name as string | undefined) ||
            params.name ||
            params.email.split("@")[0],
          plan: "free",
          role: profile?.role === "admin" ? "admin" : "user",
          status: profile?.status === "suspended" ? "suspended" : "active",
        },
      };
    }

    throw new Error("Could not establish an active session. Please try signing in.");
  }

  const res = await apiFetch<{ token: string; user: UserSession }>("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      name: params.name,
      password: params.password,
      mode: params.mode,
    }),
  });
  setLocalSessionToken(res.token);
  return { status: "signed_in", user: res.user };
}

export async function signOutAccount(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  setLocalSessionToken(null);
}

export async function signInWithGoogleOAuth(redirectPath = "/"): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Google sign-in requires Supabase authentication to be configured for this environment."
    );
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectTo = origin ? `${origin}${redirectPath}` : undefined;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (error) {
    throw new Error(error.message || "Could not start Google authentication.");
  }
  if (!data?.url) {
    throw new Error("Google OAuth redirect URL was not returned.");
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Password reset emails require Supabase authentication to be configured."
    );
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await client.auth.resetPasswordForEmail(trimmed, {
    redirectTo: origin ? `${origin}/signin` : undefined,
  });
  if (error) {
    throw new Error(error.message || "Could not send password reset email.");
  }
}

export async function enrollTotpFactor(): Promise<{
  factorId?: string;
  secret: string;
  qrSvg?: string;
  otpauthUri: string;
}> {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) throw new Error(error?.message || "Failed to start MFA enrollment.");
    return {
      factorId: data.id,
      secret: data.totp.secret,
      qrSvg: data.totp.qr_code,
      otpauthUri: data.totp.uri,
    };
  }

  return await apiFetch<{ secret: string; otpauthUri: string }>("/api/auth/mfa/enroll", {
    method: "POST",
  });
}

export async function verifyTotpFactor(params: {
  code: string;
  factorId?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    let targetFactorId = params.factorId;
    if (!targetFactorId) {
      const { data: factors } = await client.auth.mfa.listFactors();
      targetFactorId = factors?.totp?.[0]?.id;
    }
    if (!targetFactorId) throw new Error("No TOTP factor found to verify.");
    const { data: challenge, error: chErr } = await client.auth.mfa.challenge({
      factorId: targetFactorId,
    });
    if (chErr || !challenge) throw new Error(chErr?.message || "MFA challenge failed.");
    const { error: verErr } = await client.auth.mfa.verify({
      factorId: targetFactorId,
      challengeId: challenge.id,
      code: params.code.trim(),
    });
    if (verErr) throw new Error(verErr.message || "Invalid verification code.");
    return;
  }

  const res = await apiFetch<{ token: string; aal: "aal2" }>("/api/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code: params.code }),
  });
  setLocalSessionToken(res.token);
}

// ---- Wallet ----
export async function fetchWalletSummary(): Promise<WalletSummary> {
  return await apiFetch<WalletSummary>(buildApiUrl("wallet"));
}

// ---- Admin API ----
export interface AdminOverviewResponse {
  callsToday: number;
  tokensToday: number;
  errorRate: number;
  errorsToday: number;
  rateLimitedToday: number;
  activeUsers: number;
  totalUsers?: number;
  activeAppsBuilt?: number;
  systemStatus?: "operational" | "degraded" | "maintenance";
  uptimePercent?: number;
  coinsSpent: number;
  dailySeries: Array<{
    day: string;
    calls: number;
    errors: number;
    rate_limited: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    appsBuilt?: number;
    activeUsers?: number;
  }>;
  perProvider: Array<{
    id: string;
    name: string;
    slug: string;
    protocol: "gemini" | "openai";
    enabled: boolean;
    key_last4: string;
    rpm_limit: number | null;
    rpd_limit: number | null;
    daily_token_limit: number | null;
    callsToday: number;
    errorsToday: number;
    rateLimitedToday: number;
    tokensToday: number;
    health: {
      cooldown_until: string | null;
      consecutive_failures: number;
      last_error: string | null;
      key_invalid?: boolean;
    } | null;
  }>;
  alerts: Array<{ level: "error" | "warn"; providerId?: string; message: string }>;
}

export interface AdminProviderRow {
  id: string;
  name: string;
  slug: string;
  protocol: "gemini" | "openai";
  base_url: string;
  key_last4: string;
  key_version: number;
  enabled: boolean;
  priority: number;
  rpm_limit: number | null;
  rpd_limit: number | null;
  daily_token_limit: number | null;
  blocked_regions: string[];
  supports_json_schema: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  health: {
    cooldown_until: string | null;
    consecutive_failures: number;
    last_error: string | null;
    key_invalid?: boolean;
  } | null;
  usageToday: {
    calls: number;
    errors: number;
    rate_limited: number;
    total_tokens: number;
  };
}

export interface AdminProviderModelRow {
  id: string;
  provider_id: string;
  model_id: string;
  label: string;
  enabled: boolean;
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
}

export interface AdminRouteRow {
  stage: "brief" | "plan" | "build" | "repair";
  chain: Array<{ provider_id: string; model_id: string }>;
  temperature: number;
  max_output_tokens: number;
}

export interface AdminUserRow {
  user_id: string;
  email: string;
  name?: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  country: string | null;
  last_seen_at: string;
  created_at: string;
  coins: number;
  tokensToday: number;
}

export interface AdminConfigRecord {
  daily_grant: number;
  costs: { build: number; repair: number };
  reset_timezone: string;
  global_daily_call_limit: number;
  maintenance: boolean;
  signups_enabled: boolean;
  high_demand_threshold: number;
}

export interface AdminAuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  created_at: string;
}

export const adminApi = {
  getOverview: (range: "1d" | "7d" | "30d" = "7d") =>
    apiFetch<AdminOverviewResponse>(buildApiUrl("admin", `/overview?range=${range}`)),

  listProviders: () =>
    apiFetch<{ providers: AdminProviderRow[] }>(buildApiUrl("admin", "/providers")),

  createProvider: (payload: Record<string, unknown>) =>
    apiFetch<{ provider: AdminProviderRow }>(buildApiUrl("admin", "/providers"), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProvider: (id: string, payload: Record<string, unknown>) =>
    apiFetch<{ provider: AdminProviderRow }>(buildApiUrl("admin", `/providers/${id}`), {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteProvider: (id: string) =>
    apiFetch<{ ok: boolean }>(buildApiUrl("admin", `/providers/${id}`), {
      method: "DELETE",
    }),

  rotateKey: (id: string, api_key: string) =>
    apiFetch<{ provider: AdminProviderRow }>(buildApiUrl("admin", `/providers/${id}/rotate-key`), {
      method: "POST",
      body: JSON.stringify({ api_key }),
    }),

  testProvider: (id: string, saveModels = false) =>
    apiFetch<{ ok: boolean; message: string; models: Array<{ model_id: string; label: string }> }>(
      buildApiUrl("admin", `/providers/${id}/test`),
      { method: "POST", body: JSON.stringify({ saveModels }) }
    ),

  listModels: (providerId: string) =>
    apiFetch<{ models: AdminProviderModelRow[] }>(
      buildApiUrl("admin", `/providers/${providerId}/models`)
    ),

  saveModels: (
    providerId: string,
    models: Array<{
      model_id: string;
      label?: string;
      enabled?: boolean;
      input_cost_per_mtok?: number;
      output_cost_per_mtok?: number;
    }>
  ) =>
    apiFetch<{ models: AdminProviderModelRow[] }>(
      buildApiUrl("admin", `/providers/${providerId}/models`),
      { method: "PATCH", body: JSON.stringify({ models }) }
    ),

  getRoutes: () =>
    apiFetch<{ routes: AdminRouteRow[] }>(buildApiUrl("admin", "/routes")),

  saveRoutes: (routes: AdminRouteRow[]) =>
    apiFetch<{ routes: AdminRouteRow[] }>(buildApiUrl("admin", "/routes"), {
      method: "PUT",
      body: JSON.stringify({ routes }),
    }),

  listUsers: (params: { q?: string; status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    return apiFetch<{ total: number; page: number; users: AdminUserRow[] }>(
      buildApiUrl("admin", `/users?${qs.toString()}`)
    );
  },

  getUserDetail: (id: string) =>
    apiFetch<{
      profile: AdminUserRow;
      wallet: { balance: number; last_grant_at: string | null } | null;
      ledger: Array<{ id: string; delta: number; balance_after: number; reason: string; created_at: string }>;
      jobs: Array<{ id: string; stage: string; status: string; coin_cost: number; refunded: boolean; created_at: string }>;
      totalTokens: number;
    }>(buildApiUrl("admin", `/users/${id}`)),

  adjustUserCoins: (id: string, delta: number, reason: string) =>
    apiFetch<{ balance: number }>(buildApiUrl("admin", `/users/${id}/coins`), {
      method: "POST",
      body: JSON.stringify({ delta, reason }),
    }),

  suspendUser: (id: string) =>
    apiFetch<{ profile: AdminUserRow }>(buildApiUrl("admin", `/users/${id}/suspend`), {
      method: "POST",
    }),

  reactivateUser: (id: string) =>
    apiFetch<{ profile: AdminUserRow }>(buildApiUrl("admin", `/users/${id}/reactivate`), {
      method: "POST",
    }),

  getConfig: () =>
    apiFetch<{ config: AdminConfigRecord }>(buildApiUrl("admin", "/config")),

  saveConfig: (config: AdminConfigRecord) =>
    apiFetch<{ config: AdminConfigRecord }>(buildApiUrl("admin", "/config"), {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  getAuditLog: (page = 1) =>
    apiFetch<{ total: number; page: number; entries: AdminAuditEntry[] }>(
      buildApiUrl("admin", `/audit?page=${page}`)
    ),
};
