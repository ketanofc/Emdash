import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Coins,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Github,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { Button } from "@/src/components/ui/button";
import {
  ApiClientError,
  fetchUserDashboard,
  type UserDashboardData,
} from "@/src/lib/apiClient";
import { disconnectGitHub, startGitHubOAuth } from "@/src/lib/githubApiClient";
import type { UserSession } from "@/src/types";
import { cn } from "@/src/lib/utils";

interface UserDashboardPageProps {
  user: UserSession | null;
  onUnauthorized: () => void;
  onSignOut: () => void;
  onOpenWebAgent: () => void;
  onOpenBuilder: () => void;
  onOpenAdmin?: () => void;
}

type DashboardTab = "overview" | "github" | "security";

function formatTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserDashboardPage({
  user,
  onUnauthorized,
  onSignOut,
  onOpenWebAgent,
  onOpenBuilder,
  onOpenAdmin,
}: UserDashboardPageProps) {
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [ghBusy, setGhBusy] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserDashboard();
      if (res.profile.status === "suspended") {
        onUnauthorized();
        return;
      }
      setData(res);
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      onUnauthorized();
      return;
    }
    void loadDashboard();
  }, [user?.id, user?.email]);

  const handleConnectGitHub = async () => {
    setGhBusy(true);
    setError(null);
    try {
      const url = await startGitHubOAuth("/dashboard");
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start GitHub connection.");
      setGhBusy(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    setGhBusy(true);
    setError(null);
    try {
      await disconnectGitHub();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect GitHub.");
    } finally {
      setGhBusy(false);
    }
  };

  // Fail-closed: never render dashboard content before server verification succeeds
  if (loading && !data) {
    return (
      <main className="flex-1 bg-background px-2 py-12 grid place-items-center">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Verifying authenticated session…</span>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 bg-background px-2 py-12">
        <div className="relative mx-auto max-w-lg border border-edge bg-card p-6 space-y-4">
          <CornerBrackets />
          <div className="font-mono uppercase text-xs text-destructive">
            Dashboard Unavailable
          </div>
          <p className="text-xs text-muted-foreground">
            {error || "Unable to verify your session."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void loadDashboard()}
              className="font-mono uppercase text-xs"
            >
              Retry
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUnauthorized}
              className="border-edge font-mono uppercase text-xs"
            >
              Sign in again
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const { profile, wallet, jobs, github, githubSessions } = data;

  return (
    <main className="flex-1 bg-background px-2 pb-10">
      <div className="mx-auto max-w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl border-x border-b border-edge bg-card">
        <div className="h-6 border-b border-edge bg-background hatch-pattern" />

        {/* Header */}
        <div className="relative border-b border-edge px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <CornerBrackets />
          <div className="flex items-center gap-3 min-w-0">
            {github.connected && github.avatarUrl ? (
              <img
                src={github.avatarUrl}
                alt={github.username || profile.name}
                className="size-10 border border-edge object-cover shrink-0"
              />
            ) : (
              <div className="size-10 bg-primary text-primary-foreground grid place-items-center font-mono font-bold text-base shrink-0">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono uppercase text-[10px] text-primary font-semibold">
                  Builder Workspace · {profile.role}
                </span>
                <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  {profile.status}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
                {profile.name}
              </h1>
              <div className="font-mono text-xs text-muted-foreground truncate">
                {profile.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="h-8 border-edge bg-background font-mono uppercase text-[11px] gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>
            {profile.role === "admin" && onOpenAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenAdmin}
                className="h-8 border-edge bg-background font-mono uppercase text-[11px] gap-1.5"
              >
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Admin Panel</span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={onOpenWebAgent}
              className="h-8 font-mono uppercase text-[11px] gap-1.5"
            >
              <Terminal className="size-3.5" />
              <span>Open Web Agent</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="h-8 border-edge bg-background font-mono uppercase text-[11px] gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-4 border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-edge border-b border-edge">
          <div className="bg-background p-4 space-y-1">
            <div className="flex items-center justify-between font-mono uppercase text-[10px] text-muted-foreground">
              <span>Dash Coins</span>
              <Coins className="size-3.5 text-primary" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {wallet.balance}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              +{wallet.dailyGrant} daily · {wallet.buildCost} per build
            </div>
          </div>

          <div className="bg-background p-4 space-y-1">
            <div className="flex items-center justify-between font-mono uppercase text-[10px] text-muted-foreground">
              <span>GitHub Connection</span>
              <Github className="size-3.5 text-primary" />
            </div>
            <div className="text-lg font-semibold truncate text-foreground">
              {github.connected && github.username ? `@${github.username}` : "Not connected"}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {github.connected ? "OAuth encrypted token active" : "Connect to edit repos"}
            </div>
          </div>

          <div className="bg-background p-4 space-y-1">
            <div className="flex items-center justify-between font-mono uppercase text-[10px] text-muted-foreground">
              <span>Recent Jobs</span>
              <Activity className="size-3.5 text-primary" />
            </div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {jobs.length}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              App builds &amp; code repairs
            </div>
          </div>

          <div className="bg-background p-4 space-y-1">
            <div className="flex items-center justify-between font-mono uppercase text-[10px] text-muted-foreground">
              <span>Session Security</span>
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-lg font-semibold text-foreground">Verified</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Server-enforced token guard
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto border-b border-edge bg-surface px-4 sm:px-6">
          {(
            [
              { id: "overview", label: "Overview & Activity", icon: Activity },
              { id: "github", label: "GitHub & Sessions", icon: FolderGit2 },
              { id: "security", label: "Account Security", icon: KeyRound },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2.5 font-mono uppercase text-[11px] border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                tab === id
                  ? "border-primary text-primary font-semibold bg-card"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 bg-background space-y-6">
          {tab === "overview" && (
            <>
              {/* Quick Launchers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative border border-edge bg-card p-5 space-y-3">
                  <CornerBrackets />
                  <div className="flex items-center gap-2 font-mono uppercase text-[11px] text-primary">
                    <Sparkles className="size-3.5" />
                    <span>Single-Prompt App Builder</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Generate full React + Tailwind web apps from a natural-language prompt and preview them instantly.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onOpenBuilder}
                    className="font-mono uppercase text-[11px] gap-1.5"
                  >
                    <span>Launch Builder</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>

                <div className="relative border border-edge bg-card p-5 space-y-3">
                  <CornerBrackets />
                  <div className="flex items-center gap-2 font-mono uppercase text-[11px] text-primary">
                    <FolderGit2 className="size-3.5" />
                    <span>GitHub AI Coding Agent</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Inspect your GitHub repositories, propose diffs on feature branches, and open Pull Requests.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenWebAgent}
                    className="border-edge font-mono uppercase text-[11px] gap-1.5"
                  >
                    <span>Open Web Agent</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Ledger & Jobs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-edge bg-card">
                  <div className="px-4 py-2.5 border-b border-edge bg-surface font-mono uppercase text-[11px] text-foreground">
                    Dash Coin Ledger ({wallet.ledger.length})
                  </div>
                  {wallet.ledger.length === 0 ? (
                    <div className="p-6 text-center font-mono text-xs text-muted-foreground">
                      No coin transactions yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-edge max-h-80 overflow-y-auto">
                      {wallet.ledger.map((item) => (
                        <div
                          key={item.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="min-w-0">
                            <div className="text-foreground truncate">{item.reason}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatTimestamp(item.created_at)}
                            </div>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <div
                              className={cn(
                                "font-semibold",
                                item.delta >= 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-foreground"
                              )}
                            >
                              {item.delta >= 0 ? `+${item.delta}` : item.delta}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Bal: {item.balance_after}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-edge bg-card">
                  <div className="px-4 py-2.5 border-b border-edge bg-surface font-mono uppercase text-[11px] text-foreground">
                    Recent Build Jobs ({jobs.length})
                  </div>
                  {jobs.length === 0 ? (
                    <div className="p-6 text-center font-mono text-xs text-muted-foreground">
                      No build jobs recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-edge max-h-80 overflow-y-auto">
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="min-w-0">
                            <div className="text-foreground uppercase">{job.stage}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatTimestamp(job.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "uppercase text-[10px] px-1.5 py-0.5 border border-edge",
                                job.status === "completed"
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : job.status === "failed"
                                    ? "text-destructive"
                                    : "text-primary"
                              )}
                            >
                              {job.status}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              -{job.coin_cost}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === "github" && (
            <div className="space-y-4">
              <div className="border border-edge bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Github className="size-5 text-primary shrink-0" />
                  <div>
                    <div className="font-mono uppercase text-xs font-semibold text-foreground">
                      {github.connected && github.username
                        ? `Connected to @${github.username}`
                        : "GitHub Account Not Connected"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {github.connected
                        ? `Scopes: ${github.scope || "repo, read:user"} · Token encrypted at rest (AES-256-GCM)`
                        : "Authorize Emdash via GitHub OAuth to browse repositories and create Pull Requests."}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {github.connected ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onOpenWebAgent}
                        className="font-mono uppercase text-[11px]"
                      >
                        Browse Repos in Web Agent
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={ghBusy}
                        onClick={() => void handleDisconnectGitHub()}
                        className="border-edge font-mono uppercase text-[11px] text-destructive"
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={ghBusy}
                      onClick={() => void handleConnectGitHub()}
                      className="font-mono uppercase text-[11px] gap-1.5"
                    >
                      {ghBusy && <Loader2 className="size-3.5 animate-spin" />}
                      <span>Connect GitHub</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="border border-edge bg-card">
                <div className="px-4 py-2.5 border-b border-edge bg-surface font-mono uppercase text-[11px] text-foreground">
                  GitHub Agent Sessions ({githubSessions.length})
                </div>
                {githubSessions.length === 0 ? (
                  <div className="p-6 text-center font-mono text-xs text-muted-foreground">
                    No GitHub coding sessions recorded yet. Open the Web Agent to start one.
                  </div>
                ) : (
                  <div className="divide-y divide-edge">
                    {githubSessions.map((s) => (
                      <div
                        key={s.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div>
                          <div className="text-foreground font-semibold">
                            {s.repo_owner}/{s.repo_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <GitBranch className="size-3" />
                            <span>{s.working_branch || s.base_branch}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="uppercase text-[10px] px-1.5 py-0.5 border border-edge bg-surface">
                            {s.status}
                          </span>
                          {s.pr_url && (
                            <a
                              href={s.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <span>PR #{s.pr_number}</span>
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="border border-edge bg-card p-5 space-y-4 font-mono text-xs">
              <div className="uppercase text-[11px] text-primary font-semibold">
                Account &amp; Session Security Posture
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-edge bg-background p-3 space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">User ID</div>
                  <div className="text-foreground break-all">{profile.id}</div>
                </div>
                <div className="border border-edge bg-background p-3 space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">Verified Email</div>
                  <div className="text-foreground">{profile.email}</div>
                </div>
                <div className="border border-edge bg-background p-3 space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">Route Protection</div>
                  <div className="text-emerald-700 dark:text-emerald-400">
                    Fail-closed JWT / HMAC verification (anti-URL-bypass active)
                  </div>
                </div>
                <div className="border border-edge bg-background p-3 space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground">Token Storage</div>
                  <div className="text-foreground">
                    GitHub OAuth tokens AES-256-GCM encrypted server-side only
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
