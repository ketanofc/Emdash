import { useEffect, useState } from "react";
import { Coins, Search, ShieldAlert, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { adminApi, type AdminUserRow } from "@/src/lib/apiClient";

export function AdminUsersTab() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.getUserDetail>> | null>(
    null
  );
  const [coinDelta, setCoinDelta] = useState("50");
  const [coinReason, setCoinReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({ q, status: statusFilter, page: 1 });
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [statusFilter]);

  const openDetail = async (id: string) => {
    setSelectedUserId(id);
    setDetail(null);
    setCoinReason("");
    try {
      const d = await adminApi.getUserDetail(id);
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details.");
    }
  };

  const handleAdjustCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const delta = Math.trunc(Number(coinDelta));
    if (!delta || !coinReason.trim()) return;
    setActionBusy(true);
    try {
      await adminApi.adjustUserCoins(selectedUserId, delta, coinReason.trim());
      setCoinReason("");
      await Promise.all([openDetail(selectedUserId), loadUsers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coin adjustment failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleSuspend = async (u: AdminUserRow) => {
    setActionBusy(true);
    try {
      if (u.status === "suspended") {
        await adminApi.reactivateUser(u.user_id);
      } else {
        await adminApi.suspendUser(u.user_id);
      }
      await Promise.all([openDetail(u.user_id), loadUsers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status.");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono uppercase text-[11px] text-primary">04 · Users</div>
          <h2 className="text-lg font-semibold tracking-tight">Accounts, Dash Coins &amp; moderation</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadUsers();
          }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <div className="relative">
            <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email…"
              className="h-8 border border-edge bg-card pl-8 pr-2.5 text-xs outline-none focus-visible:border-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 border border-edge bg-card px-2 font-mono text-xs"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button type="submit" variant="outline" size="sm" className="h-8 border-edge font-mono uppercase text-xs">
            Search
          </Button>
        </form>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      <div className="border border-edge bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[680px]">
          <thead>
            <tr className="border-b border-edge bg-background font-mono uppercase text-[10px] text-muted-foreground">
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Coins</th>
              <th className="p-3">Tokens Today</th>
              <th className="p-3">Last Seen</th>
              <th className="p-3">Country</th>
              <th className="p-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center font-mono text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center font-mono text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id} className="hover:bg-muted/40">
                  <td className="p-3 font-medium">{u.email}</td>
                  <td className="p-3 font-mono uppercase text-[10px]">{u.role}</td>
                  <td className="p-3 font-mono uppercase text-[10px]">
                    <span
                      className={
                        u.status === "suspended"
                          ? "border border-destructive/40 text-destructive px-1.5 py-0.5"
                          : "border border-edge px-1.5 py-0.5 text-foreground"
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono tabular-nums">{u.coins}</td>
                  <td className="p-3 font-mono tabular-nums">{u.tokensToday.toLocaleString()}</td>
                  <td className="p-3 font-mono text-[10px] text-muted-foreground">
                    {new Date(u.last_seen_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-mono text-[11px]">{u.country || "—"}</td>
                  <td className="p-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openDetail(u.user_id)}
                      className="h-7 px-2.5 border-edge font-mono uppercase text-[10px]"
                    >
                      Manage
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Detail Drawer / Modal */}
      <Dialog open={Boolean(selectedUserId)} onOpenChange={(o) => !o && setSelectedUserId(null)}>
        <DialogContent className="sm:max-w-xl border-edge bg-card max-h-[85vh] overflow-y-auto">
          <CornerBrackets />
          <DialogHeader>
            <DialogTitle>{detail?.profile.email || "User details"}</DialogTitle>
            <DialogDescription>
              ID: <span className="font-mono text-[11px]">{selectedUserId}</span> ·{" "}
              Total tokens: {(detail?.totalTokens ?? 0).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border border-edge bg-background p-3">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Coins className="size-4 text-primary" />
                  <span>Balance: {detail.wallet?.balance ?? 0}</span>
                </div>
                <Button
                  type="button"
                  variant={detail.profile.status === "suspended" ? "outline" : "destructive"}
                  size="sm"
                  disabled={actionBusy}
                  onClick={() => void handleToggleSuspend(detail.profile)}
                  className="h-8 font-mono uppercase text-xs gap-1.5"
                >
                  {detail.profile.status === "suspended" ? (
                    <>
                      <UserCheck className="size-3.5" />
                      <span>Reactivate</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="size-3.5" />
                      <span>Suspend</span>
                    </>
                  )}
                </Button>
              </div>

              <form onSubmit={(e) => void handleAdjustCoins(e)} className="border border-edge bg-background p-3 space-y-2.5">
                <div className="font-mono uppercase text-[10px] text-muted-foreground">
                  Adjust Dash Coins
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-2">
                  <input
                    type="number"
                    required
                    value={coinDelta}
                    onChange={(e) => setCoinDelta(e.target.value)}
                    placeholder="+50 / -20"
                    className="h-8 border border-edge bg-card px-2 font-mono text-xs"
                  />
                  <input
                    required
                    value={coinReason}
                    onChange={(e) => setCoinReason(e.target.value)}
                    placeholder="Reason (required for audit log)"
                    className="h-8 border border-edge bg-card px-2 text-xs"
                  />
                  <Button type="submit" size="sm" disabled={actionBusy} className="h-8 font-mono uppercase text-xs">
                    Apply
                  </Button>
                </div>
              </form>

              <div className="border border-edge bg-background">
                <div className="px-3 py-2 border-b border-edge font-mono uppercase text-[10px] text-muted-foreground">
                  Coin Ledger ({detail.ledger.length})
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-edge text-xs">
                  {detail.ledger.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-1.5 font-mono">
                      <span>{l.reason}</span>
                      <span className={l.delta >= 0 ? "text-primary" : "text-foreground"}>
                        {l.delta >= 0 ? `+${l.delta}` : l.delta} (bal {l.balance_after})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-edge bg-background">
                <div className="px-3 py-2 border-b border-edge font-mono uppercase text-[10px] text-muted-foreground">
                  Recent Jobs ({detail.jobs.length})
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-edge text-xs">
                  {detail.jobs.map((j) => (
                    <div key={j.id} className="flex items-center justify-between px-3 py-1.5 font-mono">
                      <span>{j.stage} · {j.status}</span>
                      <span className="text-muted-foreground">
                        {j.coin_cost} coins {j.refunded ? "(refunded)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
