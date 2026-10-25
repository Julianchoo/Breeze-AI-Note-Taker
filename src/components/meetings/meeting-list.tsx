"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwiseIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  CloudCheckIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  SparkleIcon,
  UploadSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting, MeetingStatus, SearchResult } from "@/lib/meeting-types";
import { findMatch } from "@/lib/search-text";
import { usd } from "@/lib/utils";
import type { Icon } from "@phosphor-icons/react";

/** One readable label, tone and icon per status, so the row scans at a glance and never relies on color
 * alone. Recording has no icon: it shows a pulsing dot instead. */
const STATUS: Record<
  MeetingStatus,
  { label: string; variant: BadgeProps["variant"]; icon?: Icon }
> = {
  ready: { label: "Ready", variant: "success", icon: CheckCircleIcon },
  review: { label: "Ready to process", variant: "outline", icon: SparkleIcon },
  processing: { label: "Preparing", variant: "secondary", icon: CircleNotchIcon },
  recording: { label: "Recording", variant: "destructive" },
  error: { label: "Needs attention", variant: "destructive", icon: WarningIcon },
};

/** Marks the first accent-insensitive match of `query` in `text`. */
function Highlight({ text, query }: { text: string; query: string }) {
  const match = findMatch(text, query);
  if (!match) return text;
  return (
    <>
      {text.slice(0, match[0])}
      <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">{text.slice(...match)}</mark>
      {text.slice(match[1])}
    </>
  );
}

export function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/meetings", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load meetings.");
        setMeetings(data.meetings);
        setError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message || "Could not load meetings.");
      });
    return () => controller.abort();
  }, [attempt]);
  // 2+ chars: search titles, summaries and transcripts on the server instead of filtering the list.
  const term = query.trim();
  const searching = term.length >= 2;
  const [search, setSearch] = useState<{ term: string; results: SearchResult[]; error: string }>({ term: "", results: [], error: "" });
  const [searchAttempt, setSearchAttempt] = useState(0);
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/meetings/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Search failed.");
          setSearch({ term, results: data.results, error: "" });
        })
        .catch((error) => {
          if (!controller.signal.aborted) setSearch({ term, results: [], error: error.message || "Search failed." });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, searchAttempt]);
  const searchLoading = searching && search.term !== term;
  const shownError = error || (searching && !searchLoading ? search.error : "");
  const filtered: (Meeting | SearchResult)[] | undefined = searching ? search.results : meetings?.filter((meeting) =>
    `${meeting.title} ${new Date(meeting.createdAt).toLocaleDateString()} ${meeting.status}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  return (
    <div className="landing">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16 sm:pb-24">
        <header className="animate-landing-rise flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-primary text-sm font-semibold">Your workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">My meetings</h1>
            <p className="text-muted-foreground max-w-md text-base text-pretty">
              Conversations worth coming back to.
            </p>
          </div>
          <Link
            href="/meetings/new"
            className="bg-card ease-fluid hover:bg-accent focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-xs transition-[background-color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
          >
            <UploadSimpleIcon className="text-muted-foreground size-4" aria-hidden="true" />
            Upload a recording
          </Link>
        </header>

        <div className="animate-landing-rise mt-10 flex flex-col gap-3 [animation-delay:80ms] sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <MagnifyingGlassIcon
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              aria-label="Search meetings by title, summary, or transcript"
              placeholder="Search meetings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="bg-card dark:bg-card ease-fluid h-12 rounded-full pl-10 duration-300"
            />
          </div>
          {meetings && (
            <p className="text-muted-foreground font-mono text-xs tabular-nums" aria-live="polite">
              {searchLoading
                ? "Searching…"
                : searching
                ? `${filtered?.length ?? 0} ${filtered?.length === 1 ? "result" : "results"}`
                : query
                ? `${filtered?.length ?? 0} of ${meetings.length} meetings`
                : `${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"}`}
              {" · "}
              {Math.round(
                meetings.filter((m) => m.status === "ready").reduce((n, m) => n + m.durationSeconds, 0) / 60
              )}{" "}
              min processed · {usd(meetings.reduce((n, m) => n + (m.costUsd ?? 0), 0))} AI cost
            </p>
          )}
        </div>

        {shownError ? (
          <div
            role="alert"
            className="animate-landing-fade border-destructive/25 bg-destructive/5 mt-6 flex flex-col items-start gap-4 rounded-3xl border p-6 sm:p-8"
          >
            <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
              <WarningIcon className="size-6" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                {error ? "We could not load your meetings" : "We could not search your meetings"}
              </h2>
              <p className="text-muted-foreground max-w-md text-sm text-pretty">{shownError}</p>
            </div>
            <Button
              variant="outline"
              className="ease-fluid font-semibold duration-300"
              onClick={() => {
                if (error) return setAttempt((n) => n + 1);
                setSearch((s) => ({ ...s, term: "" }));
                setSearchAttempt((n) => n + 1);
              }}
            >
              <ArrowClockwiseIcon />
              Try again
            </Button>
          </div>
        ) : !meetings || searchLoading ? (
          <div
            role="status"
            aria-label={searchLoading ? "Searching meetings" : "Loading meetings"}
            aria-busy="true"
            className="mt-6 flex flex-col gap-3"
          >
            {[0, 1, 2].map((n) => (
              <div key={n} className="bg-card flex items-center gap-4 rounded-3xl border p-3 shadow-xs">
                <Skeleton className="hidden size-12 shrink-0 rounded-xl sm:block" />
                <div className="flex min-w-0 flex-1 flex-col gap-2 py-1 pl-2 sm:py-0 sm:pl-0">
                  <Skeleton className="h-4 w-1/2 max-w-56" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <Skeleton className="mr-2 size-4 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered?.length ? (
          <ul className="animate-landing-rise mt-6 flex flex-col gap-3 [animation-delay:160ms]">
            {filtered.map((meeting) => {
              const status = STATUS[meeting.status];
              const StatusIcon = status.icon;
              return (
                <li key={meeting.id}>
                  {/* Outer 24px radius, 12px padding: the icon well takes 12px. */}
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="group bg-card ease-fluid hover:border-foreground/20 focus-visible:ring-ring/50 flex items-center gap-4 rounded-3xl border p-3 shadow-xs transition-[translate,box-shadow,border-color] duration-500 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_color-mix(in_oklch,var(--foreground)_45%,transparent)] focus-visible:ring-[3px] focus-visible:outline-none active:translate-y-0"
                  >
                    <div className="bg-band group-hover:bg-primary/10 ease-fluid hidden size-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 sm:flex">
                      <MicrophoneIcon
                        className="text-muted-foreground group-hover:text-primary ease-fluid size-5 transition-colors duration-300"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1 pl-2 sm:pl-0">
                      <h2 className="truncate text-base font-semibold">{meeting.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-muted-foreground font-mono text-xs tabular-nums">
                          {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {"durationSeconds" in meeting && ` · ${Math.ceil(meeting.durationSeconds / 60)} min`}
                        </p>
                        <Badge variant={status.variant} className="shrink-0">
                          {meeting.status === "recording" ? (
                            <span
                              className="bg-destructive animate-pulse-ring size-1.5 shrink-0 rounded-full"
                              aria-hidden="true"
                            />
                          ) : StatusIcon ? (
                            <StatusIcon
                              aria-hidden="true"
                              weight={meeting.status === "ready" ? "fill" : "regular"}
                              className={meeting.status === "processing" ? "animate-spin" : undefined}
                            />
                          ) : null}
                          {status.label}
                        </Badge>
                      </div>
                      {"hasAudio" in meeting && meeting.hasAudio ? (
                        <p className="text-success mt-1 flex items-center gap-1 text-xs">
                          <CloudCheckIcon className="size-4" aria-hidden="true" />
                          Saved in OneDrive
                        </p>
                      ) : null}
                      {"excerpt" in meeting && meeting.excerpt && (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                          <Highlight text={meeting.excerpt} query={search.term} />
                        </p>
                      )}
                    </div>
                    <ArrowUpRightIcon
                      className="text-muted-foreground group-hover:text-primary ease-fluid mr-2 size-4 shrink-0 transition-[color,translate] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="animate-landing-rise bg-card mt-6 flex flex-col items-center gap-6 rounded-3xl border border-dashed px-6 py-16 text-center sm:py-24">
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              {query ? (
                <MagnifyingGlassIcon className="size-6" aria-hidden="true" />
              ) : (
                <MicrophoneIcon weight="fill" className="size-6" aria-hidden="true" />
              )}
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {query ? "Nothing matches that" : "Make room for the conversation"}
              </h2>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
                {query
                  ? searching
                    ? "No title, summary, or transcript mentions this. Try another word."
                    : "No meeting matches this search. Try another title, date, or status."
                  : "Record your first meeting and its summary, transcript and audio will be waiting here."}
              </p>
            </div>
            {!query && (
              <Button
                asChild
                className="ease-fluid h-auto px-4 py-2 text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Link href="/meetings/new?record=1" prefetch={false}>
                  <MicrophoneIcon weight="fill" aria-hidden="true" />
                  Record a meeting
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
