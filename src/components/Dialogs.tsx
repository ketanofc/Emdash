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
