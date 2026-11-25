import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FolderGit2,
  GitBranch,
  Github,
  GitPullRequest,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Smartphone,
  Square,
  Sun,
  Tablet,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { Button } from "@/src/components/ui/button";
import { GitHubRepoModal } from "@/src/components/web/GitHubRepoModal";
import { GitHubPrModal } from "@/src/components/web/GitHubPrModal";
import {
  STARTER_PROMPTS,
  WEB_MODELS,
  type WebChatSession,
} from "@/src/data/webMock";
import {
  disconnectGitHub,
  fetchGitHubRepos,
  fetchGitHubStatus,
  fetchRepoFile,
  fetchRepoTree,
  GitHubClientError,
  startGitHubOAuth,
} from "@/src/lib/githubApiClient";
import type {
  GitHubConnectionStatus,
  GitHubDiffFile,
  GitHubFileOperation,
  GitHubPullRequestResult,
  GitHubRepo,
  GitHubTreeEntry,
} from "@/src/lib/github/types";
import { getAuthHeaders } from "@/src/lib/supabase";
import { cn } from "@/src/lib/utils";

interface WebAgentPageProps {
  isDark: boolean;
  onToggleTheme: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  onGoHome: () => void;
}

export type WebAgentState = "signed-out" | "connected-empty" | "agent-running" | "done";
type RightTab = "overview" | "preview" | "files" | "terminal" | "changes";
type MobileTab = "chat" | "files" | "changes" | "preview";
type PreviewViewport = "desktop" | "tablet" | "mobile";
type AgentMode = "build" | "plan";
type ByokProvider = "gemini" | "openai" | "anthropic" | "openrouter";

const BYOK_STORAGE_KEY = "emdash:web_agent_byok";

const BYOK_PROVIDERS: ReadonlyArray<{
  id: ByokProvider;
  label: string;
  placeholder: string;
}> = [
  { id: "gemini", label: "Gemini", placeholder: "AIza..." },
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
];

interface BrowserTab {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  isEmpty: boolean;
}

interface InitialAgentReply {
  status: "running" | "done" | "error" | "missing_key";
  text: string;
  modelLabel?: string;
}

interface FollowUpMessage {
  id: string;
  prompt: string;
  mode: AgentMode;
  reply: string;
  toolSummary: string;
  status?: "running" | "done" | "error" | "missing_key";
}

const INSPECTOR_TABS: ReadonlyArray<{ id: RightTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "preview", label: "Preview" },
  { id: "files", label: "Files" },
  { id: "terminal", label: "Terminal" },
  { id: "changes", label: "Changes" },
];

const MOBILE_TABS: ReadonlyArray<{ id: MobileTab; label: string }> = [
  { id: "chat", label: "Chat" },
  { id: "files", label: "Files" },
  { id: "changes", label: "Changes" },
  { id: "preview", label: "Preview" },
];

const INITIAL_TABS: BrowserTab[] = [
  {
    id: "new-tab-1",
    title: "New tab",
    projectId: "",
    branch: "main",
    isEmpty: true,
  },
];

export function WebAgentPage({
  isDark,
  onToggleTheme,
  onGoHome,
}: WebAgentPageProps) {
  const [agentState, setAgentState] = useState<WebAgentState>("signed-out");
  const [sidebarOpen] = useState<boolean>(true);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus>({
    configured: true,
    connected: false,
    user: null,
  });
  const [githubLoading, setGithubLoading] = useState<boolean>(false);
  const [githubNotice, setGithubNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoModalOpen, setRepoModalOpen] = useState<boolean>(false);
  const [prModalOpen, setPrModalOpen] = useState<boolean>(false);

  const [repoTreeByKey, setRepoTreeByKey] = useState<Record<string, GitHubTreeEntry[]>>({});
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  const [chats, setChats] = useState<WebChatSession[]>([]);
  const [tabs, setTabs] = useState<BrowserTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TABS[0].id);

  const [activeTab, setActiveTab] = useState<RightTab>("changes");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");

  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [diffsByTab, setDiffsByTab] = useState<Record<string, GitHubDiffFile[]>>({});
  const [operationsByTab, setOperationsByTab] = useState<Record<string, GitHubFileOperation[]>>({});
  const [prMetaByTab, setPrMetaByTab] = useState<
    Record<string, { branch: string; commitMessage: string; prTitle: string; prBody: string }>
  >({});
  const [prResultByTab, setPrResultByTab] = useState<Record<string, GitHubPullRequestResult>>({});
  const [terminalLogsByTab, setTerminalLogsByTab] = useState<Record<string, string[]>>({});

  const [promptInput, setPromptInput] = useState<string>("");
  const [attachedNames, setAttachedNames] = useState<string[]>([]);
  const [agentMode, setAgentMode] = useState<AgentMode>("build");
  const [modelName, setModelName] = useState<string>(WEB_MODELS[0]);
  const [modelMenuOpen, setModelMenuOpen] = useState<boolean>(false);
  const [repoMenuOpen, setRepoMenuOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const [apiProvider, setApiProvider] = useState<ByokProvider>(() => {
    try {
      const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { provider?: string };
        if (
          parsed.provider === "openai" ||
          parsed.provider === "anthropic" ||
          parsed.provider === "openrouter"
        ) {
          return parsed.provider;
        }
      }
    } catch {
      // ignore storage failure
    }
    return "gemini";
  });
  const [savedApiKey, setSavedApiKey] = useState<string>(() => {
    try {
      const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { apiKey?: string };
        return typeof parsed.apiKey === "string" ? parsed.apiKey : "";
      }
    } catch {
      // ignore storage failure
    }
    return "";
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>(savedApiKey);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);

  const [initialPromptByTab, setInitialPromptByTab] = useState<Record<string, string>>({});
  const [initialReplyByTab, setInitialReplyByTab] = useState<Record<string, InitialAgentReply>>({});
  const [followUpsByTab, setFollowUpsByTab] = useState<Record<string, FollowUpMessage[]>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Record<RightTab, HTMLButtonElement | null>>({
    overview: null,
    preview: null,
    files: null,
    terminal: null,
    changes: null,
  });

  const currentTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const isConnected = githubStatus.connected || agentState !== "signed-out";
  const activeProject: GitHubRepo | null =
    repos.find((r) => String(r.id) === currentTab.projectId) ?? null;
  const activeTreeKey = activeProject ? `${activeProject.fullName}@${currentTab.branch}` : "";
  const activeTree = activeTreeKey ? (repoTreeByKey[activeTreeKey] ?? []).filter((e) => e.type === "blob") : [];
  const currentDiffs = diffsByTab[currentTab.id] ?? [];
  const currentOperations = operationsByTab[currentTab.id] ?? [];
  const currentPrMeta = prMetaByTab[currentTab.id];
  const currentPrResult = prResultByTab[currentTab.id];
  const currentTerminalLogs = terminalLogsByTab[currentTab.id] ?? [];
  const currentFollowUps = followUpsByTab[currentTab.id] ?? [];
  const currentInitialReply = initialReplyByTab[currentTab.id];
  const hasSavedApiKey = savedApiKey.trim().length > 0;
  const maskedApiKey =
    savedApiKey.trim().length > 8
      ? `${savedApiKey.trim().slice(0, 4)}••••${savedApiKey.trim().slice(-4)}`
      : savedApiKey.trim()
        ? "••••••••"
        : "";

  const loadReposList = async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const list = await fetchGitHubRepos();
      setRepos(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load GitHub repositories.";
      setRepoError(msg);
      if (err instanceof GitHubClientError && err.code === "GITHUB_TOKEN_EXPIRED") {
        setGithubStatus((prev) => ({ ...prev, connected: false, user: null }));
        setGithubNotice({ kind: "error", text: msg });
      }
    } finally {
      setLoadingRepos(false);
    }
  };

  const loadGitHubConnection = async () => {
    try {
      const status = await fetchGitHubStatus();
      setGithubStatus(status);
      if (status.connected) {
        setAgentState((prev) => (prev === "signed-out" ? "connected-empty" : prev));
        void loadReposList();
      }
    } catch {
      // keep disconnected state
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghParam = params.get("github");
    const reason = params.get("reason");
    if (ghParam === "connected") {
      setGithubNotice({ kind: "info", text: "GitHub connected successfully." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ghParam === "error") {
      setGithubNotice({
        kind: "error",
        text: reason ? `GitHub authorization failed: ${reason}` : "GitHub authorization failed.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
    void loadGitHubConnection();
  }, []);

  useEffect(() => {
    if (!mobileDrawerOpen && !settingsOpen && !repoModalOpen && !prModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
        setSettingsOpen(false);
        setRepoModalOpen(false);
        setPrModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileDrawerOpen, settingsOpen, repoModalOpen, prModalOpen]);

  useEffect(() => {
    if (!githubNotice) return;
    const timer = window.setTimeout(() => setGithubNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [githubNotice]);

  useEffect(() => {
    if (!apiKeyNotice) return;
    const timer = window.setTimeout(() => setApiKeyNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [apiKeyNotice]);

  const handleConnectGitHub = async () => {
    setGithubLoading(true);
    setGithubNotice(null);
    try {
      const authUrl = await startGitHubOAuth("/web");
      window.location.assign(authUrl);
    } catch (err) {
      const msg =
        err instanceof GitHubClientError && err.status === 401
          ? "Please sign in to your Emdash account first before connecting GitHub."
          : err instanceof Error
            ? err.message
            : "Could not start GitHub connection.";
      setGithubNotice({ kind: "error", text: msg });
      setGithubLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    setGithubLoading(true);
    try {
      await disconnectGitHub();
      setGithubStatus((prev) => ({ ...prev, connected: false, user: null, scope: null }));
      setRepos([]);
      setRepoTreeByKey({});
      setSelectedFilePath(null);
      setSelectedFileContent("");
      setTabs((prev) => prev.map((t) => ({ ...t, projectId: "" })));
      setAgentState("signed-out");
      setGithubNotice({ kind: "info", text: "GitHub account disconnected." });
    } catch (err) {
      setGithubNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to disconnect GitHub.",
      });
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSaveApiKey = (nextProvider = apiProvider, nextKey = apiKeyInput) => {
    const cleanKey = nextKey.trim();
    setSavedApiKey(cleanKey);
    setApiKeyInput(cleanKey);
    try {
      window.localStorage.setItem(
        BYOK_STORAGE_KEY,
        JSON.stringify({ provider: nextProvider, apiKey: cleanKey })
      );
    } catch {
      // ignore storage failure
    }
    setApiKeyNotice(cleanKey ? "API key saved locally" : "API key cleared");
  };

  const handleClearApiKey = () => {
    setSavedApiKey("");
    setApiKeyInput("");
    setShowApiKey(false);
    try {
      window.localStorage.removeItem(BYOK_STORAGE_KEY);
    } catch {
      // ignore storage failure
    }
    setApiKeyNotice("API key removed");
  };

  const handleOpenNewTab = (projectId = activeProject ? String(activeProject.id) : "") => {
    const project = repos.find((r) => String(r.id) === projectId) ?? null;
    const newId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newId,
      title: "New tab",
      projectId: project ? String(project.id) : "",
      branch: project?.defaultBranch ?? "main",
      isEmpty: true,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setMobileTab("chat");
    if (isConnected) {
      setAgentState("connected-empty");
    }
    window.setTimeout(() => composerRef.current?.focus(), 60);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = tabs.filter((t) => t.id !== tabId);
    if (remaining.length === 0) {
      const freshTab: BrowserTab = {
        id: `tab-${Date.now()}`,
        title: "New tab",
        projectId: activeProject ? String(activeProject.id) : "",
        branch: activeProject?.defaultBranch ?? "main",
        isEmpty: true,
      };
      setTabs([freshTab]);
      setActiveTabId(freshTab.id);
      if (isConnected) setAgentState("connected-empty");
      return;
    }

    setTabs(remaining);
    if (activeTabId === tabId) {
      const next = remaining[remaining.length - 1];
      setActiveTabId(next.id);
      if (isConnected) {
        setAgentState(next.isEmpty ? "connected-empty" : "done");
      }
    }
  };

  const handleSelectBrowserTab = (tab: BrowserTab) => {
    setActiveTabId(tab.id);
    if (isConnected) {
      setAgentState(tab.isEmpty ? "connected-empty" : "done");
    }
  };

  const handleOpenChatSession = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;

    const existing = tabs.find((t) => t.id === chat.id);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const nextTab: BrowserTab = {
        id: chat.id,
        title: chat.title,
        projectId: chat.projectId,
        branch: chat.branch,
        isEmpty: false,
      };
      setTabs((prev) => [...prev, nextTab]);
      setActiveTabId(nextTab.id);
    }
    setAgentState("done");
    setMobileTab("chat");
    setMobileDrawerOpen(false);
  };

  const loadTreeForRepo = async (repo: GitHubRepo, branch: string) => {
    const key = `${repo.fullName}@${branch}`;
    if (repoTreeByKey[key]) return;
    setLoadingTree(true);
    try {
      const tree = await fetchRepoTree(repo.owner, repo.name, branch);
      setRepoTreeByKey((prev) => ({ ...prev, [key]: tree }));
    } catch (err) {
      setGithubNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load repository files.",
      });
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo, branch?: string) => {
    const targetBranch = branch || repo.defaultBranch || "main";
    setTabs((prev) =>
      prev.map((t) =>
        t.id === currentTab.id
          ? { ...t, projectId: String(repo.id), branch: targetBranch }
          : t
      )
    );
    setSelectedFilePath(null);
    setSelectedFileContent("");
    if (agentState === "signed-out") {
      setAgentState("connected-empty");
    }
    setRepoMenuOpen(false);
    setMobileDrawerOpen(false);
    void loadTreeForRepo(repo, targetBranch);
  };

  const handleSelectRepoFile = async (filePath: string) => {
    if (!activeProject) return;
    setSelectedFilePath(filePath);
    setLoadingFile(true);
    try {
      const file = await fetchRepoFile(
        activeProject.owner,
        activeProject.name,
        filePath,
        currentTab.branch
      );
      setSelectedFileContent(file.content);
    } catch (err) {
      setSelectedFileContent(
        `// Failed to load ${filePath}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoadingFile(false);
    }
  };

  const runWebAgentTurn = async (params: {
    tabId: string;
    prompt: string;
    mode: AgentMode;
    history: Array<{ role: "user" | "assistant"; text: string }>;
    followUpId?: string;
  }) => {
    const key = savedApiKey.trim();
    if (!key) {
      if (params.followUpId) {
        setFollowUpsByTab((prev) => ({
          ...prev,
          [params.tabId]: (prev[params.tabId] ?? []).map((item) =>
            item.id === params.followUpId
              ? {
                  ...item,
                  status: "missing_key",
                  reply: "No API key configured. Add your own API key in Settings to run the agent.",
                  toolSummary: "API Key Required",
                }
              : item
          ),
        }));
      } else {
        setInitialReplyByTab((prev) => ({
          ...prev,
          [params.tabId]: {
            status: "missing_key",
            text: "No API key configured yet. Add your own Gemini, OpenAI, Anthropic, or OpenRouter API key in Settings to run this prompt.",
          },
        }));
        setAgentState("done");
      }
      return;
    }

    const appendLog = (line: string) => {
      setTerminalLogsByTab((prev) => ({
        ...prev,
        [params.tabId]: [...(prev[params.tabId] ?? []), line],
      }));
    };

    appendLog(
      activeProject
        ? `$ agent ${params.mode} --repo ${activeProject.fullName} --branch ${currentTab.branch}`
        : `$ agent ${params.mode} --standalone`
    );

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/web-agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          provider: apiProvider,
          apiKey: key,
          model: modelName,
          mode: params.mode,
          prompt: params.prompt,
          history: params.history,
          projectName: activeProject?.fullName,
          repoOwner: activeProject?.owner,
          repoName: activeProject?.name,
          branch: currentTab.branch,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        text?: string;
        modelId?: string;
        error?: string;
        inspectedFiles?: string[];
        operations?: GitHubFileOperation[];
        diffs?: GitHubDiffFile[];
        suggestedBranch?: string;
        suggestedCommitMessage?: string;
        suggestedPrTitle?: string;
        suggestedPrBody?: string;
      };

      if (!response.ok || !payload.text) {
        const errMsg = payload.error || `Request failed with status ${response.status}.`;
        appendLog(`! Error: ${errMsg}`);
        if (params.followUpId) {
          setFollowUpsByTab((prev) => ({
            ...prev,
            [params.tabId]: (prev[params.tabId] ?? []).map((item) =>
              item.id === params.followUpId
                ? {
                    ...item,
                    status: "error",
                    reply: errMsg,
                    toolSummary: "Request Failed",
                  }
                : item
            ),
          }));
        } else {
          setInitialReplyByTab((prev) => ({
            ...prev,
            [params.tabId]: {
              status: "error",
              text: errMsg,
            },
          }));
          setAgentState("done");
        }
        return;
      }

      if (Array.isArray(payload.inspectedFiles) && payload.inspectedFiles.length > 0) {
        appendLog(`✓ Inspected ${payload.inspectedFiles.length} repository files: ${payload.inspectedFiles.join(", ")}`);
      }
      if (Array.isArray(payload.diffs) && payload.diffs.length > 0) {
        setDiffsByTab((prev) => ({ ...prev, [params.tabId]: payload.diffs! }));
        setOperationsByTab((prev) => ({ ...prev, [params.tabId]: payload.operations ?? [] }));
        setPrMetaByTab((prev) => ({
          ...prev,
          [params.tabId]: {
            branch: payload.suggestedBranch || `emdash/update-${Date.now().toString(36).slice(-4)}`,
            commitMessage: payload.suggestedCommitMessage || "feat: apply Emdash AI changes",
            prTitle: payload.suggestedPrTitle || params.prompt.slice(0, 72),
            prBody: payload.suggestedPrBody || payload.text || "",
          },
        }));
        appendLog(`✓ Staged ${payload.diffs.length} file change(s) for review in Changes tab.`);
      } else {
        appendLog(`✓ Completed ${params.mode} pass with ${payload.modelId || modelName}.`);
      }

      if (params.followUpId) {
        setFollowUpsByTab((prev) => ({
          ...prev,
          [params.tabId]: (prev[params.tabId] ?? []).map((item) =>
            item.id === params.followUpId
              ? {
                  ...item,
                  status: "done",
                  reply: payload.text || "",
                  toolSummary: `${params.mode === "plan" ? "Plan" : "Build"} · ${payload.modelId || modelName}`,
                }
              : item
          ),
        }));
      } else {
        setInitialReplyByTab((prev) => ({
          ...prev,
          [params.tabId]: {
            status: "done",
            text: payload.text || "",
            modelLabel: payload.modelId || modelName,
          },
        }));
        setAgentState("done");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error reaching agent proxy.";
      if (params.followUpId) {
        setFollowUpsByTab((prev) => ({
          ...prev,
          [params.tabId]: (prev[params.tabId] ?? []).map((item) =>
            item.id === params.followUpId
              ? {
                  ...item,
                  status: "error",
                  reply: errMsg,
                  toolSummary: "Network Error",
                }
              : item
          ),
        }));
      } else {
        setInitialReplyByTab((prev) => ({
          ...prev,
          [params.tabId]: {
            status: "error",
            text: errMsg,
          },
        }));
        setAgentState("done");
      }
    }
  };

  const handleSendPrompt = (overrideText?: string) => {
    const text = (overrideText ?? promptInput).trim();
    if (!text && attachedNames.length === 0) return;

    const cleanPrompt = text || `Review attached context (${attachedNames.join(", ")})`;
    const shortTitle =
      cleanPrompt.length > 34 ? `${cleanPrompt.slice(0, 34).trim()}…` : cleanPrompt;
    const targetTabId = currentTab.id;

    if (agentState === "signed-out" || currentTab.isEmpty) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTabId ? { ...t, title: shortTitle, isEmpty: false } : t
        )
      );
      setInitialPromptByTab((prev) => ({
        ...prev,
        [targetTabId]: cleanPrompt,
      }));
      setInitialReplyByTab((prev) => ({
        ...prev,
        [targetTabId]: {
          status: savedApiKey.trim() ? "running" : "missing_key",
          text: savedApiKey.trim()
            ? `Running ${agentMode} pass with ${modelName}…`
            : "No API key configured yet. Add your own Gemini, OpenAI, Anthropic, or OpenRouter API key in Settings to run this prompt.",
        },
      }));
      setChats((prev) => {
        const exists = prev.some((c) => c.id === targetTabId);
        if (exists) {
          return prev.map((c) =>
            c.id === targetTabId ? { ...c, title: shortTitle, timestamp: "Just now" } : c
          );
        }
        return [
          {
            id: targetTabId,
            title: shortTitle,
            timestamp: "Just now",
            projectId: currentTab.projectId,
            branch: currentTab.branch,
          },
          ...prev,
        ];
      });
      setPromptInput("");
      setAttachedNames([]);
      setAgentState(savedApiKey.trim() ? "agent-running" : "done");
      void runWebAgentTurn({
        tabId: targetTabId,
        prompt: cleanPrompt,
        mode: agentMode,
        history: [],
      });
      return;
    }

    const followUpId = `msg-${Date.now()}`;
    const existingHistory: Array<{ role: "user" | "assistant"; text: string }> = [];
    if (initialPromptByTab[targetTabId]) {
      existingHistory.push({ role: "user", text: initialPromptByTab[targetTabId] });
    }
    if (initialReplyByTab[targetTabId]?.status === "done") {
      existingHistory.push({ role: "assistant", text: initialReplyByTab[targetTabId].text });
    }
    for (const item of followUpsByTab[targetTabId] ?? []) {
      existingHistory.push({ role: "user", text: item.prompt });
      if (item.status !== "missing_key" && item.status !== "error" && item.reply) {
        existingHistory.push({ role: "assistant", text: item.reply });
      }
    }

    setFollowUpsByTab((prev) => ({
      ...prev,
      [targetTabId]: [
        ...(prev[targetTabId] ?? []),
        {
          id: followUpId,
          prompt: cleanPrompt,
          mode: agentMode,
          reply: savedApiKey.trim()
            ? `Running ${agentMode} pass with ${modelName}…`
            : "No API key configured. Add your own API key in Settings to run the agent.",
          toolSummary: savedApiKey.trim()
            ? `${agentMode === "plan" ? "Plan" : "Build"} · Running…`
            : "API Key Required",
          status: savedApiKey.trim() ? "running" : "missing_key",
        },
      ],
    }));
    setPromptInput("");
    setAttachedNames([]);
    void runWebAgentTurn({
      tabId: targetTabId,
      prompt: cleanPrompt,
      mode: agentMode,
      history: existingHistory,
      followUpId,
    });
  };

  const handleAttachChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    if (files.length > 0) {
      setAttachedNames((prev) => [...prev, ...files.map((f) => f.name)].slice(0, 4));
    }
    e.target.value = "";
  };

  const handleCopyFile = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((cur) => (cur === path ? null : cur)), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const handleInspectorKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + delta + INSPECTOR_TABS.length) % INSPECTOR_TABS.length;
    const nextTab = INSPECTOR_TABS[nextIdx].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const openChangesInInspector = () => {
    setInspectorOpen(true);
    setActiveTab("changes");
    setMobileTab("changes");
  };

  const renderSidebarContent = (isMobileDrawer: boolean) => (
    <div className="flex flex-col h-full bg-card">
      {/* 1. Emdash Complete Logo & Branding Section */}
      <div className="h-12 px-3 border-b border-edge bg-surface flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onGoHome}
          aria-label="Back to Emdash home"
          className="flex items-center gap-2.5 font-semibold text-base tracking-tight text-foreground hover:opacity-80 transition-opacity cursor-pointer group"
        >
          <span className="flex items-center gap-1 sm:gap-1.5">
            <img
              src="/assets/emdash-logo.png"
              alt=""
              className="size-5 sm:size-6 object-cover shrink-0"
            />
            <span className="font-semibold tracking-tight">Emdash</span>
          </span>
          <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 border border-edge bg-background text-muted-foreground group-hover:text-foreground">
            Web Agent
          </span>
        </button>

        {isMobileDrawer && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close sidebar"
            className="size-7 border-edge bg-background shrink-0"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {/* 2. Directly Under Emdash Branding: New Chat Section */}
      <div className="p-2.5 border-b border-edge bg-card shrink-0">
        <button
          type="button"
          onClick={() => {
            handleOpenNewTab();
            if (isMobileDrawer) setMobileDrawerOpen(false);
          }}
          className="w-full h-8 px-2.5 border border-edge bg-background hover:border-primary font-mono uppercase text-[11px] text-foreground flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="size-3.5 text-[#c23800] dark:text-[#ff7a3d]" />
            <span>New chat</span>
          </span>
          <span className="text-[10px] text-muted-foreground">New tab</span>
        </button>
      </div>

      {/* 3. Middle Scrollable Area: Projects Section and Chats Section */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-5">
        <div>
          <div className="px-1.5 mb-1.5 font-mono uppercase text-[10px] tracking-wider text-muted-foreground flex items-center justify-between gap-1">
            <span>Repositories</span>
            <div className="flex items-center gap-1">
              {githubStatus.connected && (
                <>
                  <button
                    type="button"
                    onClick={() => void loadReposList()}
                    disabled={loadingRepos}
                    title="Refresh repositories"
                    aria-label="Refresh repositories"
                    className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RefreshCw className={cn("size-3", loadingRepos && "animate-spin")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoModalOpen(true)}
                    title="Browse & search repositories"
                    aria-label="Browse repositories"
                    className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Search className="size-3" />
                  </button>
                </>
              )}
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {repos.length}
              </span>
            </div>
          </div>
          <div className="space-y-0.5">
            {!githubStatus.connected ? (
              <div className="px-2 py-2 border border-dashed border-edge bg-background text-[11px] text-muted-foreground space-y-1.5">
                <div>Connect GitHub to browse your repositories and start coding sessions.</div>
                <button
                  type="button"
                  onClick={() => void handleConnectGitHub()}
                  disabled={githubLoading}
                  className="font-mono uppercase text-[10px] text-[#c23800] dark:text-[#ff7a3d] hover:underline cursor-pointer"
                >
                  {githubLoading ? "Connecting…" : "Connect GitHub →"}
                </button>
              </div>
            ) : loadingRepos && repos.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                <span>Loading repositories…</span>
              </div>
            ) : repos.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No repositories found
              </div>
            ) : (
              repos.slice(0, 12).map((proj) => {
                const selected = activeProject?.id === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleSelectRepo(proj)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 border transition-colors cursor-pointer",
                      selected
                        ? "border-edge bg-background text-foreground"
                        : "border-transparent hover:bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs truncate">
                        <FolderGit2
                          className={cn(
                            "size-3.5 shrink-0",
                            selected
                              ? "text-[#c23800] dark:text-[#ff7a3d]"
                              : "text-muted-foreground"
                          )}
                        />
                        <span className="truncate font-medium">{proj.name}</span>
                      </span>
                      <span className="font-mono text-[9px] uppercase text-muted-foreground shrink-0">
                        {proj.private ? "Priv" : "Pub"}
                      </span>
                    </div>
                    <div className="mt-0.5 pl-5 font-mono text-[10px] text-muted-foreground truncate">
                      {selected ? currentTab.branch : proj.defaultBranch}
                      {proj.language ? ` · ${proj.language}` : ""}
                    </div>
                  </button>
                );
              })
            )}
            {githubStatus.connected && repos.length > 0 && (
              <button
                type="button"
                onClick={() => setRepoModalOpen(true)}
                className="w-full mt-1 px-2 py-1 text-left font-mono uppercase text-[10px] text-[#c23800] dark:text-[#ff7a3d] hover:underline cursor-pointer"
              >
                Browse all {repos.length} repositories…
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="px-1.5 mb-1.5 font-mono uppercase text-[10px] tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Chats</span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {chats.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {chats.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No chats yet
              </div>
            ) : (
              chats.map((chat) => {
                const selected =
                  chat.id === currentTab.id &&
                  !currentTab.isEmpty &&
                  agentState !== "signed-out";
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => handleOpenChatSession(chat.id)}
                    className={cn(
                      "w-full text-left px-2 py-2 border transition-colors cursor-pointer",
                      selected
                        ? "border-edge bg-background text-foreground"
                        : "border-transparent hover:bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="text-xs font-medium leading-snug truncate">
                      {chat.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                      <span>{chat.timestamp}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{chat.branch}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Pinned Footer: Connect GitHub, Settings & Theme switch in a single line, Sponsored slot */}
      <div className="p-2.5 border-t border-edge bg-surface shrink-0 space-y-2">
        {githubStatus.connected && githubStatus.user && (
          <div className="px-2 py-1.5 border border-edge bg-background flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {githubStatus.user.avatarUrl ? (
                <img
                  src={githubStatus.user.avatarUrl}
                  alt={githubStatus.user.username}
                  className="size-5 border border-edge object-cover shrink-0"
                />
              ) : (
                <Github className="size-4 shrink-0" />
              )}
              <span className="font-mono text-[11px] text-foreground truncate">
                @{githubStatus.user.username}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleDisconnectGitHub()}
              disabled={githubLoading}
              title="Disconnect GitHub"
              aria-label="Disconnect GitHub"
              className="text-muted-foreground hover:text-destructive cursor-pointer shrink-0 p-0.5"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {githubStatus.connected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRepoModalOpen(true)}
              aria-label="Select GitHub repository"
              title="Select GitHub repository"
              className="flex-1 min-w-0 h-8 px-2 border-edge bg-background font-mono uppercase text-[10px] flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <FolderGit2 className="size-3.5 shrink-0 text-[#c23800] dark:text-[#ff7a3d]" />
              <span className="truncate">{activeProject ? activeProject.name : "Select Repo"}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => void handleConnectGitHub()}
              disabled={githubLoading}
              aria-label="Connect GitHub"
              title="Connect GitHub"
              className="flex-1 min-w-0 h-8 px-2 font-mono uppercase text-[10px] flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {githubLoading ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : (
                <Github className="size-3.5 shrink-0" />
              )}
              <span>Connect GitHub</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Workspace settings"
            title="Workspace settings"
            className="h-8 px-2 border border-edge bg-background hover:bg-muted font-mono uppercase text-[10px] text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Settings className="size-3.5 text-muted-foreground shrink-0" />
            <span>Settings</span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={(e) => onToggleTheme(e)}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="size-8 border-edge bg-background hover:bg-muted shrink-0"
          >
            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </Button>
        </div>

        {/* Sponsored Slot #1 */}
        <div className="border border-dashed border-edge bg-background p-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-[#c23800] dark:text-[#ff7a3d] bg-card">
              AD
            </span>
            <span className="font-mono uppercase text-[10px] text-muted-foreground">
              SPONSORED
            </span>
          </div>
          <div className="text-xs font-medium text-foreground truncate">
            CloudNest Edge Hosting
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            Branch previews &amp; static deploys. Sponsors fund free open-source runs.
          </p>
        </div>
      </div>
    </div>
  );

  const renderComposer = (compact: boolean) => (
    <div className={cn("w-full", !compact && "max-w-2xl mx-auto")}>
      {/* Sponsored Slot #2: Moved UPON the chat box */}
      <div className="mb-2 border border-dashed border-edge bg-background px-3 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-[#c23800] dark:text-[#ff7a3d] bg-card shrink-0">
            AD
          </span>
          <span className="text-xs text-muted-foreground truncate">
            CloudNest Edge Hosting · Open-source agent sessions funded by sponsors
          </span>
        </div>
        <span className="font-mono uppercase text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          SPONSORED
        </span>
      </div>

      <div className="relative border border-edge bg-card p-3 focus-within:border-primary transition-colors">
        <CornerBrackets />

        <textarea
          ref={!compact ? composerRef : undefined}
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt();
            }
          }}
          placeholder={
            activeProject
              ? `Ask ${modelName} to edit ${activeProject.name}…`
              : "Ask the agent to read, edit, or test a repository…"
          }
          aria-label="Prompt the web agent"
          rows={2}
          className="w-full resize-none border-0 bg-transparent p-1 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {attachedNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 mb-2">
            {attachedNames.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="inline-flex items-center gap-1.5 border border-edge bg-background px-2 py-0.5 font-mono text-[11px] text-foreground"
              >
                <span className="truncate max-w-[160px]">{name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachedNames((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label={`Remove ${name}`}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-edge mt-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleAttachChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              className="size-8 border-edge bg-background hover:bg-muted shrink-0"
            >
              <Paperclip className="size-3.5" />
            </Button>

            {/* OpenCode-style Agent Mode Switch (Build / Plan) */}
            <div
              role="group"
              aria-label="Agent mode"
              className="inline-flex items-center border border-edge bg-background p-0.5 shrink-0"
            >
              {(["build", "plan"] as AgentMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAgentMode(m)}
                  aria-pressed={agentMode === m}
                  className={cn(
                    "px-2 py-1 font-mono uppercase text-[10px] transition-colors cursor-pointer whitespace-nowrap",
                    agentMode === m
                      ? "bg-card text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Model selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen((open) => !open)}
                aria-expanded={modelMenuOpen}
                aria-label="Select model"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 border border-edge bg-background hover:border-primary font-mono text-[11px] text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="text-muted-foreground uppercase text-[10px]">Model</span>
                <span>{modelName}</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>

              {modelMenuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-1 w-48 border border-edge bg-card z-30 py-1"
                >
                  {WEB_MODELS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setModelName(m);
                        setModelMenuOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 font-mono text-xs flex items-center justify-between hover:bg-muted cursor-pointer",
                        modelName === m
                          ? "text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                          : "text-foreground"
                      )}
                    >
                      <span>{m}</span>
                      {modelName === m && <Check className="size-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => handleSendPrompt()}
            disabled={!promptInput.trim() && attachedNames.length === 0}
            aria-label="Send prompt"
            className="h-8 px-3.5 font-mono uppercase text-xs gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Send</span>
            <ArrowUp className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  const showNewTabCanvas = agentState === "signed-out" || agentState === "connected-empty" || currentTab.isEmpty;

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex-1 min-h-0 p-2 flex flex-col relative h-full w-full bg-background text-foreground overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col border border-edge bg-background overflow-hidden relative">
        {/* Main Shell */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Sidebar (Desktop 260px collapsible) */}
        {sidebarOpen && (
          <aside
            aria-label="Projects and chats"
            className="hidden md:flex w-[260px] shrink-0 border-r border-edge flex-col overflow-hidden"
          >
            {renderSidebarContent(false)}
          </aside>
        )}

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
                onClick={() => setMobileDrawerOpen(false)}
                aria-hidden="true"
              />
              <motion.aside
                aria-label="Mobile workspace sidebar"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-[260px] max-w-[85vw] h-full border-r border-edge bg-card flex flex-col shadow-2xl will-change-transform"
              >
                {renderSidebarContent(true)}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Right Workspace Column (Browser Session Tabs + Split Main Area) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-background">
          {/* Browser-Like Multi-Session Tab Bar */}
          <div
            role="tablist"
            aria-label="Open agent session tabs"
            className="relative shrink-0 h-12 bg-surface flex items-end overflow-x-auto px-2.5 pt-2 gap-1 before:content-[''] before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-edge"
          >
            {/* Mobile Sidebar Hamburger Toggle (matches Navbar.tsx home navigation menu icon) */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMobileDrawerOpen((open) => !open)}
              aria-label={mobileDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileDrawerOpen}
              className="size-8 mb-1 mr-1 border-edge bg-background hover:bg-muted md:hidden shrink-0 touch-manipulation"
            >
              <span aria-hidden="true" className="relative flex items-center justify-center size-4">
                <motion.span
                  className="absolute h-[1.75px] w-4 bg-current"
                  initial={false}
                  animate={
                    mobileDrawerOpen
                      ? { y: 0, rotate: 45 }
                      : { y: -3, rotate: 0 }
                  }
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.span
                  className="absolute h-[1.75px] w-4 bg-current"
                  initial={false}
                  animate={
                    mobileDrawerOpen
                      ? { y: 0, rotate: -45 }
                      : { y: 3, rotate: 0 }
                  }
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            </Button>

            {tabs.map((tab) => {
              const selected = tab.id === currentTab.id;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={() => handleSelectBrowserTab(tab)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectBrowserTab(tab);
                    }
                  }}
                  className={cn(
                    "group relative flex items-center justify-between gap-2 h-full min-w-[156px] max-w-[220px] px-3 rounded-t-md border text-xs font-mono transition-colors cursor-pointer select-none shrink-0",
                    selected
                      ? "z-10 bg-background border-edge border-b-background border-t-2 border-t-primary text-foreground"
                      : "z-0 bg-transparent border-transparent border-b-edge hover:bg-card/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <img
                      src="/assets/emdash-logo.png"
                      alt=""
                      className={cn(
                        "size-4 object-cover shrink-0",
                        selected ? "opacity-90" : "opacity-55 group-hover:opacity-80"
                      )}
                    />
                    <span className="truncate">{tab.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    aria-label={`Close ${tab.title}`}
                    className={cn(
                      "p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity cursor-pointer shrink-0",
                      selected ? "opacity-75 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => handleOpenNewTab()}
              aria-label="Open new tab"
              title="New tab"
              className="relative z-10 inline-flex items-center justify-center size-7 mb-1 ml-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer shrink-0"
            >
              <Plus className="size-3.5" />
            </button>

            {!showNewTabCanvas && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setInspectorOpen((open) => !open)}
                aria-label={inspectorOpen ? "Hide inspector panel" : "Show inspector panel"}
                className="hidden md:inline-flex size-7 mb-1 ml-auto border-edge bg-background hover:bg-muted shrink-0"
              >
                {inspectorOpen ? (
                  <PanelRightClose className="size-3.5" />
                ) : (
                  <PanelRightOpen className="size-3.5" />
                )}
              </Button>
            )}
          </div>

          {/* Workspace Body */}
          <main className="flex-1 flex flex-col md:flex-row min-w-0 min-h-0 overflow-hidden bg-background">
            {showNewTabCanvas ? (
              /* OpenCode Browser New-Tab Experience */
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col items-center">
                <div className="w-full max-w-2xl my-auto space-y-4 sm:space-y-5">
                  <div className="space-y-1.5 text-center">
                    <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 border border-edge bg-background min-h-8 font-mono uppercase text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 text-foreground max-w-full text-center">
                      <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
                        OPEN SOURCE
                      </span>
                      <span className="text-muted-foreground">
                        {isConnected && activeProject
                          ? `${activeProject.name} · ${currentTab.branch}`
                          : "& Supported by ads"}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground text-balance">
                      What should the agent work on?
                    </h1>
                  </div>

                  {/* Composer + Sponsor Slot #2 directly above */}
                  {renderComposer(false)}

                  {!isConnected ? null : (
                    /* Browser New-Tab Quick Task Bookmarks */
                    <div className="border border-edge bg-card divide-y divide-edge">
                      <div className="px-3.5 py-2 bg-surface font-mono uppercase text-[10px] text-muted-foreground">
                        Quick start{activeProject ? ` on ${activeProject.name}` : ""}
                      </div>
                      {STARTER_PROMPTS.map((starter) => (
                        <button
                          key={starter}
                          type="button"
                          onClick={() => handleSendPrompt(starter)}
                          className="w-full text-left px-3.5 py-2 text-xs sm:text-sm text-foreground hover:bg-muted/50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                        >
                          <span>{starter}</span>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Active OpenCode Split Workspace: Conversation + 5-Tab Inspector */
              <>
                <section
                  aria-label="Agent conversation"
                  className={cn(
                    "flex-1 min-w-0 flex flex-col bg-background overflow-hidden",
                    mobileTab !== "chat" ? "hidden md:flex" : "flex"
                  )}
                >
                  {/* Scrollable OpenCode Transcript */}
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                    <div className="max-w-2xl mx-auto space-y-6">
                      {/* User Prompt */}
                      <div className="border border-edge bg-card p-3.5">
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground mb-1">
                          <span className="text-foreground font-semibold uppercase">
                            You
                          </span>
                          <span className="tabular-nums">Just now</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {initialPromptByTab[currentTab.id] ?? currentTab.title}
                        </p>
                      </div>

                      {/* Agent Turn */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                          <span className="text-[#c23800] dark:text-[#ff7a3d] font-semibold uppercase">
                            Emdash Agent · {currentInitialReply?.modelLabel || modelName}
                          </span>
                          <span className="tabular-nums">
                            {currentInitialReply?.status === "running" || agentState === "agent-running"
                              ? "Running…"
                              : currentInitialReply?.status === "missing_key"
                                ? "API Key Needed"
                                : currentInitialReply?.status === "error"
                                  ? "Error"
                                  : "Done"}
                          </span>
                        </div>

                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {currentInitialReply?.text ??
                            (agentState === "agent-running"
                              ? `Running ${agentMode} pass with ${modelName}…`
                              : `Session ready for "${initialPromptByTab[currentTab.id] ?? currentTab.title}" using ${modelName}.`)}
                        </p>

                        {currentInitialReply?.status === "missing_key" && (
                          <div className="border border-edge bg-card px-3.5 py-2.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-mono text-muted-foreground">
                              Add your own API key in Settings to use the agent.
                            </span>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => setSettingsOpen(true)}
                              className="h-7 px-2.5 font-mono uppercase text-[10px] gap-1.5 shrink-0"
                            >
                              <KeyRound className="size-3" />
                              <span>Add API Key</span>
                            </Button>
                          </div>
                        )}

                        {currentInitialReply?.status === "error" && (
                          <div className="border border-destructive/40 bg-card px-3.5 py-2.5 flex items-center justify-between gap-3">
                            <span className="text-xs font-mono text-destructive truncate">
                              Check your API key or provider in Settings.
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSettingsOpen(true)}
                              className="h-7 px-2.5 border-edge font-mono uppercase text-[10px] shrink-0"
                            >
                              Settings
                            </Button>
                          </div>
                        )}

                        {/* Running indicator */}
                        {(currentInitialReply?.status === "running" || agentState === "agent-running") && (
                          <div className="border border-primary/50 bg-card px-3.5 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Loader2 className="size-3.5 text-[#c23800] dark:text-[#ff7a3d] animate-spin shrink-0" />
                              <span className="text-xs font-mono text-foreground truncate">
                                Waiting for {apiProvider} response…
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setAgentState("done")}
                              className="h-7 px-2.5 border-edge font-mono uppercase text-[10px] gap-1 shrink-0"
                            >
                              <Square className="size-2.5 fill-current" />
                              <span>Stop</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Follow-up Turns */}
                      {currentFollowUps.map((msg) => (
                        <div key={msg.id} className="space-y-3">
                          <div className="border border-edge bg-card p-3.5">
                            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground mb-1">
                              <span className="text-foreground font-semibold uppercase">
                                You
                              </span>
                              <span className="uppercase">{msg.mode}</span>
                            </div>
                            <p className="text-sm text-foreground">{msg.prompt}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                              {msg.reply}
                            </p>
                            <div className="border border-edge bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5">
                                {msg.status === "running" && (
                                  <Loader2 className="size-3 text-[#c23800] dark:text-[#ff7a3d] animate-spin" />
                                )}
                                <span>{msg.toolSummary}</span>
                              </span>
                              {msg.status === "missing_key" || msg.status === "error" ? (
                                <button
                                  type="button"
                                  onClick={() => setSettingsOpen(true)}
                                  className="text-[#c23800] dark:text-[#ff7a3d] hover:underline cursor-pointer"
                                >
                                  Open Settings →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={openChangesInInspector}
                                  className="text-[#c23800] dark:text-[#ff7a3d] hover:underline cursor-pointer"
                                >
                                  Inspect diff →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pinned Composer + Sponsor Slot #2 */}
                  <div className="shrink-0 border-t border-edge bg-surface p-3 sm:p-4">
                    {renderComposer(true)}
                  </div>
                </section>

                {/* Right Inspector Panel (5 tabs: Overview, Preview, Files, Terminal, Changes) */}
                {(inspectorOpen || mobileTab !== "chat") && (
                  <section
                    aria-label="Workspace inspector"
                    className={cn(
                      "w-full md:w-[46%] lg:w-[48%] shrink-0 md:border-l border-edge bg-card flex flex-col overflow-hidden",
                      mobileTab === "chat" ? "hidden md:flex" : "flex flex-1"
                    )}
                  >
                    <div
                      role="tablist"
                      aria-label="Inspector tabs"
                      className="shrink-0 h-9 border-b border-edge bg-surface flex items-stretch overflow-x-auto"
                    >
                      {INSPECTOR_TABS.map((tab, idx) => {
                        const selected = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            ref={(el) => {
                              tabRefs.current[tab.id] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`web-tab-${tab.id}`}
                            aria-selected={selected}
                            aria-controls={`web-panel-${tab.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={(e) => handleInspectorKeyDown(e, idx)}
                            className={cn(
                              "px-3.5 font-mono uppercase text-[11px] tracking-wide border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                              selected
                                ? "border-primary bg-background text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Panel Body (Zero sponsored slots inside tab panels) */}
                    <div
                      role="tabpanel"
                      id={`web-panel-${activeTab}`}
                      aria-labelledby={`web-tab-${activeTab}`}
                      className="flex-1 min-h-0 overflow-y-auto bg-background"
                    >
                      {activeTab === "overview" && (
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="border border-edge bg-card p-4">
                            <div className="font-mono uppercase text-[10px] text-[#c23800] dark:text-[#ff7a3d] font-semibold">
                              Session Summary
                            </div>
                            <h3 className="mt-1.5 text-sm font-semibold text-foreground">
                              {currentTab.title}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {initialPromptByTab[currentTab.id] ??
                                "No task prompt submitted for this session yet."}
                            </p>
                          </div>

                          <div className="border border-edge bg-card p-4 space-y-2.5 font-mono text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Repository</span>
                              <span className="text-foreground">
                                {activeProject?.name ?? "No repository connected"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Branch</span>
                              <span className="text-foreground">
                                {activeProject ? currentTab.branch : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Mode</span>
                              <span className="text-foreground uppercase">{agentMode}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Model</span>
                              <span className="text-foreground">{modelName}</span>
                            </div>
                          </div>

                          <div className="border border-edge bg-card divide-y divide-edge">
                            {[
                              { step: "01", label: "Parse request", status: "Done" },
                              {
                                step: "02",
                                label: "Inspect workspace",
                                status: activeProject ? "Done" : "Pending",
                              },
                              {
                                step: "03",
                                label: "Apply updates",
                                status: currentDiffs.length > 0 ? "Done" : "Pending",
                              },
                              {
                                step: "04",
                                label: "Verify output",
                                status:
                                  agentState === "agent-running"
                                    ? "Running"
                                    : currentTerminalLogs.length > 0
                                      ? "Done"
                                      : "Pending",
                              },
                            ].map((row) => (
                              <div
                                key={row.step}
                                className="px-4 py-2.5 flex items-center justify-between text-xs font-mono"
                              >
                                <span className="text-foreground">
                                  <span className="text-muted-foreground mr-2 tabular-nums">
                                    {row.step}
                                  </span>
                                  {row.label}
                                </span>
                                <span
                                  className={cn(
                                    "uppercase text-[11px]",
                                    row.status === "Done"
                                      ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                                      : row.status === "Running"
                                        ? "text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {row.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === "preview" && (
                        <div className="p-4 sm:p-5 h-full flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2 border border-edge bg-card px-3 py-2">
                            <span className="font-mono uppercase text-[10px] text-muted-foreground">
                              Viewport Width
                            </span>
                            <div
                              role="group"
                              aria-label="Preview width"
                              className="inline-flex items-center border border-edge bg-background p-0.5"
                            >
                              {(
                                [
                                  { id: "desktop", label: "Desktop", Icon: Monitor },
                                  { id: "tablet", label: "Tablet", Icon: Tablet },
                                  { id: "mobile", label: "Mobile", Icon: Smartphone },
                                ] as const
                              ).map(({ id, label, Icon }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setPreviewViewport(id)}
                                  aria-pressed={previewViewport === id}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 font-mono uppercase text-[10px] transition-colors cursor-pointer whitespace-nowrap",
                                    previewViewport === id
                                      ? "bg-primary text-primary-foreground font-semibold"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <Icon className="size-3" />
                                  <span className="hidden sm:inline">{label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 min-h-[280px] border border-edge bg-surface p-4 flex items-center justify-center overflow-auto">
                            <div
                              className={cn(
                                "h-full min-h-[240px] border border-edge bg-card flex flex-col transition-all duration-200",
                                previewViewport === "desktop"
                                  ? "w-full"
                                  : previewViewport === "tablet"
                                    ? "w-full max-w-[768px]"
                                    : "w-full max-w-[375px]"
                              )}
                            >
                              <div className="h-8 border-b border-edge bg-background px-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                                <span className="truncate">
                                  {activeProject
                                    ? `preview://${activeProject.name}/${currentTab.branch}`
                                    : "No active preview"}
                                </span>
                                <span className="uppercase shrink-0">
                                  {previewViewport}
                                </span>
                              </div>
                              <div className="flex-1 grid place-items-center p-6 text-center">
                                <div className="max-w-xs space-y-1.5">
                                  <div className="font-mono uppercase text-[10px] text-muted-foreground">
                                    No preview output yet
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Preview viewport framed at {previewViewport} width.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === "files" && (
                        <div className="flex flex-col h-full min-h-0">
                          {!activeProject ? (
                            <div className="flex-1 grid place-items-center p-6 text-center">
                              <div className="max-w-xs space-y-2">
                                <FileCode2 className="size-5 text-muted-foreground mx-auto" />
                                <div className="font-mono uppercase text-[10px] text-muted-foreground">
                                  No repository selected
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  Connect GitHub and select a repository to browse and inspect its files.
                                </p>
                              </div>
                            </div>
                          ) : loadingTree && activeTree.length === 0 ? (
                            <div className="flex-1 grid place-items-center p-6 text-center">
                              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                                <Loader2 className="size-4 animate-spin text-primary" />
                                <span>Loading repository tree…</span>
                              </div>
                            </div>
                          ) : activeTree.length === 0 ? (
                            <div className="flex-1 grid place-items-center p-6 text-center">
                              <div className="max-w-xs space-y-1.5">
                                <FileCode2 className="size-5 text-muted-foreground mx-auto" />
                                <div className="font-mono uppercase text-[10px] text-muted-foreground">
                                  No files found
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {activeProject.fullName} ({currentTab.branch}) appears empty.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="max-h-48 overflow-y-auto border-b border-edge bg-card divide-y divide-edge shrink-0">
                                {activeTree.slice(0, 120).map((file) => {
                                  const selected = file.path === selectedFilePath;
                                  return (
                                    <button
                                      key={file.path}
                                      type="button"
                                      onClick={() => void handleSelectRepoFile(file.path)}
                                      className={cn(
                                        "w-full text-left px-4 py-1.5 font-mono text-xs flex items-center justify-between transition-colors cursor-pointer",
                                        selected
                                          ? "bg-background text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                                          : "text-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <span className="inline-flex items-center gap-2 truncate">
                                        <FileCode2 className="size-3.5 shrink-0" />
                                        <span className="truncate">{file.path}</span>
                                      </span>
                                      {file.size !== undefined && (
                                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2 tabular-nums">
                                          {file.size} B
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="flex-1 min-h-0 flex flex-col bg-background">
                                <div className="shrink-0 px-4 py-2 border-b border-edge bg-surface flex items-center justify-between gap-2">
                                  <span className="font-mono text-[11px] text-foreground truncate">
                                    {selectedFilePath || "Select a file above to inspect"}
                                  </span>
                                  {selectedFilePath && (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="font-mono uppercase text-[10px] text-muted-foreground">
                                        {currentTab.branch}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleCopyFile(selectedFilePath, selectedFileContent)
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 border border-edge bg-card hover:border-primary font-mono uppercase text-[10px] text-foreground cursor-pointer"
                                      >
                                        {copiedPath === selectedFilePath ? (
                                          <>
                                            <Check className="size-3 text-emerald-700 dark:text-emerald-400" />
                                            <span>Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="size-3" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
                                  {loadingFile ? (
                                    <div className="flex items-center gap-2 text-muted-foreground p-2">
                                      <Loader2 className="size-3.5 animate-spin" />
                                      <span>Fetching file from GitHub…</span>
                                    </div>
                                  ) : !selectedFilePath ? (
                                    <div className="text-muted-foreground p-2">
                                      Click any file in the repository tree above to view its contents.
                                    </div>
                                  ) : (
                                    selectedFileContent.split("\n").map((line, lineIdx) => (
                                      <div key={lineIdx} className="flex">
                                        <span className="w-8 pr-3 text-right select-none text-muted-foreground/60 tabular-nums shrink-0">
                                          {lineIdx + 1}
                                        </span>
                                        <span className="whitespace-pre text-foreground">
                                          {line || " "}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {activeTab === "terminal" && (
                        <div className="p-4 h-full flex flex-col gap-3">
                          <div className="flex-1 border border-edge bg-card p-3 font-mono text-xs leading-relaxed overflow-y-auto space-y-1">
                            {currentTerminalLogs.length === 0 ? (
                              <div className="h-full grid place-items-center text-center p-4">
                                <div className="space-y-1">
                                  <div className="uppercase text-[10px] text-muted-foreground">
                                    No activity logs yet
                                  </div>
                                  <p className="font-sans text-xs text-muted-foreground">
                                    Repository inspections and agent execution steps will appear here.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              currentTerminalLogs.map((line, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    line.startsWith("$")
                                      ? "text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                                      : line.startsWith("✓")
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : line.startsWith("!")
                                          ? "text-destructive"
                                          : "text-foreground"
                                  )}
                                >
                                  {line}
                                </div>
                              ))
                            )}
                          </div>

                          <div className="border border-edge bg-card px-3 py-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <TerminalIcon className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs text-muted-foreground truncate">
                                {activeProject
                                  ? `${activeProject.fullName} (${currentTab.branch})`
                                  : "Standalone Web Agent"}
                              </span>
                            </div>
                            <span className="font-mono uppercase text-[10px] text-muted-foreground shrink-0">
                              Activity Log
                            </span>
                          </div>
                        </div>
                      )}

                      {activeTab === "changes" && (
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="border border-edge bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="font-mono uppercase text-[10px] text-muted-foreground">
                                Git Actions · Safe Feature Branch
                              </div>
                              <div className="text-xs text-foreground mt-0.5">
                                {currentDiffs.length === 0 ? (
                                  "No pending file changes"
                                ) : (
                                  <>
                                    {currentDiffs.length} modified file(s) staged from{" "}
                                    <code className="font-mono">{currentTab.branch}</code>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={!activeProject || currentOperations.length === 0}
                                onClick={() => setPrModalOpen(true)}
                                className="h-8 px-3 font-mono uppercase text-[10px] gap-1.5"
                              >
                                <GitPullRequest className="size-3" />
                                <span>Create Pull Request</span>
                              </Button>
                            </div>
                          </div>

                          {currentPrResult && (
                            <div className="border border-emerald-500/40 bg-emerald-500/10 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <div className="space-y-0.5">
                                <div className="text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
                                  PR #{currentPrResult.number} · {currentPrResult.state}
                                </div>
                                <div className="text-foreground font-sans">{currentPrResult.title}</div>
                              </div>
                              <a
                                href={currentPrResult.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-edge bg-background text-foreground hover:border-primary uppercase text-[10px]"
                              >
                                <span>View on GitHub</span>
                                <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}

                          {currentDiffs.length === 0 ? (
                            <div className="border border-edge bg-card p-6 text-center space-y-1">
                              <div className="font-mono uppercase text-[10px] text-muted-foreground">
                                No file changes yet
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Select a repository and run a Build instruction to review file diffs before opening a PR.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {currentDiffs.map((diff) => {
                                const isExpanded = expandedDiffs[diff.path] ?? true;
                                return (
                                  <div key={diff.path} className="border border-edge bg-card">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedDiffs((prev) => ({
                                          ...prev,
                                          [diff.path]: !isExpanded,
                                        }))
                                      }
                                      aria-expanded={isExpanded}
                                      className="w-full px-3.5 py-2 flex items-center justify-between gap-2 bg-surface border-b border-edge font-mono text-xs cursor-pointer"
                                    >
                                      <span className="truncate text-foreground font-medium">
                                        {diff.path}
                                      </span>
                                      <span className="flex items-center gap-2 shrink-0 tabular-nums">
                                        <span className="text-emerald-700 dark:text-emerald-400">
                                          +{diff.added}
                                        </span>
                                        <span className="text-red-700 dark:text-red-400">
                                          -{diff.removed}
                                        </span>
                                      </span>
                                    </button>

                                    {isExpanded && (
                                      <div className="overflow-x-auto font-mono text-[11px] leading-relaxed bg-background">
                                        {diff.hunks.map((line, i) => (
                                          <div
                                            key={i}
                                            className={cn(
                                              "flex px-3 py-0.5",
                                              line.type === "add" &&
                                                "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                                              line.type === "del" &&
                                                "bg-red-500/10 text-red-800 dark:text-red-300",
                                              line.type === "ctx" && "text-muted-foreground"
                                            )}
                                          >
                                            <span className="w-6 shrink-0 select-none text-right pr-2 opacity-60 tabular-nums">
                                              {line.oldLine ?? ""}
                                            </span>
                                            <span className="w-6 shrink-0 select-none text-right pr-2 opacity-60 tabular-nums">
                                              {line.newLine ?? ""}
                                            </span>
                                            <span className="w-4 shrink-0 select-none font-bold">
                                              {line.type === "add"
                                                ? "+"
                                                : line.type === "del"
                                                  ? "-"
                                                  : " "}
                                            </span>
                                            <span className="whitespace-pre">
                                              {line.text || " "}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar (under 800px / <md on active sessions) */}
      {!showNewTabCanvas && (
        <nav
          aria-label="Mobile workspace tabs"
          className="md:hidden shrink-0 border-t border-edge bg-card grid grid-cols-4 pb-[env(safe-area-inset-bottom,0px)]"
        >
          {MOBILE_TABS.map((tab) => {
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMobileTab(tab.id);
                  if (tab.id !== "chat") {
                    setActiveTab(tab.id);
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-11 px-2 font-mono uppercase text-[11px] flex items-center justify-center border-t-2 transition-colors cursor-pointer whitespace-nowrap",
                  active
                    ? "border-primary text-[#c23800] dark:text-[#ff7a3d] font-semibold bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
      </div>

      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Settings"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="relative w-full max-w-md border border-edge bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CornerBrackets />
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <div className="flex items-center gap-2">
                <Settings className="size-4 text-[#c23800] dark:text-[#ff7a3d]" />
                <h2 className="font-semibold text-sm uppercase tracking-wider font-mono text-foreground">
                  Workspace Settings
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                className="size-7 border-edge bg-background hover:bg-muted"
              >
                <X className="size-3.5" />
              </Button>
            </div>

            <div className="py-4 space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-muted-foreground uppercase text-[10px]">
                  Default Model
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WEB_MODELS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModelName(m)}
                      className={cn(
                        "px-2.5 py-1.5 border text-left transition-colors cursor-pointer truncate",
                        modelName === m
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-edge bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground uppercase text-[10px]">
                  Agent Mode
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["build", "plan"] as AgentMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAgentMode(mode)}
                      className={cn(
                        "px-2.5 py-1.5 border text-center uppercase transition-colors cursor-pointer",
                        agentMode === mode
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-edge bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Key Integration (BYOK) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-muted-foreground uppercase text-[10px] inline-flex items-center gap-1.5">
                    <KeyRound className="size-3 text-[#c23800] dark:text-[#ff7a3d]" />
                    <span>API Key Integration</span>
                  </label>
                  <span
                    className={cn(
                      "text-[10px] uppercase",
                      hasSavedApiKey
                        ? "text-[#c23800] dark:text-[#ff7a3d] font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {hasSavedApiKey ? `Active · ${maskedApiKey}` : "Not configured"}
                  </span>
                </div>

                {/* Provider Selector */}
                <div className="grid grid-cols-4 gap-1">
                  {BYOK_PROVIDERS.map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setApiProvider(prov.id);
                        if (savedApiKey) {
                          handleSaveApiKey(prov.id, savedApiKey);
                        }
                      }}
                      className={cn(
                        "px-2 py-1.5 border text-center text-[10px] uppercase transition-colors cursor-pointer truncate",
                        apiProvider === prov.id
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-edge bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {prov.label}
                    </button>
                  ))}
                </div>

                {/* Key Input + Actions */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveApiKey();
                        }
                      }}
                      placeholder={`Enter ${BYOK_PROVIDERS.find((p) => p.id === apiProvider)?.label ?? "provider"} key (${BYOK_PROVIDERS.find((p) => p.id === apiProvider)?.placeholder ?? "sk-..."})`}
                      aria-label="API Key"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full h-8 pl-2.5 pr-8 border border-edge bg-background text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleSaveApiKey()}
                    disabled={apiKeyInput.trim() === savedApiKey.trim()}
                    className="h-8 px-2.5 font-mono uppercase text-[10px] shrink-0"
                  >
                    Save
                  </Button>

                  {hasSavedApiKey && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleClearApiKey}
                      aria-label="Clear saved API key"
                      title="Remove API key"
                      className="size-8 border-edge bg-background hover:bg-muted text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground leading-snug">
                  <span>Stored locally in your browser to authenticate agent runs.</span>
                  {apiKeyNotice && (
                    <span className="text-[#c23800] dark:text-[#ff7a3d] shrink-0">
                      {apiKeyNotice}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground uppercase text-[10px]">
                  GitHub Connection
                </label>
                <div className="p-2.5 border border-edge bg-background flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate">
                    {githubStatus.connected && githubStatus.user
                      ? `Connected as @${githubStatus.user.username}`
                      : "Not connected"}
                  </span>
                  {githubStatus.connected ? (
                    <button
                      type="button"
                      onClick={() => void handleDisconnectGitHub()}
                      disabled={githubLoading}
                      className="text-destructive hover:underline uppercase text-[10px] cursor-pointer shrink-0"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleConnectGitHub()}
                      disabled={githubLoading}
                      className="text-[#c23800] dark:text-[#ff7a3d] hover:underline uppercase text-[10px] cursor-pointer shrink-0"
                    >
                      Connect GitHub
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-edge flex justify-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  if (apiKeyInput.trim() !== savedApiKey.trim()) {
                    handleSaveApiKey();
                  }
                  setSettingsOpen(false);
                }}
                className="h-7 px-3 font-mono uppercase text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <GitHubRepoModal
        open={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        repos={repos}
        loadingRepos={loadingRepos}
        repoError={repoError}
        onRefreshRepos={() => void loadReposList()}
        selectedRepo={activeProject}
        selectedBranch={currentTab.branch}
        onConfirmSelection={(repo, branch) => handleSelectRepo(repo, branch)}
      />

      {activeProject && (
        <GitHubPrModal
          open={prModalOpen}
          onClose={() => setPrModalOpen(false)}
          repo={activeProject}
          baseBranch={currentTab.branch}
          initialBranch={
            currentPrMeta?.branch || `emdash/update-${Date.now().toString(36).slice(-4)}`
          }
          initialCommitMessage={currentPrMeta?.commitMessage || "feat: apply Emdash AI changes"}
          initialPrTitle={currentPrMeta?.prTitle || "Changes by Emdash AI Agent"}
          initialPrBody={currentPrMeta?.prBody || "Generated via Emdash Web Coding Agent."}
          changes={currentOperations}
          onPrCreated={(pr) => {
            setPrResultByTab((prev) => ({ ...prev, [currentTab.id]: pr }));
            setTerminalLogsByTab((prev) => ({
              ...prev,
              [currentTab.id]: [
                ...(prev[currentTab.id] ?? []),
                `✓ Pushed branch ${pr.branch} and opened PR #${pr.number}: ${pr.url}`,
              ],
            }));
          }}
        />
      )}

      {githubNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 border border-edge bg-card px-3.5 py-2.5 text-xs shadow-lg max-w-sm"
        >
          <span
            className={cn(
              "font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 bg-background shrink-0",
              githubNotice.kind === "error"
                ? "text-destructive"
                : "text-[#c23800] dark:text-[#ff7a3d]"
            )}
          >
            {githubNotice.kind === "error" ? "GitHub Error" : "GitHub"}
          </span>
          <span className="text-foreground">{githubNotice.text}</span>
          <button
            type="button"
            onClick={() => setGithubNotice(null)}
            aria-label="Dismiss notice"
            className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
