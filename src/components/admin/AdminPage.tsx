import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  FileText,
  GitBranch,
  KeyRound,
  Loader2,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  enrollTotpFactor,
  fetchAuthState,
  verifyTotpFactor,
  type AuthMeState,
} from "@/src/lib/apiClient";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminProvidersTab } from "./AdminProvidersTab";
import { AdminRoutingTab } from "./AdminRoutingTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminSettingsTab } from "./AdminSettingsTab";
import { AdminAuditTab } from "./AdminAuditTab";
import { AdminDashboardSection } from "./AdminDashboardSection";
import { cn } from "@/src/lib/utils";

type AdminTabId = "overview" | "providers" | "routing" | "users" | "settings" | "audit";

const TABS: Array<{ id: AdminTabId; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "providers", label: "Providers", icon: Server },
  { id: "routing", label: "Routing", icon: GitBranch },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "audit", label: "Audit Log", icon: FileText },
];

interface AdminPageProps {
  onBackHome: () => void;
  onOpenAuth: () => void;
}

export default function AdminPage({ onBackHome, onOpenAuth }: AdminPageProps) {
  const [authState, setAuthState] = useState<AuthMeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  // MFA enrollment/verification state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    factorId?: string;
    secret: string;
    qrSvg?: string;
    otpauthUri: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const loadAuth = async () => {
    setLoading(true);
    try {
      const state = await fetchAuthState();
      setAuthState(state);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuth();
  }, []);

  const handleStartEnroll = async () => {
    setEnrolling(true);
    setMfaError(null);
    try {
      const data = await enrollTotpFactor();
      setEnrollment(data);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Failed to initialize TOTP enrollment.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setMfaError(null);
    try {
      await verifyTotpFactor({
        code: totpCode,
        factorId: enrollment?.factorId,
      });
      setTotpCode("");
      await loadAuth();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const isAdmin = authState?.user?.role === "admin";
  const isAal2 = authState?.aal === "aal2";

  if (loading) {
    return (
      <main className="flex-1 bg-background p-4 grid place-items-center">
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Verifying admin security posture…</span>
        </div>
      </main>
    );
  }

  // Gate 1: Not signed in or not admin
  if (!authState?.user || !isAdmin) {
    return (
      <main className="flex-1 bg-background px-2 py-8">
        <div className="relative mx-auto max-w-lg border border-edge bg-card p-6 space-y-4">
          <CornerBrackets />
          <div className="flex items-center gap-2 font-mono uppercase text-xs text-destructive">
            <ShieldAlert className="size-4" />
            <span>Admin access required</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Restricted Control Plane
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This route requires an authenticated account with database role{" "}
            <code className="font-mono text-foreground">admin</code> and TOTP two-factor
            authentication enabled.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackHome}
              className="border-edge font-mono uppercase text-xs gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Emdash</span>
            </Button>
            {!authState?.user && (
              <Button
                type="button"
                size="sm"
                onClick={onOpenAuth}
                className="font-mono uppercase text-xs"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Gate 2: Admin without MFA (aal2)
  if (!isAal2) {
    return (
      <main className="flex-1 bg-background px-2 py-8">
        <div className="relative mx-auto max-w-lg border border-edge bg-card p-6 space-y-4">
          <CornerBrackets />
          <div className="flex items-center gap-2 font-mono uppercase text-xs text-primary">
            <KeyRound className="size-4" />
            <span>Two-Factor Authentication Required (aal2)</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Verify TOTP authenticator
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Admin access requires a verified TOTP factor (assurance level{" "}
            <code className="font-mono text-foreground">aal2</code>).
          </p>

          {!authState.mfaEnrolled && !enrollment && (
            <Button
              type="button"
              onClick={() => void handleStartEnroll()}
              disabled={enrolling}
              className="font-mono uppercase text-xs gap-1.5"
            >
              {enrolling && <Loader2 className="size-3.5 animate-spin" />}
              <span>Enroll TOTP Authenticator</span>
            </Button>
          )}

          {enrollment && (
            <div className="border border-edge bg-background p-3.5 space-y-3">
              <div className="font-mono uppercase text-[10px] text-muted-foreground">
                Add this secret to your authenticator app (1Password, Google Authenticator, Authy)
              </div>
              {enrollment.qrSvg && (
                <div
                  className="bg-white p-2 w-fit border border-edge"
                  dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
                />
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 border border-edge bg-card px-2.5 py-1.5 font-mono text-xs break-all">
                  {enrollment.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(enrollment.secret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 1500);
                  }}
                  className="border-edge font-mono uppercase text-[10px] gap-1 shrink-0"
                >
                  {copiedSecret ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
                  <span>{copiedSecret ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>
          )}

          {(authState.mfaEnrolled || enrollment) && (
            <form onSubmit={(e) => void handleVerifyCode(e)} className="space-y-3">
              <label className="grid gap-1.5">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">
                  6-Digit Authenticator Code
                </span>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="h-9 border border-edge bg-background px-3 font-mono text-sm tracking-widest outline-none focus-visible:border-primary"
                />
              </label>
              {mfaError && (
                <div className="border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs font-mono text-destructive">
                  {mfaError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBackHome}
                  className="border-edge font-mono uppercase text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={verifying} className="font-mono uppercase text-xs">
                  {verifying ? "Verifying…" : "Verify & unlock admin"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-background px-2 pb-6">
      <div className="mx-auto max-w-full border-x border-b border-edge bg-card">
        {/* Top strip */}
        <div className="h-6 border-b border-edge bg-background hatch-pattern" />

        {/* Header + Tabs */}
        <div className="relative border-b border-edge px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <CornerBrackets />
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <div>
              <div className="font-mono uppercase text-[10px] text-primary">
                Emdash Control Plane · aal2 verified
              </div>
              <div className="text-sm font-semibold">{authState.user.email}</div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBackHome}
            className="h-8 border-edge font-mono uppercase text-xs gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Exit admin</span>
          </Button>
        </div>

        {/* Recharts Key Metrics Dashboard Section */}
        <AdminDashboardSection onNavigateTab={(tab) => setActiveTab(tab)} />

        {/* Navigation Tab Bar */}
        <div className="flex overflow-x-auto border-b border-edge bg-background px-2 sm:px-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 font-mono uppercase text-[11px] border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer",
                  active
                    ? "border-primary text-primary font-semibold bg-card"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div className="p-3 sm:p-5 bg-background">
          {activeTab === "overview" && <AdminOverviewTab />}
          {activeTab === "providers" && <AdminProvidersTab />}
          {activeTab === "routing" && <AdminRoutingTab />}
          {activeTab === "users" && <AdminUsersTab />}
          {activeTab === "settings" && <AdminSettingsTab />}
          {activeTab === "audit" && <AdminAuditTab />}
        </div>
      </div>
    </main>
  );
}
