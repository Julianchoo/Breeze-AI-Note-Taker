"use client";
import { EyeOff } from "lucide-react";
import {
  relabel,
  SummaryProse,
  timestamp,
  TranscriptList,
} from "@/components/meetings/meeting-sections";
import type { SharedMeeting } from "@/lib/meeting-types";

/** Read-only public view; the server only sends the sections the owner shared. */
export function SharedMeetingView({ meeting }: { meeting: SharedMeeting }) {
  const { segments } = meeting;
  const summary = meeting.summary && relabel(meeting.summary, meeting.labels, meeting.speakerNames);
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <header className="animate-fade-up mb-10 flex flex-col gap-5">
          <p className="eyebrow">Shared meeting</p>
          <h1 className="font-display min-w-0 text-4xl leading-[1.1] break-words sm:text-5xl">
            {meeting.title}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            {/* Server and browser locales/time zones can differ. */}
            <time
              dateTime={meeting.createdAt}
              className="font-mono tabular-nums"
              suppressHydrationWarning
            >
              {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span className="font-mono tabular-nums">{timestamp(meeting.durationSeconds)}</span>
          </p>
          <div className="rule-fade h-px" />
        </header>

        {meeting.summary !== undefined && (
          <section
            className="border-border bg-card animate-fade-up mb-12 rounded-2xl border p-6 sm:p-10"
            aria-labelledby="summary-heading"
          >
            <p className="eyebrow mb-2">The takeaway</p>
            <h2 id="summary-heading" className="font-display mb-7 text-3xl">
              Meeting summary
            </h2>
            {summary ? (
              <SummaryProse summary={summary} />
            ) : (
              <p className="text-muted-foreground max-w-prose text-sm leading-6">
                The summary is not ready yet.
              </p>
            )}
          </section>
        )}

        {segments && <TranscriptList segments={segments} speakerNames={meeting.speakerNames} />}

        {meeting.summary === undefined && !segments && (
          <div className="border-border/70 animate-fade-up flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-16 text-center sm:py-24">
            <span className="bg-muted flex size-14 items-center justify-center rounded-full">
              <EyeOff className="text-muted-foreground size-6" aria-hidden="true" />
            </span>
            <h2 className="font-display text-2xl sm:text-3xl">Nothing shared yet</h2>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-6">
              The owner of this meeting has not shared its summary or transcript.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
