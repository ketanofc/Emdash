import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
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
import { TEMPLATES, type TemplateItem } from "@/src/data/templates";
import type { AppVersion, UserSession } from "@/src/types";
import type { DocSection } from "@/src/components/Footer";
import { cn } from "@/src/lib/utils";

interface AdRewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRewardClaimed: (seconds: number) => void;
}

export function AdRewardDialog({
  open,
  onOpenChange,
  onRewardClaimed,
}: AdRewardDialogProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setCountdown(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      onRewardClaimed(1200);
      onOpenChange(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [countdown, onOpenChange, onRewardClaimed]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-edge bg-card">
        <CornerBrackets />
        <DialogHeader>
          <DialogTitle>Add more build time</DialogTitle>
          <DialogDescription>
            Watch a short sponsored spot to add 20 minutes to today’s limit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border border-dashed border-edge p-3 bg-background text-xs">
          <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-card">
            Ad
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground">
              {countdown !== null
                ? "Playing CloudNest sponsor spot…"
                : "Rewarded video"}
            </div>
            <div className="font-mono uppercase text-[11px] text-muted-foreground tabular-nums mt-0.5">
              {countdown !== null ? `${countdown}s remaining` : "15 seconds"}
            </div>
          </div>
          {countdown !== null && (
            <div className="w-16 h-1.5 bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((15 - countdown) / 15) * 100}%` }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={countdown !== null}
            className="border-edge font-mono uppercase text-xs"
          >
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => setCountdown(15)}
            disabled={countdown !== null}
            className="font-mono uppercase text-xs"
          >
            {countdown !== null ? `Ad ends in ${countdown}s` : "Watch ad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
              <li>5 hours daily build time</li>
              <li>+20m bonus via rewarded ads</li>
              <li>Full HTML code export</li>
              <li>Ad-supported workspace</li>
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
              <li>Unlimited daily build time</li>
              <li>Zero ads in composer or wait states</li>
              <li>Instant live publish routes</li>
              <li>Priority model throughput</li>
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

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: AppVersion | null;
  publishedPath: string | null;
  onExport: (version: AppVersion) => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  version,
  publishedPath,
  onExport,
}: PublishDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!version) return null;

  const fullUrl =
    typeof window !== "undefined" && publishedPath
      ? `${window.location.origin}${publishedPath}`
      : `https://${version.slug}.emdash.site`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-edge bg-card">
        <CornerBrackets />
        <DialogHeader className="pr-6">
          <DialogTitle className="truncate">Published {version.title}</DialogTitle>
          <DialogDescription>
            Version {version.version} is live on this server and ready to share or download.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 min-w-0 w-full border border-edge bg-background p-2">
          <span
            title={fullUrl}
            className="flex-1 min-w-0 truncate text-xs font-mono text-foreground px-1"
          >
            {fullUrl}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 border-edge font-mono uppercase text-xs"
          >
            {copied ? (
              <Check className="size-3.5 text-primary" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>

        <DialogFooter className="min-w-0 flex-wrap sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onExport(version)}
            className="border-edge font-mono uppercase text-xs"
          >
            <Download className="size-3.5" />
            <span>Download HTML</span>
          </Button>
          {publishedPath && (
            <Button asChild className="font-mono uppercase text-xs">
              <a href={publishedPath} target="_blank" rel="noopener noreferrer">
                <span>Open live route</span>
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </DialogFooter>
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
                Your session and daily build quota are saved locally in this browser.
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
            Guides for prompting, file attachments, daily build time, and exporting apps.
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
                  Free daily build quota (5 hours/day)
                </h3>
                <p>
                  Every free user receives 5 hours of daily build quota, resetting every 24 hours. When your daily allowance runs low, you can watch a short 15-second sponsored spot to add 20 bonus minutes immediately, or upgrade to Emdash Pro for unlimited ad-free builds.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Exporting HTML &amp; live publishing
                </h3>
                <p>
                  Click Download HTML to save a self-contained single-file HTML bundle you can host anywhere, or click Publish to generate a live shareable route directly from the workspace.
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
                  Your theme preference, daily build quota counter, and local account profile are stored in your browser&apos;s localStorage. We do not sell personal data or run invasive cross-site tracking scripts.
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
                  Free accounts receive 5 hours of daily build quota, supported by clearly labeled sponsor slots. Automated scraping, abusive traffic, or attempts to bypass server safeguards are prohibited.
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
                  Every generated web application runs inside an isolated iframe preview container, keeping preview execution separated from your host session. All model credentials stay strictly server-side behind encrypted API routes.
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
                Support free daily build hours by featuring your product in a native, non-intrusive placement.
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
