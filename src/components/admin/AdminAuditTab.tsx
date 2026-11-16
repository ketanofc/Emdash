import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { adminApi, type AdminAuditEntry } from "@/src/lib/apiClient";
import { cn } from "@/src/lib/utils";

export function AdminAuditTab() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLog(1);
      setEntries(res.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAudit();
  }, []);

  const filtered = filter.trim()
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(filter.toLowerCase()) ||
          e.target_type.toLowerCase().includes(filter.toLowerCase()) ||
          e.target_id.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono uppercase text-[11px] text-primary">06 · Audit Log</div>
          <h2 className="text-lg font-semibold tracking-tight">Immutable admin write trail (secrets redacted)</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter action or target…"
            className="h-8 border border-edge bg-card px-2.5 text-xs outline-none focus-visible:border-primary"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadAudit()}
            disabled={loading}
            className="h-8 border-edge font-mono uppercase text-xs gap-1.5"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      <div className="border border-edge bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[720px]">
          <thead>
            <tr className="border-b border-edge bg-background font-mono uppercase text-[10px] text-muted-foreground">
              <th className="p-3">Time</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target</th>
              <th className="p-3">Actor</th>
              <th className="p-3">IP</th>
              <th className="p-3">After (Redacted)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center font-mono text-muted-foreground">
                  Loading audit log…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center font-mono text-muted-foreground">
                  No matching audit records.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/40 align-top">
                  <td className="p-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-primary">{entry.action}</td>
                  <td className="p-3 font-mono text-[11px]">
                    {entry.target_type}:{entry.target_id.slice(0, 14)}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {entry.actor_id ? entry.actor_id.slice(0, 12) : "system"}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {entry.ip || "—"}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground max-w-[280px] truncate">
                    {entry.after ? JSON.stringify(entry.after) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
