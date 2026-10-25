"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListBulletsIcon, MicrophoneIcon } from "@phosphor-icons/react/dist/ssr";
import { useVirtualKeyboardOpen } from "@/lib/use-virtual-keyboard-open";
import { cn } from "@/lib/utils";

const HISTORY_ROUTE = "/meetings/history";

/* Every meetings route follows the landing system (DESIGN.md "Landing system"), meeting detail
   included. "New meeting" is current on the record screen and the recorder; "My meetings" on the
   list and on a meeting's detail page, which you reach from that list. */
export function MeetingNavigation() {
  const pathname = usePathname();
  const recording = pathname === "/meetings" || pathname === "/meetings/new";
  const tabs = [
    { href: "/meetings", label: "New meeting", icon: MicrophoneIcon, current: recording },
    { href: HISTORY_ROUTE, label: "My meetings", icon: ListBulletsIcon, current: !recording },
  ];

  return (
    <>
      {/* From sm up the tabs sit at the top of the page; below sm they move to the bottom bar. */}
      <LandingTopTabs tabs={tabs} />
      <BottomTabBar tabs={tabs} />
    </>
  );
}

type Tab = {
  href: string;
  label: string;
  icon: typeof MicrophoneIcon;
  current: boolean;
};

function LandingTopTabs({ tabs }: { tabs: Tab[] }) {
  return (
    // landing-island scopes the landing tokens (radius, dark surfaces) to the tabs, which render
    // in the meetings layout outside the page's .landing wrapper.
    <nav aria-label="Meeting navigation" className="meeting-tabs landing-island hidden justify-center px-4 pt-8 sm:flex">
      <div className="bg-card border-foreground/10 inline-flex gap-1 rounded-full border p-1 shadow-xs">
        {tabs.map(({ href, label, icon: Icon, current }) => (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "ease-fluid focus-visible:ring-ring/50 inline-flex min-w-36 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]",
              current
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon aria-hidden="true" weight={current ? "fill" : "regular"} className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* Phones: a floating glass pill fixed within thumb reach, in the landing style on every meetings
   route (including meeting detail). Its bottom offset and the matching page clearance live in
   globals.css ("Meetings bottom tab bar") so they can include the APK's reserved bottom inset. It
   slides away while the on-screen keyboard is open, and is inert then so focus cannot land on it. */
function BottomTabBar({ tabs }: { tabs: Tab[] }) {
  const keyboardOpen = useVirtualKeyboardOpen();
  return (
    <nav
      aria-label="Meeting navigation"
      inert={keyboardOpen}
      data-keyboard={keyboardOpen ? "open" : undefined}
      className={cn(
        "meeting-tabbar landing-island ease-fluid fixed inset-x-4 z-40 mx-auto max-w-sm transition-[translate,opacity] duration-500 sm:hidden",
        keyboardOpen && "pointer-events-none translate-y-24 opacity-0"
      )}
    >
      <div className="bg-background/70 border-foreground/10 flex gap-1 rounded-full border p-1 shadow-[0_16px_40px_-20px_color-mix(in_oklch,var(--foreground)_45%,transparent)] backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon, current }) => (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "ease-fluid focus-visible:ring-ring/50 inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-[background-color,color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]",
              current
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon aria-hidden="true" weight={current ? "fill" : "regular"} className="size-5 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
