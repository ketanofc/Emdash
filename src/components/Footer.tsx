import { ArrowUpRight, LifeBuoy, Megaphone } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";

export type DocSection =
  | "quickstart"
  | "prompting"
  | "quota"
  | "privacy"
  | "terms"
  | "security";

interface FooterProps {
  onGoHome: () => void;
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
  onOpenDocs: (section?: DocSection) => void;
  onOpenSponsor: () => void;
}

const SOCIAL_LINKS = [
  {
    label: "X (Twitter)",
    href: "https://x.com",
    handle: "@emdashbuild",
  },
  {
    label: "GitHub",
    href: "https://github.com",
    handle: "emdash-build",
  },
  {
    label: "Discord",
    href: "https://discord.com",
    handle: "Community",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    handle: "emdash",
  },
] as const;

export function Footer({
  onGoHome,
  onOpenTemplates,
  onOpenPricing,
  onOpenDocs,
  onOpenSponsor,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full px-2 pb-2 sm:pb-4 bg-background">
      <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card">
        <CornerBrackets />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_1.05fr_0.85fr_0.95fr_1.35fr] gap-x-6 gap-y-8 px-4 sm:px-6 md:px-10 py-8 sm:py-10">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex flex-col justify-between gap-5 min-w-0">
            <div>
              <button
                type="button"
                onClick={() => {
                  onGoHome();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2.5 font-semibold text-base tracking-tight text-foreground hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <img
                  src="/assets/emdash-logo.png"
                  alt=""
                  className="size-6 object-cover shrink-0"
                />
                <span>Emdash</span>
              </button>
              <p className="mt-3 text-xs sm:text-[13px] leading-relaxed text-muted-foreground max-w-sm">
                Build web apps, landing pages, and interactive tools from a single prompt. Five free hours daily, supported by transparent sponsors.
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
                onClick={onOpenTemplates}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                Templates
              </button>
              <button
                type="button"
                onClick={onOpenPricing}
                className="text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                Pricing
              </button>
            </nav>
          </div>

          {/* Support Documentation Column */}
          <div className="col-span-2 sm:col-span-1 min-w-0">
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

          {/* Social Media Column */}
          <div className="col-span-1 min-w-0">
            <h2 className="text-xs font-semibold text-foreground tracking-tight mb-3">
              Social media
            </h2>
            <ul className="space-y-1.5">
              {SOCIAL_LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${item.label} (${item.handle})`}
                    className="group inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1 whitespace-nowrap"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight
                      className="size-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
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

          {/* Sponsor a Slot Column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 min-w-0">
            <div className="border border-dashed border-edge bg-background p-4 flex flex-col justify-between gap-3 h-full">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground tracking-tight">
                  <Megaphone className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>Sponsor a slot</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Feature your developer tool or hosting platform directly below the builder composer or inside the template grid.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenSponsor}
                className="w-full sm:w-auto justify-between gap-2 border-edge bg-card hover:border-primary hover:text-primary text-xs font-medium cursor-pointer"
              >
                <span>Sponsor a slot</span>
                <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="border-t border-edge px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <p className="tabular-nums">
            &copy; {currentYear} Emdash. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
