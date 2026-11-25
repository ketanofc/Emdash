import crypto from "node:crypto";
import express from "express";
import {
  decodeBytea,
  decryptApiKey,
  encryptApiKey,
  encodeByteaHex,
  redactSecrets,
} from "../lib/llm/crypto.ts";
import {
  createBranchAndCommitFiles,
  createPullRequest,
  exchangeOAuthCode,
  fetchGitHubUser,
  getRepoFileContent,
  getRepoTree,
  GitHubApiError,
  listRepoBranches,
  listUserRepos,
} from "../lib/github/api.ts";
import { validateRepoPath } from "../lib/github/pathSafety.ts";
import type { GitHubFileOperation } from "../lib/github/types.ts";
import { getSupabaseAdmin, resolveAuthenticatedUser, type ServerContext } from "./adminRouter.ts";

interface OAuthStatePayload {
  userId: string;
  nonce: string;
  returnTo: string;
  exp: number;
}

function signOAuthState(payload: OAuthStatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`gh-oauth:${body}`).digest("base64url");
  return `${body}.${sig}`;
}

function verifyOAuthState(token: string, secret: string): OAuthStatePayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", secret).update(`gh-oauth:${body}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveGitHubOAuthConfig(req: express.Request) {
  const clientId = (process.env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GITHUB_CLIENT_SECRET || "").trim();
  const proto =
    (typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0].trim()
      : "") || req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const origin = (process.env.APP_URL || process.env.SITE_ORIGIN || `${proto}://${host}`).replace(/\/+$/, "");
  const redirectUri = (process.env.GITHUB_REDIRECT_URI || `${origin}/api/github/callback`).trim();
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

export async function getDecryptedGitHubTokenForUser(
  userId: string,
  ctx: ServerContext
): Promise<{
  token: string;
  username: string;
  avatarUrl: string;
  scope: string | null;
  connectedAt: string;
} | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from("github_connections")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data && data.access_token_enc) {
        const decrypted = await decryptApiKey(
          decodeBytea(data.access_token_enc),
          ctx.keyring
        );
        return {
          token: decrypted.plaintext,
          username: data.username,
          avatarUrl: data.avatar_url || "",
          scope: data.scope ?? null,
          connectedAt: data.connected_at,
        };
      }
    } catch {
      // fallback to local store
    }
  }

  const localConn = ctx.store.getGitHubConnection(userId);
  if (!localConn) return null;
  const decrypted = await decryptApiKey(
    decodeBytea(localConn.access_token_enc),
    ctx.keyring
  );
  return {
    token: decrypted.plaintext,
    username: localConn.username,
    avatarUrl: localConn.avatar_url || "",
    scope: localConn.scope,
    connectedAt: localConn.connected_at,
  };
}

function handleGitHubError(res: express.Response, err: unknown) {
  if (err instanceof GitHubApiError) {
    res.status(err.status).json({ code: err.code, error: err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : "GitHub operation failed.";
  res.status(400).json({ error: String(redactSecrets(msg)) });
}

export function createGitHubRouter(ctx: ServerContext): express.Router {
  const router = express.Router();
  const fetchImpl = ctx.fetchFn ?? fetch;

  // GET /api/github/status
  router.get("/status", async (req, res) => {
    const cfg = resolveGitHubOAuthConfig(req);
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      res.json({ configured: cfg.configured, connected: false, user: null });
      return;
    }

    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.json({ configured: cfg.configured, connected: false, user: null });
      return;
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from("github_connections")
          .select("github_user_id, username, avatar_url, scope, connected_at")
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (data) {
          res.json({
            configured: cfg.configured,
            connected: true,
            user: {
              id: data.github_user_id,
              username: data.username,
              avatarUrl: data.avatar_url || "",
            },
            scope: data.scope,
            connectedAt: data.connected_at,
          });
          return;
        }
      } catch {
        // fallback to local store
      }
    }

    const local = ctx.store.getGitHubConnection(auth.userId);
    if (!local) {
      res.json({ configured: cfg.configured, connected: false, user: null });
      return;
    }
    res.json({
      configured: cfg.configured,
      connected: true,
      user: {
        id: local.github_user_id,
        username: local.username,
        avatarUrl: local.avatar_url || "",
      },
      scope: local.scope,
      connectedAt: local.connected_at,
    });
  });

  // POST /api/github/oauth/start
  router.post("/oauth/start", async (req, res) => {
    const cfg = resolveGitHubOAuthConfig(req);
    if (!cfg.configured) {
      res.status(503).json({
        code: "GITHUB_NOT_CONFIGURED",
        error:
          "GitHub OAuth is not configured on the server yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      });
      return;
    }

    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const body = (req.body || {}) as { returnTo?: string };
    const returnTo =
      typeof body.returnTo === "string" && body.returnTo.startsWith("/") && !body.returnTo.startsWith("//")
        ? body.returnTo
        : "/web";

    const state = signOAuthState(
      {
        userId: auth.userId,
        nonce: crypto.randomBytes(12).toString("hex"),
        returnTo,
        exp: Date.now() + 10 * 60 * 1000,
      },
      ctx.signingSecret
    );

    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", cfg.clientId);
    authorizeUrl.searchParams.set("redirect_uri", cfg.redirectUri);
    authorizeUrl.searchParams.set("scope", "repo read:user");
    authorizeUrl.searchParams.set("state", state);

    res.json({ url: authorizeUrl.toString() });
  });

  // GET /api/github/callback
  router.get("/callback", async (req, res) => {
    const cfg = resolveGitHubOAuthConfig(req);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
    const ghError = typeof req.query.error === "string" ? req.query.error : "";

    const state = verifyOAuthState(stateRaw, ctx.signingSecret);
    const returnPath = state?.returnTo || "/web";

    if (ghError) {
      res.redirect(`${returnPath}?github=error&reason=${encodeURIComponent(ghError)}`);
      return;
    }
    if (!cfg.configured || !code || !state) {
      res.redirect(`${returnPath}?github=error&reason=invalid_oauth_state`);
      return;
    }

    try {
      const { accessToken, scope } = await exchangeOAuthCode({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        code,
        redirectUri: cfg.redirectUri,
        fetchFn: fetchImpl,
      });
      const ghUser = await fetchGitHubUser(accessToken, fetchImpl);
      const masterKey = typeof ctx.keyring === "string" ? ctx.keyring : ctx.masterSecret;
      const { encrypted, keyVersion } = await encryptApiKey(accessToken, masterKey);
      const now = new Date().toISOString();

      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        await supabaseAdmin.from("github_connections").upsert(
          {
            user_id: state.userId,
            github_user_id: ghUser.id,
            username: ghUser.username,
            avatar_url: ghUser.avatarUrl,
            scope,
            access_token_enc: encodeByteaHex(encrypted),
            key_version: keyVersion,
            connected_at: now,
            updated_at: now,
          },
          { onConflict: "user_id" }
        );
      }

      ctx.store.upsertGitHubConnection({
        user_id: state.userId,
        github_user_id: ghUser.id,
        username: ghUser.username,
        avatar_url: ghUser.avatarUrl,
        scope,
        access_token_enc: encodeByteaHex(encrypted),
        key_version: keyVersion,
        connected_at: now,
        updated_at: now,
      });

      ctx.store.writeAuditLog({
        actor_id: state.userId,
        action: "github.connect",
        target_type: "github_connection",
        target_id: ghUser.username,
        before: null,
        after: { username: ghUser.username, scope },
        ip: req.ip || null,
      });

      res.redirect(`${returnPath}?github=connected`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "oauth_failed";
      res.redirect(`${returnPath}?github=error&reason=${encodeURIComponent(msg)}`);
    }
  });

  // POST /api/github/disconnect
  router.post("/disconnect", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("github_connections").delete().eq("user_id", auth.userId);
      } catch {
        // ignore
      }
    }
    ctx.store.deleteGitHubConnection(auth.userId);
    ctx.store.writeAuditLog({
      actor_id: auth.userId,
      action: "github.disconnect",
      target_type: "github_connection",
      target_id: auth.userId,
      before: null,
      after: { disconnected: true },
      ip: req.ip || null,
    });
    res.json({ ok: true });
  });

  // GET /api/github/repos
  router.get("/repos", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    try {
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({ code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." });
        return;
      }
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const page = typeof req.query.page === "string" ? Number(req.query.page) : 1;
      const repos = await listUserRepos(conn.token, { page, perPage: 60, q }, fetchImpl);
      res.json({ repos });
    } catch (err) {
      handleGitHubError(res, err);
    }
  });

  // GET /api/github/repos/:owner/:repo/branches
  router.get("/repos/:owner/:repo/branches", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    try {
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({ code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." });
        return;
      }
      const branches = await listRepoBranches(conn.token, req.params.owner, req.params.repo, fetchImpl);
      res.json({ branches });
    } catch (err) {
      handleGitHubError(res, err);
    }
  });

  // GET /api/github/repos/:owner/:repo/tree
  router.get("/repos/:owner/:repo/tree", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    try {
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({ code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." });
        return;
      }
      const branch = typeof req.query.branch === "string" && req.query.branch.trim() ? req.query.branch.trim() : "main";
      const tree = await getRepoTree(conn.token, req.params.owner, req.params.repo, branch, fetchImpl);
      res.json({ tree });
    } catch (err) {
      handleGitHubError(res, err);
    }
  });

  // GET /api/github/repos/:owner/:repo/file
  router.get("/repos/:owner/:repo/file", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    try {
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({ code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." });
        return;
      }
      const filePath = typeof req.query.path === "string" ? req.query.path : "";
      const ref = typeof req.query.ref === "string" && req.query.ref.trim() ? req.query.ref.trim() : "main";
      const file = await getRepoFileContent(conn.token, req.params.owner, req.params.repo, filePath, ref, fetchImpl);
      res.json({ file });
    } catch (err) {
      handleGitHubError(res, err);
    }
  });

  // POST /api/github/repos/:owner/:repo/pr
  router.post("/repos/:owner/:repo/pr", async (req, res) => {
    const auth = await resolveAuthenticatedUser(req, ctx);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const body = (req.body || {}) as {
      baseBranch?: string;
      newBranch?: string;
      commitMessage?: string;
      prTitle?: string;
      prBody?: string;
      changes?: GitHubFileOperation[];
    };

    try {
      const conn = await getDecryptedGitHubTokenForUser(auth.userId, ctx);
      if (!conn) {
        res.status(401).json({ code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." });
        return;
      }

      const baseBranch = typeof body.baseBranch === "string" ? body.baseBranch.trim() : "";
      const newBranch = typeof body.newBranch === "string" ? body.newBranch.trim() : "";
      if (!baseBranch || !newBranch) {
        res.status(400).json({ error: "Both baseBranch and newBranch are required." });
        return;
      }

      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (changes.length === 0) {
        res.status(400).json({ error: "At least one file change is required to create a pull request." });
        return;
      }

      for (const c of changes) {
        validateRepoPath(c.path);
      }

      const commitRes = await createBranchAndCommitFiles(
        conn.token,
        {
          owner: req.params.owner,
          repo: req.params.repo,
          baseBranch,
          newBranch,
          commitMessage: body.commitMessage || `feat: ${body.prTitle || "Emdash AI changes"}`,
          changes,
        },
        fetchImpl
      );

      const pr = await createPullRequest(
        conn.token,
        {
          owner: req.params.owner,
          repo: req.params.repo,
          title: body.prTitle || body.commitMessage || "Changes by Emdash AI Agent",
          body: body.prBody || "Generated and reviewed via Emdash Web Coding Agent.",
          head: commitRes.branch,
          base: baseBranch,
        },
        fetchImpl
      );

      ctx.store.writeAuditLog({
        actor_id: auth.userId,
        action: "github.create_pr",
        target_type: "github_repo",
        target_id: `${req.params.owner}/${req.params.repo}`,
        before: { baseBranch },
        after: { branch: commitRes.branch, commitSha: commitRes.commitSha, prNumber: pr.number, prUrl: pr.url },
        ip: req.ip || null,
      });

      res.json({
        pr: {
          ...pr,
          commitSha: commitRes.commitSha,
        },
      });
    } catch (err) {
      handleGitHubError(res, err);
    }
  });

  return router;
}
