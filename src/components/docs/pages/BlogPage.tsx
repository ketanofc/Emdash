import {
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";

const TOC: TocItem[] = [
  { id: "pipeline-notes", label: "Four-Stage Synthesis Pipeline" },
  { id: "dash-coin-model", label: "Honest Free-Tier Economics" },
  { id: "open-web-agent", label: "BYOK & Open Web Agent (/web)" },
];

export function BlogPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="blog"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="pipeline-notes">
          How Emdash turns one prompt into a verified multi-file web app
        </DocHeading>
        <p className="text-muted-foreground">
          Single-shot code generators frequently break on the practical engineering details that separate a throwaway snippet from shippable software: insufficient color contrast across light/dark surfaces, horizontal overflow at 390px mobile widths, stubbed handlers marked with <code>TODO</code> comments, or unclosed JSX tags that render a blank white preview.
        </p>
        <p className="text-muted-foreground">
          Emdash eliminates single-pass guesswork by splitting every generation into four deterministic stages—Design Brief, Architecture Plan, Full-File Synthesis, and Runtime Repair. By locking typography, palette tokens, file tree responsibilities, and browser state contracts before emitting code, even multi-file React + TypeScript workspaces mount cleanly on the first version.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="dash-coin-model">
          Keeping creation free to start without surprise paywalls
        </DocHeading>
        <DocSubHeading>Predictable Quotas &amp; Zero Penalties for Failures</DocSubHeading>
        <p className="text-muted-foreground">
          Every builder receives 100 daily Dash Coins automatically on a 24-hour UTC reset cycle, sustained by clean, non-tracking static developer sponsor placements on designated host surfaces rather than hidden meter walls. Automated error repairs run at 0 coin cost, and failed upstream requests refund spent coins automatically back into your ledger.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="open-web-agent">
          Bringing your own keys inside /web with transparent diffs
        </DocHeading>
        <p className="text-muted-foreground">
          When engineers want direct control over model selection across Google Gemini, OpenAI, Anthropic, or OpenRouter, the open-source Web Agent (<code>/web</code>) lets you enter personal API keys locally inside browser settings, inspect tool-call file diffs side by side with live viewport previews, and push updates to GitHub with zero vendor lock-in.
        </p>
      </section>
    </DocsLayout>
  );
}
