import { getRepoFileContent } from "./api.ts";
import { computeUnifiedDiff, validateBranchName, validateRepoPath } from "./pathSafety.ts";
import type {
  GitHubDiffFile,
  GitHubFileOperation,
  GitHubTreeEntry,
} from "./types.ts";

const PRIORITY_FILES = [
  "package.json",
  "tsconfig.json",
  "README.md",
  "index.html",
  "vite.config.ts",
  "vite.config.js",
  "next.config.ts",
  "next.config.mjs",
  "src/App.tsx",
  "src/main.tsx",
  "src/index.css",
  "app/layout.tsx",
  "app/page.tsx",
];

const IGNORED_PREFIXES = [
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  ".git/",
  "coverage/",
];

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "svg", "woff", "woff2", "ttf", "eot",
  "pdf", "zip", "tar", "gz", "mp4", "mp3", "wav", "lock",
]);

function isInspectableFile(path: string, size?: number): boolean {
  if (IGNORED_PREFIXES.some((p) => path.startsWith(p))) return false;
  if (size !== undefined && size > 120_000) return false;
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (BINARY_EXTENSIONS.has(ext)) return false;
  if (path.endsWith("package-lock.json") || path.endsWith("bun.lock") || path.endsWith("yarn.lock")) {
    return false;
  }
  return true;
}

/**
 * Selects the most relevant files from the repository tree based on priority config files
 * and keyword overlap with the user's coding instruction.
 */
export function selectContextFiles(
  tree: GitHubTreeEntry[],
  prompt: string,
  maxFiles = 10
): string[] {
  const blobs = tree.filter((e) => e.type === "blob" && isInspectableFile(e.path, e.size));
  const blobSet = new Set(blobs.map((b) => b.path));
  const selected: string[] = [];

  for (const p of PRIORITY_FILES) {
    if (blobSet.has(p) && !selected.includes(p)) {
      selected.push(p);
    }
    if (selected.length >= 4) break;
  }

  const keywords = prompt
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((w) => w.length >= 3);

  const scored = blobs
    .filter((b) => !selected.includes(b.path))
    .map((b) => {
      const lower = b.path.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score += 3;
      }
      if (lower.startsWith("src/")) score += 1;
      return { path: b.path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  for (const item of scored) {
    if (selected.length >= maxFiles) break;
    selected.push(item.path);
  }

  return selected;
}

export function isExplicitDeleteRequested(prompt: string): boolean {
  return /\b(delete|remove|drop|unlink)\b/i.test(prompt);
}

export function buildRepoAgentSystemPrompt(params: {
  owner: string;
  repo: string;
  branch: string;
  mode: "build" | "plan";
  treePaths: string[];
  fileContexts: Array<{ path: string; content: string }>;
}): string {
  const treePreview = params.treePaths.slice(0, 220).join("\n");
  const filesBlock = params.fileContexts
    .map((f) => `--- FILE: ${f.path} ---\n${f.content.slice(0, 8000)}`)
    .join("\n\n");

  if (params.mode === "plan") {
    return `You are Emdash AI Web Coding Agent in PLAN mode.
Target GitHub repository: ${params.owner}/${params.repo} (branch: ${params.branch}).

Repository File Tree (subset):
${treePreview}

Inspected File Contents:
${filesBlock}

Analyze the real codebase above (framework, dependencies, architecture, and conventions) and provide a concise, actionable technical plan with specific file paths and implementation steps.`;
  }

  return `You are Emdash AI Web Coding Agent in BUILD mode.
Target GitHub repository: ${params.owner}/${params.repo} (branch: ${params.branch}).

Repository File Tree (subset):
${treePreview}

Inspected File Contents:
${filesBlock}

Instructions:
1. Analyze the existing codebase, framework, dependencies, and conventions before proposing changes.
2. Only modify or create files needed for the user's request. Never delete files unless explicitly instructed.
3. Return ONLY a valid JSON object (no surrounding prose outside JSON) with this exact schema:
{
  "summary": "Clear markdown summary of what was analyzed and changed",
  "suggestedBranch": "emdash/short-kebab-slug",
  "commitMessage": "feat: concise commit message",
  "prTitle": "Concise Pull Request title",
  "prBody": "Markdown PR description listing modified files and rationale",
  "operations": [
    {
      "action": "create" | "update" | "delete",
      "path": "relative/path/to/file.ext",
      "content": "full updated file content (required for create and update)",
      "reason": "short explanation"
    }
  ]
}`;
}

export interface ParsedAgentBuildOutput {
  summary: string;
  suggestedBranch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  operations: GitHubFileOperation[];
}

export function parseAgentStructuredResponse(
  rawText: string,
  fallbackPrompt: string
): ParsedAgentBuildOutput {
  const slug = fallbackPrompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28) || "agent-update";
  const defaultBranch = `emdash/${slug}-${Date.now().toString(36).slice(-4)}`;

  const trimmed = rawText.trim();
  let jsonCandidate = trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    jsonCandidate = fenceMatch[1].trim();
  } else {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as Partial<ParsedAgentBuildOutput>;
    if (typeof parsed.summary === "string" || Array.isArray(parsed.operations)) {
      let safeBranch = defaultBranch;
      if (typeof parsed.suggestedBranch === "string") {
        try {
          safeBranch = validateBranchName(parsed.suggestedBranch);
        } catch {
          safeBranch = defaultBranch;
        }
      }
      const ops: GitHubFileOperation[] = Array.isArray(parsed.operations)
        ? parsed.operations
            .filter(
              (op): op is GitHubFileOperation =>
                Boolean(op) &&
                (op.action === "create" || op.action === "update" || op.action === "delete") &&
                typeof op.path === "string"
            )
            .map((op) => ({
              action: op.action,
              path: op.path,
              content: typeof op.content === "string" ? op.content : "",
              reason: typeof op.reason === "string" ? op.reason : undefined,
            }))
        : [];

      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : trimmed,
        suggestedBranch: safeBranch,
        commitMessage:
          typeof parsed.commitMessage === "string" && parsed.commitMessage.trim()
            ? parsed.commitMessage.trim()
            : `feat: ${fallbackPrompt.slice(0, 60)}`,
        prTitle:
          typeof parsed.prTitle === "string" && parsed.prTitle.trim()
            ? parsed.prTitle.trim()
            : fallbackPrompt.slice(0, 72),
        prBody:
          typeof parsed.prBody === "string" && parsed.prBody.trim()
            ? parsed.prBody.trim()
            : `Implemented requested changes for: ${fallbackPrompt}`,
        operations: ops,
      };
    }
  } catch {
    // Plain text fallback if model didn't return JSON
  }

  return {
    summary: trimmed,
    suggestedBranch: defaultBranch,
    commitMessage: `feat: ${fallbackPrompt.slice(0, 60)}`,
    prTitle: fallbackPrompt.slice(0, 72),
    prBody: `Implemented requested changes for: ${fallbackPrompt}`,
    operations: [],
  };
}

export async function validateAndBuildDiffs(params: {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
  operations: GitHubFileOperation[];
  existingFilesCache: Map<string, string>;
  explicitDeleteAllowed: boolean;
  fetchFn?: typeof fetch;
}): Promise<{ operations: GitHubFileOperation[]; diffs: GitHubDiffFile[] }> {
  const validOps: GitHubFileOperation[] = [];
  const diffs: GitHubDiffFile[] = [];

  for (const op of params.operations) {
    let safePath: string;
    try {
      safePath = validateRepoPath(op.path);
    } catch {
      continue;
    }

    if (op.action === "delete" && !params.explicitDeleteAllowed) {
      continue;
    }

    let oldContent: string | null = params.existingFilesCache.get(safePath) ?? null;
    if (oldContent === null && (op.action === "update" || op.action === "delete")) {
      try {
        const fetched = await getRepoFileContent(
          params.token,
          params.owner,
          params.repo,
          safePath,
          params.baseBranch,
          params.fetchFn
        );
        oldContent = fetched.content;
        params.existingFilesCache.set(safePath, oldContent);
      } catch {
        oldContent = "";
      }
    }

    const cleanOp: GitHubFileOperation = {
      action: op.action,
      path: safePath,
      content: op.action === "delete" ? undefined : op.content ?? "",
      reason: op.reason,
    };
    validOps.push(cleanOp);

    diffs.push(
      computeUnifiedDiff(
        safePath,
        oldContent,
        op.action === "delete" ? null : cleanOp.content ?? "",
        op.action,
        op.reason
      )
    );
  }

  return { operations: validOps, diffs };
}
