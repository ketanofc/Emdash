import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { TEMPLATES, type TemplateItem } from "@/src/data/templates";
import {
  FALLBACK_GEMINI_MODEL,
  GeminiError,
  formatModelDisplayName,
  listGeminiModels,
  pickDefaultFlashModel,
} from "@/src/lib/gemini";
import {
  loadEncryptedApiKey,
  saveEncryptedApiKey,
  removeEncryptedApiKey,
} from "@/src/lib/storage";
import type { GeminiModelOption, UserSession } from "@/src/types";
import type { DocSection } from "@/src/components/Footer";
import { cn } from "@/src/lib/utils";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPro: boolean;
  onSelectPlan: (plan: "free" | "pro") => void;
}

export function PricingDialog({
  open,
  onOpenChange,
  isPro,
  onSelectPlan,
}: PricingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-edge bg-card">
        <CornerBrackets />
        <DialogHeader>
          <DialogTitle>Simple, transparent pricing</DialogTitle>
          <DialogDescription>
            Build for free every day, or upgrade for an ad-free, unlimited workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-edge border border-edge">
          <div className="bg-background p-4 flex flex-col gap-3">
            <div>
              <div className="font-mono uppercase text-[11px] text-muted-foreground">
                01 · Free Tier
              </div>
              <div className="text-sm font-semibold mt-1">Emdash Free</div>
              <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                $0
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 flex-1">
              <li>Free to start · Supported by ads</li>
              <li>Server-managed models</li>
              <li>Full project .zip code export</li>
              <li>Static &amp; React + TypeScript modes</li>
            </ul>
            <Button
              type="button"
              variant={isPro ? "outline" : "secondary"}
              size="sm"
              onClick={() => {
                onSelectPlan("free");
                onOpenChange(false);
              }}
              className="border-edge font-mono uppercase text-xs"
            >
              {isPro ? "Switch to Free" : "Current plan"}
            </Button>
          </div>

          <div className="bg-card p-4 flex flex-col gap-3">
            <div>
              <div className="font-mono uppercase text-[11px] text-primary">
                02 · Pro Tier
              </div>
              <div className="text-sm font-semibold mt-1">Emdash Pro</div>
              <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                $19
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 flex-1">
              <li>Ad-free workspace experience</li>
              <li>Zero sponsor banners or wait spots</li>
              <li>Full project .zip code export</li>
              <li>Priority support</li>
            </ul>
            <Button
              type="button"
              variant={isPro ? "secondary" : "default"}
              size="sm"
              onClick={() => {
                onSelectPlan("pro");
                onOpenChange(false);
              }}
              className="font-mono uppercase text-xs"
            >
              {isPro ? "Current plan" : "Enable Pro preview"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickTemplate: (tpl: TemplateItem) => void;
}

export function TemplatesDialog({
  open,
  onOpenChange,
  onPickTemplate,
}: TemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-edge bg-card">
        <CornerBrackets />
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            Choose a starting prompt to build in a fresh workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-px bg-edge border border-edge max-h-[340px] overflow-auto">
          {TEMPLATES.map((tpl, idx) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                onPickTemplate(tpl);
                onOpenChange(false);
              }}
              className="flex items-center justify-between gap-3 bg-background p-3.5 text-left hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <div>
                <div className="font-mono uppercase text-[11px] text-primary mb-0.5">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {tpl.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tpl.description}
                </div>
              </div>
              <span
                className="size-8 shrink-0 border border-edge"
                style={{
                  background: `linear-gradient(135deg, hsla(${tpl.hue}, 82%, 52%, 0.35), hsla(${tpl.hue}, 82%, 52%, 0.08))`,
                }}
              />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSession | null;
  onSignIn: (session: UserSession) => void;
  onSignOut: () => void;
}

export function AuthDialog({
  open,
  onOpenChange,
  user,
  onSignIn,
  onSignOut,
}: AuthDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setFormError("Enter a valid email address");
      return;
    }
    setFormError(null);
    const displayName = name.trim() || trimmedEmail.split("@")[0];
    onSignIn({
      name: displayName,
      email: trimmedEmail,
      plan: user?.plan ?? "free",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-edge bg-card">
        <CornerBrackets />
        {user ? (
          <>
            <DialogHeader>
              <DialogTitle>Account</DialogTitle>
              <DialogDescription>
                Signed in as {user.name} ({user.email})
              </DialogDescription>
            </DialogHeader>
            <div className="border border-edge bg-background p-3 text-xs space-y-1">
              <div className="font-mono uppercase text-primary">
                Plan: {user.plan === "pro" ? "Emdash Pro" : "Emdash Free"}
              </div>
              <div className="text-muted-foreground">
                Your session, workspace preferences, and plan state are saved locally in this browser.
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-edge font-mono uppercase text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onSignOut();
                  onOpenChange(false);
                }}
                className="font-mono uppercase text-xs"
              >
                Sign out
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Sign in to Emdash</DialogTitle>
              <DialogDescription>
                Save your workspace preferences and switch plans anytime.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="font-mono uppercase text-[11px] text-muted-foreground">
                  Name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="h-9 border border-edge bg-background px-3 text-sm outline-none focus-visible:border-primary"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="font-mono uppercase text-[11px] text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="h-9 border border-edge bg-background px-3 text-sm outline-none focus-visible:border-primary"
                />
              </label>
              {formError && (
                <div className="border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs font-mono text-destructive">
                  {formError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-edge font-mono uppercase text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-mono uppercase text-xs">
                Continue
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SupportDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: DocSection;
  onSectionChange: (section: DocSection) => void;
}

const DOC_TABS: Array<{ id: DocSection; label: string }> = [
  { id: "quickstart", label: "Quickstart" },
  { id: "prompting", label: "Prompting & Files" },
  { id: "quota", label: "Quota & Export" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "terms", label: "Terms of Service" },
  { id: "security", label: "Security" },
];

export function SupportDocsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
}: SupportDocsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border-edge bg-card">
        <CornerBrackets />
        <DialogHeader className="pr-6">
          <DialogTitle>Support documentation</DialogTitle>
          <DialogDescription>
            Guides for prompting, file attachments, BYOK models, and exporting apps.
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Documentation topics"
          className="flex flex-wrap gap-1 border border-edge bg-background p-1"
        >
          {DOC_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              onClick={() => onSectionChange(tab.id)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                section === tab.id
                  ? "bg-card text-primary border border-edge"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="border border-edge bg-background p-4 text-xs leading-relaxed text-muted-foreground space-y-3 max-h-[320px] overflow-y-auto">
          {section === "quickstart" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  01. Describe what you want to build
                </h3>
                <p>
                  Enter a plain-language prompt in the composer or click any starter template to populate a structured starting prompt. Press Enter or click Build app to launch the interactive workspace.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  02. Iterate and inspect across viewports
                </h3>
                <p>
                  In the workspace, use the Build Chat panel on the left to request layout adjustments, color changes, or new interactive features. Switch between Desktop, Tablet, and Mobile preview widths at the top of the preview pane.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  03. Restore versions anytime
                </h3>
                <p>
                  Every successful prompt creates a numbered version snapshot so you can compare iterations or roll back without losing earlier work.
                </p>
              </div>
            </>
          )}

          {section === "prompting" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Attaching reference files and screenshots
                </h3>
                <p>
                  Click the paperclip button, drag and drop files directly onto the prompt box, or paste screenshots from your clipboard. You can attach up to 4 files per message (max 4 MB each), including PNG/JPG/WebP mockups, HTML/CSS snippets, JSON data, or Markdown specs.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Writing clear prompts
                </h3>
                <p>
                  Specify your target audience, core interactive workflow, preferred color mood, and required sections. Mention concrete states (filters, modals, tabs, or forms) so generated code includes real client-side interactivity.
                </p>
              </div>
            </>
          )}

          {section === "quota" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Free to start · Supported by ads
                </h3>
                <p>
                  Emdash is free to start and supported by clearly labeled sponsors, powered by models on the server so anyone can start building right away. You can also upgrade to Emdash Pro for an ad-free workspace.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Exporting your project as .zip
                </h3>
                <p>
                  Click Export in the workspace toolbar to download all generated source files (static HTML/CSS/JS or React + TypeScript + Tailwind) as a ready-to-run .zip archive.
                </p>
              </div>
            </>
          )}

          {section === "privacy" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Privacy Policy &amp; local browser storage
                </h3>
                <p>
                  Your theme preference, active model selection, generated app versions, and local account profile stay in your browser. We do not sell personal data or run cross-site tracking scripts.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Prompts &amp; uploaded reference files
                </h3>
                <p>
                  Prompts and attached reference files are transmitted solely to generate your requested application output and are not retained beyond the active build request unless you explicitly publish a route.
                </p>
              </div>
            </>
          )}

          {section === "terms" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Code ownership &amp; commercial usage
                </h3>
                <p>
                  Applications generated and exported through Emdash can be downloaded, modified, and deployed freely for personal or commercial projects with zero attribution requirements.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Acceptable use &amp; daily quota
                </h3>
                <p>
                  Emdash is free to start and supported by clearly labeled sponsor slots. Automated scraping, abusive traffic, or attempts to bypass server safeguards are prohibited.
                </p>
              </div>
            </>
          )}

          {section === "security" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Sandboxed live previews &amp; API isolation
                </h3>
                <p>
                  Every generated web application runs inside an isolated sandboxed iframe preview container, keeping preview execution separated from your host session. All model API calls run exclusively through server endpoints.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Reporting security issues
                </h3>
                <p>
                  For security disclosures or compliance inquiries, review our{" "}
                  <a
                    href="/trust.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Trust Center
                  </a>{" "}
                  or email{" "}
                  <a
                    href="mailto:support@emdash.build"
                    className="text-primary hover:underline"
                  >
                    support@emdash.build
                  </a>
                  .
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <a
            href="mailto:support@emdash.build"
            className="text-xs text-muted-foreground hover:text-primary transition-colors self-center"
          >
            Need direct help? support@emdash.build
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-edge font-mono uppercase text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SponsorSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SponsorSlotDialog({
  open,
  onOpenChange,
}: SponsorSlotDialogProps) {
  const [slot, setSlot] = useState<"composer" | "template">("composer");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setFormError("Enter your company or product name.");
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setFormError("Enter a valid work email address.");
      return;
    }
    if (!headline.trim()) {
      setFormError("Provide a short sponsor headline (up to 70 characters).");
      return;
    }
    setFormError(null);
    setSubmitted(true);
  };

  const resetForm = () => {
    setSubmitted(false);
    setCompany("");
    setEmail("");
    setUrl("");
    setHeadline("");
    setFormError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-edge bg-card">
        <CornerBrackets />
        {submitted ? (
          <>
            <DialogHeader>
              <DialogTitle>Sponsorship request received</DialogTitle>
              <DialogDescription>
                We recorded your interest for the{" "}
                {slot === "composer" ? "Hero Composer Banner" : "Templates Grid Slot"}.
              </DialogDescription>
            </DialogHeader>
            <div className="border border-edge bg-background p-3.5 text-xs space-y-1.5">
              <div className="font-medium text-foreground">
                {company} · {slot === "composer" ? "Composer Banner ($290/wk)" : "Template Slot ($190/wk)"}
              </div>
              <div className="text-muted-foreground">{headline}</div>
              <div className="text-muted-foreground">
                Confirmation details will be sent to {email}.
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="border-edge font-mono uppercase text-xs"
              >
                New request
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="font-mono uppercase text-xs"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader className="pr-6">
              <DialogTitle>Sponsor a slot on Emdash</DialogTitle>
              <DialogDescription>
                Support free access by featuring your product in a native, non-intrusive placement.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSlot("composer")}
                className={cn(
                  "border p-3 text-left transition-colors cursor-pointer",
                  slot === "composer"
                    ? "border-primary bg-primary/5"
                    : "border-edge bg-background hover:border-neutral"
                )}
              >
                <div className="text-xs font-semibold text-foreground">
                  Composer Banner
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                  $290 / week · Above fold
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSlot("template")}
                className={cn(
                  "border p-3 text-left transition-colors cursor-pointer",
                  slot === "template"
                    ? "border-primary bg-primary/5"
                    : "border-edge bg-background hover:border-neutral"
                )}
              >
                <div className="text-xs font-semibold text-foreground">
                  Template Grid Card
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                  $190 / week · Gallery slot
                </div>
              </button>
            </div>

            <div className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-foreground">
                    Company or product
                  </span>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="CloudNest"
                    className="h-9 border border-edge bg-background px-3 text-xs outline-none focus-visible:border-primary"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-foreground">
                    Work email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="growth@cloudnest.dev"
                    className="h-9 border border-edge bg-background px-3 text-xs outline-none focus-visible:border-primary"
                  />
                </label>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-foreground">
                  Destination URL (optional)
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://cloudnest.dev"
                  className="h-9 border border-edge bg-background px-3 text-xs outline-none focus-visible:border-primary"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-foreground">
                  Sponsor headline
                </span>
                <input
                  type="text"
                  maxLength={70}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Deploy exported HTML in seconds with 3 months free"
                  className="h-9 border border-edge bg-background px-3 text-xs outline-none focus-visible:border-primary"
                />
              </label>

              {formError && (
                <div className="border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                  {formError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-edge font-mono uppercase text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" className="font-mono uppercase text-xs">
                Request slot
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialModel: string;
  onSaveModel: (model: string) => void;
}

type ModelLoadStatus =
  | { state: "idle"; message?: string }
  | { state: "loading"; message: string }
  | { state: "ready"; message: string }
  | { state: "error"; message: string };

export function ModelsDialog({
  open,
  onOpenChange,
  initialModel,
  onSaveModel,
}: ModelsDialogProps) {
  const [models, setModels] = useState<GeminiModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState(
    initialModel || FALLBACK_GEMINI_MODEL
  );
  const [apiKey, setApiKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [status, setStatus] = useState<ModelLoadStatus>({ state: "idle" });

  const loadModels = async (preferSelection = true, explicitKey?: string) => {
    setStatus({ state: "loading", message: "Loading available models…" });
    try {
      const keyToUse = explicitKey !== undefined ? explicitKey : apiKey;
      const listRaw = await listGeminiModels(keyToUse || undefined);
      const list = listRaw.filter((m) => !/(?:tts|audio|image|live|robotics|computer-use)/i.test(m.id));

      if (list.length === 0) {
        setModels(defaultFallbackList);
        setStatus({ state: "idle" });
        return;
      }
      setModels(list);
      const preferred = pickDefaultFlashModel(list);
      if (preferSelection) {
        setSelectedModel((prev) =>
          list.some((m) => m.id === prev) &&
          !/(?:tts|audio|image|live|robotics|computer-use)/i.test(prev)
            ? prev
            : preferred
        );
      }
      if (keyToUse && keyToUse.trim()) {
        setStatus({
          state: "ready",
          message: `Key valid · ${list.length} models loaded`,
        });
      } else {
        setStatus({ state: "idle" });
      }
    } catch (err: unknown) {
      if (err instanceof GeminiError) {
        setStatus({
          state: "error",
          message: err.message,
        });
        return;
      }
      setStatus({
        state: "error",
        message: "Could not validate API key or load models.",
      });
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedModel(initialModel || FALLBACK_GEMINI_MODEL);
      void (async () => {
        const stored = await loadEncryptedApiKey();
        if (stored) {
          setApiKey(stored);
          setHasStoredKey(true);
          void loadModels(true, stored);
        } else {
          setApiKey("");
          setHasStoredKey(false);
          void loadModels(true, "");
        }
      })();
    }
  }, [open, initialModel]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      await saveEncryptedApiKey(apiKey.trim());
    }
    onSaveModel(selectedModel || FALLBACK_GEMINI_MODEL);
    onOpenChange(false);
  };

  const handleRemoveKey = async () => {
    await removeEncryptedApiKey();
    setApiKey("");
    setHasStoredKey(false);
    void loadModels(true, "");
  };

  const defaultFallbackList: GeminiModelOption[] = [
    { id: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash (Default)" },
    { id: "gemini-3.5-flash-lite", displayName: "Gemini 3.5 Flash Lite" },
    { id: "gemini-4-hydrogen", displayName: "Gemini 4 Hydrogen" },
    { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
    { id: "gemini-4-argon", displayName: "Gemini 4 Argon" },
  ];

  const availableOptions: GeminiModelOption[] =
    models.length > 0
      ? models
      : defaultFallbackList.some((m) => m.id === selectedModel)
        ? defaultFallbackList
        : [
            {
              id: selectedModel || FALLBACK_GEMINI_MODEL,
              displayName: formatModelDisplayName(selectedModel || FALLBACK_GEMINI_MODEL),
            },
            ...defaultFallbackList,
          ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-edge bg-card p-4 sm:p-6 overflow-hidden">
        <CornerBrackets />
        <form onSubmit={handleSave} className="grid grid-cols-[minmax(0,1fr)] min-w-0 w-full gap-4">
          <DialogHeader className="pr-7 min-w-0">
            <DialogTitle>Settings · Models</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Connect your own API key and choose which model generates apps on the server.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-[minmax(0,1fr)] min-w-0 gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)] min-w-0 gap-1.5">
              <label
                htmlFor="api-key-input"
                className="font-mono uppercase text-[11px] text-muted-foreground"
              >
                API Key
              </label>
              <div className="flex gap-2 min-w-0">
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className="h-9 w-full min-w-0 border border-edge bg-background px-3 font-mono text-xs outline-none focus-visible:border-primary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadModels(false, apiKey)}
                  disabled={status.state === "loading"}
                  className="h-9 shrink-0 font-mono uppercase text-[11px]"
                >
                  Test key
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] min-w-0 gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <label
                  htmlFor="model-select"
                  className="font-mono uppercase text-[11px] text-muted-foreground"
                >
                  Model
                </label>
                <button
                  type="button"
                  onClick={() => void loadModels(false, apiKey)}
                  disabled={status.state === "loading"}
                  className="inline-flex items-center gap-1 font-mono uppercase text-[11px] text-primary hover:underline disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={cn("size-3", status.state === "loading" && "animate-spin")}
                    aria-hidden="true"
                  />
                  <span>Refresh models</span>
                </button>
              </div>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger
                  id="model-select"
                  className="h-9 w-full min-w-0 border-edge bg-background font-mono text-xs"
                >
                  <SelectValue placeholder="Select a Gemini model" />
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      {formatModelDisplayName(m.id, m.displayName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status.state !== "idle" && (
              <div
                className={cn(
                  "flex items-start gap-2 min-w-0 w-full border px-2.5 py-2 text-xs break-words",
                  status.state === "ready"
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : status.state === "loading"
                      ? "border-edge bg-background text-muted-foreground"
                      : "border-destructive/40 bg-destructive/5 text-destructive"
                )}
              >
                {status.state === "loading" ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0 mt-0.5 text-primary" />
                ) : status.state === "ready" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-primary" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                )}
                <span className="min-w-0 break-words">{status.message}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 pt-1 min-w-0">
            <div>
              {hasStoredKey && (
                <button
                  type="button"
                  onClick={() => void handleRemoveKey()}
                  className="inline-flex items-center gap-1 font-mono uppercase text-[11px] text-destructive hover:underline cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  <span>Remove key</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 border-edge font-mono uppercase text-[11px] sm:text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 font-mono uppercase text-[11px] sm:text-xs"
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
