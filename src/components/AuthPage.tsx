import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  requestPasswordReset,
  signInAccount,
  signInWithGoogleOAuth,
} from "@/src/lib/apiClient";
import { hydrateSupabaseConfig, isSupabaseConfigured } from "@/src/lib/supabase";
import type { DocSection } from "@/src/components/Footer";
import type { UserSession } from "@/src/types";

interface AuthPageProps {
  authMode: "signin" | "signup";
  onChangeMode: (nextMode: "signin" | "signup") => void;
  onSuccess: (session: UserSession) => void;
  onOpenDocs: (section: DocSection) => void;
  onOpenWallet: () => void;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthPage({
  authMode,
  onChangeMode,
  onSuccess,
  onOpenDocs,
  onOpenWallet,
}: AuthPageProps) {
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      void hydrateSupabaseConfig();
    }
  }, []);

  useEffect(() => {
    setFormError(null);
    setInfoMessage(null);
    setView("auth");
  }, [authMode]);

  const handleGoogleContinue = async () => {
    setFormError(null);
    setInfoMessage(null);
    setGoogleLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        await hydrateSupabaseConfig();
      }
      await signInWithGoogleOAuth("/");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not connect to Google sign-in."
      );
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (view === "forgot") {
      setFormError(null);
      setInfoMessage(null);
      setSubmitting(true);
      try {
        if (!isSupabaseConfigured()) {
          await hydrateSupabaseConfig();
        }
        await requestPasswordReset(trimmedEmail);
        setInfoMessage(
          `Password reset instructions sent to ${trimmedEmail}. Check your inbox.`
        );
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : "Could not send password reset email."
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setFormError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const result = await signInAccount({
        email: trimmedEmail,
        password,
        name: name.trim() || trimmedEmail.split("@")[0],
        mode: authMode,
      });

      if (result.status === "confirmation_required") {
        setInfoMessage(
          `Account created! Check ${result.email} to confirm your email, then sign in.`
        );
        onChangeMode("signin");
        return;
      }

      onSuccess(result.user);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isSignUp = authMode === "signup";

  return (
    <main className="flex-1 overflow-x-clip bg-background">
      {/* Top Diagonal Hatch Strip matching HomeView */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Main Grid Rail Section matching HomeView Hero */}
      <section className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col items-center border-x border-edge bg-card px-2.5 sm:px-4 md:px-10 py-10 sm:py-14 md:py-20">
          <CornerBrackets />

          <button
            type="button"
            onClick={onOpenWallet}
            className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 border border-edge bg-background min-h-8 font-mono uppercase text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 text-foreground hover:border-primary transition-colors cursor-pointer max-w-full text-center"
          >
            <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
              FREE
            </span>
            <span>+100 Daily Dash Coins</span>
          </button>

          <h1 className="mt-5 text-[30px] sm:text-[38px] leading-[1.05] lg:text-5xl tracking-tighter font-semibold max-w-2xl text-balance text-center text-foreground">
            {view === "forgot"
              ? "Reset your password"
              : isSignUp
                ? "Create your Emdash account"
                : "Sign in to Emdash"}
          </h1>

          <p className="mt-3 max-w-xl tracking-tight text-muted-foreground text-sm lg:text-base text-center">
            {view === "forgot"
              ? "Enter your email address and we will send a password reset link."
              : isSignUp
                ? "Sign up with Google or email to start building and exporting apps."
                : "Sign in with Google or your email to access your builds and Dash Coins."}
          </p>

          {/* Centered Focused Auth Box matching HomeView Composer Grid */}
          <div className="relative mt-9 w-full max-w-[440px] border border-edge bg-background p-5 sm:p-7 flex flex-col gap-5">
            <CornerBrackets />

            {view === "forgot" ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono uppercase text-[11px] text-primary">
                    Account recovery
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setView("auth");
                      setFormError(null);
                      setInfoMessage(null);
                    }}
                    className="inline-flex items-center gap-1 font-mono uppercase text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="size-3" />
                    <span>Back to sign in</span>
                  </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                  <label className="grid gap-1.5">
                    <span className="font-mono uppercase text-[11px] text-muted-foreground">
                      Email address
                    </span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-10 border border-edge bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
                    />
                  </label>

                  {infoMessage && (
                    <div className="border border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-mono text-primary leading-relaxed">
                      {infoMessage}
                    </div>
                  )}

                  {formError && (
                    <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive leading-relaxed">
                      {formError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-10 font-mono uppercase text-xs gap-2"
                  >
                    {submitting && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Send reset link</span>
                  </Button>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Primary Google Auth CTA */}
                <button
                  type="button"
                  onClick={() => void handleGoogleContinue()}
                  disabled={googleLoading || submitting}
                  className="w-full h-11 border border-edge bg-card hover:bg-muted/70 hover:border-neutral text-foreground text-sm font-medium inline-flex items-center justify-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {googleLoading ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>{isSignUp ? "Sign up with Google" : "Continue with Google"}</span>
                </button>

                {/* Hairline Divider */}
                <div className="relative flex items-center py-0.5">
                  <div className="flex-1 border-t border-edge" />
                  <span className="px-3 font-mono uppercase text-[10px] text-muted-foreground whitespace-nowrap">
                    or continue with email
                  </span>
                  <div className="flex-1 border-t border-edge" />
                </div>

                {/* Email / Password Form */}
                <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
                  {isSignUp && (
                    <label className="grid gap-1.5">
                      <span className="font-mono uppercase text-[11px] text-muted-foreground">
                        Full name
                      </span>
                      <input
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="h-10 border border-edge bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
                      />
                    </label>
                  )}

                  <label className="grid gap-1.5">
                    <span className="font-mono uppercase text-[11px] text-muted-foreground">
                      Email address
                    </span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="h-10 border border-edge bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary"
                    />
                  </label>

                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="auth-password-input"
                        className="font-mono uppercase text-[11px] text-muted-foreground"
                      >
                        Password
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setView("forgot");
                            setFormError(null);
                            setInfoMessage(null);
                          }}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="auth-password-input"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isSignUp ? "Minimum 6 characters" : "Enter your password"}
                        className="h-10 w-full border border-edge bg-card pl-3 pr-10 text-sm text-foreground outline-none focus-visible:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 px-3 inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {infoMessage && (
                    <div className="border border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-mono text-primary leading-relaxed">
                      {infoMessage}
                    </div>
                  )}

                  {formError && (
                    <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-mono text-destructive leading-relaxed">
                      {formError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || googleLoading}
                    className="w-full h-11 font-mono uppercase text-xs gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    <span>{isSignUp ? "Create account with email" : "Sign in with email"}</span>
                  </Button>
                </form>

                {/* Separate Page Switch Link */}
                <div className="pt-0.5 text-center text-xs text-muted-foreground">
                  {isSignUp ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => onChangeMode("signin")}
                        className="font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      New to Emdash?{" "}
                      <button
                        type="button"
                        onClick={() => onChangeMode("signup")}
                        className="font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Sign up
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Short Centered Legal Notice */}
            <div className="flex items-center justify-center pt-3 border-t border-edge text-[11px] text-muted-foreground text-center">
              <span className="max-w-xs mx-auto text-center leading-snug">
                By continuing, you accept{" "}
                <button
                  type="button"
                  onClick={() => onOpenDocs("terms")}
                  className="text-foreground hover:text-primary underline underline-offset-2 cursor-pointer"
                >
                  Terms
                </button>{" "}
                &amp;{" "}
                <button
                  type="button"
                  onClick={() => onOpenDocs("privacy")}
                  className="text-foreground hover:text-primary underline underline-offset-2 cursor-pointer"
                >
                  Privacy
                </button>
                .
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Diagonal Hatch Strip matching HomeView */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>
    </main>
  );
}
