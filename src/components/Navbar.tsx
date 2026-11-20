import type React from "react";
import { useEffect, useState } from "react";
import { ArrowUpRight, Moon, ShieldCheck, Sun } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Button } from "@/src/components/ui/button";
import { CornerBrackets } from "@/src/components/CornerBrackets";
import type { UserSession } from "@/src/types";
import { cn } from "@/src/lib/utils";

interface NavbarProps {
  mode: "home" | "workspace" | "admin" | "signin" | "signup" | "web" | "sponsorship" | "info";
  isDark: boolean;
  onToggleTheme: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  onGoHome: () => void;
  onOpenTemplates: () => void;
  onOpenWebAgent: () => void;
  onOpenSponsor?: () => void;
  onOpenWallet?: () => void;
  onOpenAdmin?: () => void;
  onOpenAuth: (authMode?: "signin" | "signup") => void;
  user: UserSession | null;
  walletBalance?: number;
}

export function Navbar({
  mode,
  isDark,
  onToggleTheme,
  onGoHome,
  onOpenTemplates,
  onOpenWebAgent,
  onOpenSponsor,
  onOpenAdmin,
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
    mode === "home" || mode === "signin" || mode === "signup" || mode === "sponsorship" || mode === "info"
      ? "md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
      : "max-w-full";

  const handleNavAction = (action: () => void) => {
    setMobileMenuOpen(false);
    action();
  };

  const isAdmin = user?.role === "admin";

  return (
    <MotionConfig reducedMotion="user">
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
            onClick={onOpenWebAgent}
            className={cn(
              "text-sm lg:text-[15px] tracking-tight font-sans transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer",
              mode === "web" ? "text-primary font-medium" : "text-foreground"
            )}
          >
            Web Agent
          </button>
          {onOpenSponsor && (
            <button
              type="button"
              onClick={onOpenSponsor}
              className={cn(
                "text-sm lg:text-[15px] tracking-tight font-sans transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer",
                mode === "sponsorship" ? "text-primary font-medium" : "text-foreground"
              )}
            >
              Sponsorship
            </button>
          )}
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className={cn(
                "inline-flex items-center gap-1 text-sm lg:text-[15px] tracking-tight font-sans transition-colors hover:text-primary whitespace-nowrap shrink-0 cursor-pointer",
                mode === "admin" ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <ShieldCheck className="size-3.5 text-primary" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 md:flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => onToggleTheme(e)}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="relative overflow-hidden size-8 sm:size-9 text-foreground hover:bg-transparent hover:text-primary shrink-0"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center justify-center"
                >
                  <Sun className="size-4" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: 60, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -60, scale: 0.6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex items-center justify-center"
                >
                  <Moon className="size-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavAction(() => onOpenAuth())}
              className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 border-edge bg-background hover:bg-muted font-mono uppercase text-[11px] sm:text-xs shrink-0"
            >
              <span className="size-5 bg-primary text-primary-foreground grid place-items-center text-[11px] font-mono font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[96px] truncate">
                {user.name}
              </span>
            </Button>
          ) : mode !== "signin" && mode !== "signup" ? (
            <Button
              size="sm"
              onClick={() => handleNavAction(() => onOpenAuth("signin"))}
              className="hidden md:inline-flex h-8 sm:h-9 px-2.5 sm:px-4 font-mono uppercase text-[11px] sm:text-xs shrink-0"
            >
              Sign in
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="size-8 sm:size-9 text-foreground hover:bg-transparent hover:text-primary md:hidden shrink-0 touch-manipulation"
          >
            <span aria-hidden="true" className="relative flex items-center justify-center size-4">
              <motion.span
                className="absolute h-[1.75px] w-4 bg-current"
                initial={false}
                animate={
                  mobileMenuOpen
                    ? { y: 0, rotate: 45 }
                    : { y: -3, rotate: 0 }
                }
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.span
                className="absolute h-[1.75px] w-4 bg-current"
                initial={false}
                animate={
                  mobileMenuOpen
                    ? { y: 0, rotate: -45 }
                    : { y: 3, rotate: 0 }
                }
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </Button>
        </div>
        </header>

        <div
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen || undefined}
          className={cn(
            "md:hidden grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            mobileMenuOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
          <nav
            aria-label="Mobile navigation"
            className={cn(
              "min-h-0 overflow-hidden relative mx-auto w-full border-x bg-card",
              mobileMenuOpen ? "border-b border-edge" : "border-b-0 border-edge",
              railWidthClass
            )}
          >
            <div className="grid grid-cols-1 divide-y divide-edge">
              <button
                type="button"
                onClick={() => handleNavAction(onGoHome)}
                className={cn(
                  "group flex items-center justify-between px-4 py-3 text-left text-sm font-sans transition-colors hover:bg-muted/60 cursor-pointer touch-manipulation",
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
                className="group flex items-center justify-between px-4 py-3 text-left text-sm font-sans text-foreground transition-colors hover:bg-muted/60 hover:text-primary cursor-pointer touch-manipulation"
              >
                <span>Templates</span>
                <span className="size-6 border border-edge bg-background grid place-items-center text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleNavAction(onOpenWebAgent)}
                className={cn(
                  "group flex items-center justify-between px-4 py-3 text-left text-sm font-sans transition-colors hover:bg-muted/60 cursor-pointer touch-manipulation",
                  mode === "web" ? "text-primary font-medium" : "text-foreground"
                )}
              >
                <span>Web Agent</span>
                <span
                  className={cn(
                    "size-6 border border-edge bg-background grid place-items-center transition-colors group-hover:border-primary group-hover:text-primary",
                    mode === "web" ? "border-primary/50 text-primary" : "text-muted-foreground"
                  )}
                >
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>
              {onOpenSponsor && (
                <button
                  type="button"
                  onClick={() => handleNavAction(onOpenSponsor)}
                  className={cn(
                    "group flex items-center justify-between px-4 py-3 text-left text-sm font-sans transition-colors hover:bg-muted/60 cursor-pointer touch-manipulation",
                    mode === "sponsorship" ? "text-primary font-medium" : "text-foreground"
                  )}
                >
                  <span>Sponsorship</span>
                  <span
                    className={cn(
                      "size-6 border border-edge bg-background grid place-items-center transition-colors group-hover:border-primary group-hover:text-primary",
                      mode === "sponsorship" ? "border-primary/50 text-primary" : "text-muted-foreground"
                    )}
                  >
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </button>
              )}
              {isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavAction(onOpenAdmin)}
                  className="group flex items-center justify-between px-4 py-3 text-left text-sm font-sans text-primary transition-colors hover:bg-muted/60 cursor-pointer touch-manipulation"
                >
                  <span>Admin</span>
                  <span className="size-6 border border-primary/50 bg-background grid place-items-center text-primary">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </button>
              )}
              {user ? (
                <div className="p-3 bg-background/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleNavAction(() => onOpenAuth())}
                    className="w-full h-9 justify-between border-edge bg-background hover:bg-muted font-mono uppercase text-xs"
                  >
                    <span className="truncate">{user.name}</span>
                    <span className="text-muted-foreground">Account</span>
                  </Button>
                </div>
              ) : (
                <div className="p-3 bg-background/50">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleNavAction(() => onOpenAuth("signin"))}
                    className="w-full h-9 font-mono uppercase text-xs"
                  >
                    Sign in
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>
    </MotionConfig>
  );
}
