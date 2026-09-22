"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Monitor, Square, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureAudio } from "@/lib/audio-recorder";
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

  function download(blob: Blob, index: number) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `breeze-audio-part-${index + 1}.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const busy = phase !== "idle";
  return (
    <div className="space-y-6">
      {recoveries.length > 0 && phase === "idle" ? (
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Recover an unfinished recording</h2>
          <p className="text-muted-foreground text-sm">
            Audio already saved on this device can be uploaded and processed. The last incomplete
            two-minute part may be unavailable after a browser interruption.
          </p>
          {recoveries.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm">
                {item.title} · {item.chunks} parts
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
            </div>
          ))}
        </div>
      ) : null}
      <div className="bg-card space-y-6 rounded-xl border p-6">
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
          />
        </div>
        <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-2 text-sm font-medium">What would you like to record?</legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="audio-source"
              value="tab"
              checked={mode === "tab"}
              onChange={() => setMode("tab")}
            />
            <Monitor className="text-muted-foreground size-5" />
            <span className="text-sm">
              Microphone + meeting tab
              <span className="text-muted-foreground block text-xs">
                Choose the meeting tab and enable Share tab audio.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
            <input
              type="radio"
              name="audio-source"
              value="mic"
              checked={mode === "mic"}
              onChange={() => setMode("mic")}
            />
            <Mic className="text-muted-foreground size-5" />
            <span className="text-sm">
              Microphone only
              <span className="text-muted-foreground block text-xs">
                For conversations in the room or personal notes.
              </span>
            </span>
          </label>
        </fieldset>
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <p className="font-mono text-4xl tabular-nums">
            {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:
            {String(Math.floor(elapsed / 60) % 60).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </p>
          <p className="text-muted-foreground mt-2 text-sm" aria-live="polite">
            {phase === "recording"
              ? "Recording · keep this tab open"
              : phase === "saving"
                ? "Saving your recording…"
                : "Up to 4 hours · English & Spanish detected automatically"}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Let everyone know you are recording. Audio is kept privately. Use headphones to avoid
          capturing speaker audio twice.
        </p>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {uploadStatus ? (
          <p role="status" className="text-muted-foreground text-sm">
            {uploadStatus}
          </p>
        ) : null}
        {phase === "idle" || phase === "starting" ? (
          <Button
            size="lg"
            className="w-full"
            disabled={phase === "starting"}
            onClick={() => void start()}
          >
            <Mic />
            {phase === "starting" ? "Preparing recording…" : "Start recording"}
          </Button>
        ) : null}
        {phase === "recording" ? (
          <Button
            size="lg"
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
          <Button onClick={() => active.current && void finish(active.current)}>
            <UploadCloud />
            Retry saving
          </Button>
        ) : null}
        {emergency.map((item) => (
          <Button
            key={item.index}
            variant="outline"
            onClick={() => download(item.blob, item.index)}
          >
            Download unsaved audio part {item.index + 1}
          </Button>
        ))}
      </div>
    </div>
  );
}
