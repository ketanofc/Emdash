import { useEffect, useState } from "react";
import {
  FolderGit2,
  GitBranch,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { Button } from "@/src/components/ui/button";
import { fetchRepoBranches } from "@/src/lib/githubApiClient";
import type { GitHubBranch, GitHubRepo } from "@/src/lib/github/types";
import { cn } from "@/src/lib/utils";

interface GitHubRepoModalProps {
  open: boolean;
  onClose: () => void;
  repos: GitHubRepo[];
  loadingRepos: boolean;
  repoError: string | null;
  onRefreshRepos: () => void;
  selectedRepo: GitHubRepo | null;
  selectedBranch: string;
  onConfirmSelection: (repo: GitHubRepo, branch: string) => void;
}

function formatRelativeDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const diffMin = Math.round((Date.now() - ms) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.round(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return iso.slice(0, 10);
}

export function GitHubRepoModal({
  open,
  onClose,
  repos,
  loadingRepos,
  repoError,
  onRefreshRepos,
  selectedRepo,
  selectedBranch,
  onConfirmSelection,
}: GitHubRepoModalProps) {
  const [search, setSearch] = useState("");
  const [draftRepo, setDraftRepo] = useState<GitHubRepo | null>(selectedRepo);
  const [draftBranch, setDraftBranch] = useState<string>(selectedBranch || "main");
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftRepo(selectedRepo);
    setDraftBranch(selectedBranch || selectedRepo?.defaultBranch || "main");
  }, [open, selectedRepo, selectedBranch]);

  useEffect(() => {
    if (!open || !draftRepo) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    setLoadingBranches(true);
    fetchRepoBranches(draftRepo.owner, draftRepo.name)
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        if (!list.some((b) => b.name === draftBranch)) {
          setDraftBranch(draftRepo.defaultBranch || list[0]?.name || "main");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, draftRepo?.fullName]);

  if (!open) return null;

  const filteredRepos = repos.filter((r) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      r.fullName.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.language && r.language.toLowerCase().includes(q))
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Select GitHub Repository"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl border border-edge bg-card p-5 shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <CornerBrackets />

        <div className="flex items-center justify-between pb-3 border-b border-edge shrink-0">
          <div className="flex items-center gap-2">
            <FolderGit2 className="size-4 text-[#c23800] dark:text-[#ff7a3d]" />
            <h2 className="font-mono uppercase text-xs font-semibold tracking-wider text-foreground">
              Select GitHub Repository
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshRepos}
              disabled={loadingRepos}
              className="h-7 px-2 border-edge bg-background font-mono uppercase text-[10px] gap-1"
            >
              <RefreshCw className={cn("size-3", loadingRepos && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              aria-label="Close repository selector"
              className="size-7 border-edge bg-background"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="py-3 shrink-0">
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repositories by name, language, or description…"
              className="w-full h-9 pl-8 pr-3 border border-edge bg-background font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {repoError && (
          <div className="mb-3 border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive shrink-0">
            {repoError}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto border border-edge bg-background divide-y divide-edge">
          {loadingRepos && repos.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Loading your GitHub repositories…</span>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-muted-foreground">
              {repos.length === 0 ? "No accessible repositories found." : "No repositories match your search."}
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = draftRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => {
                    setDraftRepo(repo);
                    setDraftBranch(repo.defaultBranch || "main");
                  }}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer",
                    isSelected ? "bg-card border-l-2 border-l-primary" : "hover:bg-card/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {repo.private ? (
                        <Lock className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Globe className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground truncate">
                        {repo.fullName}
                      </span>
                      <span className="font-mono uppercase text-[9px] px-1.5 py-0.5 border border-edge bg-surface text-muted-foreground shrink-0">
                        {repo.private ? "Private" : "Public"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatRelativeDate(repo.updatedAt)}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    {repo.language && <span>{repo.language}</span>}
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="size-3" />
                      <span>{repo.defaultBranch}</span>
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Branch Selector & Confirm Footer */}
        <div className="pt-3 mt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono uppercase text-[10px] text-muted-foreground shrink-0">
              Branch:
            </span>
            {draftRepo ? (
              <select
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
                disabled={loadingBranches}
                className="h-8 max-w-[220px] border border-edge bg-background px-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
              >
                {(branches.length > 0 ? branches : [{ name: draftRepo.defaultBranch || "main", protected: false, sha: "" }]).map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}{b.name === draftRepo.defaultBranch ? " (default)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">Select a repository above</span>
            )}
            {loadingBranches && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              type="button"
              size="sm"
              disabled={!draftRepo}
              onClick={() => {
                if (draftRepo) {
                  onConfirmSelection(draftRepo, draftBranch || draftRepo.defaultBranch || "main");
                  onClose();
                }
              }}
              className="h-8 px-3 font-mono uppercase text-[10px]"
            >
              Start Coding Session
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
