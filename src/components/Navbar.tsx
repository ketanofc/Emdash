import { Moon, Sun } from "lucide-react";
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
  onOpenAuth,
  user,
}: NavbarProps) {

  return (
    <aside className="sticky top-0 z-40 shrink-0 bg-background px-2 pt-2">
      <header
        className={cn(
          "screen-line-before screen-line-after relative mx-auto flex h-14 w-full items-center justify-between gap-2 border-x border-edge bg-card px-4 sm:gap-4",
          mode === "home"
            ? "md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
            : "max-w-full"
        )}
      >
        <CornerBrackets />

        <div className="flex flex-1 items-center justify-start">
          <button
            type="button"
            onClick={onGoHome}
            aria-label="Emdash home"
            className="flex items-center gap-2.5 font-semibold text-base tracking-tight px-1 py-1 hover:opacity-85 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="size-6 bg-primary text-primary-foreground grid place-items-center font-mono font-bold leading-none pb-0.5 text-sm">
              —
            </span>
            <span>Emdash</span>
          </button>
        </div>

        <nav
          className="hidden md:flex items-center gap-6 justify-center"
          aria-label="Primary"
        >
          <button
            type="button"
            onClick={onGoHome}
            className={cn(
              "text-[15px] tracking-tight font-sans transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer",
              mode === "home" ? "text-primary font-medium" : "text-foreground"
            )}
          >
            Home
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="text-[15px] tracking-tight font-sans text-foreground transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer"
          >
            Templates
          </button>
          <button
            type="button"
            onClick={onOpenPricing}
            className="text-[15px] tracking-tight font-sans text-foreground transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pricing
          </button>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="size-9 border-edge bg-background hover:bg-muted"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>

          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAuth}
              className="h-9 px-3 gap-2 border-edge bg-background hover:bg-muted font-mono uppercase text-xs"
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
              onClick={onOpenAuth}
              className="h-9 px-4 font-mono uppercase text-xs"
            >
              Sign in
            </Button>
          )}
        </div>
      </header>
    </aside>
  );
}
