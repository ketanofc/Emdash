import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, GitBranch, GitPullRequest, Loader2, X } from "lucide-react";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { Button } from "@/src/components/ui/button";
import { createGitHubPullRequest } from "@/src/lib/githubApiClient";
import type {
  GitHubFileOperation,
  GitHubPullRequestResult,
  GitHubRepo,
} from "@/src/lib/github/types";

interface GitHubPrModalProps {
  open: boolean;
  onClose: () => void;
  repo: GitHubRepo;
  baseBranch: string;
  initialBranch: string;
  initialCommitMessage: string;
  initialPrTitle: string;
  initialPrBody: string;
  changes: GitHubFileOperation[];
  onPrCreated: (pr: GitHubPullRequestResult) => void;
}

export function GitHubPrModal({
  open,
  onClose,
  repo,
  baseBranch,
  initialBranch,
  initialCommitMessage,
  initialPrTitle,
  initialPrBody,
  changes,
  onPrCreated,
}: GitHubPrModalProps) {
  const [newBranch, setNewBranch] = useState(initialBranch);
  const [commitMessage, setCommitMessage] = useState(initialCommitMessage);
  const [prTitle, setPrTitle] = useState(initialPrTitle);
  const [prBody, setPrBody] = useState(initialPrBody);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPr, setCreatedPr] = useState<GitHubPullRequestResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewBranch(initialBranch);
    setCommitMessage(initialCommitMessage);
    setPrTitle(initialPrTitle);
    setPrBody(initialPrBody);
    setError(null);
    setCreatedPr(null);
  }, [open, initialBranch, initialCommitMessage, initialPrTitle, initialPrBody]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBranch.trim() === baseBranch.trim()) {
      setError(`Target branch cannot be '${baseBranch}'. Changes must go to a new branch.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pr = await createGitHubPullRequest({
        owner: repo.owner,
        repo: repo.name,
        baseBranch,
        newBranch: newBranch.trim(),
        commitMessage: commitMessage.trim(),
        prTitle: prTitle.trim(),
        prBody: prBody.trim(),
        changes,
      });
      setCreatedPr(pr);
      onPrCreated(pr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push branch and create pull request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Pull Request"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg border border-edge bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CornerBrackets />

        <div className="flex items-center justify-between pb-3 border-b border-edge">
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-4 text-[#c23800] dark:text-[#ff7a3d]" />
            <h2 className="font-mono uppercase text-xs font-semibold tracking-wider text-foreground">
              Push Branch &amp; Create Pull Request
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label="Close PR dialog"
            className="size-7 border-edge bg-background"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {createdPr ? (
          <div className="py-5 space-y-4 font-mono text-xs">
            <div className="border border-emerald-500/40 bg-emerald-500/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
                <CheckCircle2 className="size-4" />
                <span>Pull Request #{createdPr.number} Opened</span>
              </div>
              <p className="text-foreground font-sans text-xs">
                {createdPr.title}
              </p>
              <div className="text-[11px] text-muted-foreground">
                Branch <code>{createdPr.branch}</code> → <code>{createdPr.baseBranch}</code> · Commit{" "}
                <code>{createdPr.commitSha.slice(0, 7)}</code>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <a
                href={createdPr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-primary bg-primary text-primary-foreground font-mono uppercase text-[10px] hover:opacity-90"
              >
                <span>Open PR on GitHub</span>
                <ExternalLink className="size-3" />
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-edge font-mono uppercase text-[10px]"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="py-4 space-y-3 font-mono text-xs">
            <div className="border border-edge bg-background px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {repo.fullName} · {changes.length} file(s)
              </span>
              <span className="inline-flex items-center gap-1 text-foreground">
                <GitBranch className="size-3" />
                <span>into {baseBranch}</span>
              </span>
            </div>

            <label className="grid gap-1">
              <span className="uppercase text-[10px] text-muted-foreground">New Feature Branch</span>
              <input
                required
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="emdash/feature-branch"
                className="h-8 border border-edge bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="uppercase text-[10px] text-muted-foreground">Commit Message</span>
              <input
                required
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="feat: implement requested changes"
                className="h-8 border border-edge bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="uppercase text-[10px] text-muted-foreground">Pull Request Title</span>
              <input
                required
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="Pull request title"
                className="h-8 border border-edge bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="uppercase text-[10px] text-muted-foreground">Pull Request Description</span>
              <textarea
                rows={3}
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                className="border border-edge bg-background p-2.5 text-xs font-sans text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </label>

            {error && (
              <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="pt-2 border-t border-edge flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8 px-3 border-edge font-mono uppercase text-[10px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-8 px-3 font-mono uppercase text-[10px] gap-1.5"
              >
                {submitting && <Loader2 className="size-3 animate-spin" />}
                <span>Push &amp; Open PR</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
