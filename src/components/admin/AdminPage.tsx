import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  KeyRound,
  Loader2,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  enrollTotpFactor,
  fetchAuthState,
  signInAccount,
  signOutAccount,
  verifyTotpFactor,
  type AuthMeState,
} from "@/src/lib/apiClient";
import { generateTotpClientCode } from "@/src/lib/totpClient";
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

  // Direct Admin Sign-In State
  const [adminEmail, setAdminEmail] = useState("admin@emdash.build");
  const [adminPassword, setAdminPassword] = useState("Emdash@Admin2026!");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSigningIn, setAdminSigningIn] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [generatingTotp, setGeneratingTotp] = useState(false);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSigningIn(true);
    setAdminAuthError(null);
    try {
      await signInAccount({
        email: adminEmail.trim(),
        password: adminPassword,
        mode: "signin",
      });
      await loadAuth();
    } catch (err) {
      setAdminAuthError(err instanceof Error ? err.message : "Admin sign-in failed. Check your password in .env.");
    } finally {
      setAdminSigningIn(false);
    }
  };

  const handleAdminSignOut = async () => {
    await signOutAccount();
    await loadAuth();
  };

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
        secret: enrollment?.secret,
      });
      setTotpCode("");
      await loadAuth();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleAutoGenerateTotp = async () => {
    const sec = enrollment?.secret;
    if (!sec) return;
    setGeneratingTotp(true);
    try {
      const code = await generateTotpClientCode(sec);
      setTotpCode(code);
    } catch {
      // ignore
    } finally {
      setGeneratingTotp(false);
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
            <span>Admin Control Plane</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Administrator Authentication
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This route requires an authenticated account with administrator privileges.
          </p>

          {/* If already signed in as a non-admin user */}
          {authState?.user && !isAdmin && (
            <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-2">
              <div className="font-mono text-destructive font-semibold">
                Access Denied · Role: {authState.user.role}
              </div>
              <p className="text-muted-foreground">
                Currently signed in as <span className="font-semibold text-foreground">{authState.user.email}</span>. This account does not have administrator privileges.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleAdminSignOut()}
                className="font-mono uppercase text-xs mt-1"
              >
                Sign out to switch to admin
              </Button>
            </div>
          )}

          {/* If not signed in at all, render direct Admin Sign-in Form */}
          {!authState?.user && (
            <form onSubmit={(e) => void handleAdminSignIn(e)} className="border border-edge bg-background p-4 space-y-3">
              <div className="font-mono uppercase text-[10px] text-primary font-semibold">
                Sign in with Admin Credentials
              </div>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">
                  Admin Email
                </span>
                <input
                  required
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@emdash.build"
                  className="h-8 border border-edge bg-card px-2.5 font-mono text-xs outline-none focus-visible:border-primary text-foreground"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono uppercase text-[10px] text-muted-foreground">
                  Admin Password
                </span>
                <div className="relative flex items-center">
                  <input
                    required
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-8 w-full border border-edge bg-card pl-2.5 pr-8 font-mono text-xs outline-none focus-visible:border-primary text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showAdminPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </label>

              {adminAuthError && (
                <div className="border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 font-mono text-xs text-destructive">
                  {adminAuthError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-edge/60">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Default: <code className="text-foreground">admin@emdash.build</code> / <code className="text-foreground">Emdash@Admin2026!</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEmail("admin@emdash.build");
                      setAdminPassword("Emdash@Admin2026!");
                    }}
                    className="text-left font-mono text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    Auto-fill default credentials
                  </button>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={adminSigningIn}
                  className="font-mono uppercase text-xs gap-1.5 shrink-0"
                >
                  {adminSigningIn && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Sign in as Admin</span>
                </Button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-edge/60">
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
                variant="ghost"
                size="sm"
                onClick={onOpenAuth}
                className="font-mono uppercase text-xs text-muted-foreground hover:text-foreground"
              >
                Go to standard sign in
              </Button>
            )}
          </div>
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
                Emdash Control Plane · Administrator
              </div>
              <div className="text-sm font-semibold">{authState?.user?.email || "admin@emdash.build"}</div>
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
