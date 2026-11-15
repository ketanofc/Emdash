import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/src/components/Navbar";
import { HomeView } from "@/src/components/HomeView";
import { WorkspaceView } from "@/src/components/WorkspaceView";
import { Footer, type DocSection } from "@/src/components/Footer";
import {
  AdRewardDialog,
  AuthDialog,
  PricingDialog,
  PublishDialog,
  SponsorSlotDialog,
  SupportDocsDialog,
  TemplatesDialog,
} from "@/src/components/Dialogs";
import type {
  AppVersion,
  AttachedFile,
  ChatAttachmentMeta,
  ChatMessage,
  UserSession,
} from "@/src/types";
import type { TemplateItem } from "@/src/data/templates";

const TOTAL_QUOTA_SECONDS = 18000; // 5 hours daily free limit
const BUILD_COST_SECONDS = 360; // 6 minutes per build

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadInitialUsedSeconds(): number {
  try {
    const raw = localStorage.getItem("emdash_quota");
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date?: string; used?: number };
    if (parsed.date === getTodayKey() && typeof parsed.used === "number") {
      return Math.max(0, Math.min(TOTAL_QUOTA_SECONDS, parsed.used));
    }
  } catch {
    // ignore storage errors
  }
  return 0;
}

function loadInitialUser(): UserSession | null {
  try {
    const raw = localStorage.getItem("emdash_user");
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
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

  const [usedSeconds, setUsedSeconds] = useState<number>(loadInitialUsedSeconds);
  const [user, setUser] = useState<UserSession | null>(loadInitialUser);
  const [planOverride, setPlanOverride] = useState<"free" | "pro">(() => {
    try {
      return localStorage.getItem("emdash_plan") === "pro" ? "pro" : "free";
    } catch {
      return "free";
    }
  });

  const [mode, setMode] = useState<"home" | "workspace">("home");
  const [homePrompt, setHomePrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dialog states
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [publishState, setPublishState] = useState<{
    open: boolean;
    version: AppVersion | null;
    path: string | null;
  }>({ open: false, version: null, path: null });
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsSection, setDocsSection] = useState<DocSection>("quickstart");
  const [sponsorOpen, setSponsorOpen] = useState(false);

  const isPro = (user?.plan ?? planOverride) === "pro";
  const quotaRemainingSeconds = Math.max(0, TOTAL_QUOTA_SECONDS - usedSeconds);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("emdash_theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "emdash_quota",
        JSON.stringify({ date: getTodayKey(), used: usedSeconds })
      );
    } catch {
      // ignore
    }
  }, [usedSeconds]);

  const handleSelectPlan = useCallback((plan: "free" | "pro") => {
    setPlanOverride(plan);
    try {
      localStorage.setItem("emdash_plan", plan);
    } catch {
      // ignore
    }
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, plan };
      try {
        localStorage.setItem("emdash_user", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const handleSignIn = useCallback(
    (session: UserSession) => {
      const merged: UserSession = { ...session, plan: isPro ? "pro" : session.plan };
      setUser(merged);
      try {
        localStorage.setItem("emdash_user", JSON.stringify(merged));
      } catch {
        // ignore
      }
    },
    [isPro]
  );

  const handleSignOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem("emdash_user");
    } catch {
      // ignore
    }
  }, []);

  const runBuild = useCallback(
    async (
      promptText: string,
      attachments: AttachedFile[],
      existingVersions: AppVersion[],
      existingMessages: ChatMessage[]
    ) => {
      if (isGenerating) return;
      if (!isPro && quotaRemainingSeconds <= 0) {
        setAdDialogOpen(true);
        return;
      }

      setMode("workspace");
      setIsGenerating(true);

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
        content: promptText,
        attachments: chatAttachments.length > 0 ? chatAttachments : undefined,
      };

      const thinkingMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        status: "thinking",
      };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);

      const currentApp = existingVersions[existingVersions.length - 1] ?? null;
      const historyPayload = existingMessages
        .filter((m) => m.status !== "error" && m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const attachmentPayload = attachments.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        kind: file.kind,
        content: file.content,
        base64Data: file.base64Data,
      }));

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            currentHtml: currentApp?.html,
            history: historyPayload,
            attachments: attachmentPayload,
          }),
        });

        const data = (await res.json()) as {
          title?: string;
          slug?: string;
          summary?: string;
          html?: string;
          elapsedSeconds?: number;
          error?: string;
        };

        if (!res.ok || !data.html) {
          throw new Error(data.error || "Failed to generate application.");
        }

        const nextVersionNumber = existingVersions.length + 1;
        const newVersion: AppVersion = {
          version: nextVersionNumber,
          title: data.title || "Untitled App",
          slug: data.slug || "untitled",
          html: data.html,
          prompt: promptText,
          createdAt: new Date().toISOString(),
        };

        setVersions((prev) => [...prev, newVersion]);
        setSelectedVersion(nextVersionNumber);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: "done",
                  elapsedSeconds: data.elapsedSeconds ?? 2,
                  content:
                    data.summary ||
                    "Built your application and saved it as a new version.",
                  version: nextVersionNumber,
                }
              : m
          )
        );

        if (!isPro) {
          setUsedSeconds((prev) => {
            const next = Math.min(TOTAL_QUOTA_SECONDS, prev + BUILD_COST_SECONDS);
            if (TOTAL_QUOTA_SECONDS - next <= 0) {
              window.setTimeout(() => setAdDialogOpen(true), 400);
            }
            return next;
          });
        }
      } catch (err: unknown) {
        const errMessage =
          err instanceof Error ? err.message : "Failed to build application.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: "error",
                  content: errMessage,
                }
              : m
          )
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, isPro, quotaRemainingSeconds]
  );

  const handleStartFromHome = (
    promptText: string,
    attachments: AttachedFile[]
  ) => {
    setHomePrompt("");
    setMessages([]);
    setVersions([]);
    setSelectedVersion(1);
    void runBuild(promptText, attachments, [], []);
  };

  const handleFollowUp = (
    promptText: string,
    attachments: AttachedFile[]
  ) => {
    void runBuild(promptText, attachments, versions, messages);
  };

  const handleGoHome = () => {
    if (isGenerating) return;
    setMode("home");
    setMessages([]);
    setVersions([]);
    setSelectedVersion(1);
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
    setMessages([]);
    setVersions([]);
    setSelectedVersion(1);
    void runBuild(tpl.prompt, [], [], []);
  };

  const handleExport = (version: AppVersion) => {
    const blob = new Blob([version.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${version.slug}-v${version.version}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePublish = async (version: AppVersion) => {
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: version.slug,
          title: version.title,
          html: version.html,
        }),
      });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        throw new Error(data.error || "Failed to publish site");
      }
      setPublishState({ open: true, version, path: data.path });
    } catch {
      // ignore failed publish when server rejects
    }
  };

  return (
    <div
      className={
        mode === "home"
          ? "min-h-full w-full max-w-full overflow-x-clip flex flex-col bg-background text-foreground"
          : "h-full w-full max-w-full overflow-x-clip flex flex-col bg-background text-foreground"
      }
    >
      <Navbar
        mode={mode}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onGoHome={handleGoHome}
        onOpenTemplates={handleOpenTemplates}
        onOpenPricing={() => setPricingOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        user={user}
      />

      {mode === "home" ? (
        <>
          <HomeView
            prompt={homePrompt}
            onPromptChange={setHomePrompt}
            onSubmitPrompt={handleStartFromHome}
            isPro={isPro}
            onOpenPricing={() => setPricingOpen(true)}
          />
          <Footer
            onGoHome={handleGoHome}
            onOpenTemplates={handleOpenTemplates}
            onOpenPricing={() => setPricingOpen(true)}
            onOpenDocs={(section = "quickstart") => {
              setDocsSection(section);
              setDocsOpen(true);
            }}
            onOpenSponsor={() => setSponsorOpen(true)}
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
          quotaRemainingSeconds={quotaRemainingSeconds}
          quotaTotalSeconds={TOTAL_QUOTA_SECONDS}
          onOpenQuota={() => setAdDialogOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          onSendFollowUp={handleFollowUp}
          onExport={handleExport}
          onPublish={handlePublish}
        />
      )}

      <AdRewardDialog
        open={adDialogOpen}
        onOpenChange={setAdDialogOpen}
        onRewardClaimed={(seconds) =>
          setUsedSeconds((prev) => Math.max(0, prev - seconds))
        }
      />

      <PricingDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        isPro={isPro}
        onSelectPlan={handleSelectPlan}
      />

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onPickTemplate={handlePickTemplateFromModal}
      />

      <PublishDialog
        open={publishState.open}
        onOpenChange={(open) => setPublishState((prev) => ({ ...prev, open }))}
        version={publishState.version}
        publishedPath={publishState.path}
        onExport={handleExport}
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

      <SponsorSlotDialog
        open={sponsorOpen}
        onOpenChange={setSponsorOpen}
      />
    </div>
  );
}
