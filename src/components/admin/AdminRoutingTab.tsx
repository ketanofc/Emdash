import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  adminApi,
  type AdminProviderModelRow,
  type AdminProviderRow,
  type AdminRouteRow,
} from "@/src/lib/apiClient";

const STAGES: Array<AdminRouteRow["stage"]> = ["brief", "plan", "build", "repair"];

export function AdminRoutingTab() {
  const [routes, setRoutes] = useState<AdminRouteRow[]>([]);
  const [providers, setProviders] = useState<AdminProviderRow[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, AdminProviderModelRow[]>>({});
  const [addSelection, setAddSelection] = useState<Record<string, { provider_id: string; model_id: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [{ routes: r }, { providers: p }] = await Promise.all([
          adminApi.getRoutes(),
          adminApi.listProviders(),
        ]);
        const ordered = STAGES.map(
          (stage) =>
            r.find((x) => x.stage === stage) ?? {
              stage,
              chain: [],
              temperature: 0.5,
              max_output_tokens: 8192,
            }
        );
        setRoutes(ordered);
        setProviders(p);

        const modelMap: Record<string, AdminProviderModelRow[]> = {};
        await Promise.all(
          p.map(async (prov) => {
            const mRes = await adminApi.listModels(prov.id);
            modelMap[prov.id] = mRes.models;
          })
        );
        setModelsByProvider(modelMap);

        const firstProv = p[0];
        if (firstProv) {
          const firstModel = modelMap[firstProv.id]?.[0]?.model_id || "";
          const defaults: Record<string, { provider_id: string; model_id: string }> = {};
          for (const st of STAGES) {
            defaults[st] = { provider_id: firstProv.id, model_id: firstModel };
          }
          setAddSelection(defaults);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load routing configuration.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const providerMap = new Map(providers.map((p) => [p.id, p]));

  const moveCandidate = (stage: AdminRouteRow["stage"], index: number, dir: -1 | 1) => {
    setRoutes((prev) =>
      prev.map((r) => {
        if (r.stage !== stage) return r;
        const target = index + dir;
        if (target < 0 || target >= r.chain.length) return r;
        const nextChain = [...r.chain];
        const [item] = nextChain.splice(index, 1);
        nextChain.splice(target, 0, item);
        return { ...r, chain: nextChain };
      })
    );
  };

  const removeCandidate = (stage: AdminRouteRow["stage"], index: number) => {
    setRoutes((prev) =>
      prev.map((r) =>
        r.stage === stage
          ? { ...r, chain: r.chain.filter((_, i) => i !== index) }
          : r
      )
    );
  };

  const addCandidate = (stage: AdminRouteRow["stage"]) => {
    const sel = addSelection[stage];
    if (!sel?.provider_id || !sel?.model_id) return;
    setRoutes((prev) =>
      prev.map((r) =>
        r.stage === stage
          ? { ...r, chain: [...r.chain, { provider_id: sel.provider_id, model_id: sel.model_id }] }
          : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const res = await adminApi.saveRoutes(routes);
      setRoutes(
        STAGES.map((s) => res.routes.find((r) => r.stage === s) ?? routes.find((r) => r.stage === s)!)
      );
      setSavedNotice("Routing chains saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save routes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono uppercase text-[11px] text-primary">03 · Routing</div>
          <h2 className="text-lg font-semibold tracking-tight">Stage fallback chains &amp; parameters</h2>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="h-8 font-mono uppercase text-xs"
        >
          {saving ? "Saving…" : "Save all routes"}
        </Button>
      </div>

      {savedNotice && (
        <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-mono">
          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-edge bg-card p-6 text-center text-xs font-mono text-muted-foreground">
          Loading stage routes…
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => {
            const hasDisabledProvider = route.chain.some((c) => !providerMap.get(c.provider_id)?.enabled);
            const isEmpty = route.chain.length === 0;
            const currentAdd = addSelection[route.stage];
            const availableModels = currentAdd?.provider_id
              ? modelsByProvider[currentAdd.provider_id] ?? []
              : [];

            return (
              <div key={route.stage} className="border border-edge bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono uppercase text-xs font-semibold text-primary">
                      Stage: {route.stage}
                    </span>
                    {(isEmpty || hasDisabledProvider) && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-destructive mt-1">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>
                          {isEmpty
                            ? "Warning: Chain is empty — requests at this stage will fail."
                            : "Warning: Chain references a disabled provider."}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-muted-foreground">Temp</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={route.temperature}
                        onChange={(e) =>
                          setRoutes((prev) =>
                            prev.map((r) =>
                              r.stage === route.stage
                                ? { ...r, temperature: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-16 h-8 border border-edge bg-background px-2 font-mono text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="text-muted-foreground">Max tok</span>
                      <input
                        type="number"
                        step="256"
                        min="128"
                        value={route.max_output_tokens}
                        onChange={(e) =>
                          setRoutes((prev) =>
                            prev.map((r) =>
                              r.stage === route.stage
                                ? { ...r, max_output_tokens: Number(e.target.value) }
                                : r
                            )
                          )
                        }
                        className="w-24 h-8 border border-edge bg-background px-2 font-mono text-xs"
                      />
                    </label>
                  </div>
                </div>

                {/* Ordered chain */}
                <div className="border border-edge bg-background divide-y divide-edge">
                  {route.chain.length === 0 ? (
                    <div className="p-3 text-xs font-mono text-muted-foreground">
                      No candidates in chain.
                    </div>
                  ) : (
                    route.chain.map((cand, idx) => {
                      const prov = providerMap.get(cand.provider_id);
                      return (
                        <div
                          key={`${cand.provider_id}-${cand.model_id}-${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-primary w-5">
                              #{idx + 1}
                            </span>
                            <span className="font-medium">
                              {prov?.name ?? cand.provider_id}
                            </span>
                            <span className="font-mono text-muted-foreground truncate">
                              {cand.model_id}
                            </span>
                            {prov && !prov.enabled && (
                              <span className="font-mono uppercase text-[10px] text-destructive border border-destructive/40 px-1">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveCandidate(route.stage, idx, -1)}
                              disabled={idx === 0}
                              aria-label="Move up"
                              className="size-7 border border-edge bg-card grid place-items-center disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCandidate(route.stage, idx, 1)}
                              disabled={idx === route.chain.length - 1}
                              aria-label="Move down"
                              className="size-7 border border-edge bg-card grid place-items-center disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCandidate(route.stage, idx)}
                              aria-label="Remove candidate"
                              className="size-7 border border-edge bg-card text-destructive grid place-items-center cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add candidate row */}
                {providers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={currentAdd?.provider_id || ""}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const firstM = modelsByProvider[pid]?.[0]?.model_id || "";
                        setAddSelection((prev) => ({
                          ...prev,
                          [route.stage]: { provider_id: pid, model_id: firstM },
                        }));
                      }}
                      className="h-8 border border-edge bg-background px-2 font-mono text-xs"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {availableModels.length > 0 ? (
                      <select
                        value={currentAdd?.model_id || ""}
                        onChange={(e) =>
                          setAddSelection((prev) => ({
                            ...prev,
                            [route.stage]: {
                              provider_id: currentAdd?.provider_id || "",
                              model_id: e.target.value,
                            },
                          }))
                        }
                        className="h-8 border border-edge bg-background px-2 font-mono text-xs flex-1 min-w-[160px]"
                      >
                        {availableModels.map((m) => (
                          <option key={m.model_id} value={m.model_id}>
                            {m.model_id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={currentAdd?.model_id || ""}
                        onChange={(e) =>
                          setAddSelection((prev) => ({
                            ...prev,
                            [route.stage]: {
                              provider_id: currentAdd?.provider_id || "",
                              model_id: e.target.value,
                            },
                          }))
                        }
                        placeholder="model-id (e.g. gemini-2.5-flash)"
                        className="h-8 border border-edge bg-background px-2 font-mono text-xs flex-1 min-w-[160px]"
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCandidate(route.stage)}
                      className="h-8 border-edge font-mono uppercase text-[11px] gap-1"
                    >
                      <Plus className="size-3" />
                      <span>Add</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
