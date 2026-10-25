"use client";
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import {
  CaretDownIcon,
  PlayIcon,
  TextAlignLeftIcon,
  WarningIcon,
  WaveformIcon,
} from "@phosphor-icons/react/dist/ssr";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { TranscriptSegment } from "@/lib/meeting-types";
import { timestamp } from "@/lib/search-text";

export { relabel, timestamp } from "@/lib/search-text";

/* Sections shared by the owner's meeting view and the public share page. The owner's view follows the
   landing system (DESIGN.md "Landing system"); the public share page keeps the warm editorial system, so
   the shared sections take a `variant` and default to the editorial look. */
export type SectionVariant = "editorial" | "landing";

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

/* Landing reading typography: Geist only, Tailwind type steps with their own line heights, no italics,
   flat surfaces (quotes sit on a band well instead of a single sided border). */
const LANDING_PROSE =
  "max-w-prose text-base text-pretty [&>*:first-child]:mt-0 " +
  "[&_h1]:mt-10 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-balance " +
  "[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-balance " +
  "[&_h3]:text-primary [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_p]:mb-4 [&_p:last-child]:mb-0 " +
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:mb-2 [&_li]:pl-1 [&_li]:marker:text-primary " +
  "[&_strong]:text-foreground [&_strong]:font-semibold " +
  "[&_em]:font-medium [&_em]:not-italic " +
  "[&_a]:text-primary [&_a]:decoration-primary/40 [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:decoration-primary " +
  "[&_blockquote]:bg-band [&_blockquote]:text-muted-foreground [&_blockquote]:my-4 [&_blockquote]:rounded-xl [&_blockquote]:px-4 [&_blockquote]:py-3 " +
  "[&_code]:bg-muted [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm " +
  "[&_hr]:bg-border [&_hr]:my-8 [&_hr]:h-px [&_hr]:border-0";

export function SummaryProse({
  summary,
  ref,
  variant = "editorial",
}: {
  summary: string;
  ref?: Ref<HTMLDivElement>;
  variant?: SectionVariant;
}) {
  return (
    <div ref={ref} className={variant === "landing" ? LANDING_PROSE : PROSE}>
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
    // Owner only, so it always follows the landing system. Outer 24px radius, 12px padding: 12px well.
    <section className="bg-card rounded-3xl border p-3 shadow-xs" aria-labelledby="audio-heading">
      <div className="flex items-center gap-3 px-3 pt-3">
        <WaveformIcon className="text-primary size-5 shrink-0" aria-hidden="true" />
        <h2 id="audio-heading" className="text-2xl font-semibold tracking-tight">
          Recording
        </h2>
      </div>
      <div className="bg-band mt-4 rounded-xl p-3">
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
      <p className="text-muted-foreground px-3 pt-3 pb-2 text-sm text-pretty">
        Played from your OneDrive. Select a transcript timestamp to jump straight to that moment.
      </p>
      {failed && (
        <p
          role="alert"
          className="border-destructive/25 bg-destructive/5 text-destructive mt-2 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
        >
          <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
  variant = "editorial",
}: {
  segments: TranscriptSegment[];
  speakerNames: Record<string, string>;
  onSeek?: ((seconds: number) => void) | undefined;
  note?: ReactNode;
  variant?: SectionVariant;
}) {
  if (variant === "landing")
    return (
      // Outer 24px radius, 12px padding: the disclosure row and segment rows take 12px.
      <section
        id="transcript"
        className="bg-card animate-landing-rise scroll-mt-[calc(var(--sticky-top)+4.5rem)] rounded-3xl border p-3 shadow-xs [animation-delay:160ms]"
        aria-labelledby="transcript-heading"
      >
        <details className="group/transcript">
          <summary className="ease-fluid hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 transition-colors duration-300 select-none focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <TextAlignLeftIcon className="text-primary size-5 shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="transcript-heading" className="text-2xl font-semibold tracking-tight">
                Full transcript
              </h2>
              {segments.length > 0 && (
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {segments.length} segments
                </span>
              )}
            </div>
            <CaretDownIcon
              className="text-muted-foreground ease-fluid size-5 shrink-0 transition-transform duration-300 group-open/transcript:rotate-180"
              aria-hidden="true"
            />
          </summary>
          {note ? (
            <p className="text-muted-foreground max-w-prose px-3 pt-2 pb-4 text-sm text-pretty">
              {note}
            </p>
          ) : (
            <div className="h-4" />
          )}
          {segments.length ? (
            <ol className="flex flex-col gap-1">
              {segments.map((segment, index) => (
                <li
                  key={`${segment.start}-${index}`}
                  className="ease-fluid hover:bg-band grid gap-2 rounded-xl px-3 py-3 transition-colors duration-300 sm:grid-cols-[8rem_1fr] sm:gap-6"
                >
                  <div className="flex min-w-0 items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                    <span className="truncate text-sm font-semibold">
                      {speakerNames[segment.speaker] || segment.speaker}
                    </span>
                    {onSeek ? (
                      <button
                        type="button"
                        className="bg-card text-muted-foreground ease-fluid hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:ring-ring/50 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-3 font-mono text-xs tabular-nums transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
                        onClick={() => onSeek(segment.start)}
                        aria-label={`Play audio at ${timestamp(segment.start)}`}
                      >
                        <PlayIcon weight="fill" className="size-3" aria-hidden="true" />
                        {timestamp(segment.start)}
                      </button>
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {timestamp(segment.start)}
                      </span>
                    )}
                  </div>
                  <p className="max-w-prose text-base text-pretty">{segment.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground px-3 pb-3 text-sm text-pretty">
              The transcript will appear here as your audio is processed.
            </p>
          )}
        </details>
      </section>
    );
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
