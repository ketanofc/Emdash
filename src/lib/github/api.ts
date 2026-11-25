import {
  validateBranchName,
  validateRepoIdentifier,
  validateRepoPath,
} from "./pathSafety.ts";
import type {
  GitHubBranch,
  GitHubFileOperation,
  GitHubPullRequestResult,
  GitHubRepo,
  GitHubTreeEntry,
  GitHubUserProfile,
} from "./types.ts";

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.code = code;
  }
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function githubFetch<T>(
  pathOrUrl: string,
  token: string,
  init: RequestInit = {},
  fetchFn: typeof fetch = fetch
): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GITHUB_API_BASE}${pathOrUrl}`;
  const res = await fetchFn(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Emdash-Web-Agent",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = errJson.message || `GitHub API returned HTTP ${res.status}.`;
    if (res.status === 401) {
      throw new GitHubApiError(401, "GITHUB_TOKEN_EXPIRED", "GitHub session expired or revoked. Please reconnect GitHub.");
    }
    if (res.status === 403) {
      throw new GitHubApiError(403, "GITHUB_FORBIDDEN", msg);
    }
    if (res.status === 404) {
      throw new GitHubApiError(404, "GITHUB_NOT_FOUND", msg);
    }
    if (res.status === 422) {
      throw new GitHubApiError(422, "GITHUB_UNPROCESSABLE", msg);
    }
    throw new GitHubApiError(res.status, `GITHUB_${res.status}`, msg);
  }

  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

export async function exchangeOAuthCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<{ accessToken: string; scope: string }> {
  const fetchImpl = params.fetchFn ?? fetch;
  const res = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Emdash-Web-Agent",
    },
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || data.error || !data.access_token) {
    throw new GitHubApiError(
      400,
      "GITHUB_OAUTH_FAILED",
      data.error_description || data.error || "Failed to exchange GitHub OAuth code."
    );
  }

  return {
    accessToken: data.access_token,
    scope: data.scope || "repo,read:user",
  };
}

export async function fetchGitHubUser(
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<GitHubUserProfile> {
  const data = await githubFetch<{
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
  }>("/user", token, { method: "GET" }, fetchFn);

  return {
    id: String(data.id),
    username: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url || "",
  };
}

export async function listUserRepos(
  token: string,
  opts: { page?: number; perPage?: number; q?: string } = {},
  fetchFn: typeof fetch = fetch
): Promise<GitHubRepo[]> {
  const perPage = Math.min(Math.max(opts.perPage ?? 60, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);

  const raw = await githubFetch<
    Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      description: string | null;
      private: boolean;
      default_branch: string;
      language: string | null;
      updated_at: string;
      html_url: string;
    }>
  >(
    `/user/repos?sort=updated&direction=desc&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`,
    token,
    { method: "GET" },
    fetchFn
  );

  let repos = raw.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner?.login || r.full_name.split("/")[0] || "",
    description: r.description,
    private: Boolean(r.private),
    defaultBranch: r.default_branch || "main",
    language: r.language,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
  }));

  if (opts.q && opts.q.trim()) {
    const query = opts.q.trim().toLowerCase();
    repos = repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query)) ||
        (r.language && r.language.toLowerCase().includes(query))
    );
  }

  return repos;
}

export async function listRepoBranches(
  token: string,
  owner: string,
  repo: string,
  fetchFn: typeof fetch = fetch
): Promise<GitHubBranch[]> {
  const safeOwner = validateRepoIdentifier(owner, "owner");
  const safeRepo = validateRepoIdentifier(repo, "repo");
  const raw = await githubFetch<
    Array<{
      name: string;
      protected: boolean;
      commit: { sha: string };
    }>
  >(`/repos/${safeOwner}/${safeRepo}/branches?per_page=100`, token, { method: "GET" }, fetchFn);

  return raw.map((b) => ({
    name: b.name,
    protected: Boolean(b.protected),
    sha: b.commit?.sha || "",
  }));
}

export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  fetchFn: typeof fetch = fetch
): Promise<GitHubTreeEntry[]> {
  const safeOwner = validateRepoIdentifier(owner, "owner");
  const safeRepo = validateRepoIdentifier(repo, "repo");
  const safeBranch = validateBranchName(branch);

  const data = await githubFetch<{
    tree?: Array<{
      path?: string;
      type?: string;
      size?: number;
      sha?: string;
    }>;
  }>(
    `/repos/${safeOwner}/${safeRepo}/git/trees/${encodeURIComponent(safeBranch)}?recursive=1`,
    token,
    { method: "GET" },
    fetchFn
  );

  return (data.tree ?? [])
    .filter((entry) => entry.path && (entry.type === "blob" || entry.type === "tree"))
    .map((entry) => ({
      path: entry.path!,
      type: entry.type as "blob" | "tree",
      size: entry.size,
      sha: entry.sha || "",
    }));
}

export async function getRepoFileContent(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  ref: string,
  fetchFn: typeof fetch = fetch
): Promise<{ path: string; content: string; sha: string; size: number }> {
  const safeOwner = validateRepoIdentifier(owner, "owner");
  const safeRepo = validateRepoIdentifier(repo, "repo");
  const safePath = validateRepoPath(filePath);
  const safeRef = validateBranchName(ref);

  const encodedPath = safePath.split("/").map(encodeURIComponent).join("/");
  const data = await githubFetch<{
    type?: string;
    encoding?: string;
    content?: string;
    sha?: string;
    size?: number;
    path?: string;
  }>(
    `/repos/${safeOwner}/${safeRepo}/contents/${encodedPath}?ref=${encodeURIComponent(safeRef)}`,
    token,
    { method: "GET" },
    fetchFn
  );

  if (data.type !== "file") {
    throw new GitHubApiError(400, "NOT_A_FILE", `${safePath} is not a file.`);
  }

  const content =
    data.encoding === "base64" && typeof data.content === "string"
      ? decodeBase64Utf8(data.content)
      : typeof data.content === "string"
        ? data.content
        : "";

  return {
    path: data.path || safePath,
    content,
    sha: data.sha || "",
    size: data.size ?? content.length,
  };
}

export async function createBranchAndCommitFiles(
  token: string,
  params: {
    owner: string;
    repo: string;
    baseBranch: string;
    newBranch: string;
    commitMessage: string;
    changes: GitHubFileOperation[];
  },
  fetchFn: typeof fetch = fetch
): Promise<{ branch: string; commitSha: string }> {
  const safeOwner = validateRepoIdentifier(params.owner, "owner");
  const safeRepo = validateRepoIdentifier(params.repo, "repo");
  const safeBase = validateBranchName(params.baseBranch);
  const safeNew = validateBranchName(params.newBranch);

  if (safeNew === safeBase) {
    throw new GitHubApiError(
      400,
      "PROTECTED_BASE_BRANCH",
      "Agent changes must be committed to a new branch, never directly to the base branch."
    );
  }
  if (!params.changes || params.changes.length === 0) {
    throw new GitHubApiError(400, "NO_CHANGES", "No file changes to commit.");
  }

  // Validate all paths before touching GitHub
  const validatedChanges = params.changes.map((c) => ({
    ...c,
    path: validateRepoPath(c.path),
  }));

  // 1. Resolve base branch HEAD commit
  const baseRef = await githubFetch<{ object: { sha: string } }>(
    `/repos/${safeOwner}/${safeRepo}/git/ref/heads/${encodeURIComponent(safeBase)}`,
    token,
    { method: "GET" },
    fetchFn
  );
  const baseCommitSha = baseRef.object.sha;

  // 2. Resolve base tree SHA
  const baseCommit = await githubFetch<{ tree: { sha: string } }>(
    `/repos/${safeOwner}/${safeRepo}/git/commits/${baseCommitSha}`,
    token,
    { method: "GET" },
    fetchFn
  );
  const baseTreeSha = baseCommit.tree.sha;

  // 3. Create blobs for created/updated files
  const treeEntries: Array<{
    path: string;
    mode: string;
    type: "blob";
    sha: string | null;
  }> = [];

  for (const change of validatedChanges) {
    if (change.action === "delete") {
      treeEntries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: null,
      });
    } else {
      const blob = await githubFetch<{ sha: string }>(
        `/repos/${safeOwner}/${safeRepo}/git/blobs`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            content: encodeUtf8Base64(change.content ?? ""),
            encoding: "base64",
          }),
        },
        fetchFn
      );
      treeEntries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }
  }

  // 4. Create new tree
  const newTree = await githubFetch<{ sha: string }>(
    `/repos/${safeOwner}/${safeRepo}/git/trees`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    },
    fetchFn
  );

  // 5. Create commit
  const newCommit = await githubFetch<{ sha: string }>(
    `/repos/${safeOwner}/${safeRepo}/git/commits`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        message: params.commitMessage.trim() || "feat: apply Emdash AI agent changes",
        tree: newTree.sha,
        parents: [baseCommitSha],
      }),
    },
    fetchFn
  );

  // 6. Create or update branch ref
  try {
    await githubFetch(
      `/repos/${safeOwner}/${safeRepo}/git/refs`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${safeNew}`,
          sha: newCommit.sha,
        }),
      },
      fetchFn
    );
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 422) {
      // Branch already exists; update its ref
      await githubFetch(
        `/repos/${safeOwner}/${safeRepo}/git/refs/heads/${encodeURIComponent(safeNew)}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: newCommit.sha,
            force: false,
          }),
        },
        fetchFn
      );
    } else {
      throw err;
    }
  }

  return {
    branch: safeNew,
    commitSha: newCommit.sha,
  };
}

export async function createPullRequest(
  token: string,
  params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  },
  fetchFn: typeof fetch = fetch
): Promise<Omit<GitHubPullRequestResult, "commitSha">> {
  const safeOwner = validateRepoIdentifier(params.owner, "owner");
  const safeRepo = validateRepoIdentifier(params.repo, "repo");
  const safeHead = validateBranchName(params.head);
  const safeBase = validateBranchName(params.base);

  if (safeHead === safeBase) {
    throw new GitHubApiError(400, "SAME_BRANCH", "Pull request head branch must differ from base branch.");
  }

  const pr = await githubFetch<{
    number: number;
    html_url: string;
    title: string;
    state: string;
  }>(
    `/repos/${safeOwner}/${safeRepo}/pulls`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        title: params.title.trim() || "Changes by Emdash AI Agent",
        body: params.body.trim() || "Generated by Emdash Web Coding Agent.",
        head: safeHead,
        base: safeBase,
      }),
    },
    fetchFn
  );

  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    state: pr.state,
    branch: safeHead,
    baseBranch: safeBase,
  };
}
