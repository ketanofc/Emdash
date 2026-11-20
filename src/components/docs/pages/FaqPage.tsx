import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";
import { FAQ_LIST, INFO_PAGES } from "@/src/data/docsPages";

const TOC: TocItem[] = [
  { id: "search-faq", label: "Search Questions" },
  { id: "dash-coins-faq", label: "Core Platform Q&A" },
  { id: "exports-hosting-faq", label: "Exports & Hosting Guide" },
  { id: "privacy-ads-faq", label: "Sponsors, Ads & Privacy" },
  { id: "more-help", label: "Contact Support" },
];

const EXTRA_FAQ: ReadonlyArray<{
  id: string;
  category: string;
  question: string;
  answer: string;
}> = [
  {
    id: "version-rollback",
    category: "Workspace",
    question: "How does version history work, and where are my apps saved?",
    answer:
      "Every completed build and follow-up edit is assigned a sequential version number (v1, v2, v3...) and persisted locally inside your browser's IndexedDB database (emdash_db, object store versions). You can switch back to earlier milestones from the workspace version selector or export any version as a .zip archive. Clearing browser site data removes local versions immediately.",
  },
  {
    id: "runtime-repair",
    category: "Dash Coins",
    question: "What happens if generated code has a runtime error in preview?",
    answer:
      "Emdash listens for uncaught syntax and runtime errors inside the preview iframe/Sandpack sandbox. If an error occurs on mount for a generated version, an automatic single-pass repair prompt runs using the exact error stack trace at zero Dash Coin cost (0 coins) to restore a working preview.",
  },
  {
    id: "static-vs-react",
    category: "Exports",
    question: "When does Emdash output Static HTML vs. a React + TypeScript project?",
    answer:
      "Landing pages, portfolios, marketing sites, and focused calculators generate clean static bundles (index.html, style.css, app.js) that open directly on any web server with zero build tools. Complex stateful apps, multi-panel dashboards, and prompts explicitly naming React or TypeScript generate full Vite + React + TypeScript + Tailwind repositories.",
  },
  {
    id: "file-uploads-faq",
    category: "Workspace",
    question: "What kinds of files can I upload with my prompt?",
    answer:
      "You can attach up to 4 files per prompt (up to 4 MB per file), including PNG/JPG/WebP/GIF/HEIC/AVIF screenshots, SVG vector files, PDFs, short MP3/WAV/OGG/MP4/WebM media references, and plain-text source or schema files (HTML, CSS, TS, TSX, JSON, Markdown, CSV, SQL, YAML, up to 60 KB text context each).",
  },
];

export function FaqPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  const allFaqs = useMemo(() => [...FAQ_LIST, ...EXTRA_FAQ], []);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allFaqs.filter((item) => {
      return (
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [allFaqs, searchQuery]);

  return (
    <DocsLayout
      page="faq"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="search-faq">Search questions</DocHeading>
        <p className="text-muted-foreground">
          Detailed answers covering daily Dash Coin grants, automatic failure refunds, React &amp; static code exports, local IndexedDB versioning, reference uploads, bring-your-own-key Web Agent workflows, and sponsor transparency.
        </p>

        <div className="pt-1">
          <div className="relative max-w-sm">
            <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions (e.g. export, coins, upload)…"
              aria-label="Search FAQ"
              className="w-full h-9 pl-8 pr-3 border-b border-edge bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <DocHeading id="dash-coins-faq">Core platform questions &amp; answers</DocHeading>

        {filteredFaqs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matching questions found for &ldquo;{searchQuery}&rdquo;. Try clearing your search or send a message via{" "}
            <a
              href={INFO_PAGES.support.path}
              onClick={(e) => {
                if (
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey ||
                  e.button !== 0
                ) {
                  return;
                }
                e.preventDefault();
                onSelectPage("support");
              }}
              className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Email support
            </a>
            .
          </p>
        ) : (
          <div className="space-y-7 divide-y divide-edge/50">
            {filteredFaqs.map((item) => (
              <div key={item.id} className="pt-5 first:pt-0 space-y-2">
                <div className="font-mono uppercase text-[10px] text-[#c23a00] dark:text-primary">
                  {item.category}
                </div>
                <DocSubHeading>{item.question}</DocSubHeading>
                <p className="text-muted-foreground leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <DocHeading id="exports-hosting-faq">
          Deploying exported code on external hosts
        </DocHeading>
        <p className="text-muted-foreground">
          Every exported <code>.zip</code> archive is completely self-contained and omits any runtime dependency on Emdash servers. Static exports need no compilation step: upload the extracted folder directly to GitHub Pages, Cloudflare Pages, Netlify Drop, Vercel, Amazon S3, or Nginx. React + TypeScript exports use standard Vite scripts—run <code>npm install</code> once and then <code>npm run build</code> to emit an optimized production bundle inside <code>dist/</code> ready for any static or edge CDN.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="privacy-ads-faq">
          Sponsors, privacy &amp; Pro accounts
        </DocHeading>
        <p className="text-muted-foreground">
          Free-tier building is subsidized by static developer sponsor placements positioned cleanly on designated Emdash surfaces (the Home composer banner, Templates gallery slot, and Web Agent workspace). These sponsor cards never track you across websites with third-party ad cookies, never execute inside your generated app previews, and never ship inside exported code. Signing up for a Pro account hides platform sponsor slots across the Builder and Workspace while preserving full code ownership across both tiers.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="more-help">Still need help?</DocHeading>
        <p className="text-muted-foreground">
          If your question relates to a specific build issue, Dash Coin ledger refund, MFA recovery, or developer sponsorship inquiry, contact us directly at{" "}
          <a
            href="mailto:info@emdash.world"
            className="font-sans font-normal text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            info@emdash.world
          </a>{" "}
          or send a message directly through the{" "}
          <a
            href={INFO_PAGES.support.path}
            onClick={(e) => {
              if (
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey ||
                e.button !== 0
              ) {
                return;
              }
              e.preventDefault();
              onSelectPage("support");
            }}
            className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            Email support page
          </a>
          .
        </p>
      </section>
    </DocsLayout>
  );
}
