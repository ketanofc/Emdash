import { useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useErrorMessage,
  useSandpack,
} from "@codesandbox/sandpack-react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Download,
  File as FileIcon,
  FileCode2,
  FolderOpen,
  Loader2,
  Monitor,
  Paperclip,
  RotateCw,
  Settings,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Skeleton } from "@/src/components/ui/skeleton";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  formatFileSize,
  processUploadedFile,
} from "@/src/lib/fileAttachment";
import { formatModelDisplayName } from "@/src/lib/gemini";
import { buildStaticPreviewHtml } from "@/src/lib/pipeline";
import type {
  AppVersion,
  AttachedFile,
  ChatMessage,
  DeviceViewport,
  GeneratedFiles,
  PipelineStage,
  WorkspaceTab,
} from "@/src/types";
import { cn } from "@/src/lib/utils";

interface WorkspaceViewProps {
  messages: ChatMessage[];
  versions: AppVersion[];
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
  isGenerating: boolean;
  isPro: boolean;
  isDark: boolean;
  selectedModel: string;
  onOpenModels: () => void;
  onOpenPricing: () => void;
  onSendFollowUp: (prompt: string, attachments: AttachedFile[]) => void;
  onRuntimeError: (version: AppVersion, errors: string[]) => void;
  onExport: (version: AppVersion) => void;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  brief: "Understanding your request…",
  plan: "Planning…",
  build: "Building…",
  check: "Checking…",
  repair: "Fixing…",
};

function sortFilePaths(paths: string[]): string[] {
  const priority = [
    "index.html",
    "style.css",
    "app.js",
    "src/App.tsx",
    "src/main.tsx",
    "src/index.css",
    "src/types.ts",
  ];
  return [...paths].sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function buildSandpackFiles(
  files: GeneratedFiles
): Record<string, { code: string }> {
  const mapped: Record<string, { code: string }> = {};
  for (const [rawPath, code] of Object.entries(files)) {
    const clean = rawPath.replace(/^\/+/, "");
    mapped[`/${clean}`] = { code };
  }

  let pkgJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    main?: string;
  } = {};
  if (files["package.json"]) {
    try {
      pkgJson = JSON.parse(files["package.json"]) as typeof pkgJson;
    } catch {
      pkgJson = {};
    }
  }

  mapped["/package.json"] = {
    code: JSON.stringify(
      {
        ...pkgJson,
        main: "/index.tsx",
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "lucide-react": "^0.475.0",
          ...(pkgJson.dependencies ?? {}),
        },
      },
      null,
      2
    ),
  };

  if (!mapped["/index.tsx"]) {
    const hasMain = Boolean(mapped["/src/main.tsx"]);
    const hasCss = Boolean(mapped["/src/index.css"]);
    mapped["/index.tsx"] = {
      code: hasMain
        ? `${hasCss ? 'import "./src/index.css";\n' : ""}import "./src/main";\n`
        : `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\n${hasCss ? 'import "./src/index.css";\n' : ""}import App from "./src/App";\nconst rootEl = document.getElementById("root");\nif (rootEl) { createRoot(rootEl).render(<StrictMode><App /></StrictMode>); }\n`,
    };
  }

  const rawIndexHtml =
    files["index.html"] ||
    `<!doctype html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>App</title></head>\n<body><div id="root"></div></body>\n</html>`;

  const strippedIndexHtml = rawIndexHtml.replace(
    /<script\b[^>]*type=["']module["'][^>]*>\s*<\/script>/gi,
    ""
  );
  const tailwindTokenConfig = `<script>window.tailwind=window.tailwind||{};window.tailwind.config={theme:{extend:{colors:{primary:"var(--primary)",secondary:"var(--secondary)",accent:"var(--accent)",bg:"var(--bg)",background:"var(--bg)",surface:"var(--surface)",text:"var(--text)",muted:"var(--muted)"},fontFamily:{heading:"var(--font-heading)",body:"var(--font-body)"}}}};</script>`;

  mapped["/public/index.html"] = {
    code: /<\/head>/i.test(strippedIndexHtml)
      ? strippedIndexHtml.replace(/<\/head>/i, `${tailwindTokenConfig}\n</head>`)
      : `${tailwindTokenConfig}\n${strippedIndexHtml}`,
  };

  return mapped;
}

function SandpackErrorBridge({
  version,
  onError,
}: {
  version: AppVersion;
  onError: (version: AppVersion, errors: string[]) => void;
}) {
  const errorMessage = useErrorMessage();
  const { sandpack } = useSandpack();
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    const msg = errorMessage || sandpack.error?.message;
    if (msg && reportedRef.current !== `${version.version}:${msg}`) {
      reportedRef.current = `${version.version}:${msg}`;
      onError(version, [msg]);
    }
  }, [errorMessage, sandpack.error, version, onError]);

  return null;
}

export function WorkspaceView({
  messages,
  versions,
  selectedVersion,
  onSelectVersion,
  isGenerating,
  isPro,
  isDark,
  selectedModel,
  onOpenModels,
  onOpenPricing,
  onSendFollowUp,
  onRuntimeError,
  onExport,
}: WorkspaceViewProps) {
  const [followUp, setFollowUp] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("preview");
  const [device, setDevice] = useState<DeviceViewport>("desktop");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [publishToastOpen, setPublishToastOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const currentApp =
    versions.find((v) => v.version === selectedVersion) ??
    versions[versions.length - 1] ??
    null;

  const fileList = useMemo(
    () => (currentApp ? sortFilePaths(Object.keys(currentApp.files)) : []),
    [currentApp]
  );

  useEffect(() => {
    if (fileList.length === 0) {
      setSelectedFilePath("");
    } else if (!selectedFilePath || !fileList.includes(selectedFilePath)) {
      setSelectedFilePath(fileList[0]);
    }
  }, [fileList, selectedFilePath]);

  useEffect(() => {
    if (!currentApp || currentApp.brief.mode !== "static") return;
    const pendingErrors: string[] = [];
    let flushTimer: number | null = null;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        version?: number;
        message?: string;
      } | null;
      if (
        !data ||
        data.type !== "emdash-runtime-error" ||
        data.version !== currentApp.version ||
        !data.message
      ) {
        return;
      }
      if (!pendingErrors.includes(data.message)) {
        pendingErrors.push(data.message);
      }
      if (flushTimer === null) {
        flushTimer = window.setTimeout(() => {
          flushTimer = null;
          if (pendingErrors.length > 0) {
            onRuntimeError(currentApp, [...pendingErrors]);
            pendingErrors.length = 0;
          }
        }, 350);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer);
      }
    };
  }, [currentApp, onRuntimeError]);

  useEffect(() => {
    if (!publishToastOpen) return;
    const timer = window.setTimeout(() => setPublishToastOpen(false), 3800);
    return () => window.clearTimeout(timer);
  }, [publishToastOpen]);

  const staticSrcDoc = useMemo(() => {
    if (!currentApp || currentApp.brief.mode !== "static") return "";
    return buildStaticPreviewHtml(currentApp.files, currentApp.version);
  }, [currentApp]);

  const sandpackFiles = useMemo(() => {
    if (!currentApp || currentApp.brief.mode !== "react-ts") return null;
    return buildSandpackFiles(currentApp.files);
  }, [currentApp]);

  const addFiles = async (fileListInput: FileList | File[]) => {
    const incoming = Array.from(fileListInput);
    if (incoming.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setFileError(`Maximum ${MAX_ATTACHMENTS} reference files per prompt.`);
      return;
    }

    const batch = incoming.slice(0, remainingSlots);
    let nextError: string | null =
      incoming.length > remainingSlots
        ? `Added first ${remainingSlots} file(s); limit is ${MAX_ATTACHMENTS}.`
        : null;

    const processed: AttachedFile[] = [];
    for (const file of batch) {
      if (file.size > MAX_FILE_BYTES) {
        nextError = `${file.name} exceeds the 4 MB limit.`;
        continue;
      }
      try {
        processed.push(await processUploadedFile(file));
      } catch {
        nextError = `Could not read ${file.name}.`;
      }
    }

    setFileError(nextError);
    if (processed.length > 0) {
      setAttachments((prev) => [...prev, ...processed]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const handleSend = () => {
    const trimmed = followUp.trim();
    if ((!trimmed && attachments.length === 0) || isGenerating) return;
    const filesToSend = attachments;
    setFollowUp("");
    setAttachments([]);
    setFileError(null);
    onSendFollowUp(
      trimmed || "Update the app using the attached reference.",
      filesToSend
    );
  };

  const handleCopyCode = async () => {
    if (!currentApp || !selectedFilePath) return;
    const content = currentApp.files[selectedFilePath];
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const frameWidthClass =
    device === "mobile"
      ? "w-[390px] border-x border-edge"
      : device === "tablet"
        ? "w-[768px] border-x border-edge"
        : "w-full";

  return (
    <div className="flex-1 min-h-0 px-2 pb-2 flex flex-col relative">
      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(260px,44%)_1fr] sm:grid-cols-[minmax(250px,310px)_1fr] md:grid-cols-[minmax(290px,350px)_1fr] lg:grid-cols-[minmax(320px,390px)_1fr] sm:grid-rows-[minmax(0,1fr)] border-x border-b border-edge bg-background">
        {/* Chat Pane */}
        <aside className="flex flex-col min-w-0 min-h-0 border-b sm:border-b-0 sm:border-r border-edge bg-background">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-edge bg-card shrink-0">
            <span className="font-mono uppercase text-[11px] font-medium text-muted-foreground tracking-wider">
              Build Chat
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={onOpenModels}
                title="Select Gemini model"
                className="inline-flex items-center gap-1.5 h-7 px-2 border border-edge bg-background font-mono text-[11px] text-foreground hover:border-primary transition-colors truncate max-w-[165px] cursor-pointer"
              >
                <Settings className="size-3 text-primary shrink-0" />
                <span className="truncate">{formatModelDisplayName(selectedModel)}</span>
              </button>
              {!isPro && (
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className="hidden sm:inline-flex items-center h-7 px-2 border border-edge bg-background font-mono uppercase text-[10px] text-muted-foreground hover:text-foreground hover:border-neutral transition-colors shrink-0 cursor-pointer"
                >
                  Free
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3.5">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div
                  key={msg.id}
                  className="self-end max-w-[88%] border border-edge bg-card px-3.5 py-2 text-[13.5px] leading-relaxed text-foreground"
                >
                  <div>{msg.content}</div>
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {msg.attachments.map((att, idx) => (
                        <div
                          key={`${att.name}-${idx}`}
                          className="flex items-center gap-1.5 border border-edge bg-background px-1.5 py-1 text-[11px] max-w-full"
                        >
                          {att.previewUrl ? (
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="size-8 object-cover border border-edge shrink-0 bg-muted"
                            />
                          ) : (
                            <FileIcon className="size-3.5 text-primary shrink-0" />
                          )}
                          <span className="font-mono truncate max-w-[160px] text-foreground">
                            {att.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    msg.attachmentName && (
                      <div className="mt-1 font-mono uppercase text-[11px] text-primary">
                        Attached: {msg.attachmentName}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1 font-mono uppercase text-[11px] text-muted-foreground">
                    <img
                      src="/assets/emdash-logo.png"
                      alt="Emdash"
                      className="size-4 object-cover shrink-0"
                    />
                    {msg.status === "thinking" ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>{STAGE_LABELS[msg.stage ?? "brief"]}</span>
                      </span>
                    ) : msg.status === "error" ? (
                      <span className="inline-flex items-center gap-1.5 text-destructive font-medium">
                        <AlertCircle className="size-3.5" />
                        <span>Generation failed</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-primary" />
                        <span className="tabular-nums">
                          Built in {msg.elapsedSeconds ?? 2}s
                        </span>
                      </span>
                    )}
                  </div>

                  {msg.status === "thinking" && !isPro && (
                    <div className="flex items-center gap-2.5 border border-dashed border-edge px-3 py-2 bg-card text-xs">
                      <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-background shrink-0">
                        Ad
                      </span>
                      <div className="min-w-0">
                        <div className="text-foreground truncate">
                          CloudNest Edge Hosting — 3 months free
                        </div>
                        <div className="font-mono uppercase text-[10px] text-muted-foreground">
                          Sponsored while you wait
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.content && (
                    <p
                      className={cn(
                        "text-[13.5px] leading-relaxed",
                        msg.status === "error"
                          ? "text-destructive"
                          : "text-foreground"
                      )}
                    >
                      {msg.content}
                    </p>
                  )}

                  {msg.version && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectVersion(msg.version!);
                        setActiveTab("code");
                      }}
                      className="flex items-center gap-2 border border-edge px-3 py-2 text-xs bg-card hover:border-primary transition-colors text-left cursor-pointer"
                    >
                      <FileCode2 className="size-4 text-primary shrink-0" />
                      <span className="font-mono font-medium text-foreground">
                        View project files
                      </span>
                      <span className="ml-auto font-mono text-muted-foreground tabular-nums">
                        v{msg.version}
                      </span>
                    </button>
                  )}
                </div>
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-edge flex flex-col gap-2 bg-background">
            {!isPro && (
              <div className="flex items-center gap-2.5 border border-dashed border-edge px-2.5 py-1.5 bg-card text-xs">
                <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-background shrink-0">
                  Ad
                </span>
                <span className="text-foreground font-medium truncate">
                  CloudNest hosting
                </span>
                <span className="font-mono uppercase text-[10px] text-muted-foreground truncate ml-auto">
                  3 mo free
                </span>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) {
                  void addFiles(e.dataTransfer.files);
                }
              }}
              className={cn(
                "relative flex flex-col gap-1.5 border bg-card p-2 focus-within:border-primary transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-edge"
              )}
            >
              <CornerBrackets />

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-1.5 border border-edge bg-background px-1.5 py-1 text-xs max-w-[200px]"
                    >
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="size-5 object-cover border border-edge shrink-0 bg-muted"
                        />
                      ) : (
                        <FileIcon className="size-3 text-primary shrink-0" />
                      )}
                      <span className="truncate font-mono text-[10px] text-foreground">
                        {file.name}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((item) => item.id !== file.id)
                          )
                        }
                        aria-label={`Remove ${file.name}`}
                        className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fileError && (
                <div className="flex items-center justify-between gap-2 px-2 py-1 border border-destructive/40 bg-destructive/5 text-[10px] font-mono text-destructive">
                  <span>{fileError}</span>
                  <button
                    type="button"
                    onClick={() => setFileError(null)}
                    aria-label="Dismiss error"
                    className="hover:opacity-75 cursor-pointer shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  aria-label="Attach any file or image"
                  className="size-8 shrink-0 border border-edge bg-background text-muted-foreground hover:text-foreground hover:border-primary grid place-items-center transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Paperclip className="size-3.5" />
                </button>
                <Textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask for a change or drop an image/file…"
                  aria-label="Ask for a change"
                  rows={1}
                  className="min-h-[36px] max-h-[120px] resize-none border-0 px-2 py-1.5 text-[13.5px]"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!followUp.trim() && attachments.length === 0) || isGenerating}
                  aria-label="Send"
                  className="size-8 shrink-0 bg-primary text-primary-foreground grid place-items-center transition-all hover:bg-primary/85 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Preview / Code Pane */}
        <section className="flex flex-col min-w-0 min-h-0 bg-background">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-edge bg-card flex-wrap">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as WorkspaceTab)}
            >
              <TabsList className="border-edge bg-background">
                <TabsTrigger
                  value="preview"
                  className="font-mono uppercase text-xs data-[state=active]:text-primary"
                >
                  Preview
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="font-mono uppercase text-xs data-[state=active]:text-primary"
                >
                  Code
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div
              className="hidden md:inline-flex h-8 items-center border border-edge bg-background p-0.5"
              role="group"
              aria-label="Device viewport"
            >
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                aria-label="Desktop"
                aria-pressed={device === "desktop"}
                className={cn(
                  "size-7 grid place-items-center transition-colors cursor-pointer",
                  device === "desktop"
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Monitor className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("tablet")}
                aria-label="Tablet"
                aria-pressed={device === "tablet"}
                className={cn(
                  "size-7 grid place-items-center transition-colors cursor-pointer",
                  device === "tablet"
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Tablet className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                aria-label="Mobile"
                aria-pressed={device === "mobile"}
                className={cn(
                  "size-7 grid place-items-center transition-colors cursor-pointer",
                  device === "mobile"
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Smartphone className="size-3.5" />
              </button>
            </div>

            {versions.length > 0 && (
              <Select
                value={String(currentApp?.version ?? 1)}
                onValueChange={(v) => onSelectVersion(Number(v))}
              >
                <SelectTrigger
                  aria-label="Version"
                  className="w-[120px] border-edge bg-background font-mono text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)}>
                      Version {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="hidden lg:flex flex-1 min-w-[120px] h-8 items-center border border-edge bg-background px-2.5 text-xs font-mono text-muted-foreground truncate">
              {currentApp
                ? `${currentApp.slug}.emdash.site · ${currentApp.brief.mode}`
                : "untitled.emdash.site"}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setReloadNonce((n) => n + 1)}
                disabled={!currentApp}
                aria-label="Reload preview"
                className="border-edge bg-background hover:bg-muted"
              >
                <RotateCw className="size-3.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => currentApp && onExport(currentApp)}
                disabled={!currentApp}
                className="border-edge bg-background hover:bg-muted font-mono uppercase text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Export .zip</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPublishToastOpen(true)}
                disabled={!currentApp}
                title="Publish coming soon"
                className="border border-edge font-mono uppercase text-xs"
              >
                Publish · Soon
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-muted flex justify-center overflow-auto relative">
            {!currentApp && isGenerating ? (
              <div className="w-full h-full p-9 flex flex-col items-center gap-3 bg-card">
                <Skeleton className="w-[40%] h-3.5" />
                <Skeleton className="w-[70%] h-8" />
                <Skeleton className="w-[55%] h-3.5" />
                <Skeleton className="w-28 h-9 mt-2" />
                <div className="flex gap-3 w-full max-w-[520px] mt-6">
                  <Skeleton className="flex-1 h-24" />
                  <Skeleton className="flex-1 h-24" />
                  <Skeleton className="flex-1 h-24" />
                </div>
              </div>
            ) : !currentApp ? (
              <div className="w-full h-full grid place-items-center p-6 text-center text-muted-foreground">
                <div className="grid gap-1.5 place-items-center">
                  <img
                    src="/assets/emdash-logo.png"
                    alt="Emdash"
                    className="size-6 object-cover mb-1.5"
                  />
                  <span className="font-medium text-foreground text-sm">
                    Nothing here yet
                  </span>
                  <span className="text-xs">
                    Describe an app and it will appear here.
                  </span>
                </div>
              </div>
            ) : activeTab === "preview" ? (
              <div
                className={cn(
                  "h-full bg-white transition-[width] duration-200 max-w-full relative",
                  frameWidthClass
                )}
              >
                {isGenerating && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary animate-pulse z-10" />
                )}
                {currentApp.brief.mode === "react-ts" && sandpackFiles ? (
                  <div className="w-full h-full [&_.sp-wrapper]:h-full [&_.sp-layout]:h-full [&_.sp-layout]:border-0 [&_.sp-layout]:rounded-none [&_.sp-preview-container]:h-full [&_.sp-preview-iframe]:h-full">
                    <SandpackProvider
                      key={`${currentApp.version}-${reloadNonce}`}
                      template="react-ts"
                      theme={isDark ? "dark" : "light"}
                      files={sandpackFiles}
                      options={{
                        externalResources: ["https://cdn.tailwindcss.com"],
                      }}
                    >
                      <SandpackErrorBridge
                        version={currentApp}
                        onError={onRuntimeError}
                      />
                      <SandpackLayout>
                        <SandpackPreview
                          showOpenInCodeSandbox={false}
                          showRefreshButton={false}
                        />
                      </SandpackLayout>
                    </SandpackProvider>
                  </div>
                ) : (
                  <iframe
                    key={`${currentApp.version}-${reloadNonce}`}
                    title={currentApp.title}
                    srcDoc={staticSrcDoc}
                    sandbox="allow-scripts"
                    className="w-full h-full border-0 bg-white block"
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row bg-card overflow-hidden">
                {/* File Tree Sidebar */}
                <div className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-edge bg-background overflow-auto max-h-40 sm:max-h-none">
                  <div className="px-3 py-2 border-b border-edge flex items-center gap-1.5 font-mono uppercase text-[10px] text-muted-foreground">
                    <FolderOpen className="size-3.5 text-primary shrink-0" />
                    <span>Project files ({fileList.length})</span>
                  </div>
                  <div className="p-1 flex sm:flex-col gap-0.5 overflow-x-auto sm:overflow-x-visible">
                    {fileList.map((filePath) => (
                      <button
                        key={filePath}
                        type="button"
                        onClick={() => setSelectedFilePath(filePath)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 text-left text-xs font-mono transition-colors whitespace-nowrap sm:whitespace-normal break-all cursor-pointer",
                          selectedFilePath === filePath
                            ? "bg-card text-primary border border-edge"
                            : "text-muted-foreground hover:text-foreground border border-transparent"
                        )}
                      >
                        <FileCode2 className="size-3.5 shrink-0" />
                        <span>{filePath}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Read-Only Code Viewer */}
                <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-card overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-edge bg-background shrink-0">
                    <span className="font-mono text-xs text-foreground truncate">
                      {selectedFilePath}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCode}
                      className="h-7 bg-card border-edge font-mono uppercase text-[11px] shrink-0"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="size-3 text-primary" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <pre className="p-4 text-xs leading-relaxed font-mono text-foreground whitespace-pre-wrap break-words">
                      <code>{currentApp.files[selectedFilePath] ?? ""}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {publishToastOpen && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 border border-edge bg-card px-3.5 py-2.5 text-xs shadow-lg max-w-sm"
        >
          <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-background shrink-0">
            Coming soon
          </span>
          <span className="text-foreground">
            Publish is coming soon. Use Export .zip to download all project files.
          </span>
          <button
            type="button"
            onClick={() => setPublishToastOpen(false)}
            aria-label="Dismiss notice"
            className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
