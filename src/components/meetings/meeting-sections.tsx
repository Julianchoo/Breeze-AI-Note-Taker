"use client";
import { type ReactNode, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { TranscriptSegment } from "@/lib/meeting-types";

/* Sections shared by the owner's meeting view and the public share page. */

/* Reading typography for the AI summary — the most editorial surface of the product. */
const PROSE =
  "max-w-[64ch] text-[0.9375rem] leading-[1.8] [&>*:first-child]:mt-0 " +
  "[&_h1]:font-display [&_h1]:mt-10 [&_h1]:mb-3 [&_h1]:text-3xl [&_h1]:leading-tight " +
  "[&_h2]:font-display [&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:leading-snug " +
  "[&_h3]:text-muted-foreground [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[0.6875rem] [&_h3]:font-medium [&_h3]:tracking-[0.18em] [&_h3]:uppercase " +
  "[&_p]:mb-5 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:mb-2 [&_li]:pl-1.5 [&_li]:leading-7 [&_li]:marker:text-primary " +
  "[&_strong]:text-foreground [&_strong]:font-semibold " +
  "[&_em]:italic " +
  "[&_a]:decoration-primary/40 [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:decoration-primary " +
  "[&_blockquote]:border-primary/40 [&_blockquote]:text-muted-foreground [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic " +
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] " +
  "[&_hr]:rule-fade [&_hr]:my-8 [&_hr]:h-px [&_hr]:border-0";

export function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
/* Replaces whole speaker labels with their display names in one pass. Longest-first alternation keeps
   "Part 2 · Speaker 1" whole; the letter/digit guards stop "Speaker 1" matching inside "Speaker 10". */
export function relabel(text: string, labels: string[], names: Record<string, string>) {
  if (!labels.length || !Object.keys(names).length) return text;
  names = { ...names };
  // The summary model tends to shorten "Part 1 · Speaker 1" to "Speaker 1"; accept that short form when unambiguous.
  const short = labels.map((label) => /^Part \d+ · (.+)$/.exec(label)?.[1]);
  short.forEach((alias, i) => {
    const label = labels[i]!;
    if (
      alias &&
      Object.hasOwn(names, label) &&
      !labels.includes(alias) &&
      short.filter((s) => s === alias).length === 1
    )
      names[alias] = names[label]!;
  });
  const alternatives = [...labels, ...Object.keys(names).filter((key) => !labels.includes(key))]
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
    "gu"
  );
  return text.replace(pattern, (label) => (Object.hasOwn(names, label) ? names[label]! : label));
}

export function SummaryProse({ summary, ref }: { summary: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={PROSE}>
      <ReactMarkdown>{summary}</ReactMarkdown>
    </div>
  );
}

/** The collapsible transcript. */
export function TranscriptList({
  segments,
  speakerNames,
  note,
}: {
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  note?: ReactNode;
}) {
  return (
    <section className="animate-fade-up" aria-labelledby="transcript-heading">
      <details className="group">
        <summary className="border-border hover:border-primary/30 flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors select-none sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="transcript-heading" className="font-display text-2xl">
              Full transcript
            </h2>
            {segments.length > 0 && (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {segments.length} segments
              </span>
            )}
          </div>
          <span
            className="bg-muted text-muted-foreground group-hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-open:rotate-180"
            aria-hidden="true"
          >
            <ChevronDown className="size-4" />
          </span>
        </summary>
        {note ? (
          <p className="text-muted-foreground my-6 max-w-prose text-xs leading-5">{note}</p>
        ) : (
          <div className="h-6" />
        )}
        {segments.length ? (
          <ol className="flex flex-col gap-1 pb-4">
            {segments.map((segment, index) => (
              <li
                key={`${segment.start}-${index}`}
                className="hover:bg-muted/50 -mx-3 grid gap-1 rounded-lg px-3 py-2.5 transition-colors sm:grid-cols-[7.5rem_1fr] sm:gap-5"
              >
                <div className="flex items-baseline gap-2.5 sm:flex-col sm:gap-1">
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {timestamp(segment.start)}
                  </span>
                  <span className="text-foreground/70 truncate text-[0.6875rem] font-medium tracking-[0.12em] uppercase">
                    {speakerNames[segment.speaker] || segment.speaker}
                  </span>
                </div>
                <p className="max-w-[62ch] text-[0.9375rem] leading-7">{segment.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground py-6 text-sm">
            The transcript will appear here as your audio is processed.
          </p>
        )}
      </details>
    </section>
  );
}
