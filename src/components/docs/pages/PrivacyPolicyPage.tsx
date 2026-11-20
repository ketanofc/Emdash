import {
  DocCallout,
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";

const TOC: TocItem[] = [
  { id: "scope", label: "1. Scope & Minimal Retention" },
  { id: "browser-storage", label: "2. Browser-First Storage Inventory" },
  { id: "prompts-uploads", label: "3. Prompts & Reference Files" },
  { id: "byok-keys", label: "4. Web Agent BYOK Key Handling" },
  { id: "sponsor-privacy", label: "5. Sponsors & Zero Tracking" },
  { id: "account-data", label: "6. Account Sessions & Logs" },
  { id: "data-rights", label: "7. Your Controls, Deletion & Contact" },
];

export function PrivacyPolicyPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="privacy"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="scope">1. Scope &amp; minimal retention philosophy</DocHeading>
        <p className="text-muted-foreground">
          This Privacy Policy describes how Emdash (<code>emdash.world</code>) collects, processes, transmits, and stores data across the Home Builder (<code>/</code>), Workspace, open-source Web Agent (<code>/web</code>), documentation pages, and optional account authentication flows. Our privacy architecture follows a <strong>minimal-retention, browser-first design</strong>: wherever server storage is not strictly required for authentication or Dash Coin accounting, application state lives directly inside your own browser.
        </p>

        <DocCallout title="Zero Sale of Prompts or Generated Code">
          Emdash never sells, rents, or brokers user prompts, uploaded mockups, reference source files, or generated applications to advertisers, data brokers, or unrelated third parties.
        </DocCallout>
      </section>

      <section className="space-y-4">
        <DocHeading id="browser-storage">2. Browser-first storage inventory</DocHeading>
        <p className="text-muted-foreground">
          When you build applications inside Emdash without signing in—or even while signed in—your generated project files, version snapshots (<code>v1</code>, <code>v2</code>, <code>v3</code>…), visual preference, and optional Web Agent API keys are written directly to browser storage on your local device. You can inspect or purge these entries anytime using browser developer tools or by clearing site data.
        </p>

        <div className="overflow-x-auto my-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge text-xs font-mono uppercase text-muted-foreground">
                <th className="py-2.5 pr-4 font-semibold">Key / Database</th>
                <th className="py-2.5 px-4 font-semibold">Storage API</th>
                <th className="py-2.5 pl-4 font-semibold">Stored Data &amp; Lifecycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60 text-xs sm:text-[13px]">
              <tr>
                <td className="py-3 pr-4 font-mono text-[#c23a00] dark:text-primary">
                  emdash_db (versions)
                </td>
                <td className="py-3 px-4 text-foreground">IndexedDB</td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Stores full versioned file maps, Design Brief JSON, Architecture Plan, and prompt history locally until cleared or replaced by a fresh build.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-[#c23a00] dark:text-primary">
                  emdash_theme
                </td>
                <td className="py-3 px-4 text-foreground">localStorage</td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Saves your explicit <code>light</code> or <code>dark</code> UI preference across page reloads.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-[#c23a00] dark:text-primary">
                  emdash_gemini_model
                </td>
                <td className="py-3 px-4 text-foreground">localStorage</td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Records selected model preference when switched in supported sessions.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-mono text-[#c23a00] dark:text-primary">
                  emdash:web_agent_byok
                </td>
                <td className="py-3 px-4 text-foreground">localStorage</td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Stores optional user-supplied BYOK API keys for Gemini, OpenAI, Anthropic, or OpenRouter strictly on your device for /web runs.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <DocHeading id="prompts-uploads">3. Prompts &amp; uploaded reference files</DocHeading>
        <p className="text-muted-foreground">
          When you submit a build prompt or attach up to four reference files (PNG, JPG, WebP, GIF, HEIC, AVIF, SVG, PDF, short audio/video media, or plain-text source/config files up to 4 MB per file), Emdash transmits that payload over encrypted HTTPS to the server synthesis endpoint (<code>/api/generate</code>). Image codecs requiring compatibility normalization (such as HEIC or SVG previews) are rasterized client-side inside your browser before transmission.
        </p>
        <p className="text-muted-foreground">
          Prompt payloads and attachments are forwarded strictly to the active AI inference provider required to generate your Design Brief, Architecture Plan, Source Files, or Repair Pass. Emdash does not publish your prompts or generated outputs to public feeds or shared galleries.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="byok-keys">4. Web Agent BYOK key handling</DocHeading>
        <p className="text-muted-foreground">
          In the open-source Web Agent (<code>/web</code>), users can supply personal API keys from Google Gemini, OpenAI, Anthropic, or OpenRouter. Those credentials are never synced to user profile tables; they stay inside browser storage (<code>emdash:web_agent_byok</code>), are attached only when you execute a generation request, and are actively scrubbed from error strings and proxy logs by automated secret-redaction middleware.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="sponsor-privacy">5. Sponsor placements &amp; zero cross-site tracking</DocHeading>
        <p className="text-muted-foreground">
          Free builder usage is funded by static sponsor cards placed on designated surfaces within Emdash (such as the Home Composer Banner, Templates section, and Web Agent workspace). Unlike conventional ad networks, Emdash serves these placements directly without embedding third-party JavaScript trackers, behavioral retargeting pixels, real-time bidding scripts, or cross-site tracking cookies.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="account-data">6. Account sessions, Dash Coins &amp; operational logs</DocHeading>
        <DocSubHeading>Signed-In Account Information</DocSubHeading>
        <p className="text-muted-foreground">
          Creating or signing into an optional Emdash account stores only essential identity and entitlement records: your normalized email address, display name, role (<code>user</code> or <code>admin</code>), account status, salted <code>scrypt</code> password hash (for local credential auth) or Supabase Auth subject ID, and your Dash Coin wallet ledger (balances, UTC reset timestamps, build debits, and automatic failure refunds).
        </p>
        <DocSubHeading>Session Cookies &amp; Security Logs</DocSubHeading>
        <p className="text-muted-foreground">
          Sessions are authenticated via Supabase JWTs and HMAC-SHA256 signed HTTP-only cookies. Server diagnostics track request timestamps, coarse country headers when provided by edge proxies (<code>cf-ipcountry</code>), HTTP status codes, and rate-limit counters exclusively to prevent abuse and protect platform availability.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="data-rights">7. Your controls, deletion &amp; contact</DocHeading>
        <p className="text-muted-foreground">
          You may remove all local generated applications, versions, and BYOK keys immediately at any time by clearing browser storage (IndexedDB <code>emdash_db</code> and <code>localStorage</code>) in your browser settings. To request an export or permanent deletion of server-side account records, wallet ledger history, or support correspondence, email{" "}
          <a
            href="mailto:info@emdash.world"
            className="font-sans font-normal text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            info@emdash.world
          </a>
          .
        </p>
      </section>
    </DocsLayout>
  );
}
