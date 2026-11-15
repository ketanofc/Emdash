import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  File as FileIcon,
  FileCode2,
  Loader2,
  Monitor,
  Paperclip,
  RotateCw,
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
import type {
  AppVersion,
  AttachedFile,
  ChatMessage,
  DeviceViewport,
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
  quotaRemainingSeconds: number;
  quotaTotalSeconds: number;
  onOpenQuota: () => void;
  onOpenPricing: () => void;
  onSendFollowUp: (prompt: string, attachments: AttachedFile[]) => void;
  onExport: (version: AppVersion) => void;
  onPublish: (version: AppVersion) => void;
}

function formatQuota(secondsRemaining: number): string {
  const clamped = Math.max(0, secondsRemaining);
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  return `${hours}h ${String(mins).padStart(2, "0")}m left`;
}

export function WorkspaceView({
  messages,
  versions,
  selectedVersion,
  onSelectVersion,
  isGenerating,
  isPro,
  quotaRemainingSeconds,
  quotaTotalSeconds,
  onOpenQuota,
  onOpenPricing,
  onSendFollowUp,
  onExport,
  onPublish,
}: WorkspaceViewProps) {
  const [followUp, setFollowUp] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("preview");
  const [device, setDevice] = useState<DeviceViewport>("desktop");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const currentApp =
    versions.find((v) => v.version === selectedVersion) ??
    versions[versions.length - 1] ??
    null;

  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
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
    if (!currentApp) return;
    try {
      await navigator.clipboard.writeText(currentApp.html);
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

  const quotaPct = Math.max(
    0,
    Math.min(100, (quotaRemainingSeconds / quotaTotalSeconds) * 100)
  );
  const isQuotaLow = quotaRemainingSeconds < 1800;

  return (
    <div className="flex-1 min-h-0 px-2 pb-2 flex flex-col">
      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(260px,44%)_1fr] sm:grid-cols-[minmax(250px,310px)_1fr] md:grid-cols-[minmax(290px,350px)_1fr] lg:grid-cols-[minmax(320px,390px)_1fr] sm:grid-rows-[minmax(0,1fr)] border-x border-b border-edge bg-background">
        {/* Chat Pane */}
        <aside className="flex flex-col min-w-0 min-h-0 border-b sm:border-b-0 sm:border-r border-edge bg-background">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-edge bg-card shrink-0">
            <span className="font-mono uppercase text-[11px] font-medium text-muted-foreground tracking-wider">
              Build Chat
            </span>
            {isPro ? (
              <button
                type="button"
                onClick={onOpenPricing}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 border border-edge bg-background font-mono uppercase text-xs text-foreground hover:border-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Clock className="size-3.5 text-primary" />
                <span>Unlimited</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenQuota}
                aria-label="Daily build time"
                className={cn(
                  "inline-flex items-center gap-2 h-8 px-2.5 border bg-background font-mono uppercase text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums",
                  isQuotaLow
                    ? "border-primary text-primary hover:bg-primary/5"
                    : "border-edge text-muted-foreground hover:text-foreground hover:border-neutral"
                )}
              >
                <Clock className="size-3.5 text-primary shrink-0" />
                <span>{formatQuota(quotaRemainingSeconds)}</span>
                <span className="w-10 h-1 bg-muted overflow-hidden inline-block">
                  <span
                    className="block h-full bg-primary transition-all duration-300"
                    style={{ width: `${quotaPct}%` }}
                  />
                </span>
              </button>
            )}
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
                  <div className="flex items-center gap-2 font-mono uppercase text-[11px] text-muted-foreground">
                    <span className="size-5 bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold pb-0.5 shrink-0">
                      —
                    </span>
                    {msg.status === "thinking" ? (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Building your app…</span>
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
                          Building… ad shows while you wait
                        </div>
                        <div className="font-mono uppercase text-[10px] text-muted-foreground">
                          Sponsored
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
                        index.html
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
                ? `${currentApp.slug}.emdash.site`
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
                className="border-edge bg-background hover:bg-muted font-mono uppercase text-xs"
              >
                Export
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => currentApp && onPublish(currentApp)}
                disabled={!currentApp}
                className="font-mono uppercase text-xs"
              >
                Publish
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
                  <span className="size-8 bg-primary text-primary-foreground grid place-items-center font-mono font-bold pb-0.5 mb-2">
                    —
                  </span>
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
                <iframe
                  key={`${currentApp.version}-${reloadNonce}`}
                  title={currentApp.title}
                  srcDoc={currentApp.html}
                  sandbox="allow-scripts allow-forms allow-modals"
                  className="w-full h-full border-0 bg-white block"
                />
              </div>
            ) : (
              <div className="w-full h-full relative bg-card overflow-auto">
                <div className="sticky top-3 float-right mr-4 z-10">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="bg-background border-edge font-mono uppercase text-xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="size-3.5 text-primary" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copy code</span>
                      </>
                    )}
                  </Button>
                </div>
                <pre className="p-4 text-xs leading-relaxed font-mono text-foreground whitespace-pre-wrap break-words">
                  {currentApp.html}
                </pre>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
