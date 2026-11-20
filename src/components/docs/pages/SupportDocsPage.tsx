import type { DocSection } from "@/src/components/Footer";
import {
  DocCallout,
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";
import { INFO_PAGES } from "@/src/data/docsPages";

const TOC: TocItem[] = [
  { id: "overview", label: "What Emdash Builds" },
  { id: "pipeline-architecture", label: "Four-Stage Synthesis Pipeline" },
  { id: "two-surfaces", label: "Builder vs. Web Agent" },
  { id: "storage-versioning", label: "Local Versioning & Exports" },
  { id: "guides-directory", label: "Documentation Directory" },
  { id: "platform-specs", label: "Quotas, Limits & Defaults" },
];

export function SupportDocsPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  const linkTo = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: DocSection
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onSelectPage(target);
  };

  return (
    <DocsLayout
      page="docs"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="overview">What Emdash builds</DocHeading>
        <p className="text-muted-foreground">
          Emdash is a prompt-driven web application builder designed to take software ideas from a plain-English description—optionally paired with UI screenshots, brand logos, PDFs, or starter source files—straight to a running, interactive, and exportable codebase. Rather than trapping projects inside a proprietary visual editor or recurring hosting subscription, every iteration generates standard web files you own outright from the very first line.
        </p>
        <p className="text-muted-foreground">
          Depending on the structural needs of your request, Emdash automatically targets one of two clean output formats. Marketing landing pages, editorial essays, calculators, portfolios, and focused single-page utilities are synthesized as zero-build static web bundles consisting of semantic HTML, CSS, and vanilla JavaScript (<code>index.html</code>, <code>style.css</code>, and <code>app.js</code>). Multi-view dashboards, collaborative planners, CRUD applications, and stateful tools are synthesized as modular React + TypeScript + Tailwind CSS projects complete with <code>package.json</code>, Vite build tooling, typed state interfaces, and separated components under <code>src/components/</code>.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="pipeline-architecture">
          Four-stage synthesis pipeline
        </DocHeading>
        <p className="text-muted-foreground">
          Single-shot code generators frequently fail on subtle implementation details: illegible text contrast in dark mode, overflowing mobile layouts under 400px, incomplete event handlers, or unclosed JSX syntax that leaves a blank white preview. Emdash avoids single-pass guesswork by orchestrating every generation across four sequential phases:
        </p>
        <ol className="list-decimal pl-5 space-y-3 text-muted-foreground">
          <li>
            <strong className="text-foreground">Design Brief</strong> — Extracts the visual system from your prompt and attachments, committing up front to color tokens (primary, secondary, accent, background, surface, foreground, muted), typographic pairings, layout cadence, theme polarity (light or dark), and key domain sections.
          </li>
          <li>
            <strong className="text-foreground">Architecture Plan</strong> — Maps out the exact list of files to create, component hierarchy, local or browser-persisted state structures, and interactive behaviors before emitting source files.
          </li>
          <li>
            <strong className="text-foreground">Full-File Synthesis</strong> — Streams complete, self-contained file contents with real data structures, accessible markup, responsive spacing, and zero stubbed placeholders.
          </li>
          <li>
            <strong className="text-foreground">Runtime Verification &amp; Repair</strong> — Renders the finished bundle inside an isolated Sandpack or sandboxed iframe environment. If a JavaScript syntax or runtime exception fires during mount, Emdash captures the trace and invokes an automated repair cycle at zero Dash Coin cost.
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <DocHeading id="two-surfaces">Builder vs. Web Agent</DocHeading>
        <p className="text-muted-foreground">
          Emdash splits creation across two environments depending on whether you want managed zero-config convenience or bring-your-own-key developer tooling:
        </p>

        <DocSubHeading>Main Home Builder (/)</DocSubHeading>
        <p className="text-muted-foreground">
          The primary Home Builder requires zero configuration or local dependencies. Every user receives an automatic daily grant of <strong>100 Dash Coins</strong>, allowing immediate generation through Emdash&apos;s server-side model router (<code>/api/generate</code>). Once built, your app appears alongside Build Chat in a split Workspace supporting Desktop, Tablet, and Mobile preview viewports, full-file syntax inspection, conversational follow-up iterations, and one-click <code>.zip</code> exports.
        </p>

        <DocSubHeading>Open-Source Web Agent (/web)</DocSubHeading>
        <p className="text-muted-foreground">
          The Web Agent is built for developers who prefer supplying their own provider credentials (Google Gemini, OpenAI, Anthropic, or OpenRouter) directly in browser settings. Keys remain stored strictly in your browser under <code>emdash:web_agent_byok</code>, tool-call file diffs and terminal logs remain transparent across editing turns, and projects can sync directly with GitHub repositories.
        </p>

        <DocCallout title="Sponsor Placements Never Enter Generated Apps">
          Free usage of the Main Builder is funded by static sponsor cards placed strictly on designated Emdash platform surfaces. Generated previews and exported .zip repositories contain zero sponsor scripts, trackers, or ads.
        </DocCallout>
      </section>

      <section className="space-y-4">
        <DocHeading id="storage-versioning">
          Local versioning, IndexedDB &amp; exports
        </DocHeading>
        <p className="text-muted-foreground">
          Every build you generate or refine inside the Workspace is assigned a sequential version number (<code>v1</code>, <code>v2</code>, <code>v3</code>…) and saved locally inside your browser&apos;s IndexedDB database (<code>emdash_db</code>, object store <code>versions</code>). Because revisions live right on your device, refreshing the tab preserves your active workspace history without forcing mandatory cloud sign-in, and rolling back to an earlier iteration is instantaneous.
        </p>
        <p className="text-muted-foreground">
          Clicking <strong>Export .zip</strong> compiles the active version&apos;s complete file map client-side using JSZip and downloads a clean archive named after your project slug and version (for example, <code>habit-tracker-v2.zip</code>). Starting a fresh prompt from the Home composer clears prior workspace versions automatically so new apps begin cleanly at <code>v1</code>.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="guides-directory">Documentation directory</DocHeading>
        <p className="text-muted-foreground">
          Explore the complete documentation and governance guides below:
        </p>
        <ul className="list-disc pl-5 space-y-2.5 text-muted-foreground">
          <li>
            <a
              href={INFO_PAGES.quickstart.path}
              onClick={(e) => linkTo(e, "quickstart")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Quickstart guide
            </a>{" "}
            — Complete step-by-step walkthrough from writing your first prompt to running exported code locally on your machine.
          </li>
          <li>
            <a
              href={INFO_PAGES.prompting.path}
              onClick={(e) => linkTo(e, "prompting")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Prompting &amp; file uploads
            </a>{" "}
            — Prompt formulas, reusable blueprints, React vs. static triggers, clipboard image pasting, SVG XML parsing, and attachment size caps.
          </li>
          <li>
            <a
              href={INFO_PAGES.faq.path}
              onClick={(e) => linkTo(e, "faq")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              FAQ
            </a>{" "}
            — Detailed operational answers covering UTC Dash Coin resets, automatic failure refunds, hosting targets, Pro accounts, and BYOK security.
          </li>
          <li>
            <a
              href={INFO_PAGES.support.path}
              onClick={(e) => linkTo(e, "support")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Email support
            </a>{" "}
            — Direct contact address (<span className="font-sans font-normal text-foreground">info@emdash.world</span>) and contact form for emdash.world.
          </li>
          <li>
            <a
              href={INFO_PAGES.legal.path}
              onClick={(e) => linkTo(e, "legal")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Legal, Privacy Policy, Terms of Service, Security &amp; Trust Center
            </a>{" "}
            — Dedicated governance pages detailing user ownership rights, storage keys, preview sandboxing, cryptography, and disclosure policies.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <DocHeading id="platform-specs">Quotas, limits &amp; defaults</DocHeading>
        <p className="text-muted-foreground">
          The table below summarizes standard system limits enforced across the Emdash platform:
        </p>

        <div className="overflow-x-auto my-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge text-xs font-mono uppercase text-muted-foreground">
                <th className="py-2.5 pr-4 font-semibold">Parameter</th>
                <th className="py-2.5 px-4 font-semibold">Default Limit</th>
                <th className="py-2.5 pl-4 font-semibold">System Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60 text-xs sm:text-[13px]">
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Daily Dash Coins
                </td>
                <td className="py-3 px-4 font-mono text-[#c23a00] dark:text-primary">
                  100 coins / UTC day
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Replenished automatically on a 24-hour UTC reset cycle.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Build vs. Repair Cost
                </td>
                <td className="py-3 px-4 font-mono text-[#c23a00] dark:text-primary">
                  10 build · 0 repair
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Automated error repairs cost 0; upstream/network failures auto-refund.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Reference File Attachments
                </td>
                <td className="py-3 px-4 font-mono text-[#c23a00] dark:text-primary">
                  4 files · 4 MB each
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Images, SVGs, PDFs, audio/video, and structured code/text (60 KB cap).
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Browser Storage Scope
                </td>
                <td className="py-3 px-4 font-mono text-[#c23a00] dark:text-primary">
                  emdash_db (IndexedDB)
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Stores versioned app files locally; cleared manually or on new project start.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Export Archive Format
                </td>
                <td className="py-3 px-4 font-mono text-[#c23a00] dark:text-primary">
                  Client-side .zip (JSZip)
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Full standalone source files deployable to any static or Node/Vite host.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </DocsLayout>
  );
}
