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
  { id: "preview-isolation", label: "1. Preview Sandbox Isolation" },
  { id: "key-cryptography", label: "2. Cryptography & Provider Vault" },
  { id: "auth-mfa", label: "3. Password Hashing, Sessions & Admin MFA" },
  { id: "secret-redaction", label: "4. Automated Secret Sanitization" },
  { id: "api-hardening", label: "5. API Boundaries & Rate Limiting" },
  { id: "disclosure", label: "6. Coordinated Vulnerability Disclosure" },
];

export function SecurityPage(props: DocsPageProps) {
  const { onSelectPage, onGoHome, onOpenWebAgent } = props;

  return (
    <DocsLayout
      page="security"
      toc={TOC}
      onSelectPage={onSelectPage}
      onGoHome={onGoHome}
      onOpenWebAgent={onOpenWebAgent}
    >
      <section className="space-y-4">
        <DocHeading id="preview-isolation">1. Preview sandbox isolation</DocHeading>
        <p className="text-muted-foreground">
          Generating and immediately rendering arbitrary HTML, CSS, and JavaScript inside a web workspace introduces cross-frame execution risks unless untrusted DOM output is strictly quarantined. Emdash executes all generated static bundles and React + TypeScript workspaces inside isolated Sandpack or sandboxed <code>&lt;iframe&gt;</code> containers.
        </p>
        <p className="text-muted-foreground">
          Code running inside a preview frame executes in a separate browser context, preventing generated scripts from reading parent Emdash session cookies, inspecting <code>localStorage</code> credentials (such as <code>emdash:web_agent_byok</code>), or issuing authenticated actions against control-plane endpoints. Runtime error listeners capture uncaught stack traces safely over structured frame boundaries exclusively to power zero-cost repair loops.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="key-cryptography">2. Cryptography &amp; provider key vault</DocHeading>
        <p className="text-muted-foreground">
          Managed AI provider keys configured for Emdash&apos;s primary Builder pipeline remain strictly server-side and are never shipped inside client Vite bundles. When administrators store or rotate upstream keys inside the Control Plane, keys are encrypted at rest using authenticated <strong>AES-256-GCM</strong> encryption via Node.js crypto primitives, using unique initialization vectors and authentication tags derived from the deployment&apos;s server-only <code>KEY_ENCRYPTION_SECRET</code>.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="auth-mfa">
          3. Password hashing, sessions &amp; Admin MFA
        </DocHeading>
        <DocSubHeading>Credential Storage &amp; Signed Cookies</DocSubHeading>
        <p className="text-muted-foreground">
          User passwords stored by Emdash&apos;s local authentication store are hashed with per-user random salts using memory-hard <strong>scrypt</strong> derivation and verified via constant-time buffer comparisons (<code>crypto.timingSafeEqual</code>) to mitigate timing side-channel attacks. Active browser sessions rely on Supabase Auth JWT verification or HMAC-SHA256 signed HTTP-only cookies.
        </p>
        <DocSubHeading>Privileged Control Plane Enforcement</DocSubHeading>
        <p className="text-muted-foreground">
          Access to <code>/admin</code> and its backend routes requires two independent checks: the authenticated user profile must hold explicit database role <code>admin</code>, and the active session must satisfy verified TOTP two-factor authentication (<strong>aal2</strong> assurance level). Signing in with password alone (<code>aal1</code>) is rejected with HTTP <code>403</code> across privileged endpoints until a valid 6-digit TOTP code is verified.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="secret-redaction">4. Automated secret sanitization</DocHeading>
        <p className="text-muted-foreground">
          Both server-side pipeline error handlers and the Web Agent multi-provider router scrub upstream HTTP exceptions and stack traces prior to returning responses to the client. Known provider API key formats (Gemini, OpenAI, Anthropic, OpenRouter), Authorization bearer headers, and internal secret strings are automatically masked so transient upstream failures cannot leak credentials into browser logs or toast notifications.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="api-hardening">5. API boundaries, RLS &amp; rate limiting</DocHeading>
        <p className="text-muted-foreground">
          Primary generation routes (<code>/api/generate</code>), wallet ledger updates, and administrative operations execute strictly through validated Express / serverless endpoints enforcing request payload caps, origin validation against configured <code>APP_URL</code> / <code>SITE_ORIGIN</code> origins, per-client rate limiting, and atomic coin ledger updates with automatic failure refunds. Read-only serverless filesystems gracefully fall back without crashing persistence layers.
        </p>
      </section>

      <section className="space-y-4">
        <DocHeading id="disclosure">6. Coordinated vulnerability disclosure</DocHeading>
        <p className="text-muted-foreground">
          We appreciate responsible reporting from independent security researchers and engineers. If you identify a sandbox escape, authentication bypass, privilege escalation path, or credential exposure risk, report it privately with clear reproduction steps to{" "}
          <a
            href="mailto:info@emdash.world"
            className="font-sans font-normal text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            info@emdash.world
          </a>
          . Please refrain from testing high-volume DoS traffic, modifying unrelated user data, or disclosing vulnerabilities publicly prior to remediation.
        </p>

        <DocCallout title="Trust Center Reference">
          Review a side-by-side matrix of client vs. server data residency on the{" "}
          <a
            href={INFO_PAGES.trust.path}
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
              onSelectPage("trust");
            }}
            className="text-foreground underline underline-offset-4 hover:text-[#c23a00] dark:hover:text-primary"
          >
            Trust Center
          </a>
          .
        </DocCallout>
      </section>
    </DocsLayout>
  );
}
