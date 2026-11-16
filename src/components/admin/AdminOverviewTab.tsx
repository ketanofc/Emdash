import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { adminApi, type AdminOverviewResponse } from "@/src/lib/apiClient";
import { cn } from "@/src/lib/utils";

export function AdminOverviewTab() {
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (r: "7d" | "30d") => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview(r);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
  }, [range]);

  const series = data?.dailySeries ?? [];
  const maxTokens = Math.max(1, ...series.map((d) => d.total_tokens));
  const maxCalls = Math.max(1, ...series.map((d) => d.calls));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono uppercase text-[11px] text-primary">01 · Overview</div>
          <h2 className="text-lg font-semibold tracking-tight">System telemetry &amp; health</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {(["7d", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "h-8 px-2.5 border font-mono uppercase text-xs cursor-pointer transition-colors",
                range === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-edge bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load(range)}
            disabled={loading}
            className="h-8 border-edge font-mono uppercase text-xs gap-1.5"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 p-3 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      {/* Alerts strip */}
      {data && data.alerts.length > 0 && (
        <div className="border border-edge bg-card divide-y divide-edge">
          {data.alerts.map((alert, i) => (
            <div
              key={`${alert.providerId ?? "sys"}-${i}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-xs font-mono",
                alert.level === "error"
                  ? "bg-destructive/5 text-destructive"
                  : "bg-primary/5 text-foreground"
              )}
            >
              <AlertTriangle
                className={cn(
                  "size-3.5 shrink-0",
                  alert.level === "error" ? "text-destructive" : "text-primary"
                )}
              />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-edge border border-edge">
        {[
          { label: "Calls Today", value: (data?.callsToday ?? 0).toLocaleString() },
          { label: "Tokens Today", value: (data?.tokensToday ?? 0).toLocaleString() },
          {
            label: "Error Rate",
            value: `${((data?.errorRate ?? 0) * 100).toFixed(1)}%`,
            sub: `${data?.rateLimitedToday ?? 0} rate-limited`,
          },
          { label: "Active Users", value: (data?.activeUsers ?? 0).toLocaleString() },
          { label: "Coins Spent", value: (data?.coinsSpent ?? 0).toLocaleString() },
        ].map((card) => (
          <div key={card.label} className="bg-card p-3.5">
            <div className="font-mono uppercase text-[10px] text-muted-foreground">
              {card.label}
            </div>
            <div className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums mt-1">
              {card.value}
            </div>
            {card.sub && (
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 7 / 30 Day Chart (inline SVG) */}
      <div className="relative border border-edge bg-card p-4">
        <CornerBrackets />
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="font-mono uppercase text-xs text-foreground">
            Daily Calls &amp; Tokens ({range})
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 bg-primary inline-block" /> Calls
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 bg-foreground/60 inline-block" /> Tokens
            </span>
          </div>
        </div>

        {series.length === 0 ? (
          <div className="h-36 grid place-items-center text-xs text-muted-foreground font-mono">
            No call data recorded for this window yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(320, series.length * 42)} 140`}
              className="w-full h-40 min-w-[300px]"
              role="img"
              aria-label="Daily calls and tokens chart"
            >
              {series.map((d, idx) => {
                const x = idx * 42 + 8;
                const callH = Math.max(3, Math.round((d.calls / maxCalls) * 90));
                const tokH = Math.max(3, Math.round((d.total_tokens / maxTokens) * 90));
                return (
                  <g key={d.day}>
                    <rect
                      x={x}
                      y={105 - callH}
                      width={11}
                      height={callH}
                      fill="#ff5401"
                    />
                    <rect
                      x={x + 13}
                      y={105 - tokH}
                      width={11}
                      height={tokH}
                      fill="currentColor"
                      opacity={0.45}
                    />
                    <text
                      x={x + 12}
                      y={124}
                      textAnchor="middle"
                      fontSize="9"
                      fill="currentColor"
                      opacity={0.65}
                      fontFamily="monospace"
                    >
                      {d.day.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Per-provider usage bars */}
      <div className="border border-edge bg-card p-4 space-y-3">
        <div className="font-mono uppercase text-xs text-foreground">
          Provider Usage Today vs Daily Limits
        </div>
        {!data || data.perProvider.length === 0 ? (
          <div className="text-xs text-muted-foreground font-mono">
            No providers configured yet. Add one in the Providers tab.
          </div>
        ) : (
          <div className="space-y-3">
            {data.perProvider.map((p) => {
              const rpdRatio = p.rpd_limit ? Math.min(1, p.callsToday / p.rpd_limit) : 0;
              const tokRatio = p.daily_token_limit
                ? Math.min(1, p.tokensToday / p.daily_token_limit)
                : 0;
              const isCooldown = Boolean(
                p.health?.cooldown_until && Date.parse(p.health.cooldown_until) > Date.now()
              );

              return (
                <div key={p.id} className="border border-edge bg-background p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="font-mono uppercase text-[10px] border border-edge px-1.5 py-0.5 text-muted-foreground">
                        {p.protocol}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ••••{p.key_last4}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase">
                      {p.health?.key_invalid ? (
                        <span className="text-destructive border border-destructive/40 px-1.5 py-0.5">
                          Key invalid
                        </span>
                      ) : isCooldown ? (
                        <span className="text-primary border border-primary/40 px-1.5 py-0.5">
                          Cooldown
                        </span>
                      ) : p.enabled ? (
                        <span className="text-foreground border border-edge px-1.5 py-0.5">
                          Healthy
                        </span>
                      ) : (
                        <span className="text-muted-foreground border border-edge px-1.5 py-0.5">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
                    <div>
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>Calls</span>
                        <span className="tabular-nums">
                          {p.callsToday}
                          {p.rpd_limit ? ` / ${p.rpd_limit}` : " (unlimited)"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${p.rpd_limit ? Math.max(3, rpdRatio * 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-muted-foreground mb-1">
                        <span>Tokens</span>
                        <span className="tabular-nums">
                          {p.tokensToday.toLocaleString()}
                          {p.daily_token_limit
                            ? ` / ${p.daily_token_limit.toLocaleString()}`
                            : " (unlimited)"}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-foreground/70 transition-all"
                          style={{
                            width: `${p.daily_token_limit ? Math.max(3, tokRatio * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
