import crypto from "node:crypto";
import fs from "node:fs";
import type http from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server.ts";
import { clearAdminRateLimitForTests } from "./adminRouter.ts";
import { generateTotpCode, LocalAppStore } from "./store.ts";

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function startTestServer(fetchFn?: typeof fetch) {
  clearAdminRateLimitForTests();
  const store = new LocalAppStore();
  const masterSecret = crypto.randomBytes(32).toString("base64");
  const { app } = createApp({ store, masterSecret, fetchFn });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected numeric ephemeral port");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl, store };
}

async function apiJson(
  baseUrl: string,
  route: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

describe("admin security, MFA aal2, secret hygiene, RLS, and coin refunds", () => {
  const openServers: http.Server[] = [];

  afterEach(async () => {
    while (openServers.length > 0) {
      const s = openServers.pop()!;
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it("blocks non-admin and aal1 admin on every admin endpoint, allows aal2 admin, never leaks keys, and logs audit writes", async () => {
    const { server, baseUrl, store } = await startTestServer();
    openServers.push(server);

    const userSession = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: { email: "regular@example.com", name: "Regular" },
    });
    expect(userSession.status).toBe(200);
    const userToken = userSession.json.token as string;
    const regularId = userSession.json.user.id as string;

    // Non-admin gets 403 on all admin routes
    const adminRoutesToCheck: Array<{ method: string; path: string; body?: unknown }> = [
      { method: "GET", path: "/api/admin/overview" },
      { method: "GET", path: "/api/admin/providers" },
      { method: "POST", path: "/api/admin/providers", body: { name: "X" } },
      { method: "GET", path: "/api/admin/routes" },
      { method: "PUT", path: "/api/admin/routes", body: { routes: [] } },
      { method: "GET", path: "/api/admin/users" },
      { method: "GET", path: `/api/admin/users/${regularId}` },
      { method: "POST", path: `/api/admin/users/${regularId}/coins`, body: { delta: 5, reason: "test" } },
      { method: "POST", path: `/api/admin/users/${regularId}/suspend` },
      { method: "GET", path: "/api/admin/usage" },
      { method: "GET", path: "/api/admin/config" },
      { method: "PUT", path: "/api/admin/config", body: {} },
      { method: "GET", path: "/api/admin/audit" },
    ];

    for (const r of adminRoutesToCheck) {
      const resp = await apiJson(baseUrl, r.path, {
        method: r.method,
        token: userToken,
        body: r.body,
      });
      expect(resp.status).toBe(403);
    }

    // Create admin user (manual DB promotion only — never automatic)
    const adminSession = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: { email: "ops@example.com", name: "Ops" },
    });
    const adminId = adminSession.json.user.id as string;
    const adminAal1Token = adminSession.json.token as string;
    store.setUserRole(adminId, "admin");

    // Admin with only aal1 still gets 403
    const aal1Overview = await apiJson(baseUrl, "/api/admin/overview", {
      token: adminAal1Token,
    });
    expect(aal1Overview.status).toBe(403);

    // Enroll + verify TOTP -> obtain aal2 token
    const enrollRes = await apiJson(baseUrl, "/api/auth/mfa/enroll", {
      method: "POST",
      token: adminAal1Token,
    });
    expect(enrollRes.status).toBe(200);
    const totpCode = generateTotpCode(enrollRes.json.secret as string);

    const verifyRes = await apiJson(baseUrl, "/api/auth/mfa/verify", {
      method: "POST",
      token: adminAal1Token,
      body: { code: totpCode },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.json.aal).toBe("aal2");
    const adminAal2Token = verifyRes.json.token as string;

    // Create provider with aal2 token and verify plaintext key NEVER leaks
    const rawFixtureKey = "fixture_secret_vault_4488";
    const createProv = await apiJson(baseUrl, "/api/admin/providers", {
      method: "POST",
      token: adminAal2Token,
      body: {
        name: "Gemini Pool",
        slug: "gemini-pool",
        protocol: "gemini",
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        api_key: rawFixtureKey,
      },
    });
    expect(createProv.status).toBe(201);
    expect(createProv.text).not.toContain(rawFixtureKey);
    expect(createProv.json.provider.key_last4).toBe("4488");
    const providerId = createProv.json.provider.id as string;

    // Rotate key & verify new key also never leaks
    const rotatedKey = "fixture_rotated_vault_7711";
    const rotateRes = await apiJson(baseUrl, `/api/admin/providers/${providerId}/rotate-key`, {
      method: "POST",
      token: adminAal2Token,
      body: { api_key: rotatedKey },
    });
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.text).not.toContain(rotatedKey);
    expect(rotateRes.json.provider.key_last4).toBe("7711");
    expect(rotateRes.json.provider.key_version).toBe(2);

    // Admin routes, coin adjustment, suspension, config write
    const routesPut = await apiJson(baseUrl, "/api/admin/routes", {
      method: "PUT",
      token: adminAal2Token,
      body: {
        routes: [
          {
            stage: "brief",
            chain: [{ provider_id: providerId, model_id: "gemini-2.5-flash" }],
            temperature: 0.4,
            max_output_tokens: 2048,
          },
        ],
      },
    });
    expect(routesPut.status).toBe(200);

    const coinRes = await apiJson(baseUrl, `/api/admin/users/${regularId}/coins`, {
      method: "POST",
      token: adminAal2Token,
      body: { delta: 50, reason: "Support bonus" },
    });
    expect(coinRes.status).toBe(200);
    expect(coinRes.json.balance).toBe(150);
    expect(store.getUserLedger(regularId)[0].reason).toBe("Support bonus");

    const suspendRes = await apiJson(baseUrl, `/api/admin/users/${regularId}/suspend`, {
      method: "POST",
      token: adminAal2Token,
    });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.json.profile.status).toBe("suspended");

    const configRes = await apiJson(baseUrl, "/api/admin/config", {
      method: "PUT",
      token: adminAal2Token,
      body: {
        daily_grant: 120,
        costs: { build: 12, repair: 0 },
        reset_timezone: "UTC",
        global_daily_call_limit: 4000,
        maintenance: false,
        signups_enabled: true,
        high_demand_threshold: 0.85,
      },
    });
    expect(configRes.status).toBe(200);

    // Check list endpoints never leak plaintext keys
    const listProv = await apiJson(baseUrl, "/api/admin/providers", { token: adminAal2Token });
    expect(listProv.status).toBe(200);
    expect(listProv.text).not.toContain(rawFixtureKey);
    expect(listProv.text).not.toContain(rotatedKey);

    const auditRes = await apiJson(baseUrl, "/api/admin/audit", { token: adminAal2Token });
    expect(auditRes.status).toBe(200);
    expect(auditRes.text).not.toContain(rawFixtureKey);
    expect(auditRes.text).not.toContain(rotatedKey);

    const actions = (auditRes.json.entries as Array<{ action: string }>).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "provider.create",
        "provider.rotate_key",
        "routes.update",
        "user.adjust_coins",
        "user.suspend",
        "config.update",
      ])
    );
  });

  it("blocks suspended users on /api/generate and refunds spent Dash Coins exactly once when all providers fail", async () => {
    const failingFetch: typeof fetch = async () => jsonResp({ error: "unavailable" }, 503);
    const { server, baseUrl, store } = await startTestServer(failingFetch);
    openServers.push(server);

    const userSession = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: { email: "builder@example.com", name: "Builder" },
    });
    const token = userSession.json.token as string;
    const userId = userSession.json.user.id as string;

    // Seed failing provider via store so callLLM attempts and fails all candidates
    const enc = await (await import("../lib/llm/crypto.ts")).encryptApiKey(
      "fixture_fail_key_5555",
      crypto.randomBytes(32).toString("base64"),
      1
    );
    const p = store.createProvider({
      name: "FailingProvider",
      slug: "failing",
      protocol: "openai",
      base_url: "https://opencode.ai/zen/v1",
      api_key_enc: enc.encryptedHex,
      key_last4: enc.keyLast4,
      key_version: 1,
      enabled: true,
      priority: 1,
      rpm_limit: null,
      rpd_limit: null,
      daily_token_limit: null,
      blocked_regions: [],
      supports_json_schema: false,
      last_test_at: null,
      last_test_status: null,
    });
    store.upsertRoute({
      stage: "brief",
      chain: [{ provider_id: p.id, model_id: "m1" }],
      temperature: 0.4,
      max_output_tokens: 2048,
    });

    const initialBalance = store.getWallet(userId)!.balance;
    expect(initialBalance).toBe(100);

    const genFail = await apiJson(baseUrl, "/api/generate", {
      method: "POST",
      token,
      body: { prompt: "Build a portfolio" },
    });
    expect(genFail.status).toBe(503);
    expect(genFail.json.error).toBe("High demand right now, please try again later");

    // Wallet restored cleanly & refunded exactly once
    expect(store.getWallet(userId)!.balance).toBe(100);
    const ledger = store.getUserLedger(userId);
    const refundEntries = ledger.filter((l) => l.reason === "build_refund");
    expect(refundEntries).toHaveLength(1);
    expect(refundEntries[0].delta).toBe(10);

    const jobs = store.getUserJobs(userId);
    expect(jobs[0].refunded).toBe(true);
    // Repeated refund attempt on same jobId is idempotent (balance unchanged)
    const afterDuplicateRefund = store.refundCoins(userId, 10, "build_refund", jobs[0].id);
    expect(afterDuplicateRefund).toBe(100);

    // Suspended user receives 403
    store.setUserStatus(userId, "suspended");
    const genSuspended = await apiJson(baseUrl, "/api/generate", {
      method: "POST",
      token,
      body: { prompt: "Build another app" },
    });
    expect(genSuspended.status).toBe(403);
    expect(genSuspended.json.code).toBe("SUSPENDED");
  });

  it("enforces strict RLS on server-only provider, health, log, and audit tables in SQL migrations", () => {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20261116000003_llm_router_and_admin.sql"),
      "utf8"
    );

    const protectedTables = [
      "providers",
      "provider_models",
      "routes",
      "provider_health",
      "llm_calls",
      "audit_log",
    ];
    for (const tbl of protectedTables) {
      expect(migrationSql).toMatch(
        new RegExp(`alter\\s+table\\s+public\\.${tbl}\\s+enable\\s+row\\s+level\\s+security`, "i")
      );
    }

    // Verify no permissive policies exist for anon or authenticated on those tables
    expect(migrationSql).not.toMatch(/\bcreate\s+policy\b/i);
  });

  it("enforces unified signup/signin password checks and /api/public-config never exposes secrets", async () => {
    const { server, baseUrl } = await startTestServer();
    openServers.push(server);

    const signup = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: {
        email: "unified@example.com",
        name: "Unified User",
        password: "password123",
        mode: "signup",
      },
    });
    expect(signup.status).toBe(200);
    expect(signup.json.user.email).toBe("unified@example.com");

    const dupSignup = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: {
        email: "unified@example.com",
        name: "Unified User",
        password: "password123",
        mode: "signup",
      },
    });
    expect(dupSignup.status).toBe(409);

    const wrongSignin = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: {
        email: "unified@example.com",
        password: "wrong-password",
        mode: "signin",
      },
    });
    expect(wrongSignin.status).toBe(401);

    const goodSignin = await apiJson(baseUrl, "/api/auth/session", {
      method: "POST",
      body: {
        email: "unified@example.com",
        password: "password123",
        mode: "signin",
      },
    });
    expect(goodSignin.status).toBe(200);
    expect(goodSignin.json.token).toBeTruthy();

    const pubConfig = await apiJson(baseUrl, "/api/public-config");
    expect(pubConfig.status).toBe(200);
    expect(Object.keys(pubConfig.json).sort()).toEqual(["supabaseAnonKey", "supabaseUrl"]);
  });

  it("never fails with 500 on read-only filesystems (Vercel serverless EROFS regression)", async () => {
    const { resolveServerMasterSecret } = await import("./store.ts");
    const readOnlyDir = path.join("/dev/null", "readonly-emdash-dir");
    const secret = resolveServerMasterSecret(readOnlyDir);
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(20);

    const store = new LocalAppStore({
      persistPath: path.join(readOnlyDir, "emdash-store.json"),
    });
    const { app } = createApp({ store, masterSecret: secret });
    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    openServers.push(server);
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Expected numeric port");

    const signup = await apiJson(`http://127.0.0.1:${addr.port}`, "/api/auth/session", {
      method: "POST",
      body: {
        email: "vercel@example.com",
        name: "Vercel Builder",
        password: "password123",
        mode: "signup",
      },
    });
    expect(signup.status).toBe(200);
    expect(signup.json.token).toBeTruthy();
  });
});

