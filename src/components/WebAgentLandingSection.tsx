import { Play } from "lucide-react";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import { WEB_URL } from "@/src/data/webMock";

interface WebAgentLandingSectionProps {
  onOpenWebAgent: () => void;
}

export function WebAgentLandingSection({ onOpenWebAgent }: WebAgentLandingSectionProps) {
  return (
    <>
      {/* Web Agent Landing Section */}
      <section aria-labelledby="web-agent-heading" className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-background px-2.5 sm:px-4 md:px-10 py-12 md:py-16">
          <CornerBrackets />

          <div className="max-w-2xl space-y-5">
            <div>
              <div className="font-mono uppercase text-xs text-primary mb-2">
                Web Agent
              </div>

              <h2
                id="web-agent-heading"
                className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground text-balance"
              >
                Code with an agent, right in your browser.
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-2">
                Connect GitHub and let the open-source Emdash Web Agent read, edit, and test your repo. Free, no coins, supported by sponsors only.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={WEB_URL}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenWebAgent();
                }}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-primary text-primary-foreground hover:opacity-90 font-mono uppercase text-xs font-medium transition-opacity whitespace-nowrap"
              >
                <Play className="size-3.5 fill-current" />
                <span>Open Web Agent</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Diagonal Hatch Strip */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>
    </>
  );
}
