import { Button } from "@/src/components/ui/button";
import {
  DocCallout,
  DocCodeBlock,
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";

const TOC: TocItem[] = [
  { id: "prerequisites", label: "Prerequisites & Dash Coins" },
  { id: "step-1-prompt", label: "Step 1 · Compose Prompt & Files" },
  { id: "step-2-pipeline", label: "Step 2 · Four-Stage Pipeline" },
  { id: "step-3-preview", label: "Step 3 · Preview, Viewports & Repairs" },
  { id: "step-4-iterate", label: "Step 4 · Iterate & Version History" },
  { id: "step-5-export", label: "Step 5 · Export & Local Deployment" },
  { id: "starter-example", label: "Try a Starter Prompt" },
];

const LOCAL_COMMANDS = `# 1. Extract your exported archive
unzip my-emdash-app-v1.zip -d my-emdash-app
cd my-emdash-app

# 2. If your export is a React + TypeScript project (contains package.json):
npm install
npm run dev

# Build optimized production assets:
npm run build

# 3. If your export is a Static bundle (contains index.html only):
npx serve .`;

const DEPLOY_NOTES = `# Deploy Static or Vite dist/ outputs directly via Vercel or Netlify CLI:
npx vercel --prod
# or
npx netlify-cli deploy --prod`;

export function QuickstartPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onTryPrompt, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="quickstart"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="prerequisites">Prerequisites &amp; daily Dash Coins</DocHeading>
        <p className="text-muted-foreground">
          Emdash requires no local installation, CLI login, database setup, or payment card to begin creating applications. As soon as you open the Home page, you start with an active daily balance of <strong>100 Dash Coins</strong>, tracked transparently in the top Wallet dialog and reset every 24 hours on a UTC schedule.
        </p>
        <p className="text-muted-foreground">
          Each fresh build or follow-up revision prompt costs <strong>10 Dash Coins</strong>. Automated runtime error repairs cost <strong>0 Dash Coins</strong>, and any generation that fails because of upstream model demand limits, capacity exhaustion, or network interruption triggers an automatic ledger refund so you never lose coins on failed attempts.
        </p>

        <DocCallout title="Automatic Output Detection vs. Explicit Override">
          Emdash decides automatically whether a Static HTML/CSS/JS bundle or a React + TypeScript + Vite project best fits your prompt. If you specifically want modular React components, TypeScript interfaces, and a <code>package.json</code> tree, mention <code>&ldquo;React TypeScript&rdquo;</code> explicitly in your prompt.
        </DocCallout>
      </section>

      <section className="space-y-4">
        <DocHeading id="step-1-prompt">
          Step 1 · Compose your prompt &amp; attach visual context
        </DocHeading>
        <p className="text-muted-foreground">
          In the Home prompt composer, describe the core workflow, target user, visual tone, and key interactive controls you want built. Rather than writing vague single-line requests like <em>&ldquo;Make a finance app&rdquo;</em>, name the concrete UI regions and persistence rules: <em>&ldquo;Build a personal monthly budget planner with category allocation sliders, expense logging persisted to localStorage, and live remaining balance calculation.&rdquo;</em>
        </p>
        <p className="text-muted-foreground">
          Optionally attach up to four reference files (maximum 4 MB each) by dragging them onto the prompt box, clicking the paperclip icon, or pasting screenshots directly from your clipboard (<code>Cmd/Ctrl + V</code>). Screenshots, Figma exports, SVG logos, PDF briefs, and starter JSON/HTML files give the synthesis pipeline exact visual and structural grounding.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="step-2-pipeline">
          Step 2 · Follow the four-stage build pipeline
        </DocHeading>
        <p className="text-muted-foreground">
          Submitting your prompt transitions into the Workspace and streams live progress across four sequential stages:
        </p>
        <ol className="list-decimal pl-5 space-y-3 text-muted-foreground">
          <li>
            <strong className="text-foreground">Design Brief</strong> — Translates your prompt and images into an explicit visual specification: palette hex values, light/dark polarity, typographic pairings, spacing rhythm, and page sections.
          </li>
          <li>
            <strong className="text-foreground">Architecture Plan</strong> — Determines the target runtime (<code>static</code> vs. <code>react-ts</code>), lists each file path and responsibility, and defines client-side state transitions and edge cases before any code is streamed.
          </li>
          <li>
            <strong className="text-foreground">Full-File Synthesis</strong> — Generates complete, non-truncated source files cleanly formatted for instant mounting. You can pause generation anytime via the stop/pause control if you decide to revise your prompt mid-run.
          </li>
          <li>
            <strong className="text-foreground">Runtime Verification &amp; Repair</strong> — Immediately boots the generated files inside the sandboxed preview frame. If any uncaught browser error occurs on mount, Emdash passes the exact error trace back to the repair pass (at 0 coin cost) until the app renders cleanly.
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <DocHeading id="step-3-preview">
          Step 3 · Test across viewports &amp; inspect source files
        </DocHeading>
        <p className="text-muted-foreground">
          Once generation completes, the right Workspace pane renders the live running application inside an isolated Sandpack or sandboxed iframe container. Use the viewport toolbar at the top of the preview pane to verify responsive behavior across <strong>Desktop</strong>, <strong>Tablet</strong>, and <strong>Mobile (390px)</strong> widths without leaving the browser.
        </p>
        <p className="text-muted-foreground">
          Toggle to the <strong>Code</strong> view anytime to inspect every generated file path, copy snippets, verify CSS variables or Tailwind classes, and confirm semantic HTML accessibility before exporting.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="step-4-iterate">
          Step 4 · Iterate in Build Chat &amp; switch versions
        </DocHeading>
        <p className="text-muted-foreground">
          Every change you request in Build Chat builds on top of the currently selected version&apos;s Design Brief and file map rather than starting over from scratch. Each completed follow-up creates an incremented version (<code>v1</code>, <code>v2</code>, <code>v3</code>…) saved locally inside browser IndexedDB (<code>emdash_db</code>).
        </p>
        <p className="text-muted-foreground">
          You can switch between any earlier version using the Workspace version selector dropdown to compare layouts, export an older milestone, or fork future edits from a prior stable checkpoint.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="step-5-export">
          Step 5 · Export .zip &amp; deploy anywhere
        </DocHeading>
        <p className="text-muted-foreground">
          Click <strong>Export .zip</strong> in the workspace header to package every file from the active version into a standalone archive generated directly in your browser with JSZip. There are zero proprietary runtime imports or vendor locks inside exported code. Extract the bundle and run or deploy it using any standard toolchain:
        </p>

        <DocCodeBlock label="Terminal — Run Locally" code={LOCAL_COMMANDS} />

        <DocCodeBlock label="Terminal — Deploy to Static / Edge Hosts" code={DEPLOY_NOTES} />

        <DocSubHeading>Working with your own API keys in /web</DocSubHeading>
        <p className="text-muted-foreground">
          Prefer using your own Google Gemini, OpenAI, Anthropic, or OpenRouter API keys with transparent tool-call file diffs and GitHub branch workflows? Open the{" "}
          <button
            type="button"
            onClick={onOpenWebAgent}
            className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary cursor-pointer"
          >
            Web Agent (/web)
          </button>{" "}
          from the top navigation bar.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="starter-example">Try a starter prompt right now</DocHeading>
        <p className="text-muted-foreground">
          Click below to prefill a well-structured starter prompt straight into the Home composer and watch the full four-stage pipeline execute end to end:
        </p>
        <blockquote className="border-l-2 border-edge pl-4 text-sm text-foreground italic">
          &ldquo;Build a clean SaaS changelog and roadmap portal with category filter tabs, search, upvote buttons persisted to localStorage, and dark editorial styling.&rdquo;
        </blockquote>
        <div>
          <Button
            type="button"
            onClick={() =>
              onTryPrompt(
                "Build a clean SaaS changelog and roadmap portal with category filter tabs, search, upvote buttons persisted to localStorage, and dark editorial styling."
              )
            }
            className="h-9 px-5 font-mono uppercase text-xs"
          >
            <span>Load Starter Prompt</span>
          </Button>
        </div>
      </section>
    </DocsLayout>
  );
}
