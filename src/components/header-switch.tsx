"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/* The public home (/) gets its own floating island nav (landing system, DESIGN.md "Home page");
   every other route keeps the standard SiteHeader passed as children. usePathname returns the same
   value during server rendering and hydration, so there is no mismatch and no swap after load. */
export function HeaderSwitch({ home, children }: { home: ReactNode; children: ReactNode }) {
  return usePathname() === "/" ? home : children;
}
