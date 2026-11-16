import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { adminApi, type AdminConfigRecord } from "@/src/lib/apiClient";
import { cn } from "@/src/lib/utils";

export function AdminSettingsTab() {
  const [config, setConfig] = useState<AdminConfigRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await adminApi.getConfig();
        setConfig(res.config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await adminApi.saveConfig(config);
      setConfig(res.config);
      setSavedMsg("Settings saved and active immediately.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="font-mono uppercase text-[11px] text-primary">05 · Settings</div>
        <h2 className="text-lg font-semibold tracking-tight">Live economy, quotas &amp; maintenance</h2>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-mono">
          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      {loading || !config ? (
        <div className="border border-edge bg-card p-6 text-center text-xs font-mono text-muted-foreground">
          Loading configuration…
        </div>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {/* Prominent Maintenance Toggle */}
          <div
            className={cn(
              "relative border p-4 flex flex-wrap items-center justify-between gap-3",
              config.maintenance
                ? "border-destructive bg-destructive/5"
                : "border-edge bg-card"
            )}
          >
            <CornerBrackets />
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className={cn(
                  "size-4 mt-0.5 shrink-0",
                  config.maintenance ? "text-destructive" : "text-muted-foreground"
                )}
              />
              <div>
                <div className="text-sm font-semibold">Maintenance Mode</div>
                <div className="text-xs text-muted-foreground">
                  Pauses all public /generate and /repair jobs immediately and shows high demand notice.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.maintenance}
              onClick={() => setConfig({ ...config, maintenance: !config.maintenance })}
              className={cn(
                "h-9 px-4 border font-mono uppercase text-xs cursor-pointer transition-colors",
                config.maintenance
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-edge bg-background text-foreground hover:border-primary"
              )}
            >
              {config.maintenance ? "Maintenance ON" : "Maintenance OFF"}
            </button>
          </div>

          <div className="border border-edge bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Daily Coin Grant
              </span>
              <input
                type="number"
                min="0"
                required
                value={config.daily_grant}
                onChange={(e) =>
                  setConfig({ ...config, daily_grant: Math.max(0, Number(e.target.value)) })
                }
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Reset Timezone (IANA)
              </span>
              <input
                required
                value={config.reset_timezone}
                onChange={(e) => setConfig({ ...config, reset_timezone: e.target.value })}
                placeholder="UTC"
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Build Cost (Coins)
              </span>
              <input
                type="number"
                min="0"
                required
                value={config.costs.build}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    costs: { ...config.costs, build: Math.max(0, Number(e.target.value)) },
                  })
                }
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Repair Cost (Coins)
              </span>
              <input
                type="number"
                min="0"
                required
                value={config.costs.repair}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    costs: { ...config.costs, repair: Math.max(0, Number(e.target.value)) },
                  })
                }
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Global Daily Call Limit
              </span>
              <input
                type="number"
                min="1"
                required
                value={config.global_daily_call_limit}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    global_daily_call_limit: Math.max(1, Number(e.target.value)),
                  })
                }
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                High Demand Alert Threshold (0.1 – 1.0)
              </span>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="1"
                required
                value={config.high_demand_threshold}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    high_demand_threshold: Math.min(1, Math.max(0.1, Number(e.target.value))),
                  })
                }
                className="h-9 border border-edge bg-background px-3 font-mono text-xs"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs cursor-pointer sm:col-span-2">
              <input
                type="checkbox"
                checked={config.signups_enabled}
                onChange={(e) => setConfig({ ...config, signups_enabled: e.target.checked })}
              />
              <span>Signups enabled (allow new user registrations)</span>
            </label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="font-mono uppercase text-xs">
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
