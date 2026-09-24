"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  AudioPlayer,
  type AudioPlayerHandle,
  relabel,
  SummaryProse,
  timestamp,
  TranscriptList,
} from "@/components/meetings/meeting-sections";
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
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { type Meeting, type MeetingDetail } from "@/lib/meeting-types";
import { estimateProgress } from "@/lib/meeting-validation";
import { ADMIN_EMAIL, usd } from "@/lib/utils";

/* Ticks only while mounted; keyed by phase so the elapsed time restarts when transcription hands off to the summary. */
function ProcessingProgress({ audioSeconds, transcribed }: { audioSeconds: number; transcribed: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(timer);
  }, []);
  const percent = estimateProgress(audioSeconds, transcribed, elapsed);
  return (
    // Not a live region: the section's status role would otherwise re-announce every tick.
    <div aria-live="off" className="mt-5 flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={transcribed ? "Summary progress" : "Transcription progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`About ${percent}% — estimated`}
        className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-muted-foreground font-mono text-xs tabular-nums" aria-hidden="true">
        ~{percent}%
      </span>
    </div>
  );
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "This request could not be completed.");
  return data;
}
export function MeetingDetailView({ id }: { id: string }) {
  const router = useRouter();
  // Visibility only — the API re-checks the admin on the server.
  const isAdmin = useSession().data?.user.email === ADMIN_EMAIL;
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [copied, setCopied] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [speakerName, setSpeakerName] = useState("");
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const player = useRef<AudioPlayerHandle>(null);
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
  async function startProcessing() {
    setSaving(true);
    try {
      await request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process", aiContext }),
      });
      /* Reloading sees status "processing" and runs the usual processing loop. */
      setRetry((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start processing.");
    } finally {
      setSaving(false);
    }
  }
  async function resummarize() {
    setSaving(true);
    try {
      await request(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resummarize" }),
      });
      setRetry((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not regenerate the summary.");
    } finally {
      setSaving(false);
    }
  }
  async function saveSpeaker(label: string, name: string) {
    setSpeakerSaving(true);
    try {
      const { meeting } = await request<{ meeting: Meeting }>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerNames: { [label]: name.trim() } }),
      });
      setDetail((current) =>
        current
          ? { ...current, meeting: { ...current.meeting, speakerNames: meeting.speakerNames } }
          : current
      );
      setSpeaker(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename speaker.");
    } finally {
      setSpeakerSaving(false);
    }
  }
  async function share(change: {
    enabled?: boolean;
    regenerate?: true;
    summary?: boolean;
    recording?: boolean;
    transcript?: boolean;
  }) {
    setShareSaving(true);
    try {
      const { meeting } = await request<{ meeting: Meeting }>(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share: change }),
      });
      setDetail((current) => (current ? { ...current, meeting } : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update sharing.");
    } finally {
      setShareSaving(false);
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
  /* The whole recording is transcribed in one job, so there is no per-part progress to show. */
  const transcribed = chunks.every((chunk) => chunk.status === "ready");
  const labels = [...new Set(segments.map((segment) => segment.speaker))];
  const summary = meeting.summary && relabel(meeting.summary, labels, meeting.speakerNames);
  /* Copies as HTML (Notion and Google Docs turn it into real headings/lists) with a Markdown plain-text fallback. */
  async function copySummary() {
    if (!summary) return;
    const date = new Date(meeting.createdAt).toLocaleDateString(undefined, { dateStyle: "long" });
    const heading = document.createElement("h1");
    heading.textContent = meeting.title;
    const html = `${heading.outerHTML}<p>${date}</p>${summaryRef.current?.innerHTML ?? ""}`;
    const text = `# ${meeting.title}\n\n${date}\n\n${summary}`;
    try {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } catch {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Summary copied. Paste it into Notion or Google Docs.");
    } catch {
      toast.error("Could not copy. Check your browser's clipboard permission.");
    }
  }
  // Rendered only after the client fetch, so `location` is always defined here.
  const shareUrl = meeting.shareToken && `${location.origin}/share/${meeting.shareToken}`;
  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy. Check your browser's clipboard permission.");
    }
  }
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
                    : meeting.status === "review"
                      ? "Ready to process"
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Share meeting">
                    <Share2 />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share this meeting</DialogTitle>
                    <DialogDescription>
                      Anyone with the link can view the sections you choose, without signing in.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="border-border flex items-center gap-3 rounded-xl border px-4 py-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${meeting.shareToken ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                      aria-hidden="true"
                    >
                      {meeting.shareToken ? <Globe className="size-4" /> : <Lock className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {meeting.shareToken ? "Anyone with the link" : "Only you"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {meeting.shareToken ? "Can view the sections below." : "This meeting is private."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={meeting.shareToken ? "outline" : "default"}
                      disabled={shareSaving}
                      onClick={() => void share({ enabled: !meeting.shareToken })}
                    >
                      {shareSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {meeting.shareToken ? "Stop sharing" : "Create link"}
                    </Button>
                  </div>
                  {shareUrl && (
                    <div className="animate-fade-in flex flex-col gap-5">
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={shareUrl}
                          aria-label="Share link"
                          onFocus={(event) => event.target.select()}
                          className="min-w-0 flex-1 font-mono text-xs"
                        />
                        <Button variant="outline" onClick={copyShareUrl}>
                          <Copy />
                          Copy
                        </Button>
                      </div>
                      <fieldset className="flex flex-col gap-2.5" disabled={shareSaving}>
                        <legend className="eyebrow mb-3">Shared sections</legend>
                        {(
                          [
                            ["summary", "shareSummary", "AI summary"],
                            ["recording", "shareRecording", "Recording (listen only)"],
                            ["transcript", "shareTranscript", "Transcript"],
                          ] as const
                        ).map(([key, field, label]) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              checked={meeting[field]}
                              onChange={(event) => void share({ [key]: event.target.checked })}
                              className="accent-primary size-4 cursor-pointer"
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      <div className="flex flex-col items-start gap-1">
                        <Button
                          variant="link"
                          className="h-auto px-0"
                          disabled={shareSaving}
                          onClick={() => void share({ regenerate: true })}
                        >
                          <RotateCcw />
                          Regenerate link
                        </Button>
                        <p className="text-muted-foreground text-xs">
                          The current link stops working for everyone who has it.
                        </p>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
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
            role="status"
            aria-busy="true"
            className="border-border bg-card animate-fade-up mb-10 rounded-2xl border p-6 sm:p-7"
          >
            <h2 className="font-display flex items-center gap-2.5 text-2xl">
              <span
                className="bg-primary/70 size-2 shrink-0 animate-pulse rounded-full"
                aria-hidden="true"
              />
              {transcribed ? "Writing your summary" : "Transcribing the recording"}
            </h2>
            <ProcessingProgress
              key={String(transcribed)}
              audioSeconds={
                meeting.durationSeconds ||
                chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0)
              }
              transcribed={transcribed}
            />
            <p className="text-muted-foreground mt-2 text-xs">Estimated from the recording length.</p>
            <p className="text-muted-foreground mt-4 max-w-prose text-sm leading-6">
              {transcribed
                ? "The transcript is ready."
                : "The whole recording is transcribed at once; longer recordings take longer."}{" "}
              Keep this page open to continue; reopen it any time to resume where it left off.
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

        {meeting.status === "review" && (
          <section
            aria-labelledby="review-heading"
            className="border-border bg-card animate-fade-up mb-10 rounded-2xl border p-6 sm:p-7"
          >
            <p className="eyebrow mb-2">Before processing</p>
            <h2 id="review-heading" className="font-display text-2xl">
              Anything the AI should know?
            </h2>
            <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-6">
              Your recording is saved. Optionally tell the AI what to focus on, who was there, or
              which questions the summary should answer. It only uses what was actually said.
            </p>
            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void startProcessing();
              }}
            >
              <label htmlFor="ai-context" className="text-sm font-medium">
                Notes for the AI — focus, context, questions to answer{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                id="ai-context"
                rows={4}
                maxLength={2000}
                value={aiContext}
                onChange={(event) => setAiContext(event.target.value)}
                aria-describedby="ai-context-count"
                className="min-h-28 rounded-lg"
                placeholder={
                  "e.g. Focus on the budget decisions.\nWho owns the launch checklist?\nAna is the client; Tom leads engineering."
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  id="ai-context-count"
                  className="text-muted-foreground font-mono text-xs tabular-nums"
                >
                  {aiContext.length}/2000
                </span>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Process meeting
                </Button>
              </div>
            </form>
          </section>
        )}

        <section
          className="border-border bg-card animate-fade-up mb-12 rounded-2xl border p-6 sm:p-10"
          aria-labelledby="summary-heading"
        >
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">The takeaway</p>
              <h2 id="summary-heading" className="font-display text-3xl">
                Meeting summary
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdmin && meeting.status === "ready" && (
                <Button variant="outline" size="sm" onClick={resummarize} disabled={saving || processing}>
                  {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                  Regenerate summary
                </Button>
              )}
              {summary && (
                <Button variant="outline" size="sm" onClick={copySummary}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy for Notion / Docs"}
                </Button>
              )}
            </div>
          </div>
          {summary ? (
            <SummaryProse ref={summaryRef} summary={summary} />
          ) : (
            <p className="text-muted-foreground max-w-prose text-sm leading-6">
              Your summary will appear here once the recording has been transcribed.
            </p>
          )}
        </section>

        {chunks.length > 0 && (
          <AudioPlayer ref={player} chunks={chunks} src={`${endpoint}/audio`} />
        )}

        {labels.length > 0 && meeting.status !== "recording" && (
          <section className="animate-fade-up mb-8 flex flex-col gap-3" aria-labelledby="speakers-heading">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="speakers-heading" className="font-display text-2xl">
                Speakers
              </h2>
              <span className="text-muted-foreground text-xs">
                Names apply to the summary and transcript.
              </span>
            </div>
            <ul className="border-border/70 divide-y border-y">
              {labels.map((label, index) => {
                const name = meeting.speakerNames[label];
                const suggestion = !name && meeting.speakerSuggestions[label];
                return (
                  <li key={label} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
                    {speaker === label ? (
                      <form
                        className="animate-scale-in flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveSpeaker(label, speakerName);
                        }}
                      >
                        <label htmlFor={`speaker-${index}`} className="sr-only">
                          Name for {label}
                        </label>
                        <Input
                          id={`speaker-${index}`}
                          autoFocus
                          maxLength={60}
                          value={speakerName}
                          onChange={(event) => setSpeakerName(event.target.value)}
                          placeholder={label}
                          className="h-9 min-w-0 flex-1"
                        />
                        <Button
                          type="submit"
                          size="icon"
                          disabled={speakerSaving}
                          aria-label={speakerName.trim() ? `Save name for ${label}` : `Clear name for ${label}`}
                        >
                          {speakerSaving ? <Loader2 className="animate-spin" /> : <Check />}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setSpeaker(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
                          <span className="truncate text-sm font-medium">{name || label}</span>
                          {name && (
                            <span className="text-muted-foreground text-[0.6875rem] tracking-[0.12em] uppercase">
                              {label}
                            </span>
                          )}
                        </div>
                        {suggestion && (
                          <span className="text-muted-foreground flex items-center gap-2 text-xs">
                            Suggested
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={speakerSaving}
                              onClick={() => void saveSpeaker(label, suggestion)}
                              aria-label={`Name ${label} ${suggestion}`}
                            >
                              <Check />
                              {suggestion}
                            </Button>
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Rename ${label}`}
                          onClick={() => {
                            setSpeakerName(name ?? "");
                            setSpeaker(label);
                          }}
                        >
                          <Pencil />
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <TranscriptList
          segments={segments}
          speakerNames={meeting.speakerNames}
          onSeek={(seconds) => player.current?.seek(seconds)}
          note="Speaker labels distinguish voices across the whole recording; rename speakers above to show their names. Older meetings may label speakers per audio part."
        />
      </div>
    </div>
  );
}
