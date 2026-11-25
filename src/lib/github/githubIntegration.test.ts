import crypto from "node:crypto";
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server.ts";
import { LocalAppStore } from "../../server/store.ts";
import { encodeByteaHex, encryptApiKey } from "../llm/crypto.ts";
import {
  isExplicitDeleteRequested,
  parseAgentStructuredResponse,
  selectContextFiles,
} from "./agent.ts";
import {
  computeUnifiedDiff,
  validateBranchName,
  validateRepoIdentifier,
  validateRepoPath,
} from "./pathSafety.ts";

describe("GitHub Path Safety & Diff Engine", () => {
  it("blocks path traversal, absolute paths, backslashes, null bytes, and .git internals", () => {
    expect(validateRepoPath("./src/App.tsx")).toBe("src/App.tsx");
    expect(validateRepoPath("README.md")).toBe("README.md");

    expect(() => validateRepoPath("../secret.txt")).toThrow();
    expect(() => validateRepoPath("src/../../etc/passwd")).toThrow();
    expect(() => validateRepoPath("/etc/passwd")).toThrow();
    expect(() => validateRepoPath("src\\index.ts")).toThrow();
    expect(() => validateRepoPath(".git/config")).toThrow();
    expect(() => validateRepoPath("file\0.ts")).toThrow();
  });

  it("validates repo identifiers and branch names", () => {
    expect(validateRepoIdentifier("octocat", "owner")).toBe("octocat");
    expect(() => validateRepoIdentifier("../evil", "owner")).toThrow();
    expect(validateBranchName("emdash/fix-auth-1")).toBe("emdash/fix-auth-1");
    expect(() => validateBranchName("main..evil")).toThrow();
    expect(() => validateBranchName("/leading-slash")).toThrow();
  });

  it("computes accurate unified diffs for create, update, and delete", () => {
    const created = computeUnifiedDiff("src/new.ts", null, "const a = 1;\nconst b = 2;", "create");
    expect(created.added).toBe(2);
    expect(created.removed).toBe(0);

    const updated = computeUnifiedDiff("src/app.ts", "line1\nold\nline3", "line1\nnew\nline3", "update");
    expect(updated.added).toBe(1);
    expect(updated.removed).toBe(1);
    expect(updated.hunks.some((h) => h.type === "del" && h.text === "old")).toBe(true);
    expect(updated.hunks.some((h) => h.type === "add" && h.text === "new")).toBe(true);
  });

  it("parses structured agent JSON and enforces explicit delete guard", () => {
    const raw = `\`\`\`json
    {
      "summary": "Fixed auth bug",
      "suggestedBranch": "emdash/fix-auth",
      "commitMessage": "fix: auth bug",
      "prTitle": "Fix auth bug",
      "prBody": "Updates auth handler",
      "operations": [
        { "action": "update", "path": "src/auth.ts", "content": "export const ok = true;", "reason": "Fix" }
      ]
    }
    \`\`\``;
    const parsed = parseAgentStructuredResponse(raw, "Fix auth bug");
    expect(parsed.summary).toBe("Fixed auth bug");
    expect(parsed.suggestedBranch).toBe("emdash/fix-auth");
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.operations[0].path).toBe("src/auth.ts");

    expect(isExplicitDeleteRequested("Add dark mode")).toBe(false);
    expect(isExplicitDeleteRequested("Delete obsolete file src/old.ts")).toBe(true);
  });

  it("selects relevant context files prioritizing config and prompt keywords", () => {
    const tree = [
      { path: "package.json", type: "blob" as const, sha: "1", size: 400 },
      { path: "src/auth.ts", type: "blob" as const, sha: "2", size: 900 },
      { path: "src/unrelated.ts", type: "blob" as const, sha: "3", size: 900 },
      { path: "dist/bundle.js", type: "blob" as const, sha: "4", size: 50000 },
      { path: "logo.png", type: "blob" as const, sha: "5", size: 2000 },
    ];
    const selected = selectContextFiles(tree, "Fix the auth bug", 5);
    expect(selected).toContain("package.json");
    expect(selected).toContain("src/auth.ts");
    expect(selected).not.toContain("dist/bundle.js");
    expect(selected).not.toContain("logo.png");
  });
});

describe("GitHub Backend Security & Authorization", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const s = servers.pop()!;
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it("enforces authentication, user isolation, token secrecy, and base-branch protection", async () => {
    const store = new LocalAppStore();
    const masterSecret = crypto.randomBytes(32).toString("base64");
    const { app } = createApp({ store, masterSecret });
    const server = await new Promise<http.Server>((resolve) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    });
    servers.push(server);
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // 1. Unauthenticated access rejected
    const unauthRepos = await fetch(`${baseUrl}/api/github/repos`);
    expect(unauthRepos.status).toBe(401);

    // 2. Sign up User A & User B
    const signA = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "usera@example.com", password: "password123", mode: "signup" }),
    }).then((r) => r.json() as Promise<{ token: string; user: { id: string } }>);

    const signB = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "userb@example.com", password: "password123", mode: "signup" }),
    }).then((r) => r.json() as Promise<{ token: string; user: { id: string } }>);

    // 3. Store encrypted GitHub token ONLY for User A
    const rawSecretToken = "gho_super_secret_token_never_expose";
    const { encrypted, keyVersion } = await encryptApiKey(rawSecretToken, masterSecret);
    store.upsertGitHubConnection({
      user_id: signA.user.id,
      github_user_id: "12345",
      username: "user-a-gh",
      avatar_url: "https://avatars.githubusercontent.com/u/12345",
      scope: "repo read:user",
      access_token_enc: encodeByteaHex(encrypted),
      key_version: keyVersion,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 4. Status for User A returns profile, NEVER raw token
    const statusA = await fetch(`${baseUrl}/api/github/status`, {
      headers: { Authorization: `Bearer ${signA.token}` },
    });
    const statusAText = await statusA.text();
    expect(statusA.status).toBe(200);
    expect(statusAText).toContain("user-a-gh");
    expect(statusAText).not.toContain(rawSecretToken);

    // 5. User B cannot see User A's connection or repos
    const statusB = await fetch(`${baseUrl}/api/github/status`, {
      headers: { Authorization: `Bearer ${signB.token}` },
    }).then((r) => r.json() as Promise<{ connected: boolean }>);
    expect(statusB.connected).toBe(false);

    const reposB = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${signB.token}` },
    });
    expect(reposB.status).toBe(401);

    // 6. User A cannot push directly to baseBranch === newBranch
    const badPr = await fetch(`${baseUrl}/api/github/repos/octocat/hello/pr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${signA.token}`,
      },
      body: JSON.stringify({
        baseBranch: "main",
        newBranch: "main",
        commitMessage: "direct push",
        prTitle: "Bad PR",
        changes: [{ action: "update", path: "README.md", content: "hi" }],
      }),
    });
    expect(badPr.status).toBe(400);

    // 7. /api/dashboard anti-bypass & user-scoping checks
    const unauthDash = await fetch(`${baseUrl}/api/dashboard`);
    expect(unauthDash.status).toBe(401);

    const forgedDash = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: "Bearer forged.jwt.token" },
    });
    expect(forgedDash.status).toBe(401);

    const dashA = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${signA.token}` },
    });
    const dashAText = await dashA.text();
    expect(dashA.status).toBe(200);
    expect(dashAText).toContain("usera@example.com");
    expect(dashAText).toContain("user-a-gh");
    expect(dashAText).not.toContain(rawSecretToken);

    store.setUserStatus(signB.user.id, "suspended");
    const suspendedDash = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${signB.token}` },
    });
    expect(suspendedDash.status).toBe(403);
  });
});
