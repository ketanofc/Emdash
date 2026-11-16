import { ArrowUpRight, LifeBuoy } from "lucide-react";
import { CornerBrackets } from "@/src/components/CornerBrackets";

export type DocSection =
  | "quickstart"
  | "prompting"
  | "quota"
  | "blog"
  | "privacy"
  | "terms"
  | "security";

interface FooterProps {
  onGoHome: () => void;
  onOpenTemplates?: () => void;
  onOpenDocs: (section?: DocSection) => void;
  onOpenSponsor: () => void;
}

type SocialKey = "x" | "github" | "discord" | "linkedin";

function SocialBrandIcon({ kind }: { kind: SocialKey }) {
  switch (kind) {
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    case "discord":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
      );
  }
}

const SOCIAL_LINKS: ReadonlyArray<{
  key: SocialKey;
  label: string;
  href: string;
}> = [
  {
    key: "x",
    label: "X (Twitter)",
    href: "https://x.com",
  },
  {
    key: "github",
    label: "GitHub",
    href: "https://github.com",
  },
  {
    key: "discord",
    label: "Discord",
    href: "https://discord.com",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "https://linkedin.com",
  },
];

export function Footer({
  onGoHome,
  onOpenDocs,
  onOpenSponsor,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full px-2 pb-2 sm:pb-4 bg-background">
      <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card">
        <CornerBrackets />

        <div className="grid grid-cols-2 lg:grid-cols-[1.6fr_1.1fr_0.9fr] gap-x-6 gap-y-8 px-4 sm:px-6 md:px-10 py-8 sm:py-10">
          {/* Brand Column */}
          <div className="col-span-2 lg:col-span-1 flex flex-col justify-between gap-5 min-w-0">
            <div>
              <button
                type="button"
                onClick={() => {
                  onGoHome();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1 font-semibold text-base tracking-tight text-foreground hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <img
                  src="/assets/emdash-logo.png"
                  alt=""
                  className="size-4.5 object-cover shrink-0"
                />
                <span>Emdash</span>
              </button>
              <p className="mt-3 text-xs sm:text-[13px] leading-relaxed text-muted-foreground max-w-sm">
                Build web apps, landing pages, and interactive tools from a single prompt. Free to start · Supported by ads.
              </p>
            </div>

            <nav aria-label="Footer product navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  onGoHome();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                Builder
              </button>
              <button
                type="button"
                onClick={onOpenSponsor}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                Sponsorship
              </button>
              <button
                type="button"
                onClick={() => onOpenDocs("blog")}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                Blog
              </button>
            </nav>
          </div>

          {/* Support Documentation Column */}
          <div className="col-span-1 min-w-0">
            <h2 className="text-xs font-semibold text-foreground tracking-tight mb-3">
              Support documentation
            </h2>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("quickstart")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left"
                >
                  <span>Quickstart guide</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("prompting")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left"
                >
                  <span>Prompting &amp; file uploads</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("quota")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left"
                >
                  <span>Daily quota &amp; export FAQ</span>
                </button>
              </li>
              <li>
                <a
                  href="mailto:support@emdash.build"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  <LifeBuoy className="size-3 shrink-0" aria-hidden="true" />
                  <span>Email support</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="col-span-1 min-w-0">
            <h2 className="text-xs font-semibold text-foreground tracking-tight mb-3">
              Legal
            </h2>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("privacy")}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left whitespace-nowrap"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("terms")}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left whitespace-nowrap"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenDocs("security")}
                  className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors py-1 cursor-pointer text-left whitespace-nowrap"
                >
                  Security
                </button>
              </li>
              <li>
                <a
                  href="/trust.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Trust Center (opens in a new tab)"
                  title="Trust Center (opens in a new tab)"
                  className="group inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 whitespace-nowrap"
                >
                  <span>Trust Center</span>
                  <ArrowUpRight
                    className="size-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 shrink-0"
                    aria-hidden="true"
                  />
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright & Social Icons Bar */}
        <div className="border-t border-edge px-4 sm:px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="tabular-nums">
            &copy; {currentYear} Emdash.
          </p>

          <nav aria-label="Social media" className="flex items-center gap-1.5">
            {SOCIAL_LINKS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                title={item.label}
                className="inline-flex items-center justify-center size-7 border border-edge bg-background text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              >
                <SocialBrandIcon kind={item.key} />
                <span className="sr-only">{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
