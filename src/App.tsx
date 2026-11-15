import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Navbar } from "@/src/components/Navbar";
import { HomeView } from "@/src/components/HomeView";
import { WorkspaceView } from "@/src/components/WorkspaceView";
import { Footer, type DocSection } from "@/src/components/Footer";
import {
  AuthDialog,
  ModelsDialog,
  PricingDialog,
  SponsorSlotDialog,
  SupportDocsDialog,
  TemplatesDialog,
} from "@/src/components/Dialogs";
import {
  FALLBACK_GEMINI_MODEL,
  GeminiError,
  runPipelineViaServer,
} from "@/src/lib/gemini";
import {
  clearVersionsFromDb,
  loadSelectedModel,
  loadVersionsFromDb,
  saveSelectedModel,
  saveVersionToDb,
} from "@/src/lib/storage";
import type {
  AppVersion,
  AttachedFile,
  ChatAttachmentMeta,
  ChatMessage,
  PipelineStage,
  UserSession,
} from "@/src/types";
import type { TemplateItem } from "@/src/data/templates";

function loadInitialUser(): UserSession | null {
  try {
    const raw = localStorage.getItem("emdash_user");
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

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
    if (err.code === "MISSING_KEY" || err.code === "INVALID_KEY") {
      return "The server's Gemini API key is missing or invalid. Check Settings > Secrets.";
    }
    if (err.code === "RATE_LIMIT") {
      return "Gemini API rate limit reached (429). Please wait a moment and try again.";
    }
    if (err.code === "MALFORMED") {
      return "The model returned malformed output after retrying. Try simplifying your prompt or switching models.";
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

  const [user, setUser] = useState<UserSession | null>(loadInitialUser);
  const [planOverride, setPlanOverride] = useState<"free" | "pro">(() => {
    try {
      return localStorage.getItem("emdash_plan") === "pro" ? "pro" : "free";
    } catch {
      return "free";
    }
  });

  const [selectedModel, setSelectedModel] = useState<string>(() =>
    loadSelectedModel(FALLBACK_GEMINI_MODEL)
  );

  const [mode, setMode] = useState<"home" | "workspace">("home");
  const [homePrompt, setHomePrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);

  // Dialog states
  const [modelsOpen, setModelsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsSection, setDocsSection] = useState<DocSection>("quickstart");
  const [sponsorOpen, setSponsorOpen] = useState(false);

  const autoRepairedVersionsRef = useRef<Set<number>>(new Set());

  const isPro = (user?.plan ?? planOverride) === "pro";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("emdash_theme", isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

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

  const executePipelineRun = useCallback(
    async ({
      modelToUse,
      promptText,
      attachments,
      existingVersions,
      runtimeErrors,
      isFreshBuild,
    }: {
      modelToUse: string;
      promptText: string;
      attachments: AttachedFile[];
      existingVersions: AppVersion[];
      runtimeErrors?: string[];
      isFreshBuild: boolean;
    }) => {
      if (isGenerating) return;

      setMode("workspace");
      setIsGenerating(true);

      if (isFreshBuild) {
        autoRepairedVersionsRef.current.clear();
        await clearVersionsFromDb();
        setVersions([]);
        setMessages([]);
      }

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

      const currentApp = existingVersions[existingVersions.length - 1] ?? null;

      try {
        const result = await runPipelineViaServer(
          promptText,
          {
            model: modelToUse,
            brief: currentApp?.brief,
            files: currentApp?.files,
            runtimeErrors,
            attachments,
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
        setIsGenerating(false);
      }
    },
    [isGenerating]
  );

  const handleStartFromHome = useCallback(
    async (promptText: string, attachments: AttachedFile[]) => {
      setHomePrompt("");
      setSelectedVersion(1);
      await executePipelineRun({
        modelToUse: selectedModel,
        promptText,
        attachments,
        existingVersions: [],
        isFreshBuild: true,
      });
    },
    [executePipelineRun, selectedModel]
  );

  const handleFollowUp = useCallback(
    async (promptText: string, attachments: AttachedFile[]) => {
      await executePipelineRun({
        modelToUse: selectedModel,
        promptText,
        attachments,
        existingVersions: versions,
        isFreshBuild: false,
      });
    },
    [executePipelineRun, selectedModel, versions]
  );

  const handleRuntimeError = useCallback(
    async (erroredVersion: AppVersion, errors: string[]) => {
      if (isGenerating || errors.length === 0) return;
      if (autoRepairedVersionsRef.current.has(erroredVersion.version)) return;

      autoRepairedVersionsRef.current.add(erroredVersion.version);
      await executePipelineRun({
        modelToUse: selectedModel,
        promptText: `Fix runtime errors in v${erroredVersion.version}`,
        attachments: [],
        existingVersions: versions,
        runtimeErrors: errors,
        isFreshBuild: false,
      });
    },
    [executePipelineRun, isGenerating, selectedModel, versions]
  );

  const handleSaveModel = useCallback((newModel: string) => {
    saveSelectedModel(newModel);
    setSelectedModel(newModel);
  }, []);

  const handleGoHome = () => {
    if (isGenerating) return;
    setMode("home");
    setMessages([]);
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
        onOpenModels={() => setModelsOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        user={user}
      />

      {mode === "home" ? (
        <>
          <HomeView
            prompt={homePrompt}
            onPromptChange={setHomePrompt}
            onSubmitPrompt={(p, files) => void handleStartFromHome(p, files)}
            isPro={isPro}
            onOpenPricing={() => setPricingOpen(true)}
            onOpenModels={() => setModelsOpen(true)}
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
          isDark={isDark}
          selectedModel={selectedModel}
          onOpenModels={() => setModelsOpen(true)}
          onOpenPricing={() => setPricingOpen(true)}
          onSendFollowUp={(p, files) => void handleFollowUp(p, files)}
          onRuntimeError={(ver, errs) => void handleRuntimeError(ver, errs)}
          onExport={(ver) => void handleExportZip(ver)}
        />
      )}

      <ModelsDialog
        open={modelsOpen}
        onOpenChange={setModelsOpen}
        initialModel={selectedModel}
        onSaveModel={handleSaveModel}
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
