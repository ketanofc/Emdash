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
  { id: "legal-overview", label: "Platform Legal Principles" },
  { id: "policy-index", label: "Governing Policy Directory" },
  { id: "ownership-guarantee", label: "Code Ownership & Licensing" },
  { id: "open-source-sponsors", label: "Sponsors & Revenue Transparency" },
  { id: "legal-contact", label: "Compliance & Formal Requests" },
];

export function LegalHubPage(props: DocsPageProps) {
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
      page="legal"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="legal-overview">Platform legal principles</DocHeading>
        <p className="text-muted-foreground">
          Emdash (<code className="text-foreground">emdash.world</code>) is structured around three clear legal commitments designed for individual creators, freelance engineers, and product teams: creators own every line of software generated on the platform from the first build onward; user workspace files and browser preferences stay local to the user&apos;s device whenever server storage is unnecessary; and platform security boundaries are documented openly rather than obscured behind generic legalese.
        </p>
        <p className="text-muted-foreground">
          Unlike hosted no-code platforms that assert platform lock-in or restrict how exported code may be redistributed, Emdash serves strictly as an application synthesis and browser preview workbench. Once your project downloads as a <code>.zip</code> archive via JSZip, zero proprietary wrappers, license beacons, or tracking scripts remain embedded in your repository.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="policy-index">Governing policy directory</DocHeading>
        <p className="text-muted-foreground">
          Each compliance domain maintains its own dedicated specification page:
        </p>

        <ul className="list-disc pl-5 space-y-3 text-muted-foreground">
          <li>
            <a
              href={INFO_PAGES.privacy.path}
              onClick={(e) => linkTo(e, "privacy")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Privacy Policy
            </a>{" "}
            — Details exact browser storage keys (<code>emdash_db</code> IndexedDB, <code>emdash_theme</code>, <code>emdash_gemini_model</code>, and <code>emdash:web_agent_byok</code>), how prompts and up to 4 reference attachments travel over TLS/HTTPS, how Supabase Auth sessions work, and why zero behavioral advertising cookies run anywhere on Emdash.
          </li>
          <li>
            <a
              href={INFO_PAGES.terms.path}
              onClick={(e) => linkTo(e, "terms")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Terms of Service
            </a>{" "}
            — Sets forth your unrestricted commercial ownership over generated static and React + TypeScript repositories, daily Dash Coin allowance and automated upstream-failure refunds, acceptable use rules, and service limitations.
          </li>
          <li>
            <a
              href={INFO_PAGES.security.path}
              onClick={(e) => linkTo(e, "security")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Security
            </a>{" "}
            — Documents preview iframe / Sandpack execution isolation, AES-256-GCM encryption for stored server credentials, per-user salted scrypt password hashing, TOTP <code>aal2</code> administrative MFA, automated error-log secret redaction, and coordinated vulnerability reporting.
          </li>
          <li>
            <a
              href={INFO_PAGES.trust.path}
              onClick={(e) => linkTo(e, "trust")}
              className="text-foreground font-medium underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
            >
              Trust Center
            </a>{" "}
            — Provides an inspectable breakdown of data residency (client browser vs. server state), active security safeguards, and ledger fairness controls.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <DocHeading id="ownership-guarantee">Code ownership &amp; licensing</DocHeading>
        <p className="text-muted-foreground">
          You retain full intellectual property and commercial exploitation rights over every static HTML/CSS/JS bundle and multi-file React + TypeScript application generated using your prompts and reference assets. You may publish generated apps under open-source licenses, ship proprietary SaaS software, deliver paid client sites, or deploy internally behind private networks without paying royalties or preserving Emdash attribution.
        </p>

        <DocCallout title="Third-Party Open Source Libraries">
          React + TypeScript templates exported from Emdash use standard open-source community packages (such as React, Vite, Tailwind CSS, and Lucide icons) licensed under permissive MIT licenses. Always review <code>package.json</code> before distributing commercial desktop or compliance-sensitive builds.
        </DocCallout>
      </section>

      <section className="space-y-4">
        <DocHeading id="open-source-sponsors">
          Sponsors &amp; platform sustainability
        </DocHeading>
        <DocSubHeading>How free access is funded cleanly</DocSubHeading>
        <p className="text-muted-foreground">
          To offer 100 daily Dash Coins without surprise paywalls or hidden usage traps, Emdash displays static sponsor cards strictly on designated platform surfaces (the Home Composer Banner, Templates section, and Web Agent workspace). Sponsor slots do not run third-party programmatic bidding scripts, never inspect your private prompts, and never appear inside generated previews or exported archives.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="legal-contact">Compliance &amp; formal requests</DocHeading>
        <p className="text-muted-foreground">
          For data access, account deletion, security questionnaires, DMCA/intellectual property notices, or commercial terms clarification, write directly to{" "}
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
