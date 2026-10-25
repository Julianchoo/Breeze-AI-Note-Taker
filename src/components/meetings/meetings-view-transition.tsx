"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/* Animates page changes inside /meetings with the View Transitions API through React's
   <ViewTransition> (App Router ships React canary, which exports it; next.config enables
   experimental.viewTransition). Next runs navigations inside startTransition, which is what lets React
   call document.startViewTransition.

   Keying by pathname turns each navigation into an exit of the old page and an enter of the new one,
   styled by the meetings-page-* classes in globals.css. Every other transition update inside a page
   (router.refresh, server actions) falls under `default="none"` and does not animate. Browsers without
   document.startViewTransition simply swap the page, and reduced motion turns the animation off in CSS.
   The single wrapper div gives React one element to name, so the page moves as one layer. */
export function MeetingsViewTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="meetings-page-enter" exit="meetings-page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
