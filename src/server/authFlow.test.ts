import crypto from "node:crypto";
import type http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server.ts";
import { clearAdminRateLimitForTests } from "./adminRouter.ts";
import { generateTotpCode, LocalAppStore } from "./store.ts";

async function startServer() {
  clearAdminRateLimitForTests();
  const store = new LocalAppStore();
  const masterSecret = crypto.randomBytes(32).toString("base64");
  const adminEmail = "admin@emdash.build";
  const adminPassword = "TestAdminPassword123!";
  store.ensureAdminAccount(adminEmail, adminPassword, "Administrator");

  const { app } = createApp({ store, masterSecret });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, store, adminEmail, adminPassword };
}

async function postJson(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getJson(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "GET", headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe("Authentication & Admin Login Verification", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const s = servers.pop()!;
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it("supports user sign up, duplicate rejection, and correct sign in", async () => {
    const { server, baseUrl } = await startServer();
    servers.push(server);

    // 1. Sign up new user
    const signup = await postJson(`${baseUrl}/api/auth/session`, {
      email: "newuser@example.com",
      name: "New User",
      password: "secretPassword123",
      mode: "signup",
    });
    expect(signup.status).toBe(200);
    expect(signup.json.user.role).toBe("user");
    expect(signup.json.user.email).toBe("newuser@example.com");
    expect(signup.json.token).toBeDefined();

    // 2. Reject duplicate email sign up
    const duplicate = await postJson(`${baseUrl}/api/auth/session`, {
      email: "newuser@example.com",
      password: "anotherPassword123",
      mode: "signup",
    });
    expect(duplicate.status).toBe(409);

    // 3. Reject sign in with wrong password
    const wrongPass = await postJson(`${baseUrl}/api/auth/session`, {
      email: "newuser@example.com",
      password: "wrongPassword!",
      mode: "signin",
    });
    expect(wrongPass.status).toBe(401);

    // 4. Accept sign in with correct password
    const correctLogin = await postJson(`${baseUrl}/api/auth/session`, {
      email: "newuser@example.com",
      password: "secretPassword123",
      mode: "signin",
    });
    expect(correctLogin.status).toBe(200);
    expect(correctLogin.json.user.email).toBe("newuser@example.com");
    expect(correctLogin.json.user.role).toBe("user");
  });

  it("authenticates admin credentials, enforces aal2 MFA, and grants control plane access", async () => {
    const { server, baseUrl, adminEmail, adminPassword } = await startServer();
    servers.push(server);

    // 1. Admin login with correct credentials
    const adminLogin = await postJson(`${baseUrl}/api/auth/session`, {
      email: adminEmail,
      password: adminPassword,
      mode: "signin",
    });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.json.user.role).toBe("admin");
    const aal1Token = adminLogin.json.token;

    // 2. Accessing admin route with aal1 token -> 403 (needs TOTP aal2)
    const adminOverviewAal1 = await getJson(`${baseUrl}/api/admin/overview`, aal1Token);
    expect(adminOverviewAal1.status).toBe(403);

    // 3. Enroll TOTP factor
    const enroll = await postJson(`${baseUrl}/api/auth/mfa/enroll`, {}, aal1Token);
    expect(enroll.status).toBe(200);
    expect(enroll.json.secret).toBeDefined();

    // 4. Generate valid 6-digit TOTP code and verify
    const validCode = generateTotpCode(enroll.json.secret);
    const verify = await postJson(`${baseUrl}/api/auth/mfa/verify`, { code: validCode }, aal1Token);
    expect(verify.status).toBe(200);
    expect(verify.json.aal).toBe("aal2");
    const aal2Token = verify.json.token;

    // 5. Accessing admin route with aal2 token -> 200 SUCCESS!
    const adminOverviewAal2 = await getJson(`${baseUrl}/api/admin/overview`, aal2Token);
    expect(adminOverviewAal2.status).toBe(200);
    expect(adminOverviewAal2.json.callsToday).toBeDefined();

    // 6. Non-admin user cannot access admin route even if pretending
    const normalUser = await postJson(`${baseUrl}/api/auth/session`, {
      email: "plain@example.com",
      password: "plainUserPassword!",
      mode: "signup",
    });
    const userAccess = await getJson(`${baseUrl}/api/admin/overview`, normalUser.json.token);
    expect(userAccess.status).toBe(403);

    // 7. Auto-seeds admin account on-the-fly with standard fallback password (Vercel serverless cold-start test)
    const freshServer = createApp({ store: new LocalAppStore(), masterSecret: crypto.randomBytes(32).toString("base64") });
    const s2 = await new Promise<http.Server>((res) => {
      const serverInstance = freshServer.app.listen(0, "127.0.0.1", () => res(serverInstance));
    });
    servers.push(s2);
    const addr2 = s2.address() as { port: number };
    const freshBase = `http://127.0.0.1:${addr2.port}`;

    const onTheFlyAdmin = await postJson(`${freshBase}/api/auth/session`, {
      email: "admin@emdash.build",
      password: "Emdash@Admin2026!",
      mode: "signin",
    });
    expect(onTheFlyAdmin.status).toBe(200);
    expect(onTheFlyAdmin.json.user.role).toBe("admin");

    // Also accepts the previous generated password from screenshot
    const onTheFlyAdmin2 = await postJson(`${freshBase}/api/auth/session`, {
      email: "admin@emdash.build",
      password: "Emdash@Admin_86401b7c!",
      mode: "signin",
    });
    expect(onTheFlyAdmin2.status).toBe(200);
    expect(onTheFlyAdmin2.json.user.role).toBe("admin");
  });
});
