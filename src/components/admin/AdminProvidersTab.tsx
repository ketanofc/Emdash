import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  adminApi,
  type AdminProviderModelRow,
  type AdminProviderRow,
} from "@/src/lib/apiClient";
import { cn } from "@/src/lib/utils";

const PRESETS = [
  {
    id: "gemini",
    label: "Gemini",
    name: "Google Gemini",
    slug: "gemini",
    protocol: "gemini" as const,
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    supports_json_schema: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    name: "OpenRouter",
    slug: "openrouter",
    protocol: "openai" as const,
    base_url: "https://openrouter.ai/api/v1",
    supports_json_schema: true,
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    name: "OpenCode Zen",
    slug: "opencode-zen",
    protocol: "openai" as const,
    base_url: "https://opencode.ai/zen/v1",
    supports_json_schema: false,
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    name: "Custom OpenAI",
    slug: "custom-openai",
    protocol: "openai" as const,
    base_url: "https://api.openai.com/v1",
    supports_json_schema: false,
  },
];

export function AdminProvidersTab() {
  const [providers, setProviders] = useState<AdminProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Add Provider Dialog
  const [addOpen, setAddOpen] = useState(false);
  const [presetId, setPresetId] = useState("gemini");
  const [name, setName] = useState("Google Gemini");
  const [slug, setSlug] = useState("gemini");
  const [protocol, setProtocol] = useState<"gemini" | "openai">("gemini");
  const [baseUrl, setBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [priority, setPriority] = useState("100");
  const [rpmLimit, setRpmLimit] = useState("");
  const [rpdLimit, setRpdLimit] = useState("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState("");
  const [blockedRegions, setBlockedRegions] = useState("");
  const [supportsJsonSchema, setSupportsJsonSchema] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Rotate Key Dialog
  const [rotateTarget, setRotateTarget] = useState<AdminProviderRow | null>(null);
  const [rotateKeyValue, setRotateKeyValue] = useState("");

  // Models Picker Dialog
  const [modelsTarget, setModelsTarget] = useState<AdminProviderRow | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<AdminProviderModelRow[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Delete Confirm Dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminProviderRow | null>(null);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listProviders();
      setProviders(res.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load providers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setName(p.name);
    setSlug(p.slug);
    setProtocol(p.protocol);
    setBaseUrl(p.base_url);
    setSupportsJsonSchema(p.supports_json_schema);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.createProvider({
        name,
        slug,
        protocol,
        base_url: baseUrl,
        api_key: apiKeyInput,
        priority: Number(priority) || 100,
        rpm_limit: rpmLimit ? Number(rpmLimit) : null,
        rpd_limit: rpdLimit ? Number(rpdLimit) : null,
        daily_token_limit: dailyTokenLimit ? Number(dailyTokenLimit) : null,
        blocked_regions: blockedRegions
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        supports_json_schema: supportsJsonSchema,
        enabled,
      });
      setApiKeyInput("");
      setAddOpen(false);
      setStatusNote(`Added ${res.provider.name} (••••${res.provider.key_last4}).`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add provider.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (p: AdminProviderRow) => {
    try {
      await adminApi.updateProvider(p.id, { enabled: !p.enabled });
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update provider.");
    }
  };

  const handleTest = async (p: AdminProviderRow) => {
    setTestingId(p.id);
    setError(null);
    try {
      const res = await adminApi.testProvider(p.id, true);
      setStatusNote(`${p.name}: ${res.message}`);
      await loadProviders();
      if (res.ok) {
        const modelsRes = await adminApi.listModels(p.id);
        setModelsTarget(p);
        setDiscoveredModels(modelsRes.models);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed.");
    } finally {
      setTestingId(null);
    }
  };

  const openModelsModal = async (p: AdminProviderRow) => {
    setModelsTarget(p);
    const res = await adminApi.listModels(p.id);
    setDiscoveredModels(res.models);
  };

  const handleSaveModels = async () => {
    if (!modelsTarget) return;
    setSaving(true);
    try {
      await adminApi.saveModels(
        modelsTarget.id,
        discoveredModels.map((m) => ({
          model_id: m.model_id,
          label: m.label,
          enabled: m.enabled,
          input_cost_per_mtok: m.input_cost_per_mtok,
          output_cost_per_mtok: m.output_cost_per_mtok,
        }))
      );
      setStatusNote(`Saved ${discoveredModels.length} models for ${modelsTarget.name}.`);
      setModelsTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save models.");
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotateTarget) return;
    setSaving(true);
    try {
      const res = await adminApi.rotateKey(rotateTarget.id, rotateKeyValue);
      setRotateKeyValue("");
      setRotateTarget(null);
      setStatusNote(`Rotated key for ${res.provider.name} to ••••${res.provider.key_last4}.`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Key rotation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await adminApi.deleteProvider(deleteTarget.id);
      setStatusNote(`Deleted provider ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono uppercase text-[11px] text-primary">02 · Providers</div>
          <h2 className="text-lg font-semibold tracking-tight">Encrypted provider keys &amp; models</h2>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            applyPreset("gemini");
            setApiKeyInput("");
            setAddOpen(true);
          }}
          className="h-8 font-mono uppercase text-xs gap-1.5"
        >
          <Plus className="size-3.5" />
          <span>Add provider</span>
        </Button>
      </div>

      {statusNote && (
        <div className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-mono text-foreground">
          <CheckCircle2 className="size-3.5 text-primary shrink-0" />
          <span>{statusNote}</span>
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive">
          {error}
        </div>
      )}

      <div className="border border-edge bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-edge bg-background font-mono uppercase text-[10px] text-muted-foreground">
              <th className="p-3">Provider</th>
              <th className="p-3">Protocol</th>
              <th className="p-3">Status</th>
              <th className="p-3">Key</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Limits</th>
              <th className="p-3">Today</th>
              <th className="p-3">Last Test</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center font-mono text-muted-foreground">
                  Loading providers…
                </td>
              </tr>
            ) : providers.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center font-mono text-muted-foreground">
                  No providers added yet.
                </td>
              </tr>
            ) : (
              providers.map((p) => {
                const inCooldown = Boolean(
                  p.health?.cooldown_until && Date.parse(p.health.cooldown_until) > Date.now()
                );
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="p-3">
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {p.base_url}
                      </div>
                    </td>
                    <td className="p-3 font-mono uppercase text-[11px]">{p.protocol}</td>
                    <td className="p-3 font-mono uppercase text-[10px]">
                      {p.health?.key_invalid ? (
                        <span className="border border-destructive/40 text-destructive px-1.5 py-0.5">
                          Key invalid
                        </span>
                      ) : inCooldown ? (
                        <span className="border border-primary/40 text-primary px-1.5 py-0.5">
                          Cooldown
                        </span>
                      ) : p.enabled ? (
                        <button
                          type="button"
                          onClick={() => void handleToggleEnabled(p)}
                          className="border border-edge bg-background px-1.5 py-0.5 text-foreground hover:border-primary cursor-pointer"
                        >
                          Enabled
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleToggleEnabled(p)}
                          className="border border-edge bg-background px-1.5 py-0.5 text-muted-foreground hover:border-primary cursor-pointer"
                        >
                          Disabled
                        </button>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">••••{p.key_last4}</td>
                    <td className="p-3 font-mono tabular-nums">{p.priority}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {p.rpm_limit ? `${p.rpm_limit} rpm` : "—"} ·{" "}
                      {p.rpd_limit ? `${p.rpd_limit} rpd` : "—"}
                    </td>
                    <td className="p-3 font-mono tabular-nums text-[11px]">
                      {p.usageToday.calls} calls · {p.usageToday.total_tokens.toLocaleString()} tok
                    </td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">
                      {p.last_test_status || "Untested"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleTest(p)}
                          disabled={testingId === p.id}
                          className="h-7 px-2 border-edge font-mono uppercase text-[10px] gap-1"
                        >
                          {testingId === p.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Play className="size-3" />
                          )}
                          <span>Test</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openModelsModal(p)}
                          className="h-7 px-2 border-edge font-mono uppercase text-[10px]"
                        >
                          Models
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRotateTarget(p);
                            setRotateKeyValue("");
                          }}
                          title="Rotate API key"
                          className="h-7 px-2 border-edge font-mono uppercase text-[10px]"
                        >
                          <KeyRound className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(p)}
                          title="Delete provider"
                          className="h-7 px-2 border-edge text-destructive hover:border-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg border-edge bg-card">
          <CornerBrackets />
          <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3.5">
            <DialogHeader>
              <DialogTitle>Add LLM Provider</DialogTitle>
              <DialogDescription>
                API keys are AES-256-GCM encrypted on the server and never displayed again.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    "border px-2 py-1.5 text-[11px] font-mono cursor-pointer transition-colors",
                    presetId === preset.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-edge bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">Name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 border border-edge bg-background px-2.5 text-xs outline-none focus-visible:border-primary"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">Slug</span>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono outline-none focus-visible:border-primary"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">Protocol</span>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value === "gemini" ? "gemini" : "openai")}
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono outline-none focus-visible:border-primary"
                >
                  <option value="gemini">gemini</option>
                  <option value="openai">openai</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">Priority</span>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono outline-none focus-visible:border-primary"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">Base URL</span>
              <input
                required
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="h-9 border border-edge bg-background px-2.5 text-xs font-mono outline-none focus-visible:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                API Key (write-only)
              </span>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Paste provider API key…"
                className="h-9 border border-edge bg-background px-2.5 text-xs font-mono outline-none focus-visible:border-primary"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">RPM Limit</span>
                <input
                  type="number"
                  value={rpmLimit}
                  onChange={(e) => setRpmLimit(e.target.value)}
                  placeholder="Optional"
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">RPD Limit</span>
                <input
                  type="number"
                  value={rpdLimit}
                  onChange={(e) => setRpdLimit(e.target.value)}
                  placeholder="Optional"
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">Daily Tokens</span>
                <input
                  type="number"
                  value={dailyTokenLimit}
                  onChange={(e) => setDailyTokenLimit(e.target.value)}
                  placeholder="Optional"
                  className="h-9 border border-edge bg-background px-2.5 text-xs font-mono"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="font-mono uppercase text-[10px] text-muted-foreground">
                Blocked Regions (comma-separated ISO codes, e.g. CN, RU)
              </span>
              <input
                value={blockedRegions}
                onChange={(e) => setBlockedRegions(e.target.value)}
                placeholder="Optional"
                className="h-9 border border-edge bg-background px-2.5 text-xs font-mono"
              />
            </label>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>Enabled</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsJsonSchema}
                  onChange={(e) => setSupportsJsonSchema(e.target.checked)}
                />
                <span>Supports JSON Schema</span>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="border-edge font-mono uppercase text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="font-mono uppercase text-xs">
                {saving ? "Saving…" : "Save provider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Models Picker Dialog */}
      <Dialog open={Boolean(modelsTarget)} onOpenChange={(o) => !o && setModelsTarget(null)}>
        <DialogContent className="sm:max-w-xl border-edge bg-card">
          <CornerBrackets />
          <DialogHeader>
            <DialogTitle>Models · {modelsTarget?.name}</DialogTitle>
            <DialogDescription>
              Enable models for routing and configure per-million-token cost tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="border border-edge bg-background max-h-[320px] overflow-auto divide-y divide-edge">
            {discoveredModels.length === 0 ? (
              <div className="p-4 text-xs font-mono text-muted-foreground text-center">
                No models saved yet. Click Test on the provider row to discover models, or add one below.
              </div>
            ) : (
              discoveredModels.map((m, idx) => (
                <div key={m.model_id} className="p-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={(e) => {
                      const next = [...discoveredModels];
                      next[idx] = { ...m, enabled: e.target.checked };
                      setDiscoveredModels(next);
                    }}
                  />
                  <span className="font-mono text-foreground flex-1 min-w-[160px] truncate">
                    {m.model_id}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={m.input_cost_per_mtok}
                    onChange={(e) => {
                      const next = [...discoveredModels];
                      next[idx] = { ...m, input_cost_per_mtok: Number(e.target.value) };
                      setDiscoveredModels(next);
                    }}
                    title="Input $/M"
                    className="w-20 h-7 border border-edge bg-card px-1.5 font-mono text-[11px]"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={m.output_cost_per_mtok}
                    onChange={(e) => {
                      const next = [...discoveredModels];
                      next[idx] = { ...m, output_cost_per_mtok: Number(e.target.value) };
                      setDiscoveredModels(next);
                    }}
                    title="Output $/M"
                    className="w-20 h-7 border border-edge bg-card px-1.5 font-mono text-[11px]"
                  />
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModelsTarget(null)}
              className="border-edge font-mono uppercase text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveModels()}
              disabled={saving}
              className="font-mono uppercase text-xs"
            >
              Save models
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Key Dialog */}
      <Dialog open={Boolean(rotateTarget)} onOpenChange={(o) => !o && setRotateTarget(null)}>
        <DialogContent className="border-edge bg-card">
          <CornerBrackets />
          <form onSubmit={(e) => void handleRotateKey(e)} className="grid gap-3.5">
            <DialogHeader>
              <DialogTitle>Rotate API Key · {rotateTarget?.name}</DialogTitle>
              <DialogDescription>
                Current key ends in ••••{rotateTarget?.key_last4}. Enter a new key to increment key_version.
              </DialogDescription>
            </DialogHeader>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={rotateKeyValue}
              onChange={(e) => setRotateKeyValue(e.target.value)}
              placeholder="Paste replacement API key…"
              className="h-9 border border-edge bg-background px-3 text-xs font-mono outline-none focus-visible:border-primary"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRotateTarget(null)}
                className="border-edge font-mono uppercase text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="font-mono uppercase text-xs">
                Rotate key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="border-edge bg-card">
          <CornerBrackets />
          <DialogHeader>
            <DialogTitle>Delete provider?</DialogTitle>
            <DialogDescription>
              This removes {deleteTarget?.name} (••••{deleteTarget?.key_last4}) and its saved models. Update routing chains if it is referenced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-edge font-mono uppercase text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="font-mono uppercase text-xs"
            >
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
