import { useEffect, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
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
import { signInAccount, signOutAccount } from "@/src/lib/apiClient";
import { isSupabaseConfigured } from "@/src/lib/supabase";
import type { UserSession, WalletSummary } from "@/src/types";
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
            Build for free every day with Dash Coins, or upgrade for an ad-free workspace.
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
              <li>Daily Dash Coins grant · Supported by ads</li>
              <li>Managed zero-setup builds</li>
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
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const supabaseActive = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setFormError("Enter a valid email address");
      return;
    }
    if (supabaseActive && password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const session = await signInAccount({
        email: trimmedEmail,
        password,
        name: name.trim() || trimmedEmail.split("@")[0],
        mode: authMode,
      });
      onSignIn(session);
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
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
                Your Dash Coins balance and workspace snapshots stay synced with your account.
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
                  void signOutAccount().finally(() => {
                    onSignOut();
                    onOpenChange(false);
                  });
                }}
                className="font-mono uppercase text-xs"
              >
                Sign out
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                {authMode === "signin" ? "Sign in to Emdash" : "Create your Emdash account"}
              </DialogTitle>
              <DialogDescription>
                Access your daily Dash Coins grant and build history anytime.
              </DialogDescription>
            </DialogHeader>

            {supabaseActive && (
              <div className="grid grid-cols-2 border border-edge bg-background p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  className={cn(
                    "py-1.5 font-mono uppercase text-[11px] cursor-pointer transition-colors",
                    authMode === "signin"
                      ? "bg-card text-primary border border-edge"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={cn(
                    "py-1.5 font-mono uppercase text-[11px] cursor-pointer transition-colors",
                    authMode === "signup"
                      ? "bg-card text-primary border border-edge"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign up
                </button>
              </div>
            )}

            <div className="grid gap-3">
              {(!supabaseActive || authMode === "signup") && (
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
              )}
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
              {supabaseActive && (
                <label className="grid gap-1.5">
                  <span className="font-mono uppercase text-[11px] text-muted-foreground">
                    Password
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 border border-edge bg-background px-3 text-sm outline-none focus-visible:border-primary"
                  />
                </label>
              )}
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
              <Button type="submit" disabled={submitting} className="font-mono uppercase text-xs gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                <span>{authMode === "signin" ? "Continue" : "Create account"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletSummary;
  user: UserSession | null;
  onOpenAuth: () => void;
}

export function WalletDialog({
  open,
  onOpenChange,
  wallet,
  user,
  onOpenAuth,
}: WalletDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-edge bg-card">
        <CornerBrackets />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-4 text-primary" />
            <span>Dash Coins Wallet</span>
          </DialogTitle>
          <DialogDescription>
            Daily free coins refresh automatically in {wallet.resetTimezone}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-px bg-edge border border-edge">
          <div className="bg-background p-3">
            <div className="font-mono uppercase text-[10px] text-muted-foreground">
              Balance
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">
              {wallet.balance}
            </div>
          </div>
          <div className="bg-background p-3">
            <div className="font-mono uppercase text-[10px] text-muted-foreground">
              Daily Grant
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5 text-primary">
              +{wallet.dailyGrant}
            </div>
          </div>
          <div className="bg-background p-3">
            <div className="font-mono uppercase text-[10px] text-muted-foreground">
              Build Cost
            </div>
            <div className="text-xl font-semibold tabular-nums mt-0.5">
              {wallet.buildCost}
            </div>
          </div>
        </div>

        {!user ? (
          <div className="border border-edge bg-background p-3.5 text-xs flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              Sign in to track your coin ledger and receive automatic daily grants.
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenAuth();
              }}
              className="font-mono uppercase text-xs shrink-0"
            >
              Sign in
            </Button>
          </div>
        ) : (
          <div className="border border-edge bg-background max-h-[240px] overflow-auto">
            <div className="px-3 py-2 border-b border-edge font-mono uppercase text-[10px] text-muted-foreground">
              Recent activity
            </div>
            {wallet.ledger.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                No coin transactions yet.
              </div>
            ) : (
              <div className="divide-y divide-edge">
                {wallet.ledger.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-foreground truncate">
                        {item.reason}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <span
                        className={
                          item.delta >= 0 ? "text-primary font-semibold" : "text-foreground"
                        }
                      >
                        {item.delta >= 0 ? `+${item.delta}` : item.delta}
                      </span>
                      <div className="text-[10px] text-muted-foreground">
                        bal {item.balance_after}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
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

interface SupportDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: DocSection;
  onSectionChange: (section: DocSection) => void;
}

const DOC_TABS: Array<{ id: DocSection; label: string }> = [
  { id: "quickstart", label: "Quickstart" },
  { id: "prompting", label: "Prompting & Files" },
  { id: "quota", label: "Coins & Export" },
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
            Guides for prompting, file attachments, Dash Coins, and exporting apps.
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
                  Free to start · Daily Dash Coins
                </h3>
                <p>
                  Emdash grants free Dash Coins every day so anyone can start building right away with zero setup. If a build fails due to high demand, spent coins are automatically refunded.
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
                  Privacy Policy &amp; storage
                </h3>
                <p>
                  Your theme preference and generated app versions stay in your browser. We do not sell personal data or run cross-site tracking scripts.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Prompts &amp; uploaded reference files
                </h3>
                <p>
                  Prompts and attached reference files are transmitted solely to generate your requested application output and are not stored in call logs.
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
                  Sandboxed live previews &amp; server isolation
                </h3>
                <p>
                  Every generated web application runs inside an isolated sandboxed iframe preview container, keeping preview execution separated from your host session. All builds run exclusively through server endpoints.
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
