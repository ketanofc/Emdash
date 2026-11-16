import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-edge border border-edge">
        {[
          {
            label: "Total Users",
            value: (data?.totalUsers ?? Math.max(1, data?.activeUsers ?? 1)).toLocaleString(),
            sub: `${data?.activeUsers ?? 0} active today`,
          },
          {
            label: "Apps Built",
            value: (data?.activeAppsBuilt ?? data?.callsToday ?? 0).toLocaleString(),
            sub: "Total creations",
          },
          {
            label: "System Health",
            value: data?.systemStatus ? data.systemStatus.toUpperCase() : "OPERATIONAL",
            sub: `${data?.uptimePercent ?? 99.9}% uptime`,
          },
          { label: "Calls Today", value: (data?.callsToday ?? 0).toLocaleString() },
          { label: "Tokens Today", value: (data?.tokensToday ?? 0).toLocaleString() },
          {
            label: "Error Rate",
            value: `${((data?.errorRate ?? 0) * 100).toFixed(1)}%`,
            sub: `${data?.rateLimitedToday ?? 0} rate-limited`,
          },
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

      {/* 7 / 30 Day Chart (Recharts) */}
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
              <span className="size-2 bg-foreground/60 inline-block" /> Tokens (k)
            </span>
          </div>
        </div>

        {series.length === 0 ? (
          <div className="h-44 grid place-items-center text-xs text-muted-foreground font-mono">
            No call data recorded for this window yet.
          </div>
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height={176}>
              <AreaChart
                data={series.map((d) => ({
                  day: d.day.slice(5),
                  fullDay: d.day,
                  calls: d.calls,
                  tokensK: Math.round(d.total_tokens / 1000),
                  tokens: d.total_tokens,
                  errors: d.errors,
                }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5401" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff5401" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="border border-edge bg-card p-2 font-mono text-[11px] space-y-1 shadow-md">
                        <div className="text-muted-foreground">{label}</div>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span
                              className="size-2 inline-block shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span>{entry.name}:</span>
                            <span className="font-semibold text-foreground">
                              {Number(entry.value).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke="#ff5401"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#callsGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="tokensK"
                  name="Tokens (k)"
                  stroke="#818cf8"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#tokGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
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
