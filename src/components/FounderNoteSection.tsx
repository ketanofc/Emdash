import { useState } from "react";
import { CornerBrackets } from "@/src/components/CornerBrackets";

export function FounderNoteSection() {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <>
      <section aria-label="Founder quote" className="w-full px-2">
        <div className="screen-line-before screen-line-after relative w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card px-4 sm:px-6 md:px-10 py-10 md:py-14">
          <CornerBrackets />

          <figure className="w-full space-y-6">
            <div className="space-y-2.5">
              <span
                aria-hidden="true"
                className="block font-sans text-3xl sm:text-4xl font-semibold leading-none tracking-tight text-[#c23a00] dark:text-primary select-none"
              >
                &ldquo;
              </span>

              <blockquote className="text-sm sm:text-[15px] leading-[1.65] tracking-[-0.005em] text-foreground/90">
                <p>
                  &ldquo;Every great product started as a sentence someone wasn&rsquo;t sure they could build. Emdash exists for that moment. You describe it, we build it in front of you, and you own the code from the first line. We named it after the Emdash because it connects one thought to the next. That&rsquo;s the whole job: connect what you imagine to what exists. It stays free because sponsors can cover the costs. It stays open source because you should be able to read how your builder works. And it stays honest: no hidden limits, no surprise paywall.&rdquo;
                </p>
              </blockquote>
            </div>

            <figcaption className="pt-5 border-t border-edge flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 border border-edge bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {!avatarFailed ? (
                    <img
                      src="/assets/ketan-avatar.jpg"
                      alt="Ketan"
                      width={40}
                      height={40}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="font-mono text-xs font-semibold text-[#b53600] dark:text-[#ff7833]"
                    >
                      K
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold tracking-tight text-foreground">
                    KETAN
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    Founder &amp; CEO
                  </div>
                </div>
              </div>

              <a
                href="https://x.com/ketanofc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ketan on X (Twitter)"
                title="Ketan on X (Twitter)"
                className="inline-flex items-center justify-center size-8 border border-edge bg-background text-muted-foreground hover:text-[#c23a00] dark:hover:text-primary hover:border-[#c23a00] dark:hover:border-primary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="sr-only">X (Twitter)</span>
              </a>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Bottom Diagonal Hatch Strip */}
      <div className="w-full px-2">
        <div className="relative flex h-8 md:h-10 w-full min-w-0 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto border-x border-edge bg-card hatch-pattern" />
      </div>
    </>
  );
}
