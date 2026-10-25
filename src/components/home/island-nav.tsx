"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  DeviceMobileIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  WindIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useTheme } from "next-themes";
import { hasAndroidRecorder } from "@/lib/native-android-recorder";
import { cn } from "@/lib/utils";

/* Home only header: the landing system's floating "fluid island" (skill B7, DESIGN.md "Home page").
   A glass pill detached from the top that stays put while the page scrolls, plus a menu button whose
   two lines morph into an X and open a full screen glass overlay with staggered links.
   Every other route keeps SiteHeader; HeaderSwitch chooses between them by pathname. */

const subscribeNoop = () => () => {};
/* True only after hydration, so theme dependent labels never mismatch the server markup. */
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Each overlay item slides up from an invisible box, one after another (skill B7 "staggered mask
   reveal"). Static class names so Tailwind can see them; closing drops the delays so items leave together. */
const STAGGER = [
  "delay-100",
  "delay-150",
  "delay-200",
  "delay-250",
  "delay-300",
  "delay-350",
] as const;

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

/* Shared look for the small round controls inside the pill: 40px targets on a 56px pill (8px inset),
   so the nested radius stays concentric. */
const PILL_CONTROL =
  "ease-fluid text-foreground/80 hover:bg-foreground/5 hover:text-foreground flex h-10 items-center justify-center rounded-full transition-[background-color,color,scale] duration-300 active:scale-[0.98]";

function Logo({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link
      href="/"
      aria-label="Breeze home"
      aria-current="page"
      onClick={onNavigate}
      className="group ease-fluid flex h-10 items-center gap-2 rounded-full pr-3 pl-1 transition-[scale] duration-300 active:scale-[0.98]"
    >
      <span className="bg-primary text-primary-foreground ease-fluid flex size-8 items-center justify-center rounded-full transition-transform duration-700 group-hover:rotate-12">
        <WindIcon weight="bold" className="size-4" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight">breeze</span>
    </Link>
  );
}

/* One tap switch between light and dark in the pill; the menu offers the full three way choice. */
function PillThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className={cn(PILL_CONTROL, "w-10")}
      aria-label={mounted ? `Switch to ${dark ? "light" : "dark"} theme` : "Switch theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {/* CSS picks the icon, so the first paint is right before the theme is known in JS. */}
      <SunIcon className="size-5 dark:hidden" aria-hidden="true" />
      <MoonIcon className="hidden size-5 dark:block" aria-hidden="true" />
    </button>
  );
}

function ThemeChoice({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("bg-foreground/5 flex w-max gap-1 rounded-full p-1", className)}
    >
      {THEMES.map(({ value, label, icon: ThemeIcon }) => {
        const checked = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(value)}
            className={cn(
              "ease-fluid flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow,scale] duration-300 active:scale-[0.98]",
              checked
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ThemeIcon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function IslandNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const installed = useSyncExternalStore(subscribeNoop, hasAndroidRecorder, () => false);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // While open: lock page scroll, trap Tab inside the header (pill + overlay), close on Escape.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const previous = {
      overflow: root.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    root.style.overflow = "hidden";
    // Fill the space the scrollbar leaves behind so the page does not jump sideways.
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    firstLinkRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !headerRef.current) return;
      const items = Array.from(headerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.getClientRects().length > 0
      );
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !headerRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !headerRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previous.overflow;
      document.body.style.paddingRight = previous.paddingRight;
    };
  }, [open, close]);

  /* In page anchors: close first so the scroll lock is gone, then scroll and move focus to the section. */
  const goToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    close(false);
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
      history.replaceState(null, "", `#${id}`);
    });
  };

  const links = [
    { href: "/login", label: "Sign in" },
    {
      href: "/android",
      label: installed ? "Update Android app" : "Android app",
      icon: DeviceMobileIcon,
    },
    { href: "#how-it-works", label: "How it works", section: "how-it-works" },
    { href: "#faq", label: "Questions", section: "faq" },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="focus:bg-background sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:p-3"
      >
        Skip to content
      </a>
      <header
        ref={headerRef}
        className="island-nav landing-island pointer-events-none sticky top-0 z-40 px-4"
      >
        <nav
          aria-label="Main navigation"
          className={cn(
            "pointer-events-auto relative z-10 mx-auto mt-6 flex w-max items-center gap-2 rounded-full border p-2 backdrop-blur-xl",
            "ease-fluid transition-[background-color,box-shadow,border-color] duration-700",
            open
              ? "border-transparent bg-transparent shadow-none"
              : "bg-background/70 border-foreground/10 shadow-[0_16px_40px_-24px_color-mix(in_oklch,var(--foreground)_45%,transparent)]"
          )}
        >
          <Logo onNavigate={() => close(false)} />
          <span className="bg-foreground/10 mx-2 hidden h-6 w-px sm:block" aria-hidden="true" />
          <div className="hidden items-center gap-1 sm:flex">
            <PillThemeButton />
            <Link href="/login" className={cn(PILL_CONTROL, "px-4 text-sm font-semibold")}>
              Sign in
            </Link>
          </div>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
            className={cn(PILL_CONTROL, "bg-foreground/5 relative ml-4 w-10 sm:ml-0")}
          >
            {/* Two lines that rotate and meet in the middle as an X; they never just disappear. */}
            <span
              aria-hidden="true"
              className={cn(
                "bg-foreground ease-fluid absolute left-3 h-0.5 w-4 rounded-full transition-transform duration-700",
                open ? "translate-y-0 rotate-45" : "-translate-y-1"
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "bg-foreground ease-fluid absolute left-3 h-0.5 w-4 rounded-full transition-transform duration-700",
                open ? "translate-y-0 -rotate-45" : "translate-y-1"
              )}
            />
          </button>
        </nav>

        <div
          id={menuId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!open}
          className={cn(
            "island-menu fixed inset-0 z-0 overflow-y-auto bg-white/80 px-6 pt-24 pb-12 backdrop-blur-3xl dark:bg-black/80",
            "ease-fluid transition-opacity duration-700",
            open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <div className="mx-auto flex w-full max-w-md flex-col gap-10 pt-6">
            <ul className="flex flex-col gap-2">
              {links.map(({ href, label, icon: LinkIcon, section }, index) => (
                <li key={href} className="overflow-hidden">
                  <Link
                    ref={index === 0 ? firstLinkRef : undefined}
                    href={href}
                    onClick={(event) => (section ? goToSection(event, section) : close(false))}
                    className={cn(
                      "group ease-fluid flex items-center justify-between gap-4 rounded-xl py-2 text-4xl font-semibold tracking-tight transition-[translate,opacity] duration-700",
                      open
                        ? cn("translate-y-0 opacity-100", STAGGER[index])
                        : "translate-y-12 opacity-0"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {label}
                      {LinkIcon && (
                        <LinkIcon className="text-muted-foreground size-6" aria-hidden="true" />
                      )}
                    </span>
                    <ArrowRightIcon
                      className="text-muted-foreground group-hover:text-primary ease-fluid size-6 transition-[translate,color] duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <div
              className={cn(
                "ease-fluid flex flex-col gap-3 transition-[translate,opacity] duration-700",
                open
                  ? cn("translate-y-0 opacity-100", STAGGER[links.length])
                  : "translate-y-12 opacity-0"
              )}
            >
              <p className="text-muted-foreground text-sm font-semibold">Theme</p>
              <ThemeChoice />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
