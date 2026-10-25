"use client";

import { useEffect, useRef } from "react";

/* Large tagline whose words brighten from a muted tone to full ink, one at a time in reading order,
   as they cross a trigger line (DESIGN.md "Landing system").
   Like Reveal, the muted state is only applied by this effect, so without JS or with reduced motion
   the tagline renders at full contrast. */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/* The trigger line sits at 65% of the viewport height. */
const TRIGGER_MARGIN = "0px 0px -35% 0px";
/* Words that cross the line together (one visual line) still light one after another. */
const WORD_STEP_MS = 70;

type TaglineRevealProps = {
  id: string;
  /** Each entry is one line on wide screens; break where the thought breaks. */
  lines: readonly string[];
};

export function TaglineReveal({ id, lines }: TaglineRevealProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window) || matchMedia(REDUCED_MOTION).matches) return;

    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-word]"));
    for (const word of words) word.dataset.lit = "false";

    const eligible = new Set<number>();
    let next = 0;
    let timer: number | undefined;

    // Lights the next word in reading order, then keeps going while the following word is also due.
    const advance = () => {
      timer = undefined;
      const word = words[next];
      if (!word || !eligible.has(next)) return;
      word.dataset.lit = "true";
      next += 1;
      if (eligible.has(next)) timer = window.setTimeout(advance, WORD_STEP_MS);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Words already scrolled past the top (e.g. after a reload mid page) count as crossed too.
          const passed = entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0);
          if (!entry.isIntersecting && !passed) continue;
          const target = entry.target as HTMLElement;
          eligible.add(Number(target.dataset.word));
          observer.unobserve(target);
        }
        if (timer === undefined) advance();
      },
      { rootMargin: TRIGGER_MARGIN }
    );
    for (const word of words) observer.observe(word);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const word of words) delete word.dataset.lit;
    };
  }, []);

  const wordLines = lines.map((line) => line.split(" "));
  // Global reading order index of each line's first word.
  const offsets = wordLines.map((_, line) =>
    wordLines.slice(0, line).reduce((total, words) => total + words.length, 0)
  );

  return (
    <h2
      id={id}
      ref={ref}
      className="max-w-170 text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
    >
      {wordLines.map((words, line) => (
        <span key={line} className="block">
          {words.map((word, position) => (
            <span
              key={position}
              data-word={offsets[line]! + position}
              className="ease-fluid data-[lit=false]:text-foreground/30 transition-colors duration-700"
            >
              {word}{" "}
            </span>
          ))}
        </span>
      ))}
    </h2>
  );
}
