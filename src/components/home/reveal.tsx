"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Scroll reveal for the home page (landing system, DESIGN.md "Home page").
   Progressive enhancement: the server renders content fully visible, and only this effect hides it
   (via `data-reveal`), so pages without JS, with reduced motion, or without IntersectionObserver
   never hide anything. React never renders `data-reveal`, so it does not fight the DOM writes. */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/* Reveal a little before the element reaches the bottom edge, not the instant one pixel shows. */
const ROOT_MARGIN = "0px 0px -10% 0px";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger in ms, for siblings that should arrive one after another. */
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window) || matchMedia(REDUCED_MOTION).matches) return;
    // Already on screen at mount: hiding it now would flash content the reader can already see.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    node.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        node.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.reveal;
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "ease-fluid transition-[opacity,translate,filter] duration-1000",
        "data-[reveal=hidden]:translate-y-16 data-[reveal=hidden]:opacity-0 data-[reveal=hidden]:blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}
