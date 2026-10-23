"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MeetingNavigation() {
  const pathname = usePathname();
  const recording = pathname === "/meetings" || pathname === "/meetings/new";

  return (
    <nav aria-label="Meeting navigation" className="flex justify-center px-4 pt-6 sm:pt-8">
      <div className="bg-muted/60 inline-flex gap-1 rounded-full p-1">
        {[
          { href: "/meetings", label: "New meeting", current: recording },
          { href: "/meetings/history", label: "My meetings", current: !recording },
        ].map(({ href, label, current }) => (
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
