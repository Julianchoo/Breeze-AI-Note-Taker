"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Mic,
  Monitor,
  RotateCcw,
  ShieldCheck,
  Square,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decodeAudioFile, sliceChunks } from "@/lib/audio-file";
import { AUDIO_SAMPLE_RATE, captureAudio, encodeWav } from "@/lib/audio-recorder";
import {
  cacheChunk,
  deleteChunk,
  deleteRecording,
  listRecordings,
  readChunk,
  saveRecording,
  type CachedRecording,
} from "@/lib/recording-cache";

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
}: {
  userId: string;
  onFinished: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("tab");
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
        if (!chunk) continue;
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
        await deleteChunk(userId, recording.id, index);
      }
      setUploadStatus("Audio saved to your private storage.");
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
      await upload(recording);
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
      await deleteRecording(recording.id);
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

  async function start() {
    setError("");
    setPhase("starting");
    cacheFailed.current = false;
    const streams: MediaStream[] = [];
    acquired.current = streams;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Open Breeze in Chrome or Edge on desktop using HTTPS or localhost.");
      // Must be invoked directly from the click, before any other awaited operation.
      if (mode === "tab") {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.push(display);
        if (!display.getAudioTracks().length)
          throw new Error("Select a browser tab and enable “Share tab audio”, then try again.");
      }
      streams.push(
        await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
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
      if (!mounted.current) throw new Error("Recording cancelled.");
      recorder.current = await captureAudio(
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
      // This function runs only from the Start button's click handler.
      // eslint-disable-next-line react-hooks/purity
      startedAt.current = performance.now();
      setElapsed(0);
      setPhase("recording");
    } catch (cause) {
      streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      setError(cause instanceof Error ? cause.message : "Could not start recording.");
      setPhase(active.current ? "stopped" : "idle");
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
    <div className="space-y-6">
      {recoveries.length > 0 && !busy ? (
        <section className="bg-card animate-fade-up rounded-2xl border p-5 sm:p-6">
          <p className="eyebrow">Unfinished</p>
          <h2 className="font-display mt-1.5 text-2xl">Pick up where you left off</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Audio already saved on this device can be uploaded and processed. The last incomplete
            two-minute part may be unavailable after a browser interruption.
          </p>
          <div className="rule-fade my-5 h-px" />
          <ul className="space-y-2">
            {recoveries.map((item) => (
              <li
                key={item.id}
                className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground"> · {item.chunks} parts</span>
                </span>
                {item.chunks ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      active.current = item;
                      void finish(item);
                    }}
                  >
                    <UploadCloud />
                    Recover
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void deleteRecording(item.id).then(() =>
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

      <div className="bg-card animate-fade-up rounded-2xl border p-5 shadow-sm sm:p-8">
        {/* Step 1 — name. Quiet, it is the least important decision here. */}
        <div className="space-y-2">
          <label htmlFor="meeting-title" className="text-sm font-medium">
            Meeting name
          </label>
          <Input
            id="meeting-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Monday product catch-up"
            maxLength={160}
            disabled={busy}
            className="h-11 rounded-lg"
          />
        </div>

        {/* Step 2 — source. Native radios styled as selectable cards via has-[:checked]. */}
        <fieldset disabled={busy} className="mt-7 disabled:opacity-60">
          <legend className="mb-3 text-sm font-medium">What would you like to record?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="group has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:bg-accent/40 focus-within:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-[3px] has-[:disabled]:cursor-not-allowed">
              <input
                type="radio"
                name="audio-source"
                value="tab"
                checked={mode === "tab"}
                onChange={() => setMode("tab")}
                className="accent-primary mt-0.5 size-4 shrink-0"
              />
              <Monitor className="text-muted-foreground group-has-[:checked]:text-primary size-5 shrink-0 transition-colors" />
              <span className="min-w-0 text-sm font-medium">
                Microphone + meeting tab
                <span className="text-muted-foreground mt-1 block text-xs leading-relaxed font-normal">
                  Choose the meeting tab and enable Share tab audio.
                </span>
              </span>
            </label>
            <label className="group has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:bg-accent/40 focus-within:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-[3px] has-[:disabled]:cursor-not-allowed">
              <input
                type="radio"
                name="audio-source"
                value="mic"
                checked={mode === "mic"}
                onChange={() => setMode("mic")}
                className="accent-primary mt-0.5 size-4 shrink-0"
              />
              <Mic className="text-muted-foreground group-has-[:checked]:text-primary size-5 shrink-0 transition-colors" />
              <span className="min-w-0 text-sm font-medium">
                Microphone only
                <span className="text-muted-foreground mt-1 block text-xs leading-relaxed font-normal">
                  For conversations in the room or personal notes.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {/* Step 3 — the clock. The hero of this screen once the tape is rolling. */}
        <div
          className={`mt-7 rounded-2xl border px-4 py-8 text-center transition-colors duration-500 ${
            phase === "recording"
              ? "border-destructive/30 bg-destructive/5"
              : phase === "saving"
                ? "border-primary/30 bg-primary/5"
                : "bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-center gap-2.5">
            <span
              className={`size-2.5 rounded-full transition-colors ${
                phase === "recording"
                  ? "bg-destructive animate-pulse-ring"
                  : phase === "saving"
                    ? "bg-primary"
                    : "bg-muted-foreground/40"
              }`}
            />
            <span className="eyebrow">
              {phase === "recording"
                ? "Recording"
                : phase === "saving"
                  ? "Saving"
                  : phase === "starting"
                    ? "Getting ready"
                    : "Standing by"}
            </span>
          </div>
          <p
            className={`mt-5 font-mono text-5xl tracking-tight tabular-nums transition-colors duration-500 sm:text-6xl ${
              phase === "recording" || phase === "saving" || phase === "stopped"
                ? "text-foreground"
                : "text-muted-foreground/45"
            }`}
          >
            {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
            {String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </p>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xs text-sm" aria-live="polite">
            {phase === "recording"
              ? "Recording · keep this tab open"
              : phase === "saving"
                ? "Saving your recording…"
                : "Up to 4 hours · English & Spanish detected automatically"}
          </p>
        </div>

        {/* Step 4 — the commitment. */}
        <div className="mt-6">
          {phase === "idle" || phase === "starting" ? (
            <Button
              size="lg"
              className="w-full"
              disabled={phase === "starting" || fileBusy}
              onClick={() => void start()}
            >
              <Mic />
              {phase === "starting" ? "Preparing recording…" : "Start recording"}
            </Button>
          ) : null}
          {phase === "recording" ? (
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={() => {
                setPhase("saving");
                recorder.current?.stop();
              }}
            >
              <Square />
              Stop & save meeting
            </Button>
          ) : null}
          {phase === "stopped" && emergency.length === 0 ? (
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={() => active.current && void finish(active.current)}
            >
              <UploadCloud />
              Retry saving
            </Button>
          ) : null}
        </div>

        {error ? (
          <p
            role="alert"
            className="text-destructive border-destructive/30 bg-destructive/5 mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
          >
            {error}
          </p>
        ) : null}
        {uploadStatus ? (
          <p role="status" className="text-muted-foreground mt-4 text-center text-sm">
            {uploadStatus}
          </p>
        ) : null}

        {emergency.length > 0 ? (
          <div className="border-destructive/30 bg-destructive/5 mt-4 space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Keep a copy before you leave</p>
            <div className="flex flex-wrap gap-2">
              {emergency.map((item) => (
                <Button
                  key={item.index}
                  variant="outline"
                  size="sm"
                  onClick={() => download(item.blob, item.index)}
                >
                  <Download />
                  Part {item.index + 1}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rule-fade mt-7 h-px" />
        <div className="mt-5 flex items-start gap-3">
          <ShieldCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Let everyone know you are recording. Audio is kept privately. Use headphones to avoid
            capturing speaker audio twice.
          </p>
        </div>
      </div>

      <section className="bg-card animate-fade-up rounded-2xl border p-5 shadow-sm [animation-delay:120ms] sm:p-8">
        <p className="eyebrow">Already recorded?</p>
        <h2 className="font-display mt-1.5 text-2xl">Upload a file</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Audio or video, up to 4 hours. Uses the meeting name above, or the file name.
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
          className={`focus-within:ring-ring/50 mt-5 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors focus-within:ring-[3px] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
            dragging ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/40"
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
          <span className="bg-muted flex size-14 items-center justify-center rounded-full">
            <UploadCloud className="text-muted-foreground size-6" />
          </span>
          <span className="text-sm font-medium">
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
              className="bg-primary h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(fileProgress.done / fileProgress.total) * 100}%` }}
            />
          </div>
        ) : null}

        {fileError ? (
          <div
            role="alert"
            className="text-destructive border-destructive/25 bg-destructive/5 mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">{fileError}</span>
          </div>
        ) : null}
        {fileError && fileJob && !busy ? (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => void sendFile(fileJob)}
          >
            <RotateCcw />
            Retry upload
          </Button>
        ) : null}
      </section>
    </div>
  );
}
