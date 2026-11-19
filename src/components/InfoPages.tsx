import type React from "react";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  FileText,
  LifeBuoy,
  Lock,
  Mail,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import type { DocSection } from "@/src/components/Footer";
import {
  ATTACHMENT_MATRIX,
  FAQ_LIST,
  INFO_PAGES,
  LEGAL_GROUP_PAGES,
  PROMPT_BLUEPRINTS,
  SUPPORT_GROUP_PAGES,
} from "@/src/data/docsPages";
import { cn } from "@/src/lib/utils";

interface InfoPageViewProps {
  page: DocSection;
  onSelectPage: (page: DocSection) => void;
  onGoHome: () => void;
  onTryPrompt: (prompt: string) => void;
  onOpenWebAgent: () => void;
  onOpenSponsor: () => void;
}

const RAIL_CLASS =
  "w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto";

function HatchSeparator() {
  return (
    <div className="w-full px-2">
      <div
        className={cn(
          RAIL_CLASS,
          "relative flex h-8 md:h-10 border-x border-edge bg-card hatch-pattern"
        )}
      />
    </div>
  );
}

export function InfoPageView({
  page,
  onSelectPage,
  onGoHome,
  onTryPrompt,
  onOpenWebAgent,
  onOpenSponsor,
}: InfoPageViewProps) {
  const meta = INFO_PAGES[page];
  const siblingIds =
    meta.group === "support" ? SUPPORT_GROUP_PAGES : LEGAL_GROUP_PAGES;

  // FAQ state
  const [faqCategory, setFaqCategory] = useState<string>("All");
  const [openFaqId, setOpenFaqId] = useState<string>(FAQ_LIST[0].id);

  // Email support intake state
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportTopic, setSupportTopic] = useState("Build & Workspace Help");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState<string | null>(null);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const faqCategories = useMemo(
    () => ["All", ...Array.from(new Set(FAQ_LIST.map((item) => item.category)))],
    []
  );

  const filteredFaqs = useMemo(
    () =>
      faqCategory === "All"
        ? FAQ_LIST
        : FAQ_LIST.filter((item) => item.category === faqCategory),
    [faqCategory]
  );

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("support@emdash.build");
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim()) {
      setSupportError("Enter your name so our team knows how to address you.");
      return;
    }
    const cleanEmail = supportEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSupportError("Enter a valid reply email address.");
      return;
    }
    if (supportMessage.trim().length < 12) {
      setSupportError("Describe your question or issue in at least a few words.");
      return;
    }

    setSupportError(null);
    const id = `EMD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setTicketRef(id);
  };

  return (
    <main className="flex-1 overflow-x-clip bg-background">
      {/* Top Hatch Strip matching HomeView */}
      <HatchSeparator />

      {/* Hero Rail Section */}
      <section className="w-full px-2">
        <div
          className={cn(
            RAIL_CLASS,
            "screen-line-before screen-line-after relative flex flex-col items-center border-x border-edge bg-card px-3 sm:px-6 md:px-10 py-10 sm:py-14 md:py-16"
          )}
        >
          <CornerBrackets />

          <div className="inline-flex flex-wrap items-center justify-center gap-2 border border-edge bg-background min-h-8 font-mono uppercase text-[11px] sm:text-xs px-3 py-1 text-foreground">
            <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-semibold">
              {meta.badgeTag}
            </span>
            <span>{meta.badgeLabel}</span>
          </div>

          <h1 className="mt-5 text-[30px] sm:text-[38px] leading-[1.06] lg:text-5xl tracking-tighter font-semibold max-w-3xl text-balance text-center text-foreground">
            {meta.title}
          </h1>

          <p className="mt-4 max-w-2xl tracking-tight text-muted-foreground text-sm lg:text-base text-center leading-relaxed">
            {meta.subtitle}
          </p>

          {/* Sibling Section Switcher Bar */}
          <nav
            aria-label="Section switcher"
            className="mt-7 w-full max-w-3xl border border-edge bg-background p-1.5 flex flex-wrap items-center justify-center gap-1"
          >
            {siblingIds.map((id) => {
              const active = id === page;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectPage(id)}
                  className={cn(
                    "px-3 py-1.5 font-mono uppercase text-[11px] transition-colors cursor-pointer whitespace-nowrap border",
                    active
                      ? "bg-card text-[#c23a00] dark:text-primary border-edge font-semibold"
                      : "bg-transparent text-muted-foreground hover:text-foreground border-transparent"
                  )}
                >
                  {INFO_PAGES[id].shortTitle}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={onGoHome}
              className="h-9 px-5 font-mono uppercase text-xs gap-2"
            >
              <span>Open Builder</span>
              <ArrowRight className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenWebAgent}
              className="h-9 px-4 font-mono uppercase text-xs border-edge bg-background hover:bg-muted gap-2"
            >
              <Terminal className="size-3.5 text-[#c23a00] dark:text-primary" />
              <span>Web Agent</span>
            </Button>
          </div>
        </div>
      </section>

      <HatchSeparator />

      {/* Dedicated Page Content Rail Section */}
      <section className="w-full px-2">
        <div
          className={cn(
            RAIL_CLASS,
            "screen-line-before screen-line-after relative border-x border-edge bg-background px-3 sm:px-6 md:px-10 py-10 sm:py-14"
          )}
        >
          <CornerBrackets />

          {page === "docs" && (
            <div className="space-y-10">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Documentation Index
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Start building with clarity
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Explore dedicated guides for prompting, reference attachments, Dash Coins, exports, and direct team support.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
                {(["quickstart", "prompting", "faq", "support", "blog"] as DocSection[]).map(
                  (id, idx) => {
                    const item = INFO_PAGES[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectPage(id)}
                        className="group bg-card hover:bg-muted/60 p-6 text-left transition-colors flex flex-col justify-between gap-4 cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                              0{idx + 1} · {item.badgeTag}
                            </span>
                            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors" />
                          </div>
                          <h3 className="text-base font-semibold text-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors">
                            {item.shortTitle}
                          </h3>
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                            {item.cardSummary}
                          </p>
                        </div>
                        <span className="font-mono uppercase text-[11px] text-foreground inline-flex items-center gap-1.5">
                          <span>Read page</span>
                          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    );
                  }
                )}
                <button
                  type="button"
                  onClick={() => onSelectPage("legal")}
                  className="group bg-surface hover:bg-muted/60 p-6 text-left transition-colors flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                        06 · LEGAL
                      </span>
                      <ShieldCheck className="size-4 text-muted-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      Legal, Security &amp; Trust
                    </h3>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                      Review Privacy Policy, Terms of Service, Security Architecture, and our public Trust Center.
                    </p>
                  </div>
                  <span className="font-mono uppercase text-[11px] text-foreground inline-flex items-center gap-1.5">
                    <span>Open Legal Hub</span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-edge border border-edge">
                <div className="bg-card p-5">
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                    Daily Quota
                  </div>
                  <div className="mt-1.5 text-xl font-semibold text-foreground">
                    100 Dash Coins / day
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    10 Dash Coins per build. Automatic runtime repairs and failed builds cost 0.
                  </p>
                </div>
                <div className="bg-card p-5">
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                    Reference Uploads
                  </div>
                  <div className="mt-1.5 text-xl font-semibold text-foreground">
                    Up to 4 files · 4 MB each
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Drag-and-drop or paste PNG mockups, SVG vectors, PDFs, or source files.
                  </p>
                </div>
                <div className="bg-card p-5">
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                    Code Ownership
                  </div>
                  <div className="mt-1.5 text-xl font-semibold text-foreground">
                    100% Exportable .zip
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Static HTML/CSS/JS or React + TypeScript + Tailwind ready to host anywhere.
                  </p>
                </div>
              </div>
            </div>
          )}

          {page === "quickstart" && (
            <div className="space-y-10">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Quickstart Workflow
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Four steps from idea to shipped repository
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-edge border border-edge">
                {[
                  {
                    step: "01",
                    title: "Describe your app or attach a reference",
                    body: "Type a plain-English prompt on the Home page—or attach up to 4 screenshots, PDFs, SVGs, or code snippets. Emdash automatically detects whether a static bundle or a full React + TypeScript project fits best.",
                  },
                  {
                    step: "02",
                    title: "Watch the four-stage build pipeline",
                    body: "Emdash executes Design Brief -> Architecture Plan -> Full-File Synthesis -> Runtime Repair. Live token output and generated files appear directly inside the split Workspace.",
                  },
                  {
                    step: "03",
                    title: "Preview across Desktop, Tablet, and Mobile",
                    body: "Test real interactions inside the isolated Sandpack/iframe preview, inspect the Code tree, and send follow-up prompts in Build Chat. Every iteration saves a rollback snapshot (v1, v2, v3…).",
                  },
                  {
                    step: "04",
                    title: "Export .zip or switch to Web Agent",
                    body: "Download a ready-to-deploy .zip archive anytime with JSZip. Need multi-provider BYOK keys (Gemini, OpenAI, Anthropic, OpenRouter) in an open-source sandbox? Switch to /web.",
                  },
                ].map((item) => (
                  <div key={item.step} className="bg-card p-6 space-y-2.5">
                    <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary">
                      Step {item.step}
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border border-edge bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-1">
                    Try a live starter prompt
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Load an interactive prompt directly into the Home composer and start v1.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() =>
                    onTryPrompt(
                      "Build a clean SaaS changelog and roadmap portal with category filter tabs, search, upvote buttons persisted to localStorage, and dark editorial styling."
                    )
                  }
                  className="h-9 px-5 font-mono uppercase text-xs shrink-0"
                >
                  <span>Load Starter Prompt</span>
                </Button>
              </div>
            </div>
          )}

          {page === "prompting" && (
            <div className="space-y-10">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Prompt Blueprints
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Proven prompts you can load in one click
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Include the target audience, visual tone, and specific interactive states (tabs, filters, modals, persistence) for highest first-pass accuracy.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-edge border border-edge">
                {PROMPT_BLUEPRINTS.map((bp) => (
                  <div
                    key={bp.label}
                    className="bg-card p-6 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                          {bp.mode === "react-ts" ? "React + TS" : "Static Web"}
                        </span>
                        <FileText className="size-3.5 text-muted-foreground" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {bp.label}
                      </h3>
                      <p className="border border-edge bg-background p-3 font-mono text-[11px] text-foreground leading-relaxed">
                        &ldquo;{bp.prompt}&rdquo;
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {bp.whyItWorks}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onTryPrompt(bp.prompt)}
                      className="w-full h-9 border-edge bg-background hover:border-primary hover:text-primary font-mono uppercase text-xs gap-2"
                    >
                      <span>Load in Builder</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  File Attachments
                </div>
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-4">
                  Supported formats &amp; upload rules
                </h2>

                <div className="border border-edge bg-edge grid grid-cols-1 gap-px">
                  {ATTACHMENT_MATRIX.map((row) => (
                    <div
                      key={row.category}
                      className="bg-card p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[1.2fr_1.3fr_1.7fr_0.8fr] gap-3 items-start md:items-center"
                    >
                      <div className="text-sm font-semibold text-foreground">
                        {row.category}
                      </div>
                      <div className="font-mono text-[11px] text-[#c23a00] dark:text-primary">
                        {row.formats}
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        {row.handling}
                      </div>
                      <div className="font-mono uppercase text-[11px] text-foreground md:text-right">
                        {row.limit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === "faq" && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                    Frequently Asked Questions
                  </div>
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                    Everything about quotas, code ownership &amp; pricing
                  </h2>
                </div>

                <div className="flex flex-wrap gap-1 border border-edge bg-card p-1">
                  {faqCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFaqCategory(cat)}
                      className={cn(
                        "px-2.5 py-1 font-mono uppercase text-[10px] transition-colors cursor-pointer",
                        faqCategory === cat
                          ? "bg-background text-[#c23a00] dark:text-primary border border-edge font-semibold"
                          : "text-muted-foreground hover:text-foreground border border-transparent"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-edge bg-edge grid grid-cols-1 gap-px">
                {filteredFaqs.map((item) => {
                  const isOpen = openFaqId === item.id;
                  return (
                    <div key={item.id} className="bg-card">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqId(isOpen ? "" : item.id)
                        }
                        aria-expanded={isOpen}
                        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-mono uppercase text-[10px] text-[#c23a00] dark:text-primary block mb-1">
                            {item.category}
                          </span>
                          <span className="text-sm sm:text-base font-medium text-foreground">
                            {item.question}
                          </span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground shrink-0 transition-transform duration-200",
                            isOpen && "rotate-180 text-[#c23a00] dark:text-primary"
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-[13px] leading-relaxed text-muted-foreground border-t border-edge/60 bg-background">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="border border-edge bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Still have a specific question about Dash Coins, enterprise hosting, or your workspace?
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSelectPage("support")}
                  className="h-9 px-4 border-edge bg-background hover:border-primary font-mono uppercase text-xs gap-2 shrink-0"
                >
                  <LifeBuoy className="size-3.5 text-[#c23a00] dark:text-primary" />
                  <span>Contact Email Support</span>
                </Button>
              </div>
            </div>
          )}

          {page === "support" && (
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.25fr] gap-px bg-edge border border-edge">
              {/* Left Info Card */}
              <div className="bg-card p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary">
                    Direct Channel
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    support@emdash.build
                  </h2>
                  <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                    Whether you ran into a workspace edge case, need help verifying MFA recovery, or want to inquire about developer sponsorships, email us directly or submit the structured ticket beside this card.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <a
                      href="mailto:support@emdash.build"
                      className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground font-mono uppercase text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Mail className="size-3.5" />
                      <span>Open Mail App</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopyEmail()}
                      className="inline-flex items-center gap-2 h-9 px-3.5 border border-edge bg-background hover:border-primary font-mono uppercase text-xs text-foreground transition-colors cursor-pointer"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="size-3.5 text-[#c23a00] dark:text-primary" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-edge pt-5 space-y-3">
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                    Typical Response Areas
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li>· Workspace exports &amp; Sandpack preview troubleshooting</li>
                    <li>· Daily Dash Coin ledger &amp; Pro subscription billing</li>
                    <li>· Responsible security vulnerability reports</li>
                    <li>· Monthly sponsorship slot reservations</li>
                  </ul>
                </div>
              </div>

              {/* Right Intake Form */}
              <div className="bg-background p-6 sm:p-8">
                {ticketRef ? (
                  <div className="h-full flex flex-col justify-center items-start space-y-4 border border-edge bg-card p-6">
                    <div className="inline-flex items-center gap-2 border border-edge bg-background px-2.5 py-1 font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                      <Check className="size-3.5" />
                      <span>Request Prepared · {ticketRef}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Ready to send to support@emdash.build
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                      Your message summary for{" "}
                      <span className="text-foreground font-medium">
                        {supportTopic}
                      </span>{" "}
                      is logged under reference{" "}
                      <span className="font-mono text-foreground">{ticketRef}</span>.
                      Click below to launch it in your email client with pre-filled details, or submit another request.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <a
                        href={`mailto:support@emdash.build?subject=${encodeURIComponent(
                          `[${ticketRef}] ${supportTopic}`
                        )}&body=${encodeURIComponent(
                          `Name: ${supportName}\nReply-To: ${supportEmail}\n\n${supportMessage}`
                        )}`}
                        className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground font-mono uppercase text-xs font-medium"
                      >
                        <Mail className="size-3.5" />
                        <span>Send via Email Client</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTicketRef(null);
                          setSupportMessage("");
                        }}
                        className="h-9 px-4 border-edge bg-background font-mono uppercase text-xs"
                      >
                        New Request
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSupportSubmit} className="space-y-4">
                    <div>
                      <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-1">
                        Structured Support Ticket
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Prepare a support message
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                          Your Name
                        </span>
                        <input
                          type="text"
                          value={supportName}
                          onChange={(e) => setSupportName(e.target.value)}
                          placeholder="Alex Rivera"
                          className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                          Reply Email
                        </span>
                        <input
                          type="email"
                          value={supportEmail}
                          onChange={(e) => setSupportEmail(e.target.value)}
                          placeholder="alex@company.com"
                          className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1.5">
                      <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                        Topic
                      </span>
                      <select
                        value={supportTopic}
                        onChange={(e) => setSupportTopic(e.target.value)}
                        className="w-full h-9 px-3 border border-edge bg-card text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option>Build &amp; Workspace Help</option>
                        <option>Dash Coins &amp; Account</option>
                        <option>Web Agent BYOK Support</option>
                        <option>Security Disclosure</option>
                        <option>Sponsorship &amp; Partnerships</option>
                      </select>
                    </label>

                    <label className="block space-y-1.5">
                      <span className="font-mono uppercase text-[11px] text-muted-foreground block">
                        Details
                      </span>
                      <textarea
                        rows={4}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder="Share what you were building, expected behavior, or question details…"
                        className="w-full p-3 border border-edge bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                      />
                    </label>

                    {supportError && (
                      <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
                        {supportError}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="h-9 px-5 font-mono uppercase text-xs gap-2"
                    >
                      <span>Prepare Support Request</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}

          {page === "legal" && (
            <div className="space-y-10">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Legal &amp; Governance
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Policies, code rights &amp; platform trust
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-edge border border-edge">
                {(["privacy", "terms", "security", "trust"] as DocSection[]).map(
                  (id, idx) => {
                    const item = INFO_PAGES[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectPage(id)}
                        className="group bg-card hover:bg-muted/60 p-6 text-left transition-colors flex flex-col justify-between gap-4 cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                              0{idx + 1} · {item.badgeTag}
                            </span>
                            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground group-hover:text-[#c23a00] dark:group-hover:text-primary transition-colors">
                            {item.shortTitle}
                          </h3>
                          <p className="mt-2 text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                            {item.cardSummary}
                          </p>
                        </div>
                        <span className="font-mono uppercase text-[11px] text-foreground inline-flex items-center gap-1.5">
                          <span>Read policy</span>
                          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {page === "privacy" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-4">
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary">
                  Privacy Policy · Emdash
                </div>
                <div className="font-mono uppercase text-[11px] text-muted-foreground">
                  Effective: 2025 · Minimal Retention Architecture
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px bg-edge border border-edge">
                {[
                  {
                    title: "01. Browser-first storage & workspace versions",
                    body: "Your UI theme preference (emdash_theme), active workspace prompt history, and numbered generated application versions live inside your browser via IndexedDB (emdash-db) and localStorage. Clearing browser data removes local build snapshots immediately.",
                  },
                  {
                    title: "02. Prompts & uploaded reference files",
                    body: "Prompts and attached reference files (screenshots, SVG vectors, PDFs, or text snippets up to 4 MB) are transmitted over HTTPS exclusively to fulfill your active build request. We do not sell prompts or user artifacts to third parties.",
                  },
                  {
                    title: "03. Web Agent BYOK key handling",
                    body: "When using the open-source Web Agent (/web) with your own provider API keys (Gemini, OpenAI, Anthropic, or OpenRouter), keys reside locally in browser storage (emdash:web_agent_byok) and are forwarded only on active generation requests with automatic error secret redaction.",
                  },
                  {
                    title: "04. Zero cross-site advertising trackers",
                    body: "Free-tier sponsor placements are static architectural slots served directly without behavioral surveillance pixels, cross-site retargeting cookies, or fingerprinting scripts.",
                  },
                  {
                    title: "05. Account sessions & data requests",
                    body: "Signed-in account authentication is secured via Supabase Auth and signed HTTP-only / HMAC cookies. To request account or data deletion, contact support@emdash.build.",
                  },
                ].map((sec) => (
                  <div key={sec.title} className="bg-card p-6 space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">
                      {sec.title}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed max-w-4xl">
                      {sec.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "terms" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge pb-4">
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary">
                  Terms of Service · Emdash
                </div>
                <div className="font-mono uppercase text-[11px] text-muted-foreground">
                  100% Generated Code Ownership
                </div>
              </div>

              <div className="grid grid-cols-1 gap-px bg-edge border border-edge">
                {[
                  {
                    title: "01. Ownership of generated code & exports",
                    body: "Every application generated and exported through Emdash—including static HTML/CSS/JS bundles and multi-file React + TypeScript repositories—belongs to you from line one. You may modify, host, sell, or license exported projects commercially with zero attribution required.",
                  },
                  {
                    title: "02. Daily Dash Coins & automatic failure refunds",
                    body: "Free accounts receive a daily Dash Coin allowance (100 coins per UTC day, 10 coins per build). Failed generation jobs caused by upstream capacity limits or network faults trigger automatic ledger refunds.",
                  },
                  {
                    title: "03. Sponsor-supported Free tier & Pro tier",
                    body: "Free sessions display clearly labeled non-intrusive sponsor placements on designated surfaces so core building stays free. Pro subscriptions remove sponsor slots across the Home Builder and Workspace.",
                  },
                  {
                    title: "04. Acceptable use & fair platform access",
                    body: "You may not use Emdash to generate malware, phishing sites, automated scraping bots, or launch abusive traffic against platform APIs. Accounts bypassing quota limits or rate controls may be suspended.",
                  },
                  {
                    title: "05. Availability & support contact",
                    body: "Emdash is provided on a continuous-improvement basis. Questions regarding terms, commercial deployments, or account status may be directed to support@emdash.build.",
                  },
                ].map((sec) => (
                  <div key={sec.title} className="bg-card p-6 space-y-2">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground">
                      {sec.title}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed max-w-4xl">
                      {sec.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === "security" && (
            <div className="space-y-8">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Platform Security Architecture
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Layered controls across previews, auth &amp; keys
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
                {[
                  {
                    tag: "ISOLATION",
                    title: "Sandboxed preview execution",
                    body: "Generated applications execute exclusively inside sandboxed iframe / Sandpack preview frames so untrusted script execution remains isolated from the host app and cookies.",
                  },
                  {
                    tag: "CRYPTO",
                    title: "AES-256-GCM key vault",
                    body: "Platform secrets and provider credentials managed by administrators are encrypted at rest using authenticated AES-256-GCM encryption via Node crypto.",
                  },
                  {
                    tag: "AUTH",
                    title: "scrypt hashing & TOTP MFA",
                    body: "Local sessions and admin credentials leverage per-user salted scrypt hashes, HMAC-signed cookies, and Supabase TOTP aal2 enforcement.",
                  },
                  {
                    tag: "REDACTION",
                    title: "Automated secret sanitization",
                    body: "Server middleware and Web Agent handlers actively redact provider API key patterns from error traces and logs before responses ever reach the browser.",
                  },
                  {
                    tag: "BOUNDARY",
                    title: "Server-side pipeline endpoints",
                    body: "Primary Gemini synthesis routes (/api/generate) run strictly through Express / Serverless functions with request validation and per-user rate limits.",
                  },
                  {
                    tag: "TRUST",
                    title: "Public Trust Center & disclosure",
                    body: "Review live security posture statements anytime or submit coordinated vulnerability reports directly to support@emdash.build.",
                  },
                ].map((card) => (
                  <div key={card.title} className="bg-card p-6 space-y-2.5">
                    <div className="inline-flex items-center gap-1.5 font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                      <Lock className="size-3" />
                      <span>{card.tag}</span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border border-edge bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-1">
                    Responsible Disclosure
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Found a vulnerability or want a compliance overview? Visit our Trust Center or reach support@emdash.build.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    onClick={() => onSelectPage("trust")}
                    className="h-9 px-4 font-mono uppercase text-xs gap-2"
                  >
                    <ShieldCheck className="size-3.5" />
                    <span>Open Trust Center</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onSelectPage("support")}
                    className="h-9 px-4 border-edge bg-background font-mono uppercase text-xs"
                  >
                    Report Issue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {page === "trust" && (
            <div className="space-y-10">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Emdash Trust Center
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Verifiable security &amp; transparency posture
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Built so individuals and teams can inspect how previews run, where workspace data lives, and how model requests are protected.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-edge border border-edge">
                {[
                  {
                    eyebrow: "01 · Runtime Isolation",
                    title: "Sandboxed Previews",
                    body: "Every generated web application runs inside an isolated sandboxed iframe / Sandpack container, separating preview execution from your main browser session and origin storage.",
                  },
                  {
                    eyebrow: "02 · Network & APIs",
                    title: "Encrypted Transport & Server Boundary",
                    body: "All prompts, authentication checks, and generated builds travel over HTTPS directly to isolated server endpoints. Upstream provider keys never touch the client bundle in main Builder builds.",
                  },
                  {
                    eyebrow: "03 · User Control",
                    title: "Minimal Local Retention",
                    body: "Theme preferences and app versions reside inside your browser (IndexedDB + localStorage). Prompts and uploaded reference files are processed strictly for generation with zero third-party ad trackers.",
                  },
                  {
                    eyebrow: "04 · Disclosure",
                    title: "Vulnerability Reporting & Verification",
                    body: "Security researchers and teams can inspect our security design or report potential vulnerabilities anytime via support@emdash.build.",
                  },
                ].map((item) => (
                  <div key={item.title} className="bg-card p-6 space-y-2.5">
                    <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                      {item.eyebrow}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border border-edge bg-card p-6">
                <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-4">
                  Active Platform Safeguards
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    "Sandboxed iframe preview DOM",
                    "HMAC & HTTP-only auth cookies",
                    "TOTP (aal2) Admin MFA enforcement",
                    "Zero cross-site behavioral trackers",
                  ].map((check) => (
                    <div
                      key={check}
                      className="flex items-start gap-2.5 border border-edge bg-background p-3 text-xs text-foreground"
                    >
                      <Check className="size-4 text-[#c23a00] dark:text-primary shrink-0 mt-0.5" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === "blog" && (
            <div className="space-y-8">
              <div>
                <div className="font-mono uppercase text-xs text-[#c23a00] dark:text-primary mb-2">
                  Engineering &amp; Product Notes
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Inside the Emdash architecture
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-px bg-edge border border-edge">
                {[
                  {
                    tag: "Engineering · Pipeline",
                    title: "How Emdash turns one prompt into a verified multi-file web app",
                    body: "Every build flows through four deterministic stages—Design Brief, Architecture Plan, Full-File Synthesis, and Runtime Repair—so generated layouts maintain crisp contrast, responsive viewports, and zero syntax crashes right away.",
                  },
                  {
                    tag: "Product · Dash Coins",
                    title: "Keeping web app creation free to start without surprise paywalls",
                    body: "Every builder gets 100 daily Dash Coins automatically, supported by tasteful non-tracking developer sponsor placements on free surfaces. Failed builds refund coins automatically so you only pay for successful iterations.",
                  },
                  {
                    tag: "Open Source · Web Agent",
                    title: "Bringing your own keys inside /web with local file persistence",
                    body: "With Emdash Web Agent (/web), engineers can paste Gemini, OpenAI, Anthropic, or OpenRouter keys right in browser settings, edit multi-file workspaces with tool diffs, and push updates to GitHub.",
                  },
                ].map((post) => (
                  <article key={post.title} className="bg-card p-6 sm:p-8 space-y-2.5">
                    <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary">
                      {post.tag}
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-muted-foreground leading-relaxed max-w-4xl">
                      {post.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <HatchSeparator />

      {/* Cross-Directory Rail Section matching Home / Footer Navigation */}
      <section className="w-full px-2">
        <div
          className={cn(
            RAIL_CLASS,
            "screen-line-before screen-line-after relative border-x border-edge bg-card px-3 sm:px-6 md:px-10 py-10"
          )}
        >
          <CornerBrackets />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-3">
                Support Documentation Pages
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SUPPORT_GROUP_PAGES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPage(id)}
                    className={cn(
                      "flex items-center justify-between border px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                      page === id
                        ? "border-primary bg-background text-[#c23a00] dark:text-primary font-medium"
                        : "border-edge bg-background text-foreground hover:border-primary"
                    )}
                  >
                    <span>{INFO_PAGES[id].shortTitle}</span>
                    <ArrowRight className="size-3 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono uppercase text-[11px] text-[#c23a00] dark:text-primary mb-3">
                Legal &amp; Trust Pages
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {LEGAL_GROUP_PAGES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPage(id)}
                    className={cn(
                      "flex items-center justify-between border px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                      page === id
                        ? "border-primary bg-background text-[#c23a00] dark:text-primary font-medium"
                        : "border-edge bg-background text-foreground hover:border-primary"
                    )}
                  >
                    <span>{INFO_PAGES[id].shortTitle}</span>
                    <ArrowRight className="size-3 shrink-0" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onOpenSponsor}
                  className="flex items-center justify-between border border-edge bg-background px-3 py-2 text-xs text-foreground hover:border-primary transition-colors cursor-pointer text-left"
                >
                  <span>Sponsor Emdash</span>
                  <ArrowRight className="size-3 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HatchSeparator />
    </main>
  );
}
