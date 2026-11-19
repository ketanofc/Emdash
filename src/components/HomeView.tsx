import { useEffect, useRef, useState } from "react";
import { ArrowUp, File as FileIcon, Paperclip, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { WebAgentLandingSection } from "@/src/components/WebAgentLandingSection";
import { FounderNoteSection } from "@/src/components/FounderNoteSection";
import {
  ROTATING_PLACEHOLDERS,
  TEMPLATES,
  type TemplateItem,
} from "@/src/data/templates";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  formatFileSize,
  processUploadedFile,
} from "@/src/lib/fileAttachment";
import type { AttachedFile } from "@/src/types";
import { cn } from "@/src/lib/utils";

interface HomeViewProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: (promptText: string, attachments: AttachedFile[]) => void;
  isPro: boolean;
  onOpenSponsor: () => void;
  onOpenWallet: () => void;
  onOpenWebAgent: () => void;
}

const TEMPLATE_TAGS: Record<string, string> = {
  "todo-app": "Productivity",
  "coffee-landing": "Storefront",
  "photo-portfolio": "Portfolio",
  "pricing-page": "SaaS",
  "habit-tracker": "Tracker",
};

export function HomeView({
  prompt,
  onPromptChange,
  onSubmitPrompt,
  isPro,
  onOpenSponsor,
  onOpenWallet,
  onOpenWebAgent,
}: HomeViewProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!prompt) {
        setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
      }
    }, 3200);
    return () => window.clearInterval(id);
  }, [prompt]);

  const handleSelectTemplate = (tpl: TemplateItem) => {
    onPromptChange(tpl.prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => textareaRef.current?.focus(), 120);
  };

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
        nextError = `${file.name} exceeds the 4 MB size limit.`;
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

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed && attachments.length === 0) return;
    onSubmitPrompt(
      trimmed || "Build a web app matching the attached reference.",
      attachments
    );
    setAttachments([]);
    setFileError(null);
  };

  return (
    <main className="flex-1 overflow-x-clip bg-background">
      {/* Culio Diagonal Hatch Top Strip */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Hero Rail Section */}
      <section className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col items-center border-x border-edge bg-card px-2.5 sm:px-4 md:px-10 py-10 sm:py-14 md:py-20">
          <CornerBrackets />

          <button
            type="button"
            onClick={onOpenWallet}
            className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 border border-edge bg-background min-h-8 font-mono uppercase text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 text-foreground hover:border-primary transition-colors cursor-pointer max-w-full text-center"
          >
            <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
              {isPro ? "PRO" : "FREE"}
            </span>
            <span>
              {isPro
                ? "Unlimited · Ad-free"
                : "& Supported by ads"}
            </span>
          </button>

          <h1 className="mt-5 text-[32px] sm:text-[38px] leading-[1.04] lg:text-6xl tracking-tighter font-semibold max-w-2xl text-balance text-center text-foreground">
            What do you want to build?
          </h1>

          <p className="mt-4 max-w-xl tracking-tight text-muted-foreground text-sm lg:text-base text-center">
            Describe a web app, landing page, or interactive tool. Preview on every viewport, iterate in chat, and export standalone code.
          </p>

          {/* Composer Box with Culio Corner Brackets */}
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
              "relative mt-9 w-full max-w-2xl border bg-card p-3 focus-within:border-primary transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-edge"
            )}
          >
            <CornerBrackets />

            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Ask Emdash to build ${ROTATING_PLACEHOLDERS[placeholderIndex]}…`}
              aria-label="Describe your app"
              rows={3}
              className="min-h-[76px] resize-none border-0 p-1.5 text-[15px] leading-relaxed"
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5 mb-2">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 border border-edge bg-background px-2 py-1 text-xs max-w-[260px]"
                  >
                    {file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="size-6 object-cover border border-edge shrink-0 bg-muted"
                      />
                    ) : (
                      <FileIcon className="size-3.5 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[11px] text-foreground">
                        {file.name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((item) => item.id !== file.id)
                        )
                      }
                      aria-label={`Remove ${file.name}`}
                      className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {fileError && (
              <div className="flex items-center justify-between gap-2 mt-1 mb-1.5 border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-[11px] font-mono text-destructive">
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

            <div className="flex items-center gap-2 pt-2.5 border-t border-edge mt-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach any file or image for reference"
                className="size-9 border-edge bg-background hover:bg-muted"
              >
                <Paperclip className="size-4" />
              </Button>

              <button
                type="button"
                onClick={onOpenWallet}
                className="inline-flex items-center h-9 px-3 border border-edge bg-background font-mono uppercase text-xs text-muted-foreground hover:text-foreground hover:border-neutral transition-colors cursor-pointer"
              >
                {isPro ? "Emdash Pro" : "Emdash Free"}
              </button>

              <div className="flex-1" />

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!prompt.trim() && attachments.length === 0}
                aria-label="Build"
                className="h-9 px-5 font-mono uppercase text-xs gap-2"
              >
                <span>Build</span>
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Ad Sponsor Banner */}
          {!isPro && (
            <div className="w-full max-w-2xl mt-4 border border-dashed border-edge bg-background px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono uppercase text-[10px] font-semibold border border-edge px-1.5 py-0.5 text-primary bg-card shrink-0">
                  Ad
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    CloudNest Edge Hosting: Deploy exported HTML in seconds
                  </div>
                  <div className="font-mono uppercase text-[10px] text-muted-foreground mt-0.5">
                    Sponsored · 3 months free for Emdash builders
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onOpenSponsor}
                  className="h-7 px-2.5 border border-edge bg-card hover:border-primary hover:text-primary font-mono uppercase text-[10px] text-foreground transition-colors cursor-pointer"
                >
                  Sponsor Emdash
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Culio Diagonal Hatch Separator */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      {/* Templates Rail Section */}
      <section id="templates-gallery" className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-background px-2.5 sm:px-4 md:px-10 py-12 md:py-16">
          <CornerBrackets />

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8">
            <div>
              <div className="font-mono uppercase text-xs text-primary mb-2">
                Templates
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                Start from a template
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick one and make it yours. Free to start · Supported by ads.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className="group bg-card hover:bg-muted/60 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex flex-col cursor-pointer"
              >
                <div className="flex items-center justify-end w-full mb-3.5">
                  <span className="font-mono uppercase text-[11px] text-primary">
                    {TEMPLATE_TAGS[tpl.id] ?? "Template"}
                  </span>
                </div>

                <div className="aspect-[16/10] w-full border border-edge bg-background p-3.5 flex flex-col gap-1.5 overflow-hidden group-hover:border-primary/60 transition-colors">
                  <span className="block h-2 w-[46%] bg-foreground/75" />
                  <span className="block h-1.5 w-[72%] bg-border" />
                  <span className="block h-1.5 w-[58%] bg-border" />
                  <span
                    className="block flex-1 mt-1 border border-edge"
                    style={{
                      background: `linear-gradient(135deg, hsla(${tpl.hue}, 82%, 52%, 0.25), hsla(${tpl.hue}, 82%, 52%, 0.05))`,
                    }}
                  />
                </div>

                <div className="mt-4">
                  <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                    {tpl.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tpl.description}
                  </div>
                </div>
              </button>
            ))}

            {!isPro ? (
              <button
                type="button"
                onClick={onOpenSponsor}
                className="group bg-surface hover:bg-muted/60 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between w-full mb-3.5">
                    <span className="font-mono uppercase text-xs border border-edge px-1.5 py-0.5 text-primary bg-background">
                      Ad
                    </span>
                    <span className="font-mono uppercase text-[11px] text-muted-foreground">
                      Sponsored
                    </span>
                  </div>

                  <div className="aspect-[16/10] w-full border border-dashed border-edge bg-background p-4 flex flex-col justify-center items-start gap-2">
                    <span className="bg-primary text-primary-foreground px-2 py-0.5 font-mono uppercase text-[11px]">
                      CloudNest
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      3 months free edge hosting. Ads keep Emdash free.
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="font-medium text-sm text-foreground">
                    CloudNest hosting
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Deploy exported HTML in seconds
                  </div>
                </div>
              </button>
            ) : (
              <div className="bg-card p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between w-full mb-3.5">
                  <span className="font-mono uppercase text-xs text-muted-foreground">
                    PRO
                  </span>
                  <span className="font-mono uppercase text-[11px] text-primary">
                    Active
                  </span>
                </div>
                <div className="my-auto">
                  <div className="font-medium text-sm text-foreground">
                    Ad-free workspace
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ad-free workspace enabled across all prompts and templates.
                  </div>
                </div>
                <span className="font-mono uppercase text-[11px] text-primary mt-4">
                  Unlimited active
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Culio Diagonal Hatch Bottom Strip */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>

      <WebAgentLandingSection onOpenWebAgent={onOpenWebAgent} />

      <FounderNoteSection />
    </main>
  );
}
