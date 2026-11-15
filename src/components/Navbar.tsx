import { useEffect, useState } from "react";
import { ArrowUpRight, Moon, Sun, X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import type { UserSession } from "@/src/types";
import { cn } from "@/src/lib/utils";

interface NavbarProps {
  mode: "home" | "workspace";
  isDark: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onOpenTemplates: () => void;
  onOpenPricing: () => void;
  onOpenModels: () => void;
  onOpenAuth: () => void;
  user: UserSession | null;
}

export function Navbar({
  mode,
  isDark,
  onToggleTheme,
  onGoHome,
  onOpenTemplates,
  onOpenPricing,
  onOpenModels,
  onOpenAuth,
  user,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const railWidthClass =
    mode === "home"
      ? "md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
      : "max-w-full";

  const handleNavAction = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  return (
    <aside className="sticky top-0 z-40 w-full max-w-full shrink-0 overflow-x-clip bg-background px-2 pt-2">
      <header
        className={cn(
          "screen-line-before screen-line-after relative mx-auto flex h-12 sm:h-14 w-full min-w-0 max-w-full items-center justify-between gap-1.5 sm:gap-2 border-x border-edge bg-card px-2.5 sm:px-4 md:gap-4",
          railWidthClass
        )}
      >
        <CornerBrackets />

        <div className="flex min-w-0 items-center justify-start md:flex-1">
          <button
            type="button"
            onClick={() => handleNavAction(onGoHome)}
            aria-label="Emdash home"
            className="flex items-center gap-1 sm:gap-1.5 font-semibold text-sm sm:text-base tracking-tight px-1 py-1 hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src="/assets/emdash-logo.png"
              alt=""
              className="size-4 sm:size-5 object-cover shrink-0"
            />
            <span>Emdash</span>
          </button>
        </div>

        <nav
          className="hidden md:flex items-center gap-5 lg:gap-6 justify-center shrink-0"
          aria-label="Primary"
        >
          <button
            type="button"
            onClick={onGoHome}
            className={cn(
              "text-sm lg:text-[15px] tracking-tight font-sans transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer",
              mode === "home" ? "text-primary font-medium" : "text-foreground"
            )}
          >
            Home
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="text-sm lg:text-[15px] tracking-tight font-sans text-foreground transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={onOpenPricing}
            className="text-sm lg:text-[15px] tracking-tight font-sans text-foreground transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pricing
          </button>
        </nav>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 md:flex-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="size-8 sm:size-9 border-edge bg-background hover:bg-muted shrink-0"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavAction(onOpenAuth)}
              className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 border-edge bg-background hover:bg-muted font-mono uppercase text-[11px] sm:text-xs shrink-0"
            >
              <span className="size-5 bg-primary text-primary-foreground grid place-items-center text-[11px] font-mono font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[96px] truncate">
                {user.name}
              </span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleNavAction(onOpenAuth)}
              className="h-8 sm:h-9 px-2.5 sm:px-4 font-mono uppercase text-[11px] sm:text-xs shrink-0"
            >
              Sign in
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="size-8 sm:size-9 border-edge bg-background hover:bg-muted md:hidden shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="size-4" />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="square"
                className="size-4"
              >
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
              </svg>
            )}
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className={cn(
            "md:hidden relative mx-auto w-full border-x border-b border-edge bg-card",
            railWidthClass
          )}
        >
          <div className="grid grid-cols-1 divide-y divide-edge">
            <button
              type="button"
              onClick={() => handleNavAction(onGoHome)}
              className={cn(
                "group flex items-center justify-between px-4 py-3 text-left text-sm font-sans transition-colors hover:bg-muted/60 cursor-pointer",
                mode === "home" ? "text-primary font-medium" : "text-foreground"
              )}
            >
              <span>Home</span>
              <span
                className={cn(
                  "size-6 border border-edge bg-background grid place-items-center transition-colors group-hover:border-primary group-hover:text-primary",
                  mode === "home" ? "border-primary/50 text-primary" : "text-muted-foreground"
                )}
              >
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNavAction(onOpenTemplates)}
              className="group flex items-center justify-between px-4 py-3 text-left text-sm font-sans text-foreground transition-colors hover:bg-muted/60 hover:text-primary cursor-pointer"
            >
              <span>Templates</span>
              <span className="size-6 border border-edge bg-background grid place-items-center text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNavAction(onOpenPricing)}
              className="group flex items-center justify-between px-4 py-3 text-left text-sm font-sans text-foreground transition-colors hover:bg-muted/60 hover:text-primary cursor-pointer"
            >
              <span>Pricing</span>
              <span className="size-6 border border-edge bg-background grid place-items-center text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNavAction(onOpenModels)}
              className="group flex items-center justify-between px-4 py-3 text-left text-sm font-sans text-foreground transition-colors hover:bg-muted/60 hover:text-primary cursor-pointer"
            >
              <span>Models</span>
              <span className="size-6 border border-edge bg-background grid place-items-center text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          </div>
        </nav>
      )}
    </aside>
  );
}
