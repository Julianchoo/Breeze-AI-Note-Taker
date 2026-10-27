"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { archiveAudioStatus } from "@/lib/audio-status";
import { useRouter } from "next/navigation";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  ArticleIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  CloudCheckIcon,
  CloudWarningIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FileDocIcon,
  GlobeIcon,
  LockIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  ShareNetworkIcon,
  SparkleIcon,
  TextAlignLeftIcon,
  TrashIcon,
  UploadSimpleIcon,
  UsersIcon,
  WarningIcon,
  WaveformIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { AiCostBreakdown } from "@/components/meetings/ai-cost-breakdown";
import {
  AudioPlayer,
  type AudioPlayerHandle,
  relabel,
  SummaryProse,
  timestamp,
  TranscriptList,
} from "@/components/meetings/meeting-sections";
import { NotionDialog } from "@/components/meetings/notion-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";
import { downloadMeetingDocx } from "@/lib/meeting-docx";
import { type Meeting, type MeetingDetail } from "@/lib/meeting-types";
import { estimateProgress } from "@/lib/meeting-validation";
import {
  type CachedRecording,
  deleteRecording,
  findFinishedRecording,
  recordingWav,
} from "@/lib/recording-cache";
import { ADMIN_EMAIL } from "@/lib/utils";

/* Landing system (DESIGN.md "Signed in landing screens"): shared class sets for this screen. */
const CARD = "bg-card rounded-3xl border shadow-xs";
const LABEL = "text-primary text-sm font-semibold";
const SECTION_HEADING = "text-2xl font-semibold tracking-tight text-balance";
const MAIN_BUTTON =
  "ease-fluid h-14 w-full px-6 text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto";
const SMALL_BUTTON = "ease-fluid font-semibold duration-300";
/* Header actions: equal width thumb targets on phones, compact pills from sm. */
const HEADER_ACTION =
  "ease-fluid bg-card dark:bg-card dark:hover:bg-accent h-12 min-w-0 flex-1 px-3 font-semibold duration-300 has-[>svg]:px-3 sm:h-10 sm:flex-none sm:px-4 sm:has-[>svg]:px-4";
const MENU_ITEM = "rounded-lg px-3 py-3";
/* Dialogs are portaled outside .landing; landing-island re-points the landing tokens there. */
const DIALOG = "landing-island rounded-3xl p-6 sm:p-8";
/* Anchored sections clear the sticky site header (var(--sticky-top), APK inset included) and the
   section switcher below it: 0.5rem gap, the 46px pill and 1rem of breathing room. */
const ANCHOR = "scroll-mt-[calc(var(--sticky-top)+4.5rem)]";

/* Ticks only while mounted; keyed by phase so the elapsed time restarts when transcription hands off to the summary. */
function ProcessingProgress({
  audioSeconds,
  transcribed,
}: {
  audioSeconds: number;
  transcribed: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(timer);
  }, []);
  const percent = estimateProgress(audioSeconds, transcribed, elapsed);
  return (
    // Not a live region: the section's status role would otherwise re-announce every tick.
    <div aria-live="off" className="mt-6 flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={transcribed ? "Summary progress" : "Transcription progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`About ${percent}%, estimated`}
        className="bg-foreground/10 h-1.5 flex-1 overflow-hidden rounded-full"
      >
        {/* Tick driven, so it stays linear on purpose (DESIGN.md, landing motion). */}
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500 ease-linear"
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
  const user = useSession().data?.user;
  const isAdmin = user?.email === ADMIN_EMAIL;
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
  const [exporting, setExporting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const player = useRef<AudioPlayerHandle>(null);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [speakerName, setSpeakerName] = useState("");
  const [speakerSaving, setSpeakerSaving] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [notionOpen, setNotionOpen] = useState(false);
  /* The finished recording kept in this browser; the server deletes its audio after transcription. */
  const [localAudio, setLocalAudio] = useState<CachedRecording | null>(null);
  const [audioExporting, setAudioExporting] = useState(false);
  const endpoint = `/api/meetings/${id}`;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    findFinishedRecording(id, userId)
      .then((recording) => live && setLocalAudio(recording ?? null))
      .catch(() => {
        /* No browser storage: there is simply no local copy to offer. */
      });
    return () => {
      live = false;
    };
  }, [id, userId]);

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
      // Best effort: a leftover local copy only costs this device some storage.
      if (userId) await deleteRecording(userId, id).catch(() => {});
      router.replace("/meetings/history");
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
      <div className="landing">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6 sm:pt-12 sm:pb-24">
          {error ? (
            <div className="animate-landing-fade border-destructive/25 bg-destructive/5 flex flex-col items-start gap-4 rounded-3xl border p-6 sm:p-8">
              <span
                className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full"
                aria-hidden="true"
              >
                <WarningIcon className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                  We could not open this meeting
                </h1>
                <p role="alert" className="text-muted-foreground max-w-md text-sm text-pretty">
                  {error}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  className={`${SMALL_BUTTON} h-12 sm:h-10`}
                  onClick={() => setRetry((value) => value + 1)}
                >
                  <ArrowClockwiseIcon aria-hidden="true" />
                  Try again
                </Button>
                <Button variant="ghost" className={`${SMALL_BUTTON} h-12 sm:h-10`} asChild>
                  <Link href="/meetings/history">
                    <ArrowLeftIcon aria-hidden="true" />
                    Back to my meetings
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            // Mirrors the loaded layout: back link, header, action pills, then the summary card.
            <div role="status" className="flex flex-col gap-6" aria-live="polite" aria-busy="true">
              <span className="sr-only">Loading your meeting</span>
              <Skeleton className="h-4 w-28 rounded-full" />
              <div className="flex flex-col gap-4">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-32 rounded-full" />
                </div>
                <div className="flex gap-2 pt-2">
                  {[0, 1, 2].map((n) => (
                    <Skeleton
                      key={n}
                      className="h-12 flex-1 rounded-full sm:h-10 sm:w-28 sm:flex-none"
                    />
                  ))}
                </div>
              </div>
              <div className={`${CARD} mt-8 flex flex-col gap-3 p-6 sm:p-10`}>
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="mb-4 h-8 w-1/2 rounded-lg" />
                {["w-full", "w-11/12", "w-full", "w-4/5", "w-2/3"].map((width, n) => (
                  <Skeleton key={n} className={`h-4 rounded-full ${width}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  const { meeting, chunks, segments } = detail;
  /* The whole recording is transcribed in one job, so there is no per-part progress to show. */
  const transcribed = chunks.every((chunk) => chunk.status === "ready");
  /* The admin's audio is saved to OneDrive before transcription starts; hasAudio turns true once it is. */
  const archiving = isAdmin && !transcribed && !meeting.hasAudio;
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
      toast.success("Summary copied. Paste it into Notion or Google Docs.");
    } catch {
      toast.error("Could not copy. Check your browser's clipboard permission.");
    }
  }
  async function downloadWord(withTranscript: boolean) {
    if (!summary) return;
    setExporting(true);
    try {
      await downloadMeetingDocx({
        title: meeting.title,
        createdAt: meeting.createdAt,
        durationSeconds: meeting.durationSeconds,
        summary,
        segments: withTranscript ? segments : [],
        speakerNames: meeting.speakerNames,
      });
    } catch {
      toast.error("Could not create the Word document.");
    } finally {
      setExporting(false);
    }
  }
  async function downloadAudio() {
    if (!localAudio) return;
    setAudioExporting(true);
    try {
      const url = URL.createObjectURL(await recordingWav(localAudio));
      const link = document.createElement("a");
      link.href = url;
      // Local date as YYYY-MM-DD; the title is stripped of characters Windows/macOS reject in filenames.
      const name = meeting.title.replace(/[\\/:*?"<>|]/g, "").replace(/[.\s]+$/, "").trim();
      link.download = `${new Date(meeting.createdAt).toLocaleDateString("en-CA")} ${name || "Meeting"}.wav`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("Could not create the audio file.");
      return;
    } finally {
      setAudioExporting(false);
    }
    // The file is now on the user's device, so the browser copy is no longer needed.
    await deleteRecording(localAudio.userId, localAudio.id).catch(() => {});
    setLocalAudio(null);
    toast.success("Audio downloaded. The copy kept in this browser was removed.");
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
    <div className="landing">
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6 sm:pt-12 sm:pb-24">
        <Link
          href="/meetings/history"
          className="group text-muted-foreground ease-fluid hover:text-foreground focus-visible:ring-ring/50 -mx-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <ArrowLeftIcon
            className="ease-fluid size-4 transition-transform duration-300 group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          My meetings
        </Link>

        <header className="animate-landing-rise mt-6 flex flex-col gap-4">
          <p className={LABEL}>Meeting notes</p>
          {editing ? (
            <>
              {/* Keeps the page's single h1 while the visible title is being edited. */}
              <h1 className="sr-only">{meeting.title}</h1>
              <form
                className={`${CARD} animate-landing-fade flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTitle();
                }}
              >
                <label htmlFor="meeting-title" className="sr-only">
                  Meeting title
                </label>
                {/* Outer 24px radius, 12px padding: the field takes 12px. */}
                <Input
                  id="meeting-title"
                  autoFocus
                  maxLength={160}
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="bg-band dark:bg-band h-14 min-w-0 flex-1 rounded-xl border-0 px-4 text-xl font-semibold shadow-none md:text-xl"
                  placeholder="Name this meeting"
                />
                <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
                  <Button
                    disabled={saving || !title.trim()}
                    type="submit"
                    className={`${SMALL_BUTTON} h-12`}
                  >
                    {saving ? (
                      <CircleNotchIcon className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckIcon aria-hidden="true" />
                    )}
                    Save<span className="sr-only"> title</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`${SMALL_BUTTON} h-12`}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <h1 className="min-w-0 text-4xl font-semibold tracking-tight text-balance break-words sm:text-5xl">
              {meeting.title}
            </h1>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Status pairs an icon (or dot) with text, never color alone. */}
            <Badge
              variant={
                meeting.status === "error"
                  ? "destructive"
                  : meeting.status === "ready"
                    ? "success"
                    : "secondary"
              }
            >
              {meeting.status === "processing" ? (
                <CircleNotchIcon className="animate-spin" aria-hidden="true" />
              ) : meeting.status === "ready" ? (
                <CheckCircleIcon weight="fill" aria-hidden="true" />
              ) : meeting.status === "review" ? (
                <SparkleIcon aria-hidden="true" />
              ) : meeting.status === "recording" ? (
                <span
                  className="bg-muted-foreground size-1.5 shrink-0 rounded-full"
                  aria-hidden="true"
                />
              ) : (
                <WarningIcon aria-hidden="true" />
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
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <time dateTime={meeting.createdAt} className="font-mono tabular-nums">
                {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              {separator}
              <span className="font-mono tabular-nums">{timestamp(meeting.durationSeconds)}</span>
              {(detail.aiCosts.totalUsd !== null || detail.aiCosts.attempts.length > 0) && (
                <>
                  {separator}
                  <AiCostBreakdown costs={detail.aiCosts} />
                </>
              )}
            </p>
          </div>

          {/* Labelled pills, full width thirds on phones so every action is an easy thumb target. */}
          <div className="flex items-center gap-2 pt-2">
            {!editing && (
              <Button
                variant="outline"
                className={HEADER_ACTION}
                onClick={() => {
                  setTitle(meeting.title);
                  setEditing(true);
                }}
              >
                <PencilSimpleIcon aria-hidden="true" />
                Rename<span className="sr-only"> meeting</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={HEADER_ACTION}>
                  <ShareNetworkIcon aria-hidden="true" />
                  Share<span className="sr-only"> and export</span>
                </Button>
              </DropdownMenuTrigger>
              {/* Portaled outside .landing, so landing-island brings the landing tokens along. */}
              <DropdownMenuContent align="start" className="landing-island min-w-60 rounded-xl p-1">
                <DropdownMenuItem className={MENU_ITEM} onSelect={() => setShareDialogOpen(true)}>
                  <GlobeIcon aria-hidden="true" />
                  Share link
                </DropdownMenuItem>
                {summary && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className={MENU_ITEM} onSelect={() => void copySummary()}>
                      <CopyIcon aria-hidden="true" />
                      Copy for Notion or Docs
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={MENU_ITEM}
                      disabled={exporting}
                      onSelect={() => void downloadWord(false)}
                    >
                      <FileDocIcon aria-hidden="true" />
                      Download Word: summary
                    </DropdownMenuItem>
                    {segments.length > 0 && (
                      <DropdownMenuItem
                        className={MENU_ITEM}
                        disabled={exporting}
                        onSelect={() => void downloadWord(true)}
                      >
                        <FileDocIcon aria-hidden="true" />
                        Download Word: summary and transcript
                      </DropdownMenuItem>
                    )}
                    {isAdmin && meeting.status === "ready" && (
                      <DropdownMenuItem className={MENU_ITEM} onSelect={() => setNotionOpen(true)}>
                        <PaperPlaneTiltIcon aria-hidden="true" />
                        Send to Notion
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {localAudio && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className={MENU_ITEM}
                      disabled={audioExporting}
                      onSelect={() => void downloadAudio()}
                    >
                      <DownloadSimpleIcon aria-hidden="true" />
                      Download audio (WAV)
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogContent className={DIALOG}>
                <DialogHeader className="text-left">
                  <DialogTitle>Share this meeting</DialogTitle>
                  <DialogDescription className="text-pretty">
                    Anyone with the link can view the sections you choose, without signing in.
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-band flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${meeting.shareToken ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground border"}`}
                    aria-hidden="true"
                  >
                    {meeting.shareToken ? (
                      <GlobeIcon className="size-5" />
                    ) : (
                      <LockIcon className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {meeting.shareToken ? "Anyone with the link" : "Only you"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {meeting.shareToken
                        ? "Can view the sections below."
                        : "This meeting is private."}
                    </p>
                  </div>
                  <Button
                    variant={meeting.shareToken ? "outline" : "default"}
                    disabled={shareSaving}
                    className={`${SMALL_BUTTON} h-11 w-full sm:h-10 sm:w-auto`}
                    onClick={() => void share({ enabled: !meeting.shareToken })}
                  >
                    {shareSaving && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
                    {meeting.shareToken ? "Stop sharing" : "Create link"}
                  </Button>
                </div>
                {shareUrl && (
                  <div className="animate-landing-fade flex flex-col gap-6">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        readOnly
                        value={shareUrl}
                        aria-label="Share link"
                        onFocus={(event) => event.target.select()}
                        className="h-11 min-w-0 flex-1 rounded-lg font-mono text-xs md:text-xs"
                      />
                      <Button
                        variant="outline"
                        className={`${SMALL_BUTTON} h-11`}
                        onClick={copyShareUrl}
                      >
                        <CopyIcon aria-hidden="true" />
                        Copy
                      </Button>
                    </div>
                    <fieldset className="flex flex-col gap-2" disabled={shareSaving}>
                      <legend className="mb-3 text-sm font-semibold">Shared sections</legend>
                      {(
                        [
                          ["summary", "shareSummary", "AI summary"],
                          ["transcript", "shareTranscript", "Transcript"],
                        ] as const
                      ).map(([key, field, label]) => (
                        <label
                          key={key}
                          className="bg-band ease-fluid has-[:checked]:border-primary/30 has-[:focus-visible]:ring-ring/50 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-4 text-sm font-semibold transition-colors duration-300 has-[:focus-visible]:ring-[3px]"
                        >
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
                        className="h-auto px-0 font-semibold"
                        disabled={shareSaving}
                        onClick={() => void share({ regenerate: true })}
                      >
                        <ArrowClockwiseIcon aria-hidden="true" />
                        Regenerate link
                      </Button>
                      <p className="text-muted-foreground text-xs text-pretty">
                        The current link stops working for everyone who has it.
                      </p>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            {isAdmin && (
              <NotionDialog
                meeting={meeting}
                open={notionOpen}
                onOpenChange={setNotionOpen}
                onSent={(notionPageUrl) => {
                  setNotionOpen(false);
                  setDetail((current) =>
                    current
                      ? { ...current, meeting: { ...current.meeting, notionPageUrl } }
                      : current
                  );
                }}
              />
            )}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className={`${HEADER_ACTION} hover:text-destructive dark:hover:text-destructive`}
                  disabled={processing}
                >
                  <TrashIcon aria-hidden="true" />
                  Delete<span className="sr-only"> meeting</span>
                </Button>
              </DialogTrigger>
              <DialogContent className={DIALOG}>
                <DialogHeader className="text-left">
                  <DialogTitle>Delete this meeting?</DialogTitle>
                  <DialogDescription className="text-pretty">
                    This permanently deletes the summary, the transcript, and any audio still on our
                    servers or in this browser. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    className={`${SMALL_BUTTON} h-12 sm:h-10`}
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Keep meeting
                  </Button>
                  <Button
                    variant="destructive"
                    className={`${SMALL_BUTTON} h-12 sm:h-10`}
                    onClick={remove}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete meeting"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Compact section switcher: sticks under the site header so long transcripts stay easy to
            move around on phones. Plain anchors, so it works without JS. */}
        {(summary || segments.length > 0) && (
          <div className="animate-landing-rise pointer-events-none sticky top-[calc(var(--sticky-top)+0.5rem)] z-30 mt-8 flex justify-center [animation-delay:80ms]">
            <nav
              aria-label="Meeting sections"
              className="bg-background/70 border-foreground/10 pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-full border p-1 shadow-[0_8px_24px_-16px_color-mix(in_oklch,var(--foreground)_45%,transparent)] backdrop-blur-xl"
            >
              {(
                [
                  ["summary", "Summary", ArticleIcon, true],
                  ["recording", "Audio", WaveformIcon, meeting.hasAudio],
                  [
                    "speakers",
                    "Speakers",
                    UsersIcon,
                    labels.length > 0 && meeting.status !== "recording",
                  ],
                  ["transcript", "Transcript", TextAlignLeftIcon, true],
                ] as const
              )
                .filter(([, , , shown]) => shown)
                .map(([anchor, label, SectionIcon]) => (
                  <a
                    key={anchor}
                    href={`#${anchor}`}
                    className="text-muted-foreground ease-fluid hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-[background-color,color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
                  >
                    <SectionIcon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
                    {label}
                  </a>
                ))}
            </nav>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {(processing || meeting.status === "processing") && (
            <section
              role="status"
              aria-busy="true"
              className={`${CARD} animate-landing-rise p-3 [animation-delay:120ms]`}
            >
              {/* Outer 24px radius, 12px padding: 12px well, tinted like the recorder while saving. */}
              <div className="bg-primary/8 rounded-xl px-4 py-6 sm:px-6">
                <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-balance">
                  <CircleNotchIcon
                    className="text-primary size-5 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                  {transcribed
                    ? "Writing your summary"
                    : archiving
                      ? "Saving audio to OneDrive"
                      : "Transcribing the recording"}
                </h2>
                {/* No estimate while archiving: the transcription estimate starts once the audio is saved. */}
                {!archiving && (
                  <>
                    <ProcessingProgress
                      key={String(transcribed)}
                      audioSeconds={
                        meeting.durationSeconds ||
                        chunks.reduce((sum, chunk) => sum + chunk.durationSeconds, 0)
                      }
                      transcribed={transcribed}
                    />
                    <p className="text-muted-foreground mt-2 text-xs">
                      Estimated from the recording length.
                    </p>
                  </>
                )}
                <p className="text-muted-foreground mt-4 max-w-prose text-sm text-pretty">
                  {transcribed
                    ? "The transcript is ready."
                    : archiving
                      ? "Your recording is saved to OneDrive first, then transcribed."
                      : "The whole recording is transcribed at once; longer recordings take longer."}{" "}
                  Keep this page open to continue; reopen it any time to resume where it left off.
                </p>
              </div>
            </section>
          )}

          {(error || meeting.status === "error") && (
            <div
              role="alert"
              className="animate-landing-fade border-destructive/25 bg-destructive/5 flex flex-col items-start gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-destructive flex max-w-xl items-start gap-2 text-sm text-pretty">
                <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {error ||
                  meeting.error ||
                  "We could not finish your notes. Try again to pick up where it stopped."}
              </p>
              <Button
                variant="outline"
                className={`${SMALL_BUTTON} h-12 w-full shrink-0 sm:h-10 sm:w-auto`}
                disabled={processing}
                onClick={() => setRetry((value) => value + 1)}
              >
                <ArrowClockwiseIcon aria-hidden="true" />
                Try again
              </Button>
            </div>
          )}

          {meeting.status === "recording" && (
            <section className={`${CARD} animate-landing-rise p-6 [animation-delay:120ms] sm:p-8`}>
              <p className={LABEL}>Unfinished</p>
              {chunks.length > 0 ? (
                <>
                  <h2 className={`${SECTION_HEADING} mt-2`}>Finish a saved recording</h2>
                  <p className="text-muted-foreground mt-2 max-w-prose text-sm text-pretty">
                    If recording is still open in another tab, finish it there. If it was
                    interrupted, you can prepare notes from the {chunks.length} uploaded audio{" "}
                    {chunks.length === 1 ? "part" : "parts"}. Unsaved audio cannot be recovered
                    here.
                  </p>
                  <Button className={`${MAIN_BUTTON} mt-6`} disabled={saving} onClick={recover}>
                    <UploadSimpleIcon aria-hidden="true" />
                    Finish saved recording
                  </Button>
                </>
              ) : (
                <>
                  {/* No audio reached the server, so there is nothing to finish here. Point to the
                      device copies (web "Saved on this device", Android "Saved on this phone") on
                      the New meeting screen, or let the empty meeting go. */}
                  <h2 className={`${SECTION_HEADING} mt-2`}>No audio reached Breeze</h2>
                  <p className="text-muted-foreground mt-2 max-w-prose text-sm text-pretty">
                    If recording is still open in another tab or on your phone, finish it there.
                    If it was interrupted, the audio may still be on the device you recorded with:
                    open New meeting on that device to upload it. If nothing was recorded, delete
                    this meeting.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Button asChild className={MAIN_BUTTON}>
                      <Link href="/meetings/new">
                        <UploadSimpleIcon aria-hidden="true" />
                        Check this device
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className={MAIN_BUTTON}
                      disabled={deleting}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <TrashIcon aria-hidden="true" />
                      Delete meeting
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {meeting.status === "review" && (
            <section
              aria-labelledby="review-heading"
              className={`${CARD} animate-landing-rise p-6 [animation-delay:120ms] sm:p-8`}
            >
              <p className={LABEL}>Before processing</p>
              <h2 id="review-heading" className={`${SECTION_HEADING} mt-2`}>
                Anything the AI should know?
              </h2>
              <p className="text-muted-foreground mt-2 max-w-prose text-sm text-pretty">
                Your recording is uploaded; our copy is deleted once it is transcribed. Optionally
                tell the AI what to focus on, who was there, or which questions the summary should
                answer. It only uses what was actually said.
              </p>
              <form
                className="mt-6 flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startProcessing();
                }}
              >
                <label htmlFor="ai-context" className="text-sm font-semibold">
                  Notes for the AI: focus, context, questions to answer{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Textarea
                  id="ai-context"
                  rows={4}
                  maxLength={2000}
                  value={aiContext}
                  onChange={(event) => setAiContext(event.target.value)}
                  aria-describedby="ai-context-count"
                  className="bg-band dark:bg-band min-h-32 rounded-xl px-4 py-3"
                  placeholder={
                    "e.g. Focus on the budget decisions.\nWho owns the launch checklist?\nAna is the client; Tom leads engineering."
                  }
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span
                    id="ai-context-count"
                    className="text-muted-foreground font-mono text-xs tabular-nums"
                  >
                    {aiContext.length}/2000
                  </span>
                  <Button type="submit" disabled={saving} className={MAIN_BUTTON}>
                    {saving ? (
                      <CircleNotchIcon className="animate-spin" aria-hidden="true" />
                    ) : (
                      <SparkleIcon weight="fill" aria-hidden="true" />
                    )}
                    Process meeting
                  </Button>
                </div>
              </form>
            </section>
          )}

          <section
            id="summary"
            className={`${CARD} ${ANCHOR} animate-landing-rise p-6 [animation-delay:120ms] sm:p-10`}
            aria-labelledby="summary-heading"
          >
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className={LABEL}>The takeaway</p>
                <h2
                  id="summary-heading"
                  className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
                >
                  Meeting summary
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && meeting.notionPageUrl && (
                  <Button variant="outline" size="sm" className={`${SMALL_BUTTON} h-10`} asChild>
                    <a href={meeting.notionPageUrl} target="_blank" rel="noopener noreferrer">
                      <ArrowUpRightIcon aria-hidden="true" />
                      Open in Notion
                    </a>
                  </Button>
                )}
                {isAdmin && meeting.status === "ready" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${SMALL_BUTTON} h-10`}
                    onClick={resummarize}
                    disabled={saving || processing}
                  >
                    {saving ? (
                      <CircleNotchIcon className="animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowClockwiseIcon aria-hidden="true" />
                    )}
                    Regenerate summary
                  </Button>
                )}
              </div>
            </div>
            {summary ? (
              <SummaryProse ref={summaryRef} summary={summary} variant="landing" />
            ) : (
              <p className="bg-band text-muted-foreground rounded-xl px-4 py-6 text-sm text-pretty">
                Your summary will appear here once the recording has been transcribed.
              </p>
            )}
          </section>

          <div
            id="recording"
            className={`${ANCHOR} animate-landing-rise flex flex-col gap-3 [animation-delay:160ms]`}
          >
            {/* Upload receipts and the OneDrive archive are separate facts (see docs/android.md). */}
            <p className="bg-card text-muted-foreground flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-pretty shadow-xs">
              {meeting.hasAudio ? (
                <CloudCheckIcon
                  weight="fill"
                  className="text-success mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <CloudWarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={
                    meeting.hasAudio
                      ? "text-success font-semibold"
                      : "text-foreground font-semibold"
                  }
                >
                  {archiveAudioStatus(meeting.hasAudio)}.
                </span>
                {!meeting.hasAudio
                  ? " Uploaded or processed audio is not proof of a OneDrive backup. Keep or export your phone copy until the archive is confirmed."
                  : null}
              </span>
            </p>
            {meeting.hasAudio && <AudioPlayer ref={player} src={`${endpoint}/audio`} />}
          </div>

          {labels.length > 0 && meeting.status !== "recording" && (
            <section
              id="speakers"
              className={`${CARD} ${ANCHOR} animate-landing-rise p-3 [animation-delay:160ms]`}
              aria-labelledby="speakers-heading"
            >
              <div className="flex flex-col gap-1 px-3 pt-3">
                <div className="flex items-center gap-3">
                  <UsersIcon className="text-primary size-5 shrink-0" aria-hidden="true" />
                  <h2 id="speakers-heading" className={SECTION_HEADING}>
                    Speakers
                  </h2>
                </div>
                <p className="text-muted-foreground text-sm text-pretty">
                  Names apply to the summary and transcript.
                </p>
              </div>
              {/* Outer 24px radius, 12px padding: 12px rows. */}
              <ul className="mt-4 flex flex-col gap-2">
                {labels.map((label, index) => {
                  const name = meeting.speakerNames[label];
                  const suggestion = !name && meeting.speakerSuggestions[label];
                  return (
                    <li
                      key={label}
                      className="bg-band flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3"
                    >
                      {speaker === label ? (
                        <form
                          className="animate-landing-fade flex min-w-0 flex-1 items-center gap-2"
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
                            className="bg-card dark:bg-card h-11 min-w-0 flex-1 rounded-lg"
                          />
                          <Button
                            type="submit"
                            size="icon"
                            className="ease-fluid size-11 rounded-full duration-300"
                            disabled={speakerSaving}
                            aria-label={
                              speakerName.trim()
                                ? `Save name for ${label}`
                                : `Clear name for ${label}`
                            }
                          >
                            {speakerSaving ? (
                              <CircleNotchIcon className="animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckIcon aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className={`${SMALL_BUTTON} h-11 px-3`}
                            onClick={() => setSpeaker(null)}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span
                            className="bg-card text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
                            aria-hidden="true"
                          >
                            {(name || label).slice(0, 1).toUpperCase()}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-base font-semibold">
                              {name || label}
                            </span>
                            {name && (
                              <span className="text-muted-foreground font-mono text-xs">
                                {label}
                              </span>
                            )}
                          </div>
                          {suggestion && (
                            <span className="text-muted-foreground flex items-center gap-2 text-xs">
                              Suggested
                              <Button
                                variant="outline"
                                className={`${SMALL_BUTTON} bg-card dark:bg-card h-10 px-3`}
                                disabled={speakerSaving}
                                onClick={() => void saveSpeaker(label, suggestion)}
                                aria-label={`Name ${label} ${suggestion}`}
                              >
                                <CheckIcon aria-hidden="true" />
                                {suggestion}
                              </Button>
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ease-fluid hover:bg-card dark:hover:bg-card size-11 rounded-full duration-300"
                            aria-label={`Rename ${label}`}
                            onClick={() => {
                              setSpeakerName(name ?? "");
                              setSpeaker(label);
                            }}
                          >
                            <PencilSimpleIcon aria-hidden="true" />
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
            variant="landing"
            segments={segments}
            speakerNames={meeting.speakerNames}
            onSeek={meeting.hasAudio ? (seconds) => player.current?.seek(seconds) : undefined}
            note="Speaker labels distinguish voices across the whole recording; rename speakers above to show their names. Older meetings may label speakers per audio part."
          />
        </div>
      </div>
    </div>
  );
}

