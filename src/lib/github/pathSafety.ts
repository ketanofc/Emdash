import type { GitHubDiffFile, GitHubDiffLine, GitHubOperationAction } from "./types.ts";

const SAFE_REPO_PART_RE = /^[A-Za-z0-9._-]+$/;
const SAFE_BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

export function validateRepoIdentifier(value: string, label = "repository"): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 100 || !SAFE_REPO_PART_RE.test(trimmed) || trimmed === "." || trimmed === "..") {
    throw new Error(`Invalid ${label} identifier.`);
  }
  return trimmed;
}

export function validateBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (
    !trimmed ||
    trimmed.length > 200 ||
    trimmed.startsWith("/") ||
    trimmed.endsWith("/") ||
    trimmed.includes("..") ||
    trimmed.includes("//") ||
    trimmed.includes("\\") ||
    trimmed.endsWith(".lock") ||
    !SAFE_BRANCH_RE.test(trimmed)
  ) {
    throw new Error("Invalid branch name.");
  }
  return trimmed;
}

/**
 * Validates and normalizes a repository-relative file path.
 * Blocks path traversal, absolute paths, backslashes, null bytes, and .git internals.
 */
export function validateRepoPath(rawPath: string): string {
  if (typeof rawPath !== "string") {
    throw new Error("File path must be a string.");
  }
  if (rawPath.includes("\0") || rawPath.includes("\\")) {
    throw new Error(`Unsafe characters in path: ${rawPath}`);
  }
  const trimmed = rawPath.trim().replace(/^\.\/+/, "");
  if (!trimmed || trimmed.startsWith("/") || trimmed.length > 500) {
    throw new Error(`Invalid repository path: ${rawPath}`);
  }
  const segments = trimmed.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg === ".git") {
      throw new Error(`Unsafe path segment in: ${rawPath}`);
    }
    if (/[\x00-\x1f\x7f]/.test(seg)) {
      throw new Error(`Control characters not allowed in path: ${rawPath}`);
    }
  }
  return segments.join("/");
}

/**
 * Computes a clean line-by-line diff suitable for UI review.
 */
export function computeUnifiedDiff(
  path: string,
  oldContent: string | null,
  newContent: string | null,
  action: GitHubOperationAction,
  reason?: string
): GitHubDiffFile {
  const oldLines = oldContent !== null ? oldContent.replace(/\r\n/g, "\n").split("\n") : [];
  const newLines = newContent !== null ? newContent.replace(/\r\n/g, "\n").split("\n") : [];

  if (action === "create") {
    const hunks: GitHubDiffLine[] = newLines.slice(0, 400).map((text, idx) => ({
      type: "add",
      newLine: idx + 1,
      text,
    }));
    return {
      path,
      action,
      added: newLines.length,
      removed: 0,
      hunks,
      newContent: newContent ?? "",
      oldContent: "",
      reason,
    };
  }

  if (action === "delete") {
    const hunks: GitHubDiffLine[] = oldLines.slice(0, 400).map((text, idx) => ({
      type: "del",
      oldLine: idx + 1,
      text,
    }));
    return {
      path,
      action,
      added: 0,
      removed: oldLines.length,
      hunks,
      newContent: "",
      oldContent: oldContent ?? "",
      reason,
    };
  }

  // LCS-based diff for bounded files, fallback to prefix/suffix diff for huge files
  const maxMatrix = 250;
  const hunks: GitHubDiffLine[] = [];
  let added = 0;
  let removed = 0;

  if (oldLines.length <= maxMatrix && newLines.length <= maxMatrix) {
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] =
          oldLines[i] === newLines[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (oldLines[i] === newLines[j]) {
        hunks.push({ type: "ctx", oldLine: i + 1, newLine: j + 1, text: oldLines[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        hunks.push({ type: "del", oldLine: i + 1, text: oldLines[i] });
        removed++;
        i++;
      } else {
        hunks.push({ type: "add", newLine: j + 1, text: newLines[j] });
        added++;
        j++;
      }
    }
    while (i < m) {
      hunks.push({ type: "del", oldLine: i + 1, text: oldLines[i] });
      removed++;
      i++;
    }
    while (j < n) {
      hunks.push({ type: "add", newLine: j + 1, text: newLines[j] });
      added++;
      j++;
    }

    // Compact long context runs while preserving 3 lines around changes
    const compacted = compactContextHunks(hunks, 3);
    return {
      path,
      action,
      added,
      removed,
      hunks: compacted,
      newContent: newContent ?? "",
      oldContent: oldContent ?? "",
      reason,
    };
  }

  // Fallback for large files: prefix/suffix trim
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const ctxStart = Math.max(0, prefix - 3);
  for (let k = ctxStart; k < prefix; k++) {
    hunks.push({ type: "ctx", oldLine: k + 1, newLine: k + 1, text: oldLines[k] });
  }
  for (let k = prefix; k < oldLines.length - suffix; k++) {
    hunks.push({ type: "del", oldLine: k + 1, text: oldLines[k] });
    removed++;
  }
  for (let k = prefix; k < newLines.length - suffix; k++) {
    hunks.push({ type: "add", newLine: k + 1, text: newLines[k] });
    added++;
  }
  const ctxEnd = Math.min(oldLines.length, oldLines.length - suffix + 3);
  for (let k = oldLines.length - suffix; k < ctxEnd; k++) {
    const newLineNum = newLines.length - (oldLines.length - k) + 1;
    hunks.push({ type: "ctx", oldLine: k + 1, newLine: newLineNum, text: oldLines[k] });
  }

  return {
    path,
    action,
    added,
    removed,
    hunks,
    newContent: newContent ?? "",
    oldContent: oldContent ?? "",
    reason,
  };
}

function compactContextHunks(lines: GitHubDiffLine[], contextRadius: number): GitHubDiffLine[] {
  const keep = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "ctx") {
      const start = Math.max(0, i - contextRadius);
      const end = Math.min(lines.length - 1, i + contextRadius);
      for (let k = start; k <= end; k++) {
        keep[k] = true;
      }
    }
  }
  const out: GitHubDiffLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      out.push(lines[i]);
    }
  }
  return out.slice(0, 400);
}
