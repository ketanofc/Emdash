import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import {
  QUICK_CHIPS,
  ROTATING_PLACEHOLDERS,
  TEMPLATES,
  type TemplateItem,
} from "@/src/data/templates";
import type { AttachedFile } from "@/src/types";
import { toast } from "sonner";

interface HomeViewProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: (promptText: string, attachment: AttachedFile | null) => void;
  isPro: boolean;
  onOpenPricing: () => void;
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
  onOpenPricing,
}: HomeViewProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 150_000) {
      toast.error("Reference file must be under 150 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setAttachment({ name: file.name, content });
      toast.success(`Attached ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmitPrompt(trimmed, attachment);
    setAttachment(null);
  };

  return (
    <main className="flex-1 overflow-auto overflow-x-hidden bg-background">
      {/* Culio Diagonal Hatch Top Strip */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge hatch-pattern" />
      </div>

      {/* Hero Rail Section */}
      <section className="px-2">
        <div className="screen-line-before screen-line-after relative md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex flex-col items-center border-x border-edge bg-card/50 px-4 md:px-10 py-14 md:py-20">
          <CornerBrackets />

          <button
            type="button"
            onClick={onOpenPricing}
            className="inline-flex items-center gap-2 border border-edge bg-background h-8 font-mono uppercase text-xs px-3 text-foreground hover:border-primary transition-colors cursor-pointer"
          >
            <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
              {isPro ? "PRO" : "FREE"}
            </span>
            <span>
              {isPro
                ? "Unlimited build time · Ad-free"
                : "5 hours daily · Supported by ads"}
            </span>
          </button>

          <h1 className="mt-5 text-[38px] leading-[1.02] lg:text-6xl tracking-tighter font-semibold max-w-2xl text-balance text-center text-foreground">
            What do you want to build?
          </h1>

          <p className="mt-4 max-w-xl tracking-tight text-muted-foreground text-sm lg:text-base text-center">
            Describe a web app, landing page, or interactive tool. Preview on every viewport, iterate in chat, and export standalone code.
          </p>

          {/* Composer Box with Culio Corner Brackets */}
          <div className="relative mt-9 w-full max-w-2xl border border-edge bg-card p-3 focus-within:border-primary transition-colors">
            <CornerBrackets />

            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
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

            {attachment && (
              <div className="flex items-center gap-2 mt-1 mb-2 px-2.5 py-1 border border-edge bg-background text-xs w-fit max-w-full">
                <Paperclip className="size-3.5 text-primary shrink-0" />
                <span className="truncate max-w-[220px] font-mono">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2.5 border-t border-edge mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.html,.css,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach reference file"
                className="size-9 border-edge bg-background hover:bg-muted"
              >
                <Paperclip className="size-4" />
              </Button>

              <button
                type="button"
                onClick={onOpenPricing}
                className="inline-flex items-center h-9 px-3 border border-edge bg-background font-mono uppercase text-xs text-muted-foreground hover:text-foreground hover:border-neutral transition-colors cursor-pointer"
              >
                {isPro ? "Emdash Pro" : "Emdash Free"}
              </button>

              <div className="flex-1" />

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
                aria-label="Build"
                className="h-9 px-5 font-mono uppercase text-xs gap-2"
              >
                <span>Build app</span>
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Prompt Bar */}
          <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-px bg-edge border border-edge mt-4">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  onPromptChange(chip.prompt);
                  textareaRef.current?.focus();
                }}
                className="bg-background hover:bg-card hover:text-primary px-3 py-2.5 font-mono uppercase text-[11px] text-muted-foreground transition-colors truncate cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Culio Diagonal Hatch Separator */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge hatch-pattern" />
      </div>

      {/* Templates Rail Section */}
      <section id="templates-gallery" className="px-2">
        <div className="screen-line-before screen-line-after relative md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-background px-4 md:px-10 py-12 md:py-16">
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
                Pick one and make it yours. Free for 5 hours a day.
              </p>
            </div>
            <span className="font-mono uppercase text-xs text-muted-foreground">
              01 — 06
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
            {TEMPLATES.map((tpl, idx) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className="group bg-card hover:bg-muted/60 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex flex-col cursor-pointer"
              >
                <div className="flex items-center justify-between w-full mb-3.5">
                  <span className="font-mono uppercase text-xs text-muted-foreground tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
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
                onClick={() =>
                  toast.info("CloudNest hosting: 3 months free for Emdash builders")
                }
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
                    Unlimited daily build hours enabled across all prompts and templates.
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
        <div className="relative flex h-8 md:h-10 w-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge hatch-pattern" />
      </div>

      <footer className="px-2 pb-4">
        <div className="screen-line-before screen-line-after relative md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card px-4 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-mono uppercase text-xs text-muted-foreground">
            Emdash
          </span>
          <span className="font-mono uppercase text-[11px] text-muted-foreground">
            Build time resets every 24 hours · Ads keep Emdash free
          </span>
        </div>
      </footer>
    </main>
  );
}
