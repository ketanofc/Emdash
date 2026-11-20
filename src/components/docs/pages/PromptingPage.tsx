import {
  DocCallout,
  DocCodeBlock,
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";
import { ATTACHMENT_MATRIX, PROMPT_BLUEPRINTS } from "@/src/data/docsPages";

const TOC: TocItem[] = [
  { id: "prompt-anatomy", label: "Anatomy of a Precision Prompt" },
  { id: "stack-selection", label: "Static vs. React + TypeScript" },
  { id: "follow-up-prompts", label: "Effective Follow-Up Iterations" },
  { id: "blueprints", label: "Verified Prompt Blueprints" },
  { id: "attachments", label: "Attaching Reference Files" },
  { id: "limits", label: "Limits, Encoding & Normalization" },
];

const PROMPT_FORMULA = `[Target App & Stack]   e.g. "Build a React TypeScript invoice dashboard..."
[Visual Direction]     e.g. "Warm off-white background, 1px hairline borders, dark header"
[Core Sections]        e.g. "KPI summary strip, filterable table, side invoice preview drawer"
[Interactive States]   e.g. "Persist drafts to localStorage, instant search, CSV export button"`;

const FOLLOWUP_EXAMPLES = `Good follow-up:
"Add a CSV export button next to the filter tabs that downloads the currently filtered rows, and keep existing dark mode styling untouched."

Less effective follow-up:
"Make it better and add more features."`;

export function PromptingPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onTryPrompt, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="prompting"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="prompt-anatomy">Anatomy of a precision prompt</DocHeading>
        <p className="text-muted-foreground">
          Before writing source files, Emdash synthesizes a structured Design Brief and Architecture Plan from your prompt. When your prompt specifies only a broad category—such as <em>&ldquo;Create a portfolio site&rdquo;</em>—the planner has to invent generic copy, arbitrary color palettes, and minimal interactions. Conversely, prompts that clearly define the visual aesthetic, structural regions, and concrete browser states produce cohesive, ready-to-ship software on the very first version.
        </p>
        <p className="text-muted-foreground">
          Think of a strong initial prompt as four compact clauses combined into one paragraph: target application and stack preference, visual mood and contrast polarity, named layout sections, and explicit state/persistence rules.
        </p>

        <DocCodeBlock label="Four-Part Prompt Formula" code={PROMPT_FORMULA} />
      </section>

      <section className="space-y-4">
        <DocHeading id="stack-selection">
          Controlling Static vs. React + TypeScript output
        </DocHeading>
        <p className="text-muted-foreground">
          During the Architecture Plan stage, Emdash inspects your prompt to decide between a fast zero-bundler static project and a modular React + TypeScript + Vite repository:
        </p>
        <ul className="list-disc pl-5 space-y-2.5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Static Web Bundles (HTML + CSS + JS)</strong> — Selected automatically for editorial landing pages, documentation micro-sites, event schedules, agency portfolios, pricing calculators, and marketing waitlists. Output files (<code>index.html</code>, <code>style.css</code>, <code>app.js</code>) boot instantaneously inside the preview iframe and require no Node build pipeline when deployed.
          </li>
          <li>
            <strong className="text-foreground">React + TypeScript Projects</strong> — Selected when your prompt describes multi-tab applications, searchable data grids, drag-or-status Kanban workflows, split editors, multi-step onboarding wizards, or explicitly mentions <code>React</code>, <code>TypeScript</code>, <code>Tailwind</code>, or <code>Vite</code>. Emdash emits a complete <code>package.json</code>, <code>vite.config.ts</code>, <code>tsconfig.json</code>, and typed components under <code>src/</code> rendered inside Sandpack.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <DocHeading id="follow-up-prompts">
          Writing targeted follow-up iterations
        </DocHeading>
        <p className="text-muted-foreground">
          Inside the Workspace Build Chat, follow-up prompts receive your existing Design Brief and complete active file map as context. Rather than repeating your entire original specification, state cleanly what should change, what new interaction should be added, and which working elements must remain untouched.
        </p>

        <DocCodeBlock label="Follow-Up Precision Comparison" code={FOLLOWUP_EXAMPLES} />
      </section>

      <section className="space-y-5">
        <DocHeading id="blueprints">Verified prompt blueprints</DocHeading>
        <p className="text-muted-foreground">
          Study how each example below pairs visual intent with specific interactive controls. Select <em>Load in Builder</em> on any blueprint to inject it straight into the Home composer:
        </p>

        {PROMPT_BLUEPRINTS.map((bp, idx) => (
          <div key={bp.label} className="space-y-2 pt-2">
            <DocSubHeading>
              Blueprint {idx + 1}: {bp.label}{" "}
              <span className="font-mono text-xs font-normal text-[#c23a00] dark:text-primary ml-1">
                ({bp.mode === "react-ts" ? "React + TS" : "Static Web"})
              </span>
            </DocSubHeading>
            <p className="text-muted-foreground text-sm">
              <strong>Why it works:</strong> {bp.whyItWorks}{" "}
              <button
                type="button"
                onClick={() => onTryPrompt(bp.prompt)}
                className="text-[#c23a00] dark:text-primary font-medium underline underline-offset-4 hover:opacity-80 cursor-pointer ml-1"
              >
                Load in Builder →
              </button>
            </p>
            <DocCodeBlock label={`Prompt — ${bp.label}`} code={bp.prompt} />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <DocHeading id="attachments">Attaching reference files &amp; screenshots</DocHeading>
        <p className="text-muted-foreground">
          Often a single screenshot, wireframe sketch, SVG brand mark, or sample JSON payload conveys design requirements faster than three paragraphs of prose. Both the Home composer and Build Chat accept attachments via drag-and-drop, file picker selection, or direct clipboard paste (<code>Cmd/Ctrl + V</code>).
        </p>
        <p className="text-muted-foreground">
          When attaching files, state explicitly in your prompt how Emdash should treat them—for instance, whether an uploaded PNG screenshot is a strict layout mockup to replicate or simply color/typography inspiration, or whether an uploaded SVG should appear inside the hero header and footer.
        </p>

        <div className="overflow-x-auto my-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge text-xs font-mono uppercase text-muted-foreground">
                <th className="py-2.5 pr-4 font-semibold">Category</th>
                <th className="py-2.5 px-4 font-semibold">Supported Formats</th>
                <th className="py-2.5 px-4 font-semibold">Pipeline Handling</th>
                <th className="py-2.5 pl-4 font-semibold text-right">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60 text-xs sm:text-[13px]">
              {ATTACHMENT_MATRIX.map((row) => (
                <tr key={row.category}>
                  <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                    {row.category}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#c23a00] dark:text-primary">
                    {row.formats}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {row.handling}
                  </td>
                  <td className="py-3 pl-4 font-mono text-[11px] text-foreground text-right whitespace-nowrap">
                    {row.limit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <DocHeading id="limits">Upload limits, encoding &amp; normalization</DocHeading>
        <p className="text-muted-foreground">
          Each prompt supports up to <strong>4 attached files</strong>, with an individual size limit of <strong>4 MB per file</strong>. Plain-text source and data files (HTML, CSS, TS, TSX, JSON, Markdown, CSV, SQL, YAML, XML) are decoded as UTF-8 and capped at <strong>60 KB per file</strong> so structural examples fit cleanly inside model context alongside your Design Brief.
        </p>

        <DocCallout title="Automatic Browser Image Normalization">
          When you drop an SVG file, Emdash preserves the crisp XML markup as readable text context while also generating a preview thumbnail. If you upload non-web image codecs such as HEIC, BMP, or AVIF, the client automatically rasterizes a high-resolution PNG fallback before sending so vision stages inspect your reference without format errors.
        </DocCallout>
      </section>
    </DocsLayout>
  );
}
