export interface GitHubUserProfile {
  id: string;
  username: string;
  name?: string | null;
  avatarUrl: string;
}

export interface GitHubConnectionStatus {
  configured: boolean;
  connected: boolean;
  user: GitHubUserProfile | null;
  scope?: string | null;
  connectedAt?: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  htmlUrl: string;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  sha: string;
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

export type GitHubOperationAction = "create" | "update" | "delete";

export interface GitHubFileOperation {
  action: GitHubOperationAction;
  path: string;
  content?: string;
  reason?: string;
}

export interface GitHubDiffLine {
  type: "ctx" | "add" | "del";
  oldLine?: number;
  newLine?: number;
  text: string;
}

export interface GitHubDiffFile {
  path: string;
  action: GitHubOperationAction;
  added: number;
  removed: number;
  hunks: GitHubDiffLine[];
  newContent?: string;
  oldContent?: string;
  reason?: string;
}

export interface GitHubAgentRunResult {
  text: string;
  modelId: string;
  provider: string;
  inspectedFiles: string[];
  operations: GitHubFileOperation[];
  diffs: GitHubDiffFile[];
  suggestedBranch: string;
  suggestedCommitMessage: string;
  suggestedPrTitle: string;
  suggestedPrBody: string;
}

export interface GitHubPullRequestResult {
  number: number;
  url: string;
  title: string;
  state: string;
  branch: string;
  baseBranch: string;
  commitSha: string;
}
