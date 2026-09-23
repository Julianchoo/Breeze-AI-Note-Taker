"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic, Plus, Search, TriangleAlert } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting, MeetingStatus, SearchResult } from "@/lib/meeting-types";
import { findMatch } from "@/lib/search-text";
import { usd } from "@/lib/utils";

/** One readable label + tone per status, so the row scans at a glance. */
const STATUS: Record<MeetingStatus, { label: string; variant: BadgeProps["variant"] }> = {
  ready: { label: "Ready", variant: "success" },
  review: { label: "Ready to process", variant: "outline" },
  processing: { label: "Preparing", variant: "secondary" },
  recording: { label: "Recording", variant: "destructive" },
  error: { label: "Needs attention", variant: "destructive" },
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
    <div className="glow-bg">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <header className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Your workspace</p>
            <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl">My meetings</h1>
            <p className="text-muted-foreground max-w-md text-sm leading-6 sm:text-base">
              Conversations worth coming back to.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/meetings/new">
              <Plus aria-hidden="true" />
              New Meeting
            </Link>
          </Button>
        </header>

        <div className="mt-10 h-px rule-fade sm:mt-14" />

        <div className="animate-fade-up mt-6 flex flex-col gap-3 [animation-delay:80ms] sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              aria-label="Search meetings by title, summary, or transcript"
              placeholder="Search meetings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-lg pl-10"
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
            className="animate-fade-in border-destructive/25 bg-destructive/5 mt-8 flex flex-col items-start gap-4 rounded-xl border p-6 sm:p-8"
          >
            <TriangleAlert className="text-destructive size-5" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl">
                {error ? "We could not load your meetings" : "We could not search your meetings"}
              </h2>
              <p className="text-muted-foreground max-w-md text-sm leading-6">{shownError}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (error) return setAttempt((n) => n + 1);
                setSearch((s) => ({ ...s, term: "" }));
                setSearchAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : !meetings || searchLoading ? (
          <div
            role="status"
            aria-label={searchLoading ? "Searching meetings" : "Loading meetings"}
            aria-busy="true"
            className="border-border/70 mt-8 divide-y border-y"
          >
            {[0, 1, 2].map((n) => (
              <div key={n} className="flex items-center gap-4 py-5">
                <Skeleton className="hidden size-10 shrink-0 rounded-lg sm:block" />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <Skeleton className="h-4 w-1/2 max-w-56" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                <Skeleton className="size-4 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered?.length ? (
          <ul className="border-border/70 animate-fade-up mt-8 divide-y border-y [animation-delay:120ms]">
            {filtered.map((meeting) => {
              const status = STATUS[meeting.status];
              return (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="group hover:bg-accent/40 -mx-3 flex items-center gap-3 rounded-lg px-3 py-5 transition-colors sm:gap-4"
                  >
                    <div className="bg-muted group-hover:bg-primary/10 hidden size-10 shrink-0 items-center justify-center rounded-lg transition-colors sm:flex">
                      <Mic
                        className="text-muted-foreground group-hover:text-primary size-4 transition-colors"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        className={`group-hover:text-primary truncate transition-colors ${searching ? "font-semibold" : "font-medium"}`}
                      >
                        {meeting.title}
                      </h2>
                      <p className="text-muted-foreground mt-1.5 truncate font-mono text-xs tabular-nums">
                        {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {"durationSeconds" in meeting && ` · ${Math.ceil(meeting.durationSeconds / 60)} min`}
                      </p>
                      {"excerpt" in meeting && meeting.excerpt && (
                        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-6">
                          <Highlight text={meeting.excerpt} query={search.term} />
                        </p>
                      )}
                    </div>
                    <Badge variant={status.variant} className="shrink-0">
                      {meeting.status === "recording" && (
                        <span
                          className="bg-destructive animate-pulse-ring size-1.5 shrink-0 rounded-full"
                          aria-hidden="true"
                        />
                      )}
                      {status.label}
                    </Badge>
                    <ArrowUpRight
                      className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="animate-fade-up border-border/70 mt-8 flex flex-col items-center gap-5 rounded-2xl border border-dashed px-6 py-16 text-center sm:py-24">
            <span className="bg-muted flex size-14 items-center justify-center rounded-full">
              {query ? (
                <Search className="text-muted-foreground size-6" aria-hidden="true" />
              ) : (
                <Mic className="text-primary size-6" aria-hidden="true" />
              )}
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl sm:text-3xl">
                {query ? "Nothing matches that" : "Make room for the conversation"}
              </h2>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-6">
                {query
                  ? searching
                    ? "No title, summary, or transcript mentions this. Try another word."
                    : "No meeting matches this search. Try another title, date, or status."
                  : "Record your first meeting and it will be waiting here — summary, transcript, and audio, all in one place."}
              </p>
            </div>
            {!query && (
              <Button asChild size="lg" className="mt-1">
                <Link href="/meetings/new">
                  <Mic aria-hidden="true" />
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
