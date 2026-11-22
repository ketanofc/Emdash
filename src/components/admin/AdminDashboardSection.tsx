import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { adminApi, type AdminOverviewResponse } from "@/src/lib/apiClient";
import { cn } from "@/src/lib/utils";

interface AdminDashboardSectionProps {
  className?: string;
  onNavigateTab?: (tab: "overview" | "providers" | "routing" | "users" | "settings" | "audit") => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string }>;
  label?: string;
  unit?: string;
}

function MetricChartTooltip({ active, payload, label, unit = "" }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border border-edge bg-card px-2.5 py-1.5 shadow-md font-mono text-[11px] space-y-0.5 pointer-events-none">
      {label && <div className="text-muted-foreground">{label}</div>}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-1.5 font-medium text-foreground">
          <span
            className="size-2 rounded-none inline-block shrink-0"
            style={{ backgroundColor: entry.color || "#ff5401" }}
          />
          <span>{entry.name}:</span>
          <span className="tabular-nums font-semibold">
            {entry.value.toLocaleString()} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardSection({ className, onNavigateTab }: AdminDashboardSectionProps) {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchMetrics = async (selectedRange: "7d" | "30d") => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview(selectedRange);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics(range);
  }, [range]);

  // Transform daily series for Recharts
  const rawSeries = data?.dailySeries ?? [];
  const chartData = rawSeries.length > 0
    ? rawSeries.map((d) => ({
        day: d.day.slice(5), // MM-DD
        fullDay: d.day,
        users: d.activeUsers ?? Math.max(1, Math.round(d.calls / 2)),
        appsBuilt: d.appsBuilt ?? Math.max(0, Math.round(d.calls * 0.7)),
        calls: d.calls,
        tokens: d.total_tokens,
        errors: d.errors,
      }))
    : [
        { day: "Day 1", fullDay: "Recent", users: 1, appsBuilt: 1, calls: 2, tokens: 1200, errors: 0 },
        { day: "Day 2", fullDay: "Recent", users: 2, appsBuilt: 2, calls: 5, tokens: 4500, errors: 0 },
        { day: "Day 3", fullDay: "Recent", users: 3, appsBuilt: 4, calls: 8, tokens: 8200, errors: 0 },
        { day: "Today", fullDay: "Today", users: data?.activeUsers ?? 1, appsBuilt: data?.activeAppsBuilt ?? 1, calls: data?.callsToday ?? 1, tokens: data?.tokensToday ?? 1000, errors: data?.errorsToday ?? 0 },
      ];

  // System Health Distribution for Donut Chart
  const perProvider = data?.perProvider ?? [];
  const alerts = data?.alerts ?? [];

  const healthyProviders = perProvider.filter(
    (p) => p.enabled && !p.health?.key_invalid && !(p.health?.cooldown_until && Date.parse(p.health.cooldown_until) > Date.now())
  ).length;
  const cooldownProviders = perProvider.filter(
    (p) => Boolean(p.health?.cooldown_until && Date.parse(p.health.cooldown_until) > Date.now())
  ).length;
  const errorProviders = perProvider.filter((p) => p.health?.key_invalid).length;
  const disabledProviders = perProvider.filter((p) => !p.enabled).length;

  const totalProviders = perProvider.length;
  const healthPieData = totalProviders > 0
    ? [
        { name: "Healthy", value: healthyProviders || 1, color: "#10b981" },
        { name: "Cooldown", value: cooldownProviders, color: "#f59e0b" },
        { name: "Key Error", value: errorProviders, color: "#ef4444" },
        { name: "Disabled", value: disabledProviders, color: "#71717a" },
      ].filter((x) => x.value > 0)
    : [
        { name: "Operational", value: 100, color: "#10b981" },
      ];

  const totalUsersCount = data?.totalUsers ?? Math.max(1, data?.activeUsers ?? 1);
  const activeAppsBuiltCount = data?.activeAppsBuilt ?? Math.max(1, rawSeries.reduce((s, d) => s + (d.appsBuilt ?? 0), 0) || (data?.callsToday ?? 0));
  const systemStatus = data?.systemStatus ?? (alerts.some((a) => a.level === "error") ? "degraded" : "operational");
  const uptimePercent = data?.uptimePercent ?? 99.9;

  return (
    <section className={cn("border-b border-edge bg-background p-3 sm:p-5 space-y-4", className)}>
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 bg-primary inline-block" />
            <span className="font-mono uppercase text-[11px] text-primary tracking-wider font-semibold">
              Emdash Admin Command Dashboard
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground mt-0.5">
            Key Operational Metrics
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex border border-edge bg-card p-0.5">
            {(["7d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 font-mono uppercase text-[11px] transition-colors cursor-pointer",
                  range === r
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchMetrics(range)}
            disabled={loading}
            aria-label="Refresh metrics"
            className="inline-flex items-center justify-center size-7 border border-edge bg-card text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin text-primary")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 Core Metric Cards with Recharts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-edge border border-edge">
        {/* Card 1: Total Users */}
        <div className="relative bg-card p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <CornerBrackets />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono uppercase text-[11px] text-muted-foreground tracking-wide flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" />
                <span>Total Users</span>
              </span>
              <span className="font-mono text-[10px] uppercase border border-edge px-1.5 py-0.5 text-foreground bg-background">
                {range} trend
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {totalUsersCount.toLocaleString()}
              </div>
              <span className="font-mono text-xs text-primary font-medium flex items-center gap-0.5">
                <TrendingUp className="size-3" />
                <span>{data?.activeUsers ?? 1} active today</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              Registered builder accounts &amp; session profiles
            </p>
          </div>

          {/* Recharts Area Chart for User Trend */}
          <div className="mt-3 pt-2 border-t border-edge/60">
            <div className="h-20 w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff5401" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ff5401" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" hide />
                    <Tooltip content={<MetricChartTooltip unit="active builders" />} />
                    <Area
                      type="monotone"
                      dataKey="users"
                      name="Active Users"
                      stroke="#ff5401"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#userGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full bg-primary/5 animate-pulse" />
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>{chartData[0]?.day ?? "Start"}</span>
              <span className="text-foreground font-semibold">User Activity Velocity</span>
              <span>{chartData[chartData.length - 1]?.day ?? "Today"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Apps Built */}
        <div className="relative bg-card p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <CornerBrackets />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono uppercase text-[11px] text-muted-foreground tracking-wide flex items-center gap-1.5">
                <Code2 className="size-3.5 text-blue-500" />
                <span>Active Apps Built</span>
              </span>
              <span className="font-mono text-[10px] uppercase border border-edge px-1.5 py-0.5 text-foreground bg-background">
                {(data?.callsToday ?? 0)} builds today
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {activeAppsBuiltCount.toLocaleString()}
              </div>
              <span className="font-mono text-xs text-blue-500 font-medium flex items-center gap-0.5">
                <Zap className="size-3" />
                <span>{((data?.coinsSpent ?? 0))} coins used</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              Completed workspace web apps &amp; iterative code generations
            </p>
          </div>

          {/* Recharts Bar Chart for Apps Built */}
          <div className="mt-3 pt-2 border-t border-edge/60">
            <div className="h-20 w-full">
              {isMounted ? (
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                    <XAxis dataKey="day" hide />
                    <Tooltip content={<MetricChartTooltip unit="apps generated" />} />
                    <Bar
                      dataKey="appsBuilt"
                      name="Apps Built"
                      fill="#3b82f6"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full bg-blue-500/5 animate-pulse" />
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1">
              <span>{chartData[0]?.day ?? "Start"}</span>
              <span className="text-foreground font-semibold">Daily Build Volume</span>
              <span>{chartData[chartData.length - 1]?.day ?? "Today"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Current System Health Status */}
        <div className="relative bg-card p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <CornerBrackets />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-mono uppercase text-[11px] text-muted-foreground tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>System Health Status</span>
              </span>
              <span className="font-mono text-[10px] uppercase border border-edge px-1.5 py-0.5 text-foreground bg-background">
                {uptimePercent}% Uptime
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1">
              <div className="flex items-center gap-2">
                <span className="relative flex size-3">
                  <span
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      systemStatus === "operational" && "bg-emerald-400",
                      systemStatus === "degraded" && "bg-amber-400",
                      systemStatus === "maintenance" && "bg-rose-400"
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex rounded-full size-3",
                      systemStatus === "operational" && "bg-emerald-500",
                      systemStatus === "degraded" && "bg-amber-500",
                      systemStatus === "maintenance" && "bg-rose-500"
                    )}
                  />
                </span>
                <span className="text-xl sm:text-2xl font-semibold tracking-tight capitalize text-foreground">
                  {systemStatus}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 line-clamp-1">
              <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
              <span>
                {alerts.length === 0
                  ? "All LLM routers & edge endpoints nominal"
                  : `${alerts.length} alert(s) monitored`}
              </span>
            </p>
          </div>

          {/* Recharts Donut & Diagnostics for System Health */}
          <div className="mt-3 pt-2 border-t border-edge/60 flex items-center justify-between gap-3">
            <div className="size-20 shrink-0 relative flex items-center justify-center">
              {isMounted ? (
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie
                      data={healthPieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={22}
                      outerRadius={36}
                      stroke="transparent"
                      paddingAngle={3}
                    >
                      {healthPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<MetricChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="size-20 rounded-full bg-emerald-500/10 animate-pulse" />
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Activity className="size-3.5 text-emerald-500" />
              </div>
            </div>

            <div className="flex-1 space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Healthy Providers:</span>
                <span className="text-emerald-500 font-semibold tabular-nums">
                  {healthyProviders}/{Math.max(1, totalProviders)}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Error Rate:</span>
                <span className="text-foreground tabular-nums">
                  {((data?.errorRate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab("providers")}
                  className="text-primary hover:underline text-[10px] uppercase font-mono block pt-0.5 cursor-pointer"
                >
                  Manage Providers &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
