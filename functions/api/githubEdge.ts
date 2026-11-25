import type { SupabaseClient } from "@supabase/supabase-js";
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
} from "../../src/lib/github/api.ts";
import {
  buildRepoAgentSystemPrompt,
  isExplicitDeleteRequested,
  parseAgentStructuredResponse,
  selectContextFiles,
  validateAndBuildDiffs,
} from "../../src/lib/github/agent.ts";
import { validateRepoPath } from "../../src/lib/github/pathSafety.ts";
import type { GitHubFileOperation } from "../../src/lib/github/types.ts";
import {
  decodeBytea,
  decryptApiKey,
  encodeByteaHex,
  encryptApiKey,
  redactSecrets,
} from "../../src/lib/llm/crypto.ts";

export interface EdgeGitHubEnv {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  KEY_ENCRYPTION_SECRET?: string;
  SESSION_SIGNING_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  APP_URL?: string;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeStr(str: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(str));
}

function base64UrlDecodeStr(str: string): string {
  let padded = str.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) padded += "=";
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSign(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

async function resolveMasterKeyBase64(env: EdgeGitHubEnv, signingSecret: string): Promise<string> {
  const explicit = env.KEY_ENCRYPTION_SECRET?.trim();
  if (explicit) return explicit;
  // Derive deterministic 32-byte AES key from server signing secret via SHA-256
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`emdash-gh-aes:${signingSecret}`)
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function resolveEdgeUser(
  request: Request,
  supabaseAdmin: SupabaseClient | null,
  verifyLocalToken: (token: string) => Promise<{ userId: string; email: string } | null>
): Promise<{ ok: true; userId: string; email: string } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Authentication required." };

  const local = await verifyLocalToken(token);
  if (local) return { ok: true, userId: local.userId, email: local.email };

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        return { ok: true, userId: data.user.id, email: data.user.email || "" };
      }
    } catch {
      // ignore
    }
  }
  return { ok: false, status: 401, error: "Invalid or expired session." };
}

function resolveWebAgentModelId(provider: string, selectedModel: string): string {
  const clean = selectedModel.trim();
  if (provider === "gemini") {
    if (/^gemini-/i.test(clean)) return clean;
    if (/pro/i.test(clean)) return "gemini-2.5-pro";
    return "gemini-2.5-flash";
  }
  if (provider === "openai") {
    if (/^(gpt-|o[134]-)/i.test(clean)) return clean;
    return "gpt-4o-mini";
  }
  if (provider === "anthropic") {
    if (/^claude-/i.test(clean)) return clean;
    return "claude-sonnet-4-20250514";
  }
  if (clean.includes("/")) return clean;
  if (/pro/i.test(clean)) return "google/gemini-2.5-pro";
  if (/claude/i.test(clean)) return "anthropic/claude-sonnet-4";
  if (/gpt/i.test(clean)) return "openai/gpt-4o-mini";
  return "google/gemini-2.5-flash";
}

export async function handleEdgeGitHubAndAgent(params: {
  request: Request;
  path: string;
  method: string;
  env: EdgeGitHubEnv;
  signingSecret: string;
  supabaseAdmin: SupabaseClient | null;
  verifyLocalToken: (token: string) => Promise<{ userId: string; email: string } | null>;
  jsonResponse: (data: unknown, status?: number, req?: Request) => Response;
  errorResponse: (error: string, status?: number, req?: Request) => Response;
}): Promise<Response | null> {
  const {
    request,
    path,
    method,
    env,
    signingSecret,
    supabaseAdmin,
    verifyLocalToken,
    jsonResponse,
    errorResponse,
  } = params;

  const url = new URL(request.url);
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET || "").trim();
  const configured = Boolean(clientId && clientSecret);
  const origin = (env.APP_URL || url.origin).replace(/\/+$/, "");
  const redirectUri = (env.GITHUB_REDIRECT_URI || `${origin}/api/github/callback`).trim();

  // 1. GET /api/github/status
  if (path === "/api/github/status" && method === "GET") {
    const auth = await resolveEdgeUser(request, supabaseAdmin, verifyLocalToken);
    if (!auth.ok || !supabaseAdmin) {
      return jsonResponse({ configured, connected: false, user: null }, 200, request);
    }
    try {
      const { data } = await supabaseAdmin
        .from("github_connections")
        .select("github_user_id, username, avatar_url, scope, connected_at")
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (!data) {
        return jsonResponse({ configured, connected: false, user: null }, 200, request);
      }
      return jsonResponse(
        {
          configured,
          connected: true,
          user: {
            id: data.github_user_id,
            username: data.username,
            avatarUrl: data.avatar_url || "",
          },
          scope: data.scope,
          connectedAt: data.connected_at,
        },
        200,
        request
      );
    } catch {
      return jsonResponse({ configured, connected: false, user: null }, 200, request);
    }
  }

  // 2. POST /api/github/oauth/start
  if (path === "/api/github/oauth/start" && method === "POST") {
    if (!configured) {
      return jsonResponse(
        {
          code: "GITHUB_NOT_CONFIGURED",
          error:
            "GitHub OAuth is not configured on the server yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare environment variables.",
        },
        503,
        request
      );
    }
    const auth = await resolveEdgeUser(request, supabaseAdmin, verifyLocalToken);
    if (!auth.ok) return errorResponse(auth.error, auth.status, request);

    let body: { returnTo?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      // ignore
    }
    const returnTo =
      typeof body.returnTo === "string" && body.returnTo.startsWith("/") && !body.returnTo.startsWith("//")
        ? body.returnTo
        : "/web";

    const payloadStr = base64UrlEncodeStr(
      JSON.stringify({
        userId: auth.userId,
        nonce: crypto.randomUUID(),
        returnTo,
        exp: Date.now() + 10 * 60 * 1000,
      })
    );
    const sig = await hmacSign(signingSecret, `gh-oauth:${payloadStr}`);
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "repo read:user");
    authorizeUrl.searchParams.set("state", `${payloadStr}.${sig}`);

    return jsonResponse({ url: authorizeUrl.toString() }, 200, request);
  }

  // 3. GET /api/github/callback
  if (path === "/api/github/callback" && method === "GET") {
    const code = url.searchParams.get("code") || "";
    const stateRaw = url.searchParams.get("state") || "";
    const ghError = url.searchParams.get("error") || "";

    let parsedState: { userId?: string; returnTo?: string; exp?: number } | null = null;
    const [payloadStr, sig] = stateRaw.split(".");
    if (payloadStr && sig) {
      const expected = await hmacSign(signingSecret, `gh-oauth:${payloadStr}`);
      if (expected === sig) {
        try {
          const p = JSON.parse(base64UrlDecodeStr(payloadStr)) as {
            userId?: string;
            returnTo?: string;
            exp?: number;
          };
          if (p.userId && p.exp && p.exp >= Date.now()) {
            parsedState = p;
          }
        } catch {
          parsedState = null;
        }
      }
    }

    const returnPath = parsedState?.returnTo || "/web";
    if (ghError) {
      return Response.redirect(`${origin}${returnPath}?github=error&reason=${encodeURIComponent(ghError)}`, 302);
    }
    if (!configured || !code || !parsedState?.userId || !supabaseAdmin) {
      return Response.redirect(`${origin}${returnPath}?github=error&reason=invalid_oauth_state`, 302);
    }

    try {
      const { accessToken, scope } = await exchangeOAuthCode({
        clientId,
        clientSecret,
        code,
        redirectUri,
      });
      const ghUser = await fetchGitHubUser(accessToken);
      const masterKey = await resolveMasterKeyBase64(env, signingSecret);
      const { encrypted, keyVersion } = await encryptApiKey(accessToken, masterKey);
      const now = new Date().toISOString();

      await supabaseAdmin.from("github_connections").upsert(
        {
          user_id: parsedState.userId,
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

      return Response.redirect(`${origin}${returnPath}?github=connected`, 302);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "oauth_failed";
      return Response.redirect(`${origin}${returnPath}?github=error&reason=${encodeURIComponent(msg)}`, 302);
    }
  }

  // 4. POST /api/github/disconnect
  if (path === "/api/github/disconnect" && method === "POST") {
    const auth = await resolveEdgeUser(request, supabaseAdmin, verifyLocalToken);
    if (!auth.ok) return errorResponse(auth.error, auth.status, request);
    if (supabaseAdmin) {
      await supabaseAdmin.from("github_connections").delete().eq("user_id", auth.userId);
    }
    return jsonResponse({ ok: true }, 200, request);
  }

  // Helper to get decrypted GitHub token for the authenticated user
  const requireUserToken = async (): Promise<
    { ok: true; userId: string; token: string } | { ok: false; res: Response }
  > => {
    const auth = await resolveEdgeUser(request, supabaseAdmin, verifyLocalToken);
    if (!auth.ok) {
      return { ok: false, res: errorResponse(auth.error, auth.status, request) };
    }
    if (!supabaseAdmin) {
      return {
        ok: false,
        res: jsonResponse(
          { code: "GITHUB_NOT_CONNECTED", error: "Database connection unavailable." },
          503,
          request
        ),
      };
    }
    const { data } = await supabaseAdmin
      .from("github_connections")
      .select("access_token_enc")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!data?.access_token_enc) {
      return {
        ok: false,
        res: jsonResponse(
          { code: "GITHUB_NOT_CONNECTED", error: "GitHub account is not connected." },
          401,
          request
        ),
      };
    }
    const masterKey = await resolveMasterKeyBase64(env, signingSecret);
    const decrypted = await decryptApiKey(decodeBytea(data.access_token_enc), masterKey);
    return { ok: true, userId: auth.userId, token: decrypted.plaintext };
  };

  // 5. GET /api/github/repos
  if (path === "/api/github/repos" && method === "GET") {
    const tok = await requireUserToken();
    if (!tok.ok) return tok.res;
    try {
      const q = url.searchParams.get("q") || undefined;
      const page = Number(url.searchParams.get("page") || "1") || 1;
      const repos = await listUserRepos(tok.token, { page, perPage: 60, q });
      return jsonResponse({ repos }, 200, request);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        return jsonResponse({ code: err.code, error: err.message }, err.status, request);
      }
      return errorResponse(err instanceof Error ? err.message : "Failed to list repositories.", 400, request);
    }
  }

  // 6. Repo sub-routes: /api/github/repos/:owner/:repo/(branches|tree|file|pr)
  const repoMatch = path.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/(branches|tree|file|pr)$/);
  if (repoMatch) {
    const [, rawOwner, rawRepo, action] = repoMatch;
    const owner = decodeURIComponent(rawOwner);
    const repo = decodeURIComponent(rawRepo);
    const tok = await requireUserToken();
    if (!tok.ok) return tok.res;

    try {
      if (action === "branches" && method === "GET") {
        const branches = await listRepoBranches(tok.token, owner, repo);
        return jsonResponse({ branches }, 200, request);
      }
      if (action === "tree" && method === "GET") {
        const branch = url.searchParams.get("branch")?.trim() || "main";
        const tree = await getRepoTree(tok.token, owner, repo, branch);
        return jsonResponse({ tree }, 200, request);
      }
      if (action === "file" && method === "GET") {
        const filePath = url.searchParams.get("path") || "";
        const ref = url.searchParams.get("ref")?.trim() || "main";
        const file = await getRepoFileContent(tok.token, owner, repo, filePath, ref);
        return jsonResponse({ file }, 200, request);
      }
      if (action === "pr" && method === "POST") {
        const body = (await request.json().catch(() => ({}))) as {
          baseBranch?: string;
          newBranch?: string;
          commitMessage?: string;
          prTitle?: string;
          prBody?: string;
          changes?: GitHubFileOperation[];
        };
        const baseBranch = (body.baseBranch || "").trim();
        const newBranch = (body.newBranch || "").trim();
        if (!baseBranch || !newBranch) {
          return errorResponse("Both baseBranch and newBranch are required.", 400, request);
        }
        const changes = Array.isArray(body.changes) ? body.changes : [];
        if (changes.length === 0) {
          return errorResponse("At least one file change is required to create a pull request.", 400, request);
        }
        for (const c of changes) validateRepoPath(c.path);

        const commitRes = await createBranchAndCommitFiles(tok.token, {
          owner,
          repo,
          baseBranch,
          newBranch,
          commitMessage: body.commitMessage || `feat: ${body.prTitle || "Emdash AI changes"}`,
          changes,
        });
        const pr = await createPullRequest(tok.token, {
          owner,
          repo,
          title: body.prTitle || body.commitMessage || "Changes by Emdash AI Agent",
          body: body.prBody || "Generated and reviewed via Emdash Web Coding Agent.",
          head: commitRes.branch,
          base: baseBranch,
        });
        return jsonResponse({ pr: { ...pr, commitSha: commitRes.commitSha } }, 200, request);
      }
    } catch (err) {
      if (err instanceof GitHubApiError) {
        return jsonResponse({ code: err.code, error: err.message }, err.status, request);
      }
      return errorResponse(err instanceof Error ? err.message : "GitHub operation failed.", 400, request);
    }
  }

  // 7. POST /api/web-agent/chat (with optional real GitHub repo context)
  if (path === "/api/web-agent/chat" && method === "POST") {
    let body: {
      provider?: string;
      apiKey?: string;
      model?: string;
      mode?: "build" | "plan";
      prompt?: string;
      history?: Array<{ role: "user" | "assistant"; text: string }>;
      projectName?: string;
      repoOwner?: string;
      repoName?: string;
      branch?: string;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return errorResponse("Invalid JSON payload.", 400, request);
    }

    const rawProvider = (body.provider || "gemini").trim().toLowerCase();
    const provider =
      rawProvider === "openai" || rawProvider === "anthropic" || rawProvider === "openrouter"
        ? rawProvider
        : "gemini";
    const apiKey = (body.apiKey || "").trim();
    const prompt = (body.prompt || "").trim();
    const mode = body.mode === "plan" ? "plan" : "build";
    const modelId = resolveWebAgentModelId(provider, body.model || "Gemini Flash");

    if (!apiKey) {
      return jsonResponse(
        { code: "MISSING_KEY", error: "Please enter your API key in Settings to run the agent." },
        400,
        request
      );
    }
    if (!prompt) {
      return jsonResponse({ code: "MISSING_PROMPT", error: "Prompt is required." }, 400, request);
    }

    const repoOwner = (body.repoOwner || "").trim();
    const repoName = (body.repoName || "").trim();
    const branch = (body.branch || "main").trim() || "main";
    const hasRepo = Boolean(repoOwner && repoName);

    let githubToken: string | null = null;
    const inspectedFiles: string[] = [];
    const existingFilesCache = new Map<string, string>();
    let system: string;

    if (hasRepo) {
      const tok = await requireUserToken();
      if (!tok.ok) return tok.res;
      githubToken = tok.token;

      try {
        const tree = await getRepoTree(githubToken, repoOwner, repoName, branch);
        const contextPaths = selectContextFiles(tree, prompt, 10);
        const fileContexts: Array<{ path: string; content: string }> = [];
        for (const p of contextPaths) {
          try {
            const f = await getRepoFileContent(githubToken, repoOwner, repoName, p, branch);
            fileContexts.push({ path: f.path, content: f.content });
            existingFilesCache.set(f.path, f.content);
            inspectedFiles.push(f.path);
          } catch {
            // skip unreadable
          }
        }
        system = buildRepoAgentSystemPrompt({
          owner: repoOwner,
          repo: repoName,
          branch,
          mode,
          treePaths: tree.filter((t) => t.type === "blob").map((t) => t.path),
          fileContexts,
        });
      } catch (err) {
        if (err instanceof GitHubApiError) {
          return jsonResponse({ code: err.code, error: err.message }, err.status, request);
        }
        return errorResponse("Failed to read repository context.", 500, request);
      }
    } else {
      const repoContext = body.projectName
        ? `Active repository: ${body.projectName} (branch: ${branch}).`
        : "No repository connected yet (standalone web agent session).";
      system =
        mode === "plan"
          ? `You are Emdash Web Agent in PLAN mode. ${repoContext} Provide a concise, structured technical plan.`
          : `You are Emdash Web Agent in BUILD mode. ${repoContext} Deliver concise, production-ready engineering guidance.`;
    }

    const historyBlock = Array.isArray(body.history) && body.history.length > 0
      ? body.history
          .slice(-8)
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.text || "").slice(0, 3000)}`)
          .join("\n\n")
      : "";
    const composedPrompt = historyBlock
      ? `Previous conversation:\n${historyBlock}\n\nCurrent request:\n${prompt}`
      : prompt;
    const maxTokens = hasRepo && mode === "build" ? 8192 : 2048;

    try {
      let rawText = "";
      if (provider === "gemini") {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: composedPrompt }] }],
              generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
            }),
          }
        );
        if (!gRes.ok) {
          const errText = await gRes.text().catch(() => "");
          return jsonResponse(
            { error: String(redactSecrets(`Gemini HTTP ${gRes.status}: ${errText.slice(0, 200)}`)) },
            gRes.status >= 400 ? gRes.status : 502,
            request
          );
        }
        const gData = (await gRes.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        rawText =
          gData.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      } else if (provider === "anthropic") {
        const aRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: composedPrompt }],
          }),
        });
        if (!aRes.ok) {
          return jsonResponse({ error: `Anthropic HTTP ${aRes.status}` }, aRes.status, request);
        }
        const aData = (await aRes.json()) as { content?: Array<{ type?: string; text?: string }> };
        rawText = (aData.content ?? [])
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text)
          .join("\n");
      } else {
        const base =
          provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
        const oRes = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(provider === "openrouter" ? { "X-Title": "Emdash" } : {}),
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: maxTokens,
            messages: [
              { role: "system", content: system },
              { role: "user", content: composedPrompt },
            ],
          }),
        });
        if (!oRes.ok) {
          return jsonResponse({ error: `Provider HTTP ${oRes.status}` }, oRes.status, request);
        }
        const oData = (await oRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        rawText = oData.choices?.[0]?.message?.content || "";
      }

      if (!rawText.trim()) {
        return jsonResponse({ error: "Model returned an empty response." }, 502, request);
      }

      if (!hasRepo || mode === "plan" || !githubToken) {
        return jsonResponse({ text: rawText, modelId, provider, inspectedFiles }, 200, request);
      }

      const parsed = parseAgentStructuredResponse(rawText, prompt);
      const { operations, diffs } = await validateAndBuildDiffs({
        token: githubToken,
        owner: repoOwner,
        repo: repoName,
        baseBranch: branch,
        operations: parsed.operations,
        existingFilesCache,
        explicitDeleteAllowed: isExplicitDeleteRequested(prompt),
      });

      return jsonResponse(
        {
          text: parsed.summary,
          modelId,
          provider,
          inspectedFiles,
          operations,
          diffs,
          suggestedBranch: parsed.suggestedBranch,
          suggestedCommitMessage: parsed.commitMessage,
          suggestedPrTitle: parsed.prTitle,
          suggestedPrBody: parsed.prBody,
        },
        200,
        request
      );
    } catch (err) {
      return errorResponse(
        String(redactSecrets(err instanceof Error ? err.message : "Agent request failed.")),
        500,
        request
      );
    }
  }

  return null;
}
