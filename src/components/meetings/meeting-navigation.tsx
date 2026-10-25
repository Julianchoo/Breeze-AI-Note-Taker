"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListBulletsIcon, MicrophoneIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/* Routes that follow the landing system (DESIGN.md "Landing system"). Meeting detail pages keep the
   warm editorial tabs below, so the tabs match the page they sit on. */
const LANDING_ROUTES = new Set(["/meetings", "/meetings/new", "/meetings/history"]);

export function MeetingNavigation() {
  const pathname = usePathname();
  const recording = pathname === "/meetings" || pathname === "/meetings/new";
  const landing = LANDING_ROUTES.has(pathname);
  const tabs = [
    { href: "/meetings", label: "New meeting", icon: MicrophoneIcon, current: recording },
    { href: "/meetings/history", label: "My meetings", icon: ListBulletsIcon, current: !recording },
  ];

  if (landing) {
    return (
      // landing-island scopes the landing tokens (radius, dark surfaces) to the tabs, which render
      // in the meetings layout outside the page's .landing wrapper.
      <nav aria-label="Meeting navigation" className="landing-island flex justify-center px-4 pt-6 sm:pt-8">
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

  return (
    <nav aria-label="Meeting navigation" className="flex justify-center px-4 pt-6 sm:pt-8">
      <div className="bg-muted/60 inline-flex gap-1 rounded-full p-1">
        {tabs.map(({ href, label, current }) => (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "min-w-32 rounded-full px-5 py-2.5 text-center text-sm font-medium transition-colors",
              current
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
