import { getAuthHeaders } from "@/src/lib/supabase";
import type {
  GitHubBranch,
  GitHubConnectionStatus,
  GitHubFileOperation,
  GitHubPullRequestResult,
  GitHubRepo,
  GitHubTreeEntry,
} from "@/src/lib/github/types";

export class GitHubClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "GitHubClientError";
    this.status = status;
    this.code = code;
  }
}

async function ghFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(init.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    throw new GitHubClientError(
      res.status,
      json.error || `GitHub request failed (${res.status})`,
      json.code
    );
  }
  return json as T;
}

export async function fetchGitHubStatus(): Promise<GitHubConnectionStatus> {
  return await ghFetch<GitHubConnectionStatus>("/api/github/status");
}

export async function startGitHubOAuth(returnTo = "/web"): Promise<string> {
  const res = await ghFetch<{ url: string }>("/api/github/oauth/start", {
    method: "POST",
    body: JSON.stringify({ returnTo }),
  });
  return res.url;
}

export async function disconnectGitHub(): Promise<void> {
  await ghFetch<{ ok: boolean }>("/api/github/disconnect", { method: "POST" });
}

export async function fetchGitHubRepos(q?: string): Promise<GitHubRepo[]> {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const res = await ghFetch<{ repos: GitHubRepo[] }>(`/api/github/repos${qs ? `?${qs}` : ""}`);
  return res.repos ?? [];
}

export async function fetchRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  const res = await ghFetch<{ branches: GitHubBranch[] }>(
    `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`
  );
  return res.branches ?? [];
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeEntry[]> {
  const res = await ghFetch<{ tree: GitHubTreeEntry[] }>(
    `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?branch=${encodeURIComponent(branch)}`
  );
  return res.tree ?? [];
}

export async function fetchRepoFile(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<{ path: string; content: string; sha: string; size: number }> {
  const res = await ghFetch<{
    file: { path: string; content: string; sha: string; size: number };
  }>(
    `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`
  );
  return res.file;
}

export async function createGitHubPullRequest(params: {
  owner: string;
  repo: string;
  baseBranch: string;
  newBranch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changes: GitHubFileOperation[];
}): Promise<GitHubPullRequestResult> {
  const res = await ghFetch<{ pr: GitHubPullRequestResult }>(
    `/api/github/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/pr`,
    {
      method: "POST",
      body: JSON.stringify({
        baseBranch: params.baseBranch,
        newBranch: params.newBranch,
        commitMessage: params.commitMessage,
        prTitle: params.prTitle,
        prBody: params.prBody,
        changes: params.changes,
      }),
    }
  );
  return res.pr;
}
