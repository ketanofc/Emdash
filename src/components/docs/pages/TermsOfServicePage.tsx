import {
  DocCallout,
  DocHeading,
  DocSubHeading,
  DocsLayout,
  type DocsPageProps,
  type TocItem,
} from "@/src/components/docs/DocsLayout";

const TOC: TocItem[] = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "code-ownership", label: "2. Ownership of Generated Code" },
  { id: "dash-coins", label: "3. Dash Coins & Failure Refunds" },
  { id: "sponsors-pro", label: "4. Free Sponsors & Pro Tier" },
  { id: "acceptable-use", label: "5. Acceptable Use & Rate Limits" },
  { id: "disclaimers", label: "6. Disclaimers & Liability" },
  { id: "contact", label: "7. Changes & Contact" },
];

export function TermsOfServicePage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="terms"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="acceptance">1. Acceptance of terms</DocHeading>
        <p className="text-muted-foreground">
          By accessing or using Emdash (<code>emdash.world</code>)—including the Home Builder (<code>/</code>), interactive Workspace, Sandpack/iframe preview environments, open-source Web Agent (<code>/web</code>), documentation portal, and account services—you agree to be bound by these Terms of Service. If you access Emdash on behalf of an organization, company, or client, you confirm that you have authority to accept these terms on that entity&apos;s behalf.
        </p>

        <DocCallout title="Zero Vendor Lock-In">
          Emdash does not require ongoing hosting subscriptions to keep software running. Generated archives export as standalone standard files under your full ownership.
        </DocCallout>
      </section>

      <section className="space-y-4">
        <DocHeading id="code-ownership">2. Ownership of generated code &amp; exports</DocHeading>
        <p className="text-muted-foreground">
          You retain full legal ownership of every application, stylesheet, script, component tree, and <code>.zip</code> archive synthesized in response to your prompts and reference files. Emdash claims no copyright, revenue share, or exclusive license over your generated code.
        </p>
        <p className="text-muted-foreground">
          You may freely modify, open-source, incorporate into proprietary commercial products, host on any external cloud provider, or transfer exported deliverables to clients without attribution requirements. However, because AI-synthesized code may integrate standard open-source frameworks (such as React, Tailwind CSS, Vite, or Lucide icons), you remain responsible for reviewing generated output, security-hardening backend integrations, and complying with third-party package licenses before shipping to production.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="dash-coins">3. Daily Dash Coins &amp; automatic refunds</DocHeading>
        <DocSubHeading>Daily Grants &amp; Consumption</DocSubHeading>
        <p className="text-muted-foreground">
          Each active builder account receives a daily allowance of <strong>100 Dash Coins</strong>, replenished automatically every 24 hours based on the configured UTC reset cycle. Standard generation runs deduct <strong>10 Dash Coins</strong> per build, while automated runtime error repair loops run at <strong>0 Dash Coins</strong>.
        </p>
        <DocSubHeading>Automatic Failure Refunds &amp; Non-Monetary Status</DocSubHeading>
        <p className="text-muted-foreground">
          If an initiated generation fails before delivering a usable build because of upstream model rate limits, capacity saturation, malformed parser errors, or network timeouts, Emdash automatically credits the spent Dash Coins back to your wallet ledger. Dash Coins are internal platform metering credits only; they possess zero monetary value, are non-transferable, and cannot be redeemed for cash.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="sponsors-pro">4. Sponsor-supported Free tier &amp; Pro tier</DocHeading>
        <p className="text-muted-foreground">
          To keep core application creation accessible free of charge without hidden paywalls, free Emdash sessions display clearly identified static sponsor placements on designated host surfaces. Sponsor banners never inject third-party advertising code into generated previews or exported archives. Users on paid Pro plans have sponsor placements suppressed across the Builder and Workspace interfaces.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="acceptable-use">5. Acceptable use &amp; platform integrity</DocHeading>
        <p className="text-muted-foreground">
          You agree to use Emdash responsibly and lawfully. Specifically, you must not use Emdash or its Web Agent to:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
          <li>
            Generate malware, ransomware, credential-harvesting phishing pages, deceptive impersonation clones, or automated exploitation scripts.
          </li>
          <li>
            Circumvent Dash Coin quotas, forge session cookies, automate bulk scraping against <code>/api/*</code> routes, or abuse shared inference capacity.
          </li>
          <li>
            Attempt unauthorized access to administrative routes (<code>/admin</code>), bypass TOTP MFA enforcement, or test disruptive payloads outside coordinated disclosure.
          </li>
          <li>
            Upload illegal, infringing, or confidential third-party materials without proper authorization.
          </li>
        </ul>
        <p className="text-muted-foreground">
          Emdash reserves the right to rate-limit or suspend accounts that violate acceptable use or degrade platform availability for other builders.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="disclaimers">6. Availability, warranties &amp; limitation of liability</DocHeading>
        <p className="text-muted-foreground">
          Emdash is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without express or implied warranties regarding uninterrupted availability, output suitability for regulated medical/financial/legal systems, or absence of bugs in AI-generated source code. To the fullest extent permitted by applicable law, Emdash shall not be liable for indirect, incidental, or consequential damages arising from reliance on generated code, browser storage resets, or third-party AI provider outages.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="contact">7. Updates &amp; contact</DocHeading>
        <p className="text-muted-foreground">
          We may revise these Terms of Service as platform capabilities evolve; material changes will be reflected with an updated effective date at the top of this page. For questions regarding commercial usage, account suspension appeals, or licensing, contact{" "}
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
