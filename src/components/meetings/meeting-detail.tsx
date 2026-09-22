"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
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

function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
function usd(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: value < 0.01 ? 4 : 2 });
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
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-16">
        {error ? (
          <>
            <p role="alert" className="text-destructive">
              {error}
            </p>
            <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
              Try again
            </Button>
            <Link href="/meetings" className="text-sm underline">
              Back to meetings
            </Link>
          </>
        ) : (
          <>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </div>
    );
  const { meeting, chunks, segments } = detail;
  const completed = chunks.filter((chunk) => chunk.status === "ready").length;
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <Link
        href="/meetings"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" />
        My meetings
      </Link>
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={meeting.status === "error" ? "destructive" : "secondary"}>
            {meeting.status === "ready"
              ? "Ready"
              : meeting.status === "processing"
                ? "Preparing your notes"
                : meeting.status === "recording"
                  ? "Recording not finalized"
                  : "Needs attention"}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {new Date(meeting.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {timestamp(meeting.durationSeconds)}
            {meeting.costUsd !== null && <> · {usd(meeting.costUsd)} AI cost</>}
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          {editing ? (
            <form
              className="flex flex-1 flex-wrap gap-2"
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
                className="flex-1"
              />
              <Button
                disabled={saving || !title.trim()}
                type="submit"
                size="icon"
                aria-label="Save title"
              >
                <Check />
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <h1 className="min-w-0 text-3xl font-semibold tracking-tight break-words">
              {meeting.title}
            </h1>
          )}
          <div className="flex shrink-0 gap-1">
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
      </header>
      {(processing || meeting.status === "processing") && (
        <section aria-live="polite" className="bg-muted/40 mb-8 rounded-lg border p-6">
          <div className="mb-3 flex items-center gap-3">
            <Loader2 className="size-4 animate-spin" />
            <h2 className="font-medium">
              {completed === chunks.length ? "Writing your summary" : "Preparing the transcript"}
            </h2>
          </div>
          <progress
            className="accent-primary h-2 w-full"
            max={chunks.length + 1}
            value={completed}
          />
          <p className="text-muted-foreground mt-3 text-sm">
            {completed} of {chunks.length} audio parts transcribed. Keep this page open to continue;
            reopen it to resume.
          </p>
        </section>
      )}
      {(error || meeting.status === "error") && (
        <div
          role="alert"
          className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-6"
        >
          <p className="text-destructive max-w-xl text-sm">
            {error ||
              meeting.error ||
              "We could not finish your notes. Your saved audio is still available."}
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
        <section className="mb-8 flex flex-col items-start gap-4 rounded-lg border p-6">
          <h2 className="font-medium">Finish a saved recording</h2>
          <p className="text-muted-foreground text-sm leading-6">
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
        className="bg-card mb-10 rounded-lg border p-6 sm:p-8"
        aria-labelledby="summary-heading"
      >
        <div className="mb-6 flex items-center gap-3">
          <FileText className="text-muted-foreground size-5" />
          <h2 id="summary-heading" className="text-lg font-semibold">
            Meeting summary
          </h2>
        </div>
        {meeting.summary ? (
          <div className="text-sm leading-7 [&_a]:underline [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown>{meeting.summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm leading-6">
            Your summary will appear here once the recording has been transcribed.
          </p>
        )}
      </section>
      {chunks.length > 0 && (
        <section className="mb-10 flex flex-col gap-4" aria-labelledby="audio-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="audio-heading" className="text-lg font-semibold">
              Recording
            </h2>
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              Audio part
              <select
                aria-label="Audio part"
                value={audioIndex}
                onChange={(event) => {
                  playNext.current = false;
                  pendingSeek.current = null;
                  setAudioIndex(Number(event.target.value));
                  setAudioError("");
                }}
                className="bg-background text-foreground rounded-md border p-2"
              >
                {chunks.map((chunk) => (
                  <option key={chunk.index} value={chunk.index}>
                    {chunk.index + 1} · {timestamp(chunk.index * CHUNK_SECONDS)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <audio
            ref={audio}
            controls
            preload="none"
            src={`${endpoint}/audio/${audioIndex}`}
            className="w-full"
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
          <p className="text-muted-foreground text-xs">
            Parts play in sequence. Select a transcript timestamp to jump to that moment.
          </p>
          {audioError && (
            <p role="alert" className="text-destructive text-sm">
              {audioError}
            </p>
          )}
        </section>
      )}
      <details className="group border-t pt-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <span className="text-lg font-semibold">
            Full transcript{" "}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {segments.length ? `${segments.length} segments` : ""}
            </span>
          </span>
          <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
        </summary>
        <p className="text-muted-foreground my-5 text-xs leading-5">
          Speaker labels distinguish voices within each audio part. The same person may have a
          different label in another part; names are not inferred.
        </p>
        {segments.length ? (
          <ol className="flex flex-col gap-6">
            {segments.map((segment, index) => (
              <li key={`${segment.start}-${index}`} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <div className="flex items-start gap-2">
                  <button
                    className="text-muted-foreground font-mono text-xs underline-offset-4 hover:underline"
                    onClick={() => seek(segment.start)}
                    aria-label={`Play audio at ${timestamp(segment.start)}`}
                  >
                    {timestamp(segment.start)}
                  </button>
                  <span className="text-xs font-medium">{segment.speaker}</span>
                </div>
                <p className="text-sm leading-7">{segment.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground py-6 text-sm">
            The transcript will appear as audio is processed.
          </p>
        )}
      </details>
    </div>
  );
}
