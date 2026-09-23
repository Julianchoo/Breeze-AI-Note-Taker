"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic, Plus, Search, TriangleAlert } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting, MeetingStatus } from "@/lib/meeting-types";
import { usd } from "@/lib/utils";

/** One readable label + tone per status, so the row scans at a glance. */
const STATUS: Record<MeetingStatus, { label: string; variant: BadgeProps["variant"] }> = {
  ready: { label: "Ready", variant: "success" },
  processing: { label: "Preparing", variant: "secondary" },
  recording: { label: "Recording", variant: "destructive" },
  error: { label: "Needs attention", variant: "destructive" },
};

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
  const filtered = meetings?.filter((meeting) =>
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
              aria-label="Search meetings by title, date, or status"
              placeholder="Search meetings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-lg pl-10"
            />
          </div>
          {meetings && (
            <p className="text-muted-foreground font-mono text-xs tabular-nums" aria-live="polite">
              {query
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

        {error ? (
          <div
            role="alert"
            className="animate-fade-in border-destructive/25 bg-destructive/5 mt-8 flex flex-col items-start gap-4 rounded-xl border p-6 sm:p-8"
          >
            <TriangleAlert className="text-destructive size-5" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl">We could not load your meetings</h2>
              <p className="text-muted-foreground max-w-md text-sm leading-6">{error}</p>
            </div>
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : !meetings ? (
          <div
            role="status"
            aria-label="Loading meetings"
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
                      <h2 className="group-hover:text-primary truncate font-medium transition-colors">
                        {meeting.title}
                      </h2>
                      <p className="text-muted-foreground mt-1.5 truncate font-mono text-xs tabular-nums">
                        {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        · {Math.ceil(meeting.durationSeconds / 60)} min
                      </p>
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
                  ? "No meeting matches this search. Try another title, date, or status."
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
