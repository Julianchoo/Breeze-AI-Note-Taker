"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  MicrophoneIcon,
  MonitorIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  StopIcon,
  UploadSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decodeAudioFile, sliceChunks } from "@/lib/audio-file";
import { AUDIO_SAMPLE_RATE, captureAudio, encodeWav } from "@/lib/audio-recorder";
import {
  cacheChunk,
  deleteRecording,
  listRecordings,
  markChunkUploaded,
  readChunk,
  saveRecording,
  type CachedRecording,
} from "@/lib/recording-cache";
import { AudioLevelMeter } from "./recorder/audio-level-meter";
import { RecordHandoff } from "./recorder/record-handoff";

/* Landing system classes (DESIGN.md "Landing system"), shared by the recorder's buttons, disclosures
   and alerts so every state reads the same. Markup only: no recording behaviour depends on them. */
const MAIN_BUTTON =
  "ease-fluid h-14 w-full text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0";
const SMALL_BUTTON = "ease-fluid font-semibold duration-300";
const SUMMARY =
  "ease-fluid hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-details-marker]:hidden";
const ALERT =
  "text-destructive border-destructive/25 bg-destructive/5 mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm";

async function checked(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${response.status}). Please retry.`
    );
  return data;
}

export function MeetingRecorder({
  userId,
  onFinished,
  autoStart = false,
}: {
  userId: string;
  autoStart?: boolean;
  onFinished: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [tabAttached, setTabAttached] = useState(false);
  const [addingTab, setAddingTab] = useState(false);
  const detachTab = useRef<(() => void) | null>(null);
  const starting = useRef(false);
  const autoAttempted = useRef(false);
  const startLatest = useRef<() => Promise<void>>(async () => {});
  const titleLatest = useRef("");
  const startedHere = useRef<string | null>(null);
  // getDisplayMedia (tab/screen capture) isn't implemented on mobile browsers (e.g. Chrome on
  // Android), so calling it there throws a raw "not a function" error instead of a usable message.
  const [tabCaptureSupported, setTabCaptureSupported] = useState(true);
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "saving" | "stopped">(
    "idle"
  );
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [recoveries, setRecoveries] = useState<CachedRecording[]>([]);
  const [emergency, setEmergency] = useState<{ blob: Blob; index: number }[]>([]);
  const active = useRef<CachedRecording | null>(null);
  const recorder = useRef<Awaited<ReturnType<typeof captureAudio>> | null>(null);
  const persistence = useRef(Promise.resolve());
  const uploading = useRef<Promise<void> | null>(null);
  const cacheFailed = useRef(false);
  const startedAt = useRef(0);
  const mounted = useRef(true);
  const acquired = useRef<MediaStream[]>([]);
  const [filePhase, setFilePhase] = useState<"idle" | "decoding" | "uploading">("idle");
  const [fileProgress, setFileProgress] = useState({ done: 0, total: 0 });
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  // Kept after a failed upload so Retry resumes the same meeting instead of creating another.
  const [fileJob, setFileJob] = useState<{ id: string; chunks: Int16Array[] } | null>(null);
  // Read-only references for the level meter: the same streams captureAudio() records, never
  // stopped or changed by the meter. The recorder below keeps owning their lifecycle.
  const [micLevelStreams, setMicLevelStreams] = useState<MediaStream[]>([]);
  const [tabLevelStream, setTabLevelStream] = useState<MediaStream | null>(null);
  const levelStreams = useMemo(
    () => (tabAttached && tabLevelStream ? [...micLevelStreams, tabLevelStream] : micLevelStreams),
    [micLevelStreams, tabAttached, tabLevelStream]
  );

  useEffect(() => {
    // One-time capability probe: getDisplayMedia is undefined during SSR and on browsers
    // (mobile Chrome/Safari) that don't implement tab/screen capture at all.
    const supported = !!navigator.mediaDevices?.getDisplayMedia;
    if (!supported) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTabCaptureSupported(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void listRecordings(userId)
      .then(setRecoveries)
      .catch(() =>
        setError(
          "Local audio recovery is unavailable. Check browser storage permissions before recording."
        )
      );
    const warn = (event: BeforeUnloadEvent) => {
      if (active.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    const guardNavigation = (event: MouseEvent) => {
      if (active.current && (event.target as Element).closest("a[href]")) {
        event.preventDefault();
        event.stopPropagation();
        setError("Stop and save your recording before leaving this page.");
      }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => {
      mounted.current = false;
      recorder.current?.stop();
      acquired.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [userId]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      const seconds = Math.floor((performance.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= 14400) recorder.current?.stop();
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  async function upload(recording: CachedRecording) {
    if (uploading.current) {
      await uploading.current;
      return upload(recording);
    }
    const work = async () => {
      for (let index = 0; index < recording.chunks; index++) {
        const chunk = await readChunk(userId, recording.id, index);
        // Chunks are kept after upload as the local copy; skip the ones the server already confirmed.
        if (!chunk || chunk.uploaded) continue;
        setUploadStatus(`Saving audio part ${index + 1}…`);
        const receipt = await checked(
          await fetch(`/api/meetings/${recording.id}/chunks`, {
            method: "POST",
            headers: { "Content-Type": "audio/wav", "X-Chunk-Index": String(index) },
            body: chunk.blob,
            signal: AbortSignal.timeout(60000),
          })
        );
        if (receipt?.index !== index || typeof receipt?.durationSeconds !== "number")
          throw new Error("Audio upload was not confirmed. Your local copy has been kept.");
        await markChunkUploaded(chunk);
      }
      setUploadStatus("Audio uploaded for transcription.");
    };
    uploading.current = work();
    try {
      await uploading.current;
    } finally {
      uploading.current = null;
    }
  }

  async function finish(recording: CachedRecording) {
    setPhase("saving");
    try {
      await persistence.current;
      if (cacheFailed.current)
        throw new Error(
          "Device storage is full. Download the unsaved audio below before leaving. Saved parts can be recovered after reloading."
        );
      recording.stopped = true;
      await saveRecording(recording);
      // A local copy can outlive its meeting (tab closed after the server finished it, or meeting deleted);
      // the server then rejects every part forever, so settle the local copy instead of retrying.
      const current = await fetch(`/api/meetings/${recording.id}`);
      if (current.status === 404) {
        await deleteRecording(userId, recording.id);
        setRecoveries((items) => items.filter((row) => row.id !== recording.id));
        active.current = null;
        setUploadStatus("");
        setError("That recording's meeting no longer exists, so its local copy was removed.");
        setPhase("idle");
        return;
      }
      if ((await checked(current))?.meeting?.status !== "recording") {
        recording.finished = true;
        await saveRecording(recording);
        active.current = null;
        if (mounted.current) onFinished(recording.id);
        return;
      }
      await upload(recording);
      const finalTitle = titleLatest.current.trim() || recording.title;
      if (startedHere.current === recording.id && finalTitle !== recording.title) {
        try {
          await checked(
            await fetch(`/api/meetings/${recording.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: finalTitle }),
              signal: AbortSignal.timeout(10000),
            })
          );
          recording.title = finalTitle;
          await saveRecording(recording);
        } catch {
          toast.error("Could not save the meeting name. You can rename it on the meeting page.");
        }
      }
      await checked(
        await fetch(`/api/meetings/${recording.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            expectedChunks: recording.chunks,
            durationSeconds: recording.samples / 16000,
          }),
        })
      );
      // Kept on this device so the audio can be downloaded from the meeting page.
      recording.finished = true;
      await saveRecording(recording);
      active.current = null;
      if (mounted.current) onFinished(recording.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the recording. Your cached audio is still on this device."
      );
      setPhase("stopped");
    }
  }

  // A start that fails or is cancelled after the meeting was created but before any audio part
  // exists would leave an empty "Recording not finalized" meeting with nothing to finish. Remove it
  // (server and local copy) only while it has no audio at all; any captured part is kept.
  async function discardEmptyStart(recording: CachedRecording) {
    if (recording.chunks > 0) return;
    await fetch(`/api/meetings/${recording.id}`, { method: "DELETE" }).catch(() => {});
    await deleteRecording(userId, recording.id).catch(() => {});
    if (active.current?.id === recording.id) active.current = null;
    if (startedHere.current === recording.id) startedHere.current = null;
  }

  async function start() {
    if (starting.current || active.current) return;
    starting.current = true;
    setError("");
    setPhase("starting");
    cacheFailed.current = false;
    const streams: MediaStream[] = [];
    acquired.current = streams;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone recording is unavailable. Open Breeze in a supported browser using HTTPS."
        );
      streams.push(
        await navigator.mediaDevices.getUserMedia({
          // Echo cancellation only when tab audio is captured directly; mic-only mode must hear the device's own speaker.
          audio: { echoCancellation: false, noiseSuppression: true },
          video: false,
        })
      );
      if (!mounted.current) throw new Error("Recording cancelled.");
      // Check storage before creating or capturing a meeting.
      await listRecordings(userId);
      const result = await checked(
        await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() || "Untitled meeting" }),
        })
      );
      if (typeof result?.meeting?.id !== "string")
        throw new Error("The meeting could not be created.");
      const recording: CachedRecording = {
        id: result.meeting.id,
        userId,
        title: title.trim() || "Untitled meeting",
        chunks: 0,
        samples: 0,
        stopped: false,
      };
      await saveRecording(recording);
      active.current = recording;
      startedHere.current = recording.id;
      if (!mounted.current) throw new Error("Recording cancelled.");
      const capture = await captureAudio(
        streams,
        (blob, samples) => {
          const index = recording.chunks++;
          recording.samples = samples;
          const snapshot = { ...recording };
          persistence.current = persistence.current.then(async () => {
            if (cacheFailed.current) {
              setEmergency((items) => [...items, { blob, index }]);
              return;
            }
            try {
              await cacheChunk(snapshot, index, blob);
            } catch {
              cacheFailed.current = true;
              setEmergency((items) => [...items, { blob, index }]);
              setError(
                "Device storage is full. Recording stopped. Download the unsaved audio below."
              );
              recorder.current?.stop();
              return;
            }
            void upload(snapshot).catch(() =>
              setUploadStatus(
                "Upload paused. Audio is saved on this device; use Retry when connected."
              )
            );
          });
        },
        () => {
          if (mounted.current) void finish(recording);
        },
        setError
      );
      if (!mounted.current) {
        capture.dispose();
        await discardEmptyStart(recording);
        return;
      }
      recorder.current = capture;
      startedAt.current = performance.now();
      setElapsed(0);
      setMicLevelStreams([...streams]);
      setPhase("recording");
    } catch (cause) {
      streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      if (active.current && !recorder.current) await discardEmptyStart(active.current);
      setError(cause instanceof Error ? cause.message : "Could not start recording.");
      setPhase(active.current ? "stopped" : "idle");
    } finally {
      starting.current = false;
    }
  }

  // A deferred attempt survives Strict Mode's effect rehearsal without opening the mic twice.
  useEffect(() => {
    startLatest.current = start;
  });
  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => {
      if (autoAttempted.current) return;
      autoAttempted.current = true;
      void startLatest.current();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart]);

  async function addTab() {
    if (addingTab || phase !== "recording" || !recorder.current) return;
    setAddingTab(true);
    setError("");
    let display: MediaStream | undefined;
    try {
      // Keep the browser chooser directly in this click's activation.
      display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!display.getAudioTracks().length)
        throw new Error(
          "Choose a browser tab and enable Share tab audio. Your microphone is still recording."
        );
      if (!mounted.current || !active.current || !recorder.current)
        throw new Error("The recording has already stopped.");
      detachTab.current = recorder.current.addStream(display, () => {
        detachTab.current = null;
        setTabAttached(false);
      });
      setTabLevelStream(display);
      setTabAttached(true);
    } catch (cause) {
      display?.getTracks().forEach((track) => track.stop());
      if (!(cause instanceof DOMException && cause.name === "NotAllowedError"))
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not add tab audio. Your microphone is still recording."
        );
    } finally {
      setAddingTab(false);
    }
  }

  async function sendFile(job: { id: string; chunks: Int16Array[] }) {
    setFileError("");
    setFilePhase("uploading");
    try {
      for (let index = 0; index < job.chunks.length; index++) {
        setFileProgress({ done: index, total: job.chunks.length });
        // The chunk endpoint is idempotent for identical audio, so retrying is safe.
        for (let attempt = 1; ; attempt++) {
          try {
            const receipt = await checked(
              await fetch(`/api/meetings/${job.id}/chunks`, {
                method: "POST",
                headers: { "Content-Type": "audio/wav", "X-Chunk-Index": String(index) },
                body: encodeWav(job.chunks[index]!),
                signal: AbortSignal.timeout(60000),
              })
            );
            if (receipt?.index !== index) throw new Error("Audio upload was not confirmed.");
            break;
          } catch (cause) {
            if (attempt >= 3) throw cause;
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      setFileProgress({ done: job.chunks.length, total: job.chunks.length });
      await checked(
        await fetch(`/api/meetings/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            expectedChunks: job.chunks.length,
            durationSeconds:
              job.chunks.reduce((sum, chunk) => sum + chunk.length, 0) / AUDIO_SAMPLE_RATE,
          }),
        })
      );
      setFileJob(null);
      if (mounted.current) onFinished(job.id);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "Could not upload the file.");
      setFilePhase("idle");
    }
  }

  async function uploadFile(file: File) {
    setFileJob(null);
    setFileError("");
    setFilePhase("decoding");
    let job: { id: string; chunks: Int16Array[] };
    try {
      const chunks = sliceChunks(await decodeAudioFile(file));
      // No typed title → the "Untitled meeting" sentinel, which gets an AI-generated title after processing.
      const name = title.trim() || "Untitled meeting";
      const result = await checked(
        await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name }),
        })
      );
      if (typeof result?.meeting?.id !== "string")
        throw new Error("The meeting could not be created.");
      job = { id: result.meeting.id, chunks };
      setFileJob(job);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "Could not read the file.");
      setFilePhase("idle");
      return;
    }
    await sendFile(job);
  }

  function download(blob: Blob, index: number) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `breeze-audio-part-${index + 1}.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const fileBusy = filePhase !== "idle";
  const busy = phase !== "idle" || fileBusy;
  return (
    <div className="flex flex-col gap-6">
      {recoveries.length > 0 && !busy ? (
        <section className="bg-card animate-landing-rise rounded-3xl border p-6 shadow-xs sm:p-8">
          <p className="text-primary text-sm font-semibold">Unfinished</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance">Pick up where you left off</h2>
          <p className="text-muted-foreground mt-2 text-sm text-pretty">
            Audio already saved on this device can be uploaded and processed. The last incomplete
            two minute part may be unavailable after a browser interruption.
          </p>
          <ul className="mt-6 flex flex-col gap-2">
            {recoveries.map((item) => (
              <li
                key={item.id}
                className="bg-band flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-muted-foreground font-mono tabular-nums"> · {item.chunks} parts</span>
                </span>
                {item.chunks ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className={SMALL_BUTTON}
                    onClick={() => {
                      active.current = item;
                      void finish(item);
                    }}
                  >
                    <UploadSimpleIcon />
                    Recover
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={SMALL_BUTTON}
                    onClick={() =>
                      void deleteRecording(userId, item.id).then(() =>
                        setRecoveries((items) => items.filter((row) => row.id !== item.id))
                      )
                    }
                  >
                    Dismiss empty recording
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Arriving from the Record circle (autoStart), the clock well morphs in from the circle, so the
          card skips its own entrance instead of fading in around the well a second time. */}
      <div className={`bg-card rounded-3xl border p-3 shadow-xs ${autoStart ? "" : "animate-landing-rise [animation-delay:80ms]"}`}>
        {/* The clock: the hero of this screen once the tape is rolling. Outer 24px radius, 12px gap: 12px well. */}
        <RecordHandoff>
          <div
            className={`ease-fluid rounded-xl px-4 py-10 text-center transition-colors duration-700 ${
              phase === "recording"
                ? "bg-destructive/8"
                : phase === "saving"
                  ? "bg-primary/8"
                  : "bg-band"
            }`}
          >
            <span className="bg-card inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              {phase === "saving" || phase === "starting" ? (
                <CircleNotchIcon className="text-primary size-3 animate-spin" aria-hidden="true" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full transition-colors ${
                    phase === "recording"
                      ? "bg-destructive animate-pulse-ring"
                      : phase === "stopped"
                        ? "bg-primary"
                        : "bg-muted-foreground/40"
                  }`}
                />
              )}
              {phase === "recording"
                ? "Recording"
                : phase === "saving"
                  ? "Saving"
                  : phase === "starting"
                    ? "Getting ready"
                    : phase === "stopped"
                      ? "Stopped"
                      : "Standing by"}
            </span>
            <p
              className={`ease-fluid mt-6 font-mono text-5xl tracking-tight tabular-nums transition-colors duration-700 sm:text-6xl ${
                phase === "recording" || phase === "saving" || phase === "stopped"
                  ? "text-foreground"
                  : "text-muted-foreground/45"
              }`}
            >
              {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
              {String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            {/* Decorative live input level; the status pill above stays the accessible status. */}
            <AudioLevelMeter streams={levelStreams} active={phase === "recording"} />
            <p className="text-muted-foreground mx-auto mt-4 max-w-xs text-sm text-pretty" aria-live="polite">
              {phase === "recording"
                ? tabAttached
                  ? "Microphone and meeting tab · keep this tab open"
                  : "Microphone · keep this tab open"
                : phase === "saving"
                  ? "Saving your recording…"
                  : "Up to 4 hours · English and Spanish detected automatically"}
            </p>
          </div>
        </RecordHandoff>

        <div className="px-3 pt-6 pb-3">
          {/* The commitment. */}
          {phase === "idle" || phase === "starting" ? (
            <Button
              size="lg"
              className={MAIN_BUTTON}
              disabled={phase === "starting" || fileBusy}
              onClick={() => void start()}
            >
              <MicrophoneIcon weight="fill" />
              {phase === "starting" ? "Starting microphone…" : "Record meeting"}
            </Button>
          ) : null}
          {phase === "recording" ? (
            <Button
              size="lg"
              variant="destructive"
              className={MAIN_BUTTON}
              onClick={() => {
                setPhase("saving");
                recorder.current?.stop();
              }}
            >
              <StopIcon weight="fill" />
              Stop and save meeting
            </Button>
          ) : null}
          {phase === "stopped" && emergency.length === 0 ? (
            <Button
              size="lg"
              variant="secondary"
              className={MAIN_BUTTON}
              onClick={() => active.current && void finish(active.current)}
            >
              <ArrowClockwiseIcon />
              Retry saving
            </Button>
          ) : null}

          <details className="group/options mt-4">
            <summary className={SUMMARY}>
              <SlidersHorizontalIcon className="text-muted-foreground size-4" aria-hidden="true" />
              Meeting options
              <CaretDownIcon
                className="text-muted-foreground ease-fluid ml-auto size-4 transition-transform duration-300 group-open/options:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="flex flex-col gap-4 px-3 pt-4 pb-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="meeting-title" className="text-sm font-semibold">
                  Meeting name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  id="meeting-title"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    titleLatest.current = event.target.value;
                  }}
                  placeholder="Breeze will name it for you"
                  maxLength={160}
                  disabled={phase === "saving" || phase === "stopped" || fileBusy}
                  className="h-12 rounded-lg"
                />
              </div>
              {tabCaptureSupported ? (
                <div>
                  <Button
                    variant="outline"
                    className={`${SMALL_BUTTON} w-full`}
                    disabled={phase !== "recording" || addingTab}
                    onClick={() => {
                      if (tabAttached) {
                        detachTab.current?.();
                        detachTab.current = null;
                        setTabAttached(false);
                      } else void addTab();
                    }}
                  >
                    <MonitorIcon />
                    {addingTab
                      ? "Choosing tab…"
                      : tabAttached
                        ? "Remove meeting tab"
                        : "Add meeting tab audio"}
                  </Button>
                  <p className="text-muted-foreground mt-2 text-xs text-pretty">
                    {phase === "recording"
                      ? "Choose the meeting tab and enable Share tab audio. Use headphones to avoid capturing voices twice."
                      : "Start recording, then add a meeting tab here anytime."}
                  </p>
                </div>
              ) : null}
            </div>
          </details>

          {error ? (
            <div role="alert" className={ALERT}>
              <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{error}</span>
            </div>
          ) : null}
          {uploadStatus ? (
            <p role="status" className="text-muted-foreground mt-4 text-center text-sm">
              {uploadStatus}
            </p>
          ) : null}

          {emergency.length > 0 ? (
            <div className="border-destructive/25 bg-destructive/5 mt-4 flex flex-col gap-3 rounded-xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <DownloadSimpleIcon className="text-destructive size-4" aria-hidden="true" />
                Keep a copy before you leave
              </p>
              <div className="flex flex-wrap gap-2">
                {emergency.map((item) => (
                  <Button
                    key={item.index}
                    variant="outline"
                    size="sm"
                    className={SMALL_BUTTON}
                    onClick={() => download(item.blob, item.index)}
                  >
                    <DownloadSimpleIcon />
                    Part {item.index + 1}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bg-border mt-6 h-px" />
          <div className="mt-4 flex items-start gap-3">
            <ShieldCheckIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-muted-foreground text-xs text-pretty">
              Let everyone know you’re recording. Keep this tab open until you stop and save.
            </p>
          </div>
        </div>
      </div>

      <details className="group/upload bg-card animate-landing-rise rounded-3xl border p-3 shadow-xs [animation-delay:160ms]">
        <summary className={SUMMARY}>
          <UploadSimpleIcon className="text-muted-foreground size-4" aria-hidden="true" />
          Upload an existing recording
          <CaretDownIcon
            className="text-muted-foreground ease-fluid ml-auto size-4 transition-transform duration-300 group-open/upload:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="px-3 pt-2 pb-3">
          <p className="text-muted-foreground text-sm text-pretty">
            Audio or video, up to 4 hours. Breeze will name the meeting automatically.
          </p>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file && !busy) void uploadFile(file);
            }}
            className={`ease-fluid focus-within:ring-ring/50 mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-300 focus-within:ring-[3px] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
              dragging ? "border-primary bg-primary/5" : "bg-band hover:border-foreground/30"
            }`}
          >
            <input
              type="file"
              accept="audio/*,video/*"
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              {fileBusy ? (
                <CircleNotchIcon className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <UploadSimpleIcon className="size-6" aria-hidden="true" />
              )}
            </span>
            <span className="text-sm font-semibold">
              {filePhase === "decoding"
                ? "Decoding…"
                : filePhase === "uploading"
                  ? `Uploading part ${Math.min(fileProgress.done + 1, fileProgress.total)} of ${fileProgress.total}`
                  : "Choose a file or drop it here"}
            </span>
            <span className="text-muted-foreground text-xs">MP3, M4A, WAV, OGG, WebM, MP4, MOV</span>
          </label>

          {filePhase === "uploading" ? (
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={fileProgress.total}
              aria-valuenow={fileProgress.done}
              className="bg-muted mt-4 h-1.5 overflow-hidden rounded-full"
            >
              <div
                className="bg-primary ease-fluid h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(fileProgress.done / fileProgress.total) * 100}%` }}
              />
            </div>
          ) : null}

          {fileError ? (
            <div role="alert" className={ALERT}>
              <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{fileError}</span>
            </div>
          ) : null}
          {fileError && fileJob && !busy ? (
            <Button
              variant="secondary"
              className={`${SMALL_BUTTON} mt-4 w-full`}
              onClick={() => void sendFile(fileJob)}
            >
              <ArrowCounterClockwiseIcon />
              Retry upload
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
