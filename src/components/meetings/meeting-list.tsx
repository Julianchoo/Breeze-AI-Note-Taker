"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting } from "@/lib/meeting-types";

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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            Your workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">My meetings</h1>
          <p className="text-muted-foreground mt-3 text-sm">Conversations worth coming back to.</p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">
            <Plus data-icon="inline-start" />
            New Meeting
          </Link>
        </Button>
      </div>
      <div className="mb-6 flex items-center gap-3">
        <Search className="text-muted-foreground size-4" aria-hidden="true" />
        <Input
          aria-label="Search meetings by title, date, or status"
          placeholder="Search meetings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        {meetings && (
          <span className="text-muted-foreground ml-auto text-xs">
            {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
          </span>
        )}
      </div>
      {error ? (
        <div role="alert" className="flex flex-col items-start gap-4 py-12">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !meetings ? (
        <div aria-label="Loading meetings" className="flex flex-col gap-4">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered?.length ? (
        <ul className="divide-y border-y">
          {filtered.map((meeting) => (
            <li key={meeting.id}>
              <Link
                href={`/meetings/${meeting.id}`}
                className="group hover:bg-muted/40 flex items-center gap-4 py-6 transition-colors sm:px-3"
              >
                <div className="bg-muted hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex">
                  <Mic className="text-muted-foreground size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">{meeting.title}</h2>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {Math.ceil(meeting.durationSeconds / 60)} min
                  </p>
                </div>
                <Badge variant={meeting.status === "error" ? "destructive" : "secondary"}>
                  {meeting.status === "ready"
                    ? "Ready"
                    : meeting.status === "processing"
                      ? "Preparing"
                      : meeting.status === "recording"
                        ? "Recording"
                        : "Needs attention"}
                </Badge>
                <ArrowUpRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-20 text-center">
          <Mic className="text-muted-foreground size-8" aria-hidden="true" />
          <h2 className="text-lg font-medium">
            {query ? "No matching meetings" : "Make room for the conversation"}
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm leading-6">
            {query
              ? "Try a different title, date, or status."
              : "Start your first meeting. Your summary, transcript, and recording will be waiting here."}
          </p>
          {!query && (
            <Button variant="outline" asChild>
              <Link href="/meetings/new">Record a meeting</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
