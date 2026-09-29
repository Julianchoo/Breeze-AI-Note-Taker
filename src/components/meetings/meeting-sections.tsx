"use client";
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { AudioLines, ChevronDown, TriangleAlert } from "lucide-react";
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

export type AudioPlayerHandle = { seek: (seconds: number) => void };
/** The owner's Recording section: one WAV streamed from OneDrive through a redirecting `src`. */
export function AudioPlayer({ src, ref }: { src: string; ref?: Ref<AudioPlayerHandle> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  const resumeAt = useRef<number | null>(null);
  useImperativeHandle(ref, () => ({
    seek(seconds: number) {
      const element = audio.current;
      if (!element) return;
      if (element.readyState === 0) resumeAt.current = seconds;
      else element.currentTime = seconds;
      void element.play().catch(() => {});
    },
  }));
  return (
    <section className="animate-fade-up mb-12 flex flex-col gap-4" aria-labelledby="audio-heading">
      <h2 id="audio-heading" className="font-display flex items-center gap-2.5 text-2xl">
        <AudioLines className="text-muted-foreground size-5" aria-hidden="true" />
        Recording
      </h2>
      <div className="border-border bg-card rounded-2xl border p-3 sm:p-4">
        <audio
          ref={audio}
          controls
          preload="metadata"
          // The query only forces a fresh request: the redirect target expires after about an hour.
          src={attempt ? `${src}?retry=${attempt}` : src}
          className="w-full [color-scheme:light] dark:[color-scheme:dark]"
          onLoadedMetadata={() => {
            retried.current = false;
            setFailed(false);
            if (audio.current && resumeAt.current !== null) {
              audio.current.currentTime = resumeAt.current;
              resumeAt.current = null;
            }
          }}
          onError={() => {
            // One silent retry (e.g. an expired OneDrive link), resuming where playback stopped.
            if (retried.current) return setFailed(true);
            retried.current = true;
            resumeAt.current = audio.current?.currentTime || null;
            setAttempt((n) => n + 1);
          }}
        />
      </div>
      <p className="text-muted-foreground text-xs leading-5">
        Played from your OneDrive. Select a transcript timestamp to jump straight to that moment.
      </p>
      {failed && (
        <p
          role="alert"
          className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-3 rounded-xl border p-4 text-sm leading-6"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Could not play the audio from OneDrive. Reconnect OneDrive from your account menu and
          reload.
        </p>
      )}
    </section>
  );
}

/** The collapsible transcript. Timestamps are buttons only when `onSeek` is given. */
export function TranscriptList({
  segments,
  speakerNames,
  onSeek,
  note,
}: {
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  onSeek?: ((seconds: number) => void) | undefined;
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
                  {onSeek ? (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary rounded font-mono text-xs tabular-nums underline-offset-4 transition-colors hover:underline"
                      onClick={() => onSeek(segment.start)}
                      aria-label={`Play audio at ${timestamp(segment.start)}`}
                    >
                      {timestamp(segment.start)}
                    </button>
                  ) : (
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {timestamp(segment.start)}
                    </span>
                  )}
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
