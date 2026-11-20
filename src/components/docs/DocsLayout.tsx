import type React from "react";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Hash,
} from "lucide-react";
import type { DocSection } from "@/src/components/Footer";
import {
  DOCS_ORDER,
  INFO_PAGES,
  LEGAL_GROUP_PAGES,
  SUPPORT_GROUP_PAGES,
} from "@/src/data/docsPages";
import { cn } from "@/src/lib/utils";

export interface TocItem {
  id: string;
  label: string;
}

export interface DocsPageProps {
  onSelectPage: (page: DocSection) => void;
  onGoHome: () => void;
  onTryPrompt: (prompt: string) => void;
  onOpenWebAgent: () => void;
  onOpenSponsor: () => void;
}

interface DocsLayoutProps {
  page: DocSection;
  toc: TocItem[];
  onSelectPage: (page: DocSection) => void;
  onGoHome: () => void;
  onOpenWebAgent: () => void;
  children: React.ReactNode;
}

export function DocHeading({
  id,
  children,
}: {
  id: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 pt-4 border-t border-edge/60 text-xl sm:text-[22px] font-semibold tracking-tight text-foreground group flex items-center gap-2"
    >
      <span>{children}</span>
      <a
        href={`#${id}`}
        aria-label={`Link to ${id}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-[#c23a00] dark:hover:text-primary transition-opacity"
      >
        <Hash className="size-4" />
      </a>
    </h2>
  );
}

export function DocSubHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 pt-2 text-base sm:text-[17px] font-semibold tracking-tight text-foreground"
    >
      {children}
    </h3>
  );
}

export function DocCallout({
  title,
  children,
}: {
  variant?: "note" | "tip" | "security";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <blockquote className="my-5 border-l-2 border-primary pl-4 py-0.5 text-sm text-muted-foreground leading-relaxed">
      <div className="font-mono uppercase text-[11px] font-semibold text-[#c23a00] dark:text-primary mb-1">
        {title}
      </div>
      <div>{children}</div>
    </blockquote>
  );
}

export function DocCodeBlock({
  label,
  code,
}: {
  label: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="my-4 bg-card/70 border-y border-edge/70">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-edge/50">
        <span className="font-mono text-[11px] text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3 text-[#c23a00] dark:text-primary" />
              <span className="text-[#c23a00] dark:text-primary">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="px-3.5 py-3 overflow-x-auto font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DocsLayout({
  page,
  toc,
  onSelectPage,
  onGoHome,
  onOpenWebAgent,
  children,
}: DocsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const meta = INFO_PAGES[page];

  const currentIdx = DOCS_ORDER.indexOf(page);
  const prevPageId = currentIdx > 0 ? DOCS_ORDER[currentIdx - 1] : null;
  const nextPageId =
    currentIdx >= 0 && currentIdx < DOCS_ORDER.length - 1
      ? DOCS_ORDER[currentIdx + 1]
      : null;

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: DocSection
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    setMobileMenuOpen(false);
    onSelectPage(target);
  };

  const renderSidebarGroup = (heading: string, ids: DocSection[]) => (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-2">
        {heading}
      </div>
      <ul className="space-y-0.5">
        {ids.map((id) => {
          const item = INFO_PAGES[id];
          const active = id === page;
          return (
            <li key={id}>
              <a
                href={item.path}
                onClick={(e) => handleNavClick(e, id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block px-2.5 py-1.5 text-[13px] transition-colors border-l",
                  active
                    ? "border-primary text-[#c23a00] dark:text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-edge"
                )}
              >
                {item.shortTitle}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <main className="flex-1 bg-background text-foreground">
      {/* Main Content Area */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Mobile Navigation Switcher */}
        <div className="lg:hidden mb-6 pb-3 border-b border-edge/60">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            className="w-full flex items-center justify-between gap-2 py-1 text-sm font-medium text-foreground cursor-pointer"
          >
            <span>
              Section:{" "}
              <span className="text-[#c23a00] dark:text-primary">
                {meta.shortTitle}
              </span>
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                mobileMenuOpen && "rotate-180"
              )}
            />
          </button>

          {mobileMenuOpen && (
            <div className="mt-3 pt-3 border-t border-edge/50 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {renderSidebarGroup("Support documentation", SUPPORT_GROUP_PAGES)}
              {renderSidebarGroup("Legal & Trust", LEGAL_GROUP_PAGES)}
              {renderSidebarGroup("Resources", ["blog"])}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10 xl:gap-12">
          {/* Left Sticky Sidebar */}
          <aside
            aria-label="Documentation sidebar"
            className="hidden lg:block w-52 xl:w-56 shrink-0"
          >
            <div className="sticky top-20 space-y-6">
              {renderSidebarGroup("Support documentation", SUPPORT_GROUP_PAGES)}
              {renderSidebarGroup("Legal & Trust", LEGAL_GROUP_PAGES)}
              {renderSidebarGroup("Resources", ["blog"])}
            </div>
          </aside>

          {/* Center Paragraphic Prose Article */}
          <article className="min-w-0 flex-1 max-w-3xl">
            <header className="pb-6 mb-6 border-b border-edge/60">
              <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-2">
                {meta.badgeLabel}
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                {meta.title}
              </h1>
              <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                {meta.subtitle}
              </p>
            </header>

            <div className="space-y-6 text-[15px] leading-7 text-foreground/90">
              {children}
            </div>

            {/* Clean Typographic Previous / Next Footer */}
            <nav
              aria-label="Documentation pagination"
              className="mt-14 pt-6 border-t border-edge/60 flex items-center justify-between gap-4"
            >
              {prevPageId ? (
                <a
                  href={INFO_PAGES[prevPageId].path}
                  onClick={(e) => handleNavClick(e, prevPageId)}
                  className="group inline-flex flex-col items-start gap-0.5 text-left"
                >
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors">
                    <ArrowLeft className="size-3" />
                    <span>Previous</span>
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:underline">
                    {INFO_PAGES[prevPageId].shortTitle}
                  </span>
                </a>
              ) : (
                <div />
              )}

              {nextPageId ? (
                <a
                  href={INFO_PAGES[nextPageId].path}
                  onClick={(e) => handleNavClick(e, nextPageId)}
                  className="group inline-flex flex-col items-end gap-0.5 text-right"
                >
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors">
                    <span>Next</span>
                    <ArrowRight className="size-3" />
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:underline">
                    {INFO_PAGES[nextPageId].shortTitle}
                  </span>
                </a>
              ) : (
                <div />
              )}
            </nav>
          </article>

          {/* Right Minimal Table of Contents */}
          <aside
            aria-label="Table of contents"
            className="hidden xl:block w-48 shrink-0"
          >
            <div className="sticky top-20 space-y-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2.5">
                  On this page
                </div>
                <ul className="space-y-1.5 border-l border-edge/70 pl-3">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block text-xs text-muted-foreground hover:text-foreground transition-colors leading-snug py-0.5"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-edge/60 space-y-1.5 text-xs">
                <button
                  type="button"
                  onClick={onGoHome}
                  className="block text-left text-muted-foreground hover:text-[#c23a00] dark:hover:text-primary transition-colors cursor-pointer"
                >
                  Open Emdash Builder →
                </button>
                <button
                  type="button"
                  onClick={onOpenWebAgent}
                  className="block text-left text-muted-foreground hover:text-[#c23a00] dark:hover:text-primary transition-colors cursor-pointer"
                >
                  Launch Web Agent →
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
