import crypto from "node:crypto";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  decryptApiKey,
  encryptApiKey,
  type Keyring,
} from "../lib/llm/crypto.ts";
import { testProviderConnection } from "../lib/llm/adapters.ts";
import type { RouteStage } from "../lib/llm/types.ts";
import {
  generateTotpSecret,
  hashPassword,
  LocalAppStore,
  verifyPassword,
  verifyTotpCode,
  type ProfileRecord,
} from "./store.ts";

export interface AuthSessionPayload {
  userId: string;
  email: string;
  aal: "aal1" | "aal2";
  exp: number;
}

export interface ServerContext {
  store: LocalAppStore;
  masterSecret: string;
  keyring: Keyring;
  signingSecret: string;
  fetchFn?: typeof fetch;
}

const adminRateMap = new Map<string, { count: number; resetAt: number }>();

export function clearAdminRateLimitForTests() {
  adminRateMap.clear();
}

export function checkAdminRateLimit(actorId: string, ip: string, max = 120): boolean {
  const key = `${actorId}:${ip}`;
  const now = Date.now();
  const cur = adminRateMap.get(key);
  if (!cur || cur.resetAt <= now) {
    adminRateMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}

export function signSessionToken(payload: AuthSessionPayload, signingSecret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", signingSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string, signingSecret: string): AuthSessionPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", signingSecret).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AuthSessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeJwtAal(token: string): "aal1" | "aal2" {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "aal1";
    const json = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { aal?: string };
    return json.aal === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

export async function resolveAuthenticatedUser(
  req: express.Request,
  ctx: ServerContext
): Promise<
  | { ok: true; userId: string; email: string; aal: "aal1" | "aal2"; profile: ProfileRecord; country: string | null; ip: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const ip =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : "") ||
    req.ip ||
    "127.0.0.1";
  const country =
    (typeof req.headers["cf-ipcountry"] === "string" ? req.headers["cf-ipcountry"] : null) ||
    (typeof req.headers["x-vercel-ip-country"] === "string" ? req.headers["x-vercel-ip-country"] : null) ||
    (typeof req.headers["x-user-country"] === "string" ? req.headers["x-user-country"] : null);

  if (!token) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  // Try local HMAC session token first
  const localSession = verifySessionToken(token, ctx.signingSecret);
  if (localSession) {
    // Always fetch role & status directly from database/store (never trust token claim)
    const profile = ctx.store.getProfile(localSession.userId);
    if (!profile) {
      return { ok: false, status: 403, error: "Profile not found." };
    }
    return {
      ok: true,
      userId: profile.user_id,
      email: profile.email,
      aal: localSession.aal,
      profile,
      country: country || profile.country,
      ip,
    };
  }

  // Fallback: verify Supabase JWT if Supabase is configured on the server
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && serviceKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user) {
      const { data: dbProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();
      if (!dbProfile) {
        return { ok: false, status: 403, error: "Profile not found." };
      }
      return {
        ok: true,
        userId: data.user.id,
        email: data.user.email || "",
        aal: decodeJwtAal(token),
        profile: {
          user_id: dbProfile.user_id,
          email: dbProfile.email,
          name: dbProfile.email.split("@")[0] || "Builder",
          role: dbProfile.role === "admin" ? "admin" : "user",
          status: dbProfile.status === "suspended" ? "suspended" : "active",
          country: dbProfile.country,
          last_seen_at: dbProfile.last_seen_at,
          created_at: dbProfile.created_at,
        },
        country: country || dbProfile.country,
        ip,
      };
    }
  }

  return { ok: false, status: 401, error: "Invalid or expired session." };
}

function sanitizeProvider(p: {
  id: string;
  name: string;
  slug: string;
  protocol: string;
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
  created_at: string;
  updated_at: string;
}) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    protocol: p.protocol,
    base_url: p.base_url,
    key_last4: p.key_last4,
    key_version: p.key_version,
    enabled: p.enabled,
    priority: p.priority,
    rpm_limit: p.rpm_limit,
    rpd_limit: p.rpd_limit,
    daily_token_limit: p.daily_token_limit,
    blocked_regions: p.blocked_regions,
    supports_json_schema: p.supports_json_schema,
    last_test_at: p.last_test_at,
    last_test_status: p.last_test_status,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

export function createAuthRouter(ctx: ServerContext): express.Router {
  const router = express.Router();

  router.post("/session", async (req, res) => {
    const body = (req.body || {}) as {
      email?: string;
      name?: string;
      password?: string;
      mode?: "signin" | "signup";
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email is required." });
      return;
    }
    const mode = body.mode;
    const password = typeof body.password === "string" ? body.password : "";
    if (mode && password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const country =
      typeof req.headers["cf-ipcountry"] === "string" ? req.headers["cf-ipcountry"] : null;
    try {
      const existing = ctx.store.getProfileByEmail(email);

      if (mode === "signup") {
        if (existing) {
          res.status(409).json({
            error: "An account with this email already exists. Please sign in instead.",
          });
          return;
        }
      } else if (mode === "signin") {
        if (!existing) {
          res.status(401).json({ error: "Invalid email or password." });
          return;
        }
        if (existing.password_hash && !verifyPassword(password, existing.password_hash)) {
          res.status(401).json({ error: "Invalid email or password." });
          return;
        }
      }

      const { profile } = ctx.store.ensureProfile({
        email,
        name: body.name,
        country,
        passwordHash: password.length >= 6 ? hashPassword(password) : null,
      });
      const token = signSessionToken(
        {
          userId: profile.user_id,
          email: profile.email,
          aal: "aal1",
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
        },
        ctx.signingSecret
      );
      res.json({
        token,
        aal: "aal1",
        user: {
          id: profile.user_id,
          email: profile.email,
          name: profile.name,
          plan: "free",
          role: profile.role,
          status: profile.status,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === "SIGNUPS_DISABLED") {
        res.status(403).json({ error: "New signups are currently disabled." });
        return;
      }
      res.status(500).json({ error: "Failed to create session." });
    }
  });

  router.get("/me", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    res.json({
      aal: auth.aal,
      mfaEnrolled: Boolean(auth.profile.totp_verified),
      user: {
        id: auth.profile.user_id,
        email: auth.profile.email,
        name: auth.profile.name,
        role: auth.profile.role,
        status: auth.profile.status,
      },
    });
  });

  router.post("/mfa/enroll", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const secret = generateTotpSecret();
    ctx.store.setUserTotp(auth.userId, secret, false);
    const label = encodeURIComponent(`Emdash:${auth.email}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=Emdash`;
    res.json({ secret, otpauthUri });
  });

  router.post("/mfa/verify", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const body = (req.body || {}) as { code?: string };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const fresh = ctx.store.getProfile(auth.userId);
    if (!fresh?.totp_secret || !verifyTotpCode(fresh.totp_secret, code)) {
      res.status(400).json({ error: "Invalid 6-digit authenticator code." });
      return;
    }
    ctx.store.setUserTotp(auth.userId, fresh.totp_secret, true);
    const token = signSessionToken(
      {
        userId: auth.userId,
        email: auth.email,
        aal: "aal2",
        exp: Date.now() + 12 * 60 * 60 * 1000,
      },
      ctx.signingSecret
    );
    res.json({ token, aal: "aal2" });
  });

  return router;
}

export function createAdminRouter(ctx: ServerContext): express.Router {
  const router = express.Router();

  // Strict admin + aal2 + rate limit guard on EVERY route
  router.use(async (req, res, next) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    if (auth.profile.status === "suspended") {
      res.status(403).json({ error: "Account is suspended." });
      return;
    }
    if (auth.profile.role !== "admin") {
      res.status(403).json({ error: "Admin access required." });
      return;
    }
    if (auth.aal !== "aal2") {
      res.status(403).json({ error: "Two-factor authentication (aal2) required." });
      return;
    }
    if (!checkAdminRateLimit(auth.userId, auth.ip)) {
      res.status(429).json({ error: "Admin rate limit exceeded." });
      return;
    }
    res.locals.adminAuth = auth;
    next();
  });

  router.get("/overview", (req, res) => {
    const range = typeof req.query.range === "string" ? req.query.range : "7d";
    const days = range === "1d" ? 1 : range === "30d" ? 30 : 7;
    res.json(ctx.store.getOverviewMetrics(days));
  });

  router.get("/providers", (_req, res) => {
    const usage = new Map(ctx.store.getUsageByProvider(1).map((u) => [u.provider_id, u]));
    const list = ctx.store.listProviders().map((p) => {
      const h = ctx.store.getProviderHealth(p.id);
      return h.then((health) => ({
        ...sanitizeProvider(p),
        health,
        usageToday: usage.get(p.id) ?? { calls: 0, errors: 0, rate_limited: 0, total_tokens: 0 },
      }));
    });
    void Promise.all(list).then((providers) => res.json({ providers }));
  });

  router.post("/providers", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const body = (req.body || {}) as Record<string, any>;
    const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
    if (!apiKey || !body.name || !body.slug || !body.protocol || !body.base_url) {
      res.status(400).json({ error: "name, slug, protocol, base_url, and api_key are required." });
      return;
    }

    try {
      const enc = await encryptApiKey(apiKey, ctx.masterSecret, 1);
      const created = ctx.store.createProvider({
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
        last_test_at: null,
        last_test_status: null,
      });

      ctx.store.writeAuditLog({
        actor_id: adminAuth.userId,
        action: "provider.create",
        target_type: "provider",
        target_id: created.id,
        before: null,
        after: sanitizeProvider(created),
        ip: adminAuth.ip,
      });

      res.status(201).json({ provider: sanitizeProvider(created) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create provider." });
    }
  });

  router.patch("/providers/:id", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const before = await ctx.store.getProvider(req.params.id);
    if (!before) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const body = (req.body || {}) as Record<string, any>;
    const patch: Record<string, unknown> = {};
    for (const k of [
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
      if (k in body) patch[k] = body[k];
    }
    const updated = ctx.store.updateProvider(req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "provider.update",
      target_type: "provider",
      target_id: updated.id,
      before: sanitizeProvider(before),
      after: sanitizeProvider(updated),
      ip: adminAuth.ip,
    });
    res.json({ provider: sanitizeProvider(updated) });
  });

  router.delete("/providers/:id", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const before = await ctx.store.getProvider(req.params.id);
    if (!before) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    ctx.store.deleteProvider(req.params.id);
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "provider.delete",
      target_type: "provider",
      target_id: req.params.id,
      before: sanitizeProvider(before),
      after: null,
      ip: adminAuth.ip,
    });
    res.json({ ok: true });
  });

  router.post("/providers/:id/rotate-key", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const body = (req.body || {}) as { api_key?: string };
    const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
    if (!apiKey) {
      res.status(400).json({ error: "api_key is required." });
      return;
    }
    const before = await ctx.store.getProvider(req.params.id);
    if (!before) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const nextVersion = before.key_version + 1;
    const enc = await encryptApiKey(apiKey, ctx.masterSecret, nextVersion);
    const updated = ctx.store.updateProvider(req.params.id, {
      api_key_enc: enc.encryptedHex,
      key_last4: enc.keyLast4,
      key_version: enc.keyVersion,
    });
    await ctx.store.upsertProviderHealth({
      provider_id: req.params.id,
      cooldown_until: null,
      consecutive_failures: 0,
      last_error: null,
      key_invalid: false,
      updated_at: new Date().toISOString(),
    });
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "provider.rotate_key",
      target_type: "provider",
      target_id: req.params.id,
      before: { key_last4: before.key_last4, key_version: before.key_version },
      after: { key_last4: enc.keyLast4, key_version: enc.keyVersion },
      ip: adminAuth.ip,
    });
    res.json({ provider: sanitizeProvider(updated!) });
  });

  router.post("/providers/:id/test", async (req, res) => {
    const provider = await ctx.store.getProvider(req.params.id);
    if (!provider) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const body = (req.body || {}) as { saveModels?: boolean };
    const { plaintext } = await decryptApiKey(provider.api_key_enc, ctx.keyring);
    const result = await testProviderConnection({
      protocol: provider.protocol,
      baseUrl: provider.base_url,
      slug: provider.slug,
      apiKey: plaintext,
      fetchFn: ctx.fetchFn,
    });

    ctx.store.updateProvider(provider.id, {
      last_test_at: new Date().toISOString(),
      last_test_status: result.ok ? "ok" : result.statusText,
    });

    if (result.ok && body.saveModels && result.models.length > 0) {
      ctx.store.upsertProviderModels(provider.id, result.models);
    }

    res.json({
      ok: result.ok,
      message: result.statusText,
      models: result.models,
    });
  });

  router.get("/providers/:id/models", (req, res) => {
    res.json({ models: ctx.store.listProviderModels(req.params.id) });
  });

  router.patch("/providers/:id/models", (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const body = (req.body || {}) as {
      models?: Array<{
        model_id: string;
        label?: string;
        enabled?: boolean;
        input_cost_per_mtok?: number;
        output_cost_per_mtok?: number;
      }>;
    };
    const before = ctx.store.listProviderModels(req.params.id);
    const after = ctx.store.upsertProviderModels(
      req.params.id,
      Array.isArray(body.models) ? body.models : []
    );
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "provider_models.update",
      target_type: "provider",
      target_id: req.params.id,
      before,
      after,
      ip: adminAuth.ip,
    });
    res.json({ models: after });
  });

  router.get("/routes", (_req, res) => {
    res.json({ routes: ctx.store.listRoutes() });
  });

  router.put("/routes", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const body = (req.body || {}) as {
      routes?: Array<{
        stage: RouteStage;
        chain: Array<{ provider_id: string; model_id: string }>;
        temperature: number;
        max_output_tokens: number;
      }>;
    };
    const incoming = Array.isArray(body.routes) ? body.routes : [];
    const validProviders = new Set(ctx.store.listProviders().map((p) => p.id));

    for (const r of incoming) {
      for (const candidate of r.chain ?? []) {
        if (!validProviders.has(candidate.provider_id)) {
          res.status(400).json({ error: `Unknown provider_id: ${candidate.provider_id}` });
          return;
        }
        const models = ctx.store.listProviderModels(candidate.provider_id);
        if (models.length > 0 && !models.some((m) => m.model_id === candidate.model_id)) {
          res.status(400).json({
            error: `Unknown model ${candidate.model_id} for provider ${candidate.provider_id}`,
          });
          return;
        }
      }
    }

    const before = ctx.store.listRoutes();
    for (const r of incoming) {
      ctx.store.upsertRoute({
        stage: r.stage,
        chain: r.chain ?? [],
        temperature: Number(r.temperature ?? 0.5),
        max_output_tokens: Number(r.max_output_tokens ?? 8192),
      });
    }
    const after = ctx.store.listRoutes();

    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "routes.update",
      target_type: "routes",
      target_id: "all",
      before,
      after,
      ip: adminAuth.ip,
    });
    res.json({ routes: after });
  });

  router.get("/users", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const page = Number(req.query.page || 1);
    const paged = ctx.store.listProfiles({ q, status, page });
    const usage = new Map(ctx.store.getUsageByUser(1).map((u) => [u.user_id, u.total_tokens]));
    res.json({
      total: paged.total,
      page: paged.page,
      users: paged.items.map((p) => ({
        user_id: p.user_id,
        email: p.email,
        name: p.name,
        role: p.role,
        status: p.status,
        country: p.country,
        last_seen_at: p.last_seen_at,
        created_at: p.created_at,
        coins: ctx.store.getWallet(p.user_id)?.balance ?? 0,
        tokensToday: usage.get(p.user_id) ?? 0,
      })),
    });
  });

  router.get("/users/:id", (req, res) => {
    const profile = ctx.store.getProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const { totp_secret: _omitTotp, password_hash: _omitPw, ...safeProfile } = profile;
    const wallet = ctx.store.getWallet(profile.user_id);
    const ledger = ctx.store.getUserLedger(profile.user_id);
    const jobs = ctx.store.getUserJobs(profile.user_id);
    const totalTokens = ctx.store
      .listLlmCalls()
      .filter((c) => c.user_id === profile.user_id)
      .reduce((s, c) => s + c.total_tokens, 0);
    res.json({ profile: safeProfile, wallet, ledger, jobs, totalTokens });
  });

  router.post("/users/:id/coins", (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const profile = ctx.store.getProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const body = (req.body || {}) as { delta?: number; reason?: string };
    const delta = Math.trunc(Number(body.delta));
    const reason = (body.reason || "").trim();
    if (!Number.isFinite(delta) || delta === 0 || !reason) {
      res.status(400).json({ error: "Non-zero integer delta and reason are required." });
      return;
    }
    const beforeBal = ctx.store.getWallet(profile.user_id)?.balance ?? 0;
    const balance = ctx.store.adjustCoins(profile.user_id, delta, reason, adminAuth.userId);
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "user.adjust_coins",
      target_type: "user",
      target_id: profile.user_id,
      before: { balance: beforeBal },
      after: { balance, delta, reason },
      ip: adminAuth.ip,
    });
    res.json({ balance });
  });

  router.post("/users/:id/suspend", (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const before = ctx.store.getProfile(req.params.id);
    if (!before) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const after = ctx.store.setUserStatus(req.params.id, "suspended");
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "user.suspend",
      target_type: "user",
      target_id: req.params.id,
      before: { status: before.status },
      after: { status: after?.status },
      ip: adminAuth.ip,
    });
    res.json({ profile: after });
  });

  router.post("/users/:id/reactivate", (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const before = ctx.store.getProfile(req.params.id);
    if (!before) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const after = ctx.store.setUserStatus(req.params.id, "active");
    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "user.reactivate",
      target_type: "user",
      target_id: req.params.id,
      before: { status: before.status },
      after: { status: after?.status },
      ip: adminAuth.ip,
    });
    res.json({ profile: after });
  });

  router.get("/usage", (req, res) => {
    const group = typeof req.query.group === "string" ? req.query.group : "day";
    const range = typeof req.query.range === "string" ? req.query.range : "7d";
    const days = range === "1d" ? 1 : range === "30d" ? 30 : 7;
    const rows =
      group === "provider"
        ? ctx.store.getUsageByProvider(days)
        : group === "model"
          ? ctx.store.getUsageByModel(days)
          : group === "user"
            ? ctx.store.getUsageByUser(days)
            : ctx.store.getUsageByDay(days);
    res.json({ group, days, rows });
  });

  router.get("/config", async (_req, res) => {
    const config = await ctx.store.getConfig();
    res.json({ config });
  });

  router.put("/config", async (req, res) => {
    const adminAuth = res.locals.adminAuth as { userId: string; ip: string };
    const before = await ctx.store.getConfig();
    const body = (req.body || {}) as Record<string, any>;
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
      res.status(400).json({ error: "Invalid configuration values." });
      return;
    }

    const after = ctx.store.updateConfig({
      daily_grant: dailyGrant,
      costs: { build: buildCost, repair: repairCost },
      reset_timezone: String(body.reset_timezone || "UTC"),
      global_daily_call_limit: globalLimit,
      maintenance: Boolean(body.maintenance),
      signups_enabled: Boolean(body.signups_enabled),
      high_demand_threshold: threshold,
    });

    ctx.store.writeAuditLog({
      actor_id: adminAuth.userId,
      action: "config.update",
      target_type: "app_config",
      target_id: "1",
      before,
      after,
      ip: adminAuth.ip,
    });

    res.json({ config: after });
  });

  router.get("/audit", (req, res) => {
    const page = Number(req.query.page || 1);
    res.json(ctx.store.listAuditLog(page));
  });

  return router;
}
