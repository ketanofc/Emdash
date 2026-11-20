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
  { id: "trust-summary", label: "Platform Trust Posture" },
  { id: "isolation-encryption", label: "Execution & Transport Controls" },
  { id: "active-safeguards", label: "Active Safeguards Checklist" },
  { id: "artifact-residency", label: "Data Residency & Retention Matrix" },
  { id: "fairness-sponsors", label: "Ledger Fairness & Sponsor Ethics" },
  { id: "transparency-links", label: "Governance Links & Contact" },
];

export function TrustCenterPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  const linkTo = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: "privacy" | "security" | "terms"
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onSelectPage(target);
  };

  return (
    <DocsLayout
      page="trust"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="trust-summary">Platform trust posture</DocHeading>
        <p className="text-muted-foreground">
          The Emdash Trust Center documents transparently how previews execute, how credentials and API keys are compartmentalized, where generated applications reside, and how platform fairness guarantees are enforced in code. Instead of publishing vague marketing assurances, every statement below reflects active architectural controls implemented across the Emdash client and server layers.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="isolation-encryption">
          Runtime execution &amp; transport controls
        </DocHeading>
        <DocSubHeading>Sandboxed Preview Containers</DocSubHeading>
        <p className="text-muted-foreground">
          Every synthesized application executes strictly within isolated iframe / Sandpack preview sandboxes. Preview DOM and JavaScript execution cannot read Emdash cookies, tamper with parent workspace navigation, or access local BYOK tokens stored outside the preview boundary.
        </p>
        <DocSubHeading>HTTPS &amp; Server-Side Boundary</DocSubHeading>
        <p className="text-muted-foreground">
          All build prompts, attachment payloads, authentication handshakes, and model completions traverse encrypted HTTPS/TLS channels. Managed provider credentials used by the main Builder stay strictly inside server memory and AES-256-GCM encrypted backend storage—never bundled into browser JavaScript.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="active-safeguards">Active safeguards checklist</DocHeading>
        <p className="text-muted-foreground">
          Verify the core operational protections running continuously across Emdash:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">Isolated preview sandboxing</strong>{" "}
            — Static HTML/JS and React + TS builds execute inside quarantined Sandpack / iframe frames.
          </li>
          <li>
            <strong className="text-foreground">HMAC &amp; HTTP-only session integrity</strong>{" "}
            — Account tokens are verified against Supabase Auth or server-signed HMAC-SHA256 secrets with timing-safe checks.
          </li>
          <li>
            <strong className="text-foreground">TOTP (aal2) mandatory for /admin</strong>{" "}
            — Privileged administrative endpoints require verified database <code>admin</code> role plus active TOTP second-factor authentication.
          </li>
          <li>
            <strong className="text-foreground">Automated secret redaction</strong>{" "}
            — Upstream provider error traces are scrubbed of API key patterns before returning diagnostics to the client.
          </li>
          <li>
            <strong className="text-foreground">Zero behavioral advertising pixels</strong>{" "}
            — Free-tier sponsor cards render statically without cross-site tracking cookies or programmatic ad-exchange trackers.
          </li>
          <li>
            <strong className="text-foreground">Automatic Dash Coin failure refunds</strong>{" "}
            — Upstream capacity failures or network timeouts automatically restore spent Dash Coins to the user&apos;s wallet ledger.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <DocHeading id="artifact-residency">Data residency &amp; retention matrix</DocHeading>
        <p className="text-muted-foreground">
          Inspect exactly where each class of platform data lives and who controls retention:
        </p>

        <div className="overflow-x-auto my-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-edge text-xs font-mono uppercase text-muted-foreground">
                <th className="py-2.5 pr-4 font-semibold">Artifact</th>
                <th className="py-2.5 px-4 font-semibold">Storage Location</th>
                <th className="py-2.5 pl-4 font-semibold">Control &amp; Encryption</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60 text-xs sm:text-[13px]">
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Generated Apps &amp; Versions
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  Browser IndexedDB (<code>emdash_db</code>)
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Local to your device; 100% ownable, exportable as .zip, or deletable anytime.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Theme &amp; Model Preferences
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  Browser localStorage (<code>emdash_theme</code>)
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Local UI settings only; zero server tracking cookies.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Web Agent BYOK Keys
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  Browser localStorage (<code>emdash:web_agent_byok</code>)
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Sent only on active requests; masked out of server logs and errors.
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Managed Provider Keys
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  Backend server store
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Encrypted at rest with AES-256-GCM; gated behind admin MFA (aal2).
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">
                  Dash Coin Ledger
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  Backend wallet store
                </td>
                <td className="py-3 pl-4 text-muted-foreground">
                  Atomic debit/refund accounting with daily 24h UTC resets.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <DocHeading id="fairness-sponsors">
          Ledger fairness &amp; non-intrusive sponsorship
        </DocHeading>
        <p className="text-muted-foreground">
          Free builder access works honestly: you receive 100 Dash Coins daily, repairs cost 0 coins, failed generations refund automatically, and sponsors never inject tracking code into your builds or previews. Read full details inside our{" "}
          <a
            href={INFO_PAGES.terms.path}
            onClick={(e) => linkTo(e, "terms")}
            className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            Terms of Service
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="transparency-links">Governance links &amp; contact</DocHeading>
        <p className="text-muted-foreground">
          Inspect related documentation on the{" "}
          <a
            href={INFO_PAGES.privacy.path}
            onClick={(e) => linkTo(e, "privacy")}
            className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href={INFO_PAGES.security.path}
            onClick={(e) => linkTo(e, "security")}
            className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            Security Architecture
          </a>{" "}
          pages.
        </p>

        <DocCallout title="Direct Security & Trust Contact">
          Need compliance documentation, data deletion confirmation, or coordinated vulnerability disclosure? Email{" "}
          <a
            href="mailto:info@emdash.world"
            className="font-sans font-normal text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            info@emdash.world
          </a>
          .
        </DocCallout>
      </section>
    </DocsLayout>
  );
}
