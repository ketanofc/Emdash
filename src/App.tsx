import type React from "react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import JSZip from "jszip";
import { Navbar } from "@/src/components/Navbar";
import { HomeView } from "@/src/components/HomeView";
import { WorkspaceView } from "@/src/components/WorkspaceView";
import { AuthPage } from "@/src/components/AuthPage";
import { SponsorshipPage } from "@/src/components/SponsorshipPage";
import { WebAgentPage } from "@/src/components/web/WebAgentPage";
import { Footer, type DocSection } from "@/src/components/Footer";
import {
  AuthDialog,
  SupportDocsDialog,
  TemplatesDialog,
  WalletDialog,
} from "@/src/components/Dialogs";
import {
  FALLBACK_GEMINI_MODEL,
  GeminiError,
  runPipelineViaServer,
} from "@/src/lib/gemini";
import { fetchAuthState, fetchWalletSummary } from "@/src/lib/apiClient";
import { getSupabaseClient, hydrateSupabaseConfig } from "@/src/lib/supabase";
import {
  clearVersionsFromDb,
  loadVersionsFromDb,
  saveVersionToDb,
} from "@/src/lib/storage";
import type {
  AppVersion,
  AttachedFile,
  ChatAttachmentMeta,
  ChatMessage,
  PipelineStage,
  UserSession,
  WalletSummary,
} from "@/src/types";
import type { TemplateItem } from "@/src/data/templates";

const LazyAdminPage = lazy(() => import("@/src/components/admin/AdminPage"));

const DEFAULT_WALLET: WalletSummary = {
  balance: 100,
  dailyGrant: 100,
  buildCost: 10,
  repairCost: 0,
  maintenance: false,
  signupsEnabled: true,
  resetTimezone: "UTC",
  ledger: [],
};

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "emdash-app"
  );
}

function formatFriendlyPipelineError(err: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your internet connection and try again.";
  }
  if (err instanceof GeminiError) {
    if (
      err.code === "HIGH_DEMAND" ||
      err.code === "RATE_LIMIT" ||
      err.code === "MISSING_KEY" ||
      err.status === 503 ||
      err.status === 429
    ) {
      return "High demand right now, please try again later";
    }
    if (err.code === "INSUFFICIENT_COINS" || err.status === 402) {
      return "You don't have enough Dash Coins right now. Daily coins reset automatically.";
    }
    if (err.code === "SUSPENDED" || err.status === 403) {
      return "Your account is currently suspended.";
    }
    if (err.code === "MALFORMED") {
      return "Build output was incomplete. Please try again.";
    }
    if (err.code === "TIMEOUT") {
      return "Generation timed out. Please try again.";
    }
    if (err.code === "NETWORK") {
      return "Network error reaching the Emdash server. Check your connection and try again.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Failed to build application.";
}

function getModeFromPath(pathname: string): "home" | "admin" | "signin" | "signup" | "web" | "sponsorship" {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/web")) return "web";
  if (pathname.startsWith("/sponsorship") || pathname.startsWith("/sponsor") || pathname.startsWith("/advertisers")) return "sponsorship";
  if (pathname.startsWith("/signup") || pathname.startsWith("/register")) return "signup";
  if (pathname.startsWith("/signin") || pathname.startsWith("/login")) return "signin";
  return "home";
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("emdash_theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<UserSession | null>(null);
  const [wallet, setWallet] = useState<WalletSummary>(DEFAULT_WALLET);

  const [mode, setMode] = useState<"home" | "workspace" | "admin" | "signin" | "signup" | "web" | "sponsorship">(() => {
    if (typeof window !== "undefined") {
      return getModeFromPath(window.location.pathname);
    }
    return "home";
  });
  const [homePrompt, setHomePrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dialog states
  const [walletOpen, setWalletOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsSection, setDocsSection] = useState<DocSection>("quickstart");

  const autoRepairedVersionsRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshSessionAndWallet = useCallback(async () => {
    await hydrateSupabaseConfig();
    try {
      const auth = await fetchAuthState();
      setUser(auth.user);
    } catch {
      // keep anonymous session
    }
    try {
      const summary = await fetchWalletSummary();
      setWallet(summary);
    } catch {
      // keep existing wallet state
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      await refreshSessionAndWallet();
      if (!active) return;
      const client = getSupabaseClient();
      if (client) {
        const { data } = client.auth.onAuthStateChange((event) => {
          if (
            event === "SIGNED_IN" ||
            event === "SIGNED_OUT" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED"
          ) {
            void refreshSessionAndWallet();
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [refreshSessionAndWallet]);

  useEffect(() => {
    const onPopState = () => {
      setMode(getModeFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToMode = useCallback(
    (nextMode: "home" | "workspace" | "admin" | "signin" | "signup" | "web" | "sponsorship") => {
      setMode(nextMode);
      if (typeof window !== "undefined") {
        const targetPath =
          nextMode === "admin"
            ? "/admin"
            : nextMode === "web"
              ? "/web"
              : nextMode === "sponsorship"
                ? "/sponsorship"
                : nextMode === "signin"
                  ? "/signin"
                  : nextMode === "signup"
                    ? "/signup"
                    : "/";
        if (window.location.pathname !== targetPath) {
          window.history.pushState({}, "", targetPath);
        }
      }
    },
    []
  );

  const handlePause = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.status === "thinking"
          ? { ...m, status: "error", content: "Generation paused by user." }
          : m
      )
    );
  }, []);

  const isPro = (user?.plan ?? "free") === "pro";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("emdash_theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  const handleToggleTheme = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      const next = !isDark;
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      };

      if (!doc.startViewTransition || prefersReduced) {
        setIsDark(next);
        return;
      }

      const rect = e?.currentTarget?.getBoundingClientRect();
      const x =
        e && e.clientX > 0
          ? e.clientX
          : rect
            ? rect.left + rect.width / 2
            : window.innerWidth - 48;
      const y =
        e && e.clientY > 0
          ? e.clientY
          : rect
            ? rect.top + rect.height / 2
            : 32;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        document.documentElement.classList.toggle("dark", next);
        flushSync(() => {
          setIsDark(next);
        });
      });

      void transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 450,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {
          // ignore animation errors in unsupported contexts
        });
    },
    [isDark]
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const storedVersions = await loadVersionsFromDb();
      if (!active) return;
      if (storedVersions.length > 0) {
        setVersions(storedVersions);
        setSelectedVersion(storedVersions[storedVersions.length - 1].version);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSignIn = useCallback(
    (session: UserSession) => {
      const merged: UserSession = { ...session, plan: isPro ? "pro" : session.plan };
      setUser(merged);
      void refreshSessionAndWallet();
    },
    [isPro, refreshSessionAndWallet]
  );

  const handleOpenAuth = useCallback(() => {
    if (user) {
      setAuthOpen(true);
    } else {
      navigateToMode("signin");
    }
  }, [navigateToMode, user]);

  const handleSignOut = useCallback(() => {
    setUser(null);
    if (mode === "admin") {
      navigateToMode("home");
    }
    void refreshSessionAndWallet();
  }, [mode, navigateToMode, refreshSessionAndWallet]);

  const executePipelineRun = useCallback(
    async ({
      promptText,
      attachments,
      existingVersions,
      runtimeErrors,
      isFreshBuild,
    }: {
      promptText: string;
      attachments: AttachedFile[];
      existingVersions: AppVersion[];
      runtimeErrors?: string[];
      isFreshBuild: boolean;
    }) => {
      if (isGenerating) return;

      navigateToMode("workspace");
      setIsGenerating(true);

      if (isFreshBuild) {
        autoRepairedVersionsRef.current.clear();
        await clearVersionsFromDb();
        setVersions([]);
        setMessages([]);
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const startedAt = Date.now();
      const userMsgId = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now() + 1}`;

      const chatAttachments: ChatAttachmentMeta[] = attachments.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        kind: file.kind,
        previewUrl: file.previewUrl,
      }));

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: runtimeErrors?.length
          ? `Fixing runtime error: ${runtimeErrors[0]}`
          : promptText,
        attachments: chatAttachments.length > 0 ? chatAttachments : undefined,
      };

      const thinkingMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        status: "thinking",
        stage: runtimeErrors?.length ? "repair" : "brief",
      };

      setMessages((prev) =>
        isFreshBuild ? [userMsg, thinkingMsg] : [...prev, userMsg, thinkingMsg]
      );

      const currentApp =
        existingVersions.find((v) => v.version === selectedVersion) ??
        existingVersions[existingVersions.length - 1] ??
        null;

      try {
        const result = await runPipelineViaServer(
          promptText,
          {
            model: FALLBACK_GEMINI_MODEL,
            brief: currentApp?.brief,
            files: currentApp?.files,
            runtimeErrors,
            attachments,
            signal: abortController.signal,
          },
          (stage: PipelineStage) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, stage } : m
              )
            );
          }
        );

        const nextVersionNumber = existingVersions.length + 1;
        const newVersion: AppVersion = {
          version: nextVersionNumber,
          title: result.brief.appName || "Untitled App",
          slug: slugifyTitle(result.brief.appName || "emdash-app"),
          prompt: promptText,
          brief: result.brief,
          plan: result.plan,
          files: result.files,
          createdAt: new Date().toISOString(),
        };

        await saveVersionToDb(newVersion);
        const persistedVersions = await loadVersionsFromDb();
        const finalVersions =
          persistedVersions.length > 0
            ? persistedVersions
            : [...existingVersions, newVersion];

        setVersions(finalVersions);
        setSelectedVersion(nextVersionNumber);

        const elapsedSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000)
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: "done",
                  elapsedSeconds,
                  content:
                    result.summary ||
                    "Built your application and saved a new version.",
                  version: nextVersionNumber,
                }
              : m
          )
        );
      } catch (err: unknown) {
        if (abortController.signal.aborted) {
          return;
        }
        const friendly = formatFriendlyPipelineError(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: "error",
                  content: friendly,
                }
              : m
          )
        );
      } finally {
        abortControllerRef.current = null;
        setIsGenerating(false);
        void refreshSessionAndWallet();
      }
    },
    [isGenerating, navigateToMode, refreshSessionAndWallet, selectedVersion]
  );

  const handleStartFromHome = useCallback(
    async (promptText: string, attachments: AttachedFile[]) => {
      setHomePrompt("");
      setSelectedVersion(1);
      await executePipelineRun({
        promptText,
        attachments,
        existingVersions: [],
        isFreshBuild: true,
      });
    },
    [executePipelineRun]
  );

  const handleFollowUp = useCallback(
    async (promptText: string, attachments: AttachedFile[]) => {
      await executePipelineRun({
        promptText,
        attachments,
        existingVersions: versions,
        isFreshBuild: false,
      });
    },
    [executePipelineRun, versions]
  );

  const handleRuntimeError = useCallback(
    async (erroredVersion: AppVersion, errors: string[]) => {
      if (isGenerating || errors.length === 0) return;
      if (autoRepairedVersionsRef.current.has(erroredVersion.version)) return;

      autoRepairedVersionsRef.current.add(erroredVersion.version);
      await executePipelineRun({
        promptText: `Fix runtime errors in v${erroredVersion.version}`,
        attachments: [],
        existingVersions: versions,
        runtimeErrors: errors,
        isFreshBuild: false,
      });
    },
    [executePipelineRun, isGenerating, versions]
  );

  const handleGoHome = () => {
    if (isGenerating) return;
    navigateToMode("home");
    setMessages([]);
  };

  const handleOpenSponsorship = () => {
    if (isGenerating) return;
    navigateToMode("sponsorship");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenTemplates = () => {
    if (mode === "home") {
      document
        .getElementById("templates-gallery")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      setTemplatesOpen(true);
    }
  };

  const handlePickTemplateFromModal = (tpl: TemplateItem) => {
    if (isGenerating) return;
    void handleStartFromHome(tpl.prompt, []);
  };

  const handleExportZip = async (version: AppVersion) => {
    const zip = new JSZip();
    for (const [filePath, content] of Object.entries(version.files)) {
      zip.file(filePath, content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${version.slug}-v${version.version}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={
        mode === "workspace" || mode === "web"
          ? "h-full w-full max-w-full overflow-x-clip flex flex-col bg-background text-foreground"
          : "min-h-full w-full max-w-full overflow-x-clip flex flex-col bg-background text-foreground"
      }
    >
      {mode !== "workspace" && mode !== "web" && (
        <Navbar
          mode={mode}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onGoHome={handleGoHome}
          onOpenTemplates={handleOpenTemplates}
          onOpenWebAgent={() => navigateToMode("web")}
          onOpenSponsor={handleOpenSponsorship}
          onOpenWallet={() => setWalletOpen(true)}
          onOpenAdmin={user?.role === "admin" ? () => navigateToMode("admin") : undefined}
          onOpenAuth={handleOpenAuth}
          user={user}
          walletBalance={wallet.balance}
        />
      )}

      {mode === "signin" || mode === "signup" ? (
        <>
          <AuthPage
            authMode={mode}
            onChangeMode={(next) => navigateToMode(next)}
            onSuccess={(session) => {
              handleSignIn(session);
              navigateToMode("home");
            }}
            onOpenDocs={(section) => {
              setDocsSection(section);
              setDocsOpen(true);
            }}
            onOpenWallet={() => setWalletOpen(true)}
          />
          <Footer
            onGoHome={handleGoHome}
            onOpenTemplates={handleOpenTemplates}
            onOpenWebAgent={() => navigateToMode("web")}
            onOpenDocs={(section = "quickstart") => {
              setDocsSection(section);
              setDocsOpen(true);
            }}
            onOpenSponsor={handleOpenSponsorship}
          />
        </>
      ) : mode === "admin" ? (
        <Suspense
          fallback={
            <main className="flex-1 grid place-items-center p-8 font-mono text-xs text-muted-foreground">
              Loading admin console…
            </main>
          }
        >
          <LazyAdminPage
            onBackHome={() => navigateToMode("home")}
            onOpenAuth={handleOpenAuth}
          />
        </Suspense>
      ) : mode === "web" ? (
        <WebAgentPage
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onGoHome={handleGoHome}
        />
      ) : mode === "sponsorship" ? (
        <>
          <SponsorshipPage
            onGoHome={handleGoHome}
            onOpenWebAgent={() => navigateToMode("web")}
          />
          <Footer
            onGoHome={handleGoHome}
            onOpenTemplates={handleOpenTemplates}
            onOpenWebAgent={() => navigateToMode("web")}
            onOpenDocs={(section = "quickstart") => {
              setDocsSection(section);
              setDocsOpen(true);
            }}
            onOpenSponsor={handleOpenSponsorship}
          />
        </>
      ) : mode === "home" ? (
        <>
          <HomeView
            prompt={homePrompt}
            onPromptChange={setHomePrompt}
            onSubmitPrompt={(p, files) => void handleStartFromHome(p, files)}
            isPro={isPro}
            onOpenSponsor={handleOpenSponsorship}
            onOpenWallet={() => setWalletOpen(true)}
            onOpenWebAgent={() => navigateToMode("web")}
          />
          <Footer
            onGoHome={handleGoHome}
            onOpenTemplates={handleOpenTemplates}
            onOpenWebAgent={() => navigateToMode("web")}
            onOpenDocs={(section = "quickstart") => {
              setDocsSection(section);
              setDocsOpen(true);
            }}
            onOpenSponsor={handleOpenSponsorship}
          />
        </>
      ) : (
        <WorkspaceView
          messages={messages}
          versions={versions}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
          isGenerating={isGenerating}
          isPro={isPro}
          isDark={isDark}
          onGoHome={handleGoHome}
          onOpenWallet={() => setWalletOpen(true)}
          onSendFollowUp={(p, files) => void handleFollowUp(p, files)}
          onRuntimeError={(ver, errs) => void handleRuntimeError(ver, errs)}
          onExport={(ver) => void handleExportZip(ver)}
          onPause={handlePause}
        />
      )}

      <WalletDialog
        open={walletOpen}
        onOpenChange={setWalletOpen}
        wallet={wallet}
        user={user}
        onOpenAuth={handleOpenAuth}
      />

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onPickTemplate={handlePickTemplateFromModal}
      />

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <SupportDocsDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        section={docsSection}
        onSectionChange={setDocsSection}
      />
    </div>
  );
}
