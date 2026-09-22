"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AudioLines,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CHUNK_SECONDS, type MeetingDetail } from "@/lib/meeting-types";

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

function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
function usd(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  });
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "This request could not be completed.");
  return data;
}
export function MeetingDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [audioIndex, setAudioIndex] = useState(0);
  const [audioError, setAudioError] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const playNext = useRef(false);
  const endpoint = `/api/meetings/${id}`;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setError("");
        let data = await request<MeetingDetail>(endpoint, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setDetail(data);
        if (data.meeting.status !== "processing" && !(retry > 0 && data.meeting.status === "error"))
          return;
        setProcessing(true);
        for (;;) {
          const result = await request<{ remaining: number; busy?: boolean }>(
            `${endpoint}/process`,
            { method: "POST", signal: controller.signal }
          );
          if (controller.signal.aborted) return;
          data = await request<MeetingDetail>(endpoint, { signal: controller.signal });
          if (controller.signal.aborted) return;
          setDetail(data);
          if (result.remaining === 0) break;
          if (result.busy) await new Promise((resolve) => setTimeout(resolve, 2000));
          if (controller.signal.aborted) return;
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : "Could not load the meeting.");
          try {
            const data = await request<MeetingDetail>(endpoint, { signal: controller.signal });
            if (!controller.signal.aborted) setDetail(data);
          } catch {
            /* Preserve the last loaded meeting. */
          }
        }
      } finally {
        if (!controller.signal.aborted) setProcessing(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, retry]);

  async function saveTitle() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setDetail((current) =>
        current ? { ...current, meeting: { ...current.meeting, title: title.trim() } } : current
      );
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save title.");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setDeleting(true);
    try {
      await request(endpoint, { method: "DELETE" });
      router.replace("/meetings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete meeting.");
      setDeleting(false);
    }
  }
  async function recover() {
    if (!detail) return;
    setSaving(true);
    try {
      await request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          expectedChunks: detail.chunks.length,
          durationSeconds: detail.chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0),
        }),
      });
      setRetry((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not finish recording.");
    } finally {
      setSaving(false);
    }
  }
  function seek(seconds: number) {
    if (!detail?.chunks.length) return;
    const chunk = detail.chunks.find(
      (chunk) =>
        seconds >= chunk.index * CHUNK_SECONDS &&
        seconds < chunk.index * CHUNK_SECONDS + chunk.durationSeconds
    );
    if (!chunk) return;
    const offset = seconds - chunk.index * CHUNK_SECONDS;
    if (chunk.index === audioIndex && audio.current) {
      audio.current.currentTime = offset;
      void audio.current.play().catch(() => setAudioError("Press play to listen to this moment."));
    } else {
      pendingSeek.current = offset;
      playNext.current = true;
      setAudioIndex(chunk.index);
      setAudioError("");
    }
  }
  if (!detail)
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        {error ? (
          <div className="animate-fade-up mx-auto flex max-w-md flex-col items-center gap-6 text-center">
            <span
              className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <TriangleAlert className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-3xl">We could not open this meeting</h2>
              <p role="alert" className="text-muted-foreground text-sm leading-6">
                {error}
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                <RotateCcw />
                Try again
              </Button>
              <Link
                href="/meetings"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to my meetings
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading your meeting</span>
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-11 w-3/4 rounded-xl" />
            <Skeleton className="h-4 w-56 rounded-full" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        )}
      </div>
    );
  const { meeting, chunks, segments } = detail;
  const completed = chunks.filter((chunk) => chunk.status === "ready").length;
  /* The summary counts as the final step, so the bar never sits at 100% while it is still writing. */
  const totalSteps = chunks.length + 1;
  const percent = Math.round((completed / totalSteps) * 100);
  const separator = (
    <span aria-hidden="true" className="text-border">
      ·
    </span>
  );
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <Link
          href="/meetings"
          className="text-muted-foreground hover:text-foreground group mb-10 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft
            className="size-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          My meetings
        </Link>

        <header className="animate-fade-up mb-10 flex flex-col gap-5">
          {editing ? (
            <form
              className="animate-scale-in border-border bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                void saveTitle();
              }}
            >
              <label htmlFor="meeting-title" className="sr-only">
                Meeting title
              </label>
              <Input
                id="meeting-title"
                autoFocus
                maxLength={160}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="font-display h-11 min-w-0 flex-1 border-0 bg-transparent text-2xl shadow-none focus-visible:ring-0"
                placeholder="Name this meeting"
              />
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  disabled={saving || !title.trim()}
                  type="submit"
                  size="icon"
                  aria-label="Save title"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Check />}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <h1 className="font-display min-w-0 text-4xl leading-[1.1] break-words sm:text-5xl">
              {meeting.title}
            </h1>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <Badge
              variant={
                meeting.status === "error"
                  ? "destructive"
                  : meeting.status === "ready"
                    ? "success"
                    : "secondary"
              }
            >
              {meeting.status === "processing" && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {meeting.status === "ready"
                ? "Ready"
                : meeting.status === "processing"
                  ? "Preparing your notes"
                  : meeting.status === "recording"
                    ? "Recording not finalized"
                    : "Needs attention"}
            </Badge>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
              <time dateTime={meeting.createdAt} className="font-mono tabular-nums">
                {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              {separator}
              <span className="font-mono tabular-nums">{timestamp(meeting.durationSeconds)}</span>
              {meeting.costUsd !== null && (
                <>
                  {separator}
                  <span>
                    <span className="font-mono tabular-nums">{usd(meeting.costUsd)}</span> AI cost
                  </span>
                </>
              )}
            </p>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!editing && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit meeting title"
                  onClick={() => {
                    setTitle(meeting.title);
                    setEditing(true);
                  }}
                >
                  <Pencil />
                </Button>
              )}
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete meeting"
                    disabled={processing}
                  >
                    <Trash2 />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete this meeting?</DialogTitle>
                    <DialogDescription>
                      This permanently deletes the summary, transcript, and saved audio. This cannot
                      be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteOpen(false)}
                      disabled={deleting}
                    >
                      Keep meeting
                    </Button>
                    <Button variant="destructive" onClick={remove} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete meeting"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="rule-fade h-px" />
        </header>

        {(processing || meeting.status === "processing") && (
          <section
            aria-live="polite"
            className="border-border bg-card animate-fade-up mb-10 rounded-2xl border p-6 sm:p-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display flex items-center gap-2.5 text-2xl">
                <span
                  className="bg-primary/70 size-2 shrink-0 animate-pulse rounded-full"
                  aria-hidden="true"
                />
                {completed === chunks.length ? "Writing your summary" : "Preparing the transcript"}
              </h2>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {percent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-valuenow={completed}
              aria-valuetext={`${completed} of ${chunks.length} audio parts transcribed`}
              className="bg-muted mt-5 h-1.5 w-full overflow-hidden rounded-full"
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-4 max-w-prose text-sm leading-6">
              <span className="text-foreground font-mono tabular-nums">
                {completed}/{chunks.length}
              </span>{" "}
              audio parts transcribed. Keep this page open to continue; reopen it any time to resume
              where it left off.
            </p>
          </section>
        )}

        {(error || meeting.status === "error") && (
          <div
            role="alert"
            className="border-destructive/25 bg-destructive/8 animate-fade-up mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-6"
          >
            <p className="text-destructive flex max-w-xl items-start gap-3 text-sm leading-6">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {error ||
                meeting.error ||
                "We could not finish your notes. Your saved audio is still safe."}
            </p>
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => setRetry((value) => value + 1)}
            >
              <RotateCcw />
              Try again
            </Button>
          </div>
        )}

        {meeting.status === "recording" && (
          <section className="border-border bg-card animate-fade-up mb-10 flex flex-col items-start gap-4 rounded-2xl border p-6 sm:p-7">
            <p className="eyebrow">Unfinished</p>
            <h2 className="font-display text-2xl">Finish a saved recording</h2>
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              If recording is still open in another tab, finish it there. If it was interrupted, you
              can prepare notes from the {chunks.length} saved audio{" "}
              {chunks.length === 1 ? "part" : "parts"}. Unsaved audio cannot be recovered here.
            </p>
            <Button disabled={saving || chunks.length === 0} onClick={recover}>
              Finish saved recording
            </Button>
          </section>
        )}

        <section
          className="border-border bg-card animate-fade-up mb-12 rounded-2xl border p-6 sm:p-10"
          aria-labelledby="summary-heading"
        >
          <p className="eyebrow mb-2">The takeaway</p>
          <h2 id="summary-heading" className="font-display mb-7 text-3xl">
            Meeting summary
          </h2>
          {meeting.summary ? (
            <div className={PROSE}>
              <ReactMarkdown>{meeting.summary}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              Your summary will appear here once the recording has been transcribed.
            </p>
          )}
        </section>

        {chunks.length > 0 && (
          <section
            className="animate-fade-up mb-12 flex flex-col gap-4"
            aria-labelledby="audio-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="audio-heading" className="font-display flex items-center gap-2.5 text-2xl">
                <AudioLines className="text-muted-foreground size-5" aria-hidden="true" />
                Recording
              </h2>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                Audio part
                <span className="relative inline-flex items-center">
                  <select
                    aria-label="Audio part"
                    value={audioIndex}
                    onChange={(event) => {
                      playNext.current = false;
                      pendingSeek.current = null;
                      setAudioIndex(Number(event.target.value));
                      setAudioError("");
                    }}
                    className="border-border bg-card text-foreground hover:border-primary/40 focus-visible:border-ring focus-visible:ring-ring/50 h-8 cursor-pointer appearance-none rounded-full border py-0 pr-8 pl-3.5 font-mono text-xs tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
                  >
                    {chunks.map((chunk) => (
                      <option key={chunk.index} value={chunk.index}>
                        {chunk.index + 1} · {timestamp(chunk.index * CHUNK_SECONDS)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="text-muted-foreground pointer-events-none absolute right-3 size-3.5"
                    aria-hidden="true"
                  />
                </span>
              </label>
            </div>
            <div className="border-border bg-card rounded-2xl border p-3 sm:p-4">
              <audio
                ref={audio}
                controls
                preload="none"
                src={`${endpoint}/audio/${audioIndex}`}
                className="w-full [color-scheme:light] dark:[color-scheme:dark]"
                onError={() =>
                  setAudioError(
                    "Audio could not load. Check your connection and try selecting the part again."
                  )
                }
                onLoadedMetadata={() => {
                  if (audio.current && pendingSeek.current !== null) {
                    audio.current.currentTime = pendingSeek.current;
                    pendingSeek.current = null;
                  }
                  if (playNext.current) {
                    playNext.current = false;
                    void audio.current
                      ?.play()
                      .catch(() => setAudioError("Press play to continue listening."));
                  }
                }}
                onEnded={() => {
                  const next = chunks.find((chunk) => chunk.index === audioIndex + 1);
                  if (next) {
                    playNext.current = true;
                    setAudioIndex(next.index);
                  }
                }}
              />
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              Parts play in sequence. Select a transcript timestamp to jump straight to that moment.
            </p>
            {audioError && (
              <p role="alert" className="text-destructive text-sm">
                {audioError}
              </p>
            )}
          </section>
        )}

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
            <p className="text-muted-foreground my-6 max-w-prose text-xs leading-5">
              Speaker labels distinguish voices within each audio part. The same person may have a
              different label in another part; names are not inferred.
            </p>
            {segments.length ? (
              <ol className="flex flex-col gap-1 pb-4">
                {segments.map((segment, index) => (
                  <li
                    key={`${segment.start}-${index}`}
                    className="hover:bg-muted/50 -mx-3 grid gap-1 rounded-lg px-3 py-2.5 transition-colors sm:grid-cols-[7.5rem_1fr] sm:gap-5"
                  >
                    <div className="flex items-baseline gap-2.5 sm:flex-col sm:gap-1">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-primary rounded font-mono text-xs tabular-nums underline-offset-4 transition-colors hover:underline"
                        onClick={() => seek(segment.start)}
                        aria-label={`Play audio at ${timestamp(segment.start)}`}
                      >
                        {timestamp(segment.start)}
                      </button>
                      <span className="text-foreground/70 truncate text-[0.6875rem] font-medium tracking-[0.12em] uppercase">
                        {segment.speaker}
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
      </div>
    </div>
  );
}
