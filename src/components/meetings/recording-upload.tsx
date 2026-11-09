"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  ArrowSquareOutIcon,
  CircleNotchIcon,
  UploadSimpleIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { decodeAudioFile, sliceChunks } from "@/lib/audio-file";
import { AUDIO_SAMPLE_RATE, encodeWav } from "@/lib/audio-recorder";

/* Landing system classes (DESIGN.md "Landing system"), matching the recorders' disclosures and alerts. */
const SUMMARY =
  "ease-fluid hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-details-marker]:hidden";
const ALERT =
  "text-destructive border-destructive/25 bg-destructive/5 mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm";

type FileJob = { id: string; chunks: Int16Array[] };

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

/**
 * "Upload an existing recording" card, shared by the web and Android recorders. Decodes the file in
 * the page (Web Audio, also inside the Android WebView), creates a meeting and sends the audio in
 * parts through the same chunk API the live recorder uses.
 */
export function RecordingUpload({
  title,
  disabled = false,
  onBusyChange,
  onFinished,
  featured = false,
  className = "",
  browserHref,
}: {
  /** Meeting name typed in the recorder's options; empty means Breeze names it. */
  title: string;
  /** The recorder is busy (starting, recording or saving): no upload may start meanwhile. */
  disabled?: boolean;
  /** Told whenever a decode or upload starts or ends, so the recorder can lock its own controls. */
  onBusyChange?: (busy: boolean) => void;
  onFinished: (id: string) => void;
  /** Upload mode (`/meetings/new?upload=1`): open the card, bring it into view and focus the picker. */
  featured?: boolean;
  /** Entrance delay class, e.g. `[animation-delay:160ms]`. */
  className?: string;
  /** Set inside an APK that can't open the file picker: offer this page in the phone's browser instead. */
  browserHref?: string | undefined;
}) {
  const [filePhase, setFilePhase] = useState<"idle" | "decoding" | "uploading">("idle");
  const [fileProgress, setFileProgress] = useState({ done: 0, total: 0 });
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  // Kept after a failed upload so Retry resumes the same meeting instead of creating another.
  const [fileJob, setFileJob] = useState<FileJob | null>(null);
  const mounted = useRef(true);
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fileBusy = filePhase !== "idle";
  useEffect(() => {
    onBusyChangeRef.current?.(fileBusy);
  }, [fileBusy]);

  // Open before the first paint so upload mode never flashes a closed card. The `open` attribute is
  // set once here rather than as a prop, so later re-renders never fight the visitor's own toggling.
  useLayoutEffect(() => {
    if (!featured || !details.current) return;
    details.current.open = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    details.current.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    // Focusing the (visually hidden) input lets Enter or Space open the file picker right away.
    input.current?.focus({ preventScroll: true });
  }, [featured]);

  const busy = disabled || fileBusy;

  async function sendFile(job: FileJob) {
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
    let job: FileJob;
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

  return (
    <details
      ref={details}
      className={`group/upload bg-card animate-landing-rise rounded-3xl border p-3 shadow-xs ${className}`}
    >
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
        {browserHref ? (
          <div className="bg-band mt-4 flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center">
            <p className="text-sm font-semibold text-balance">
              This version of the app can&apos;t open your files
            </p>
            <p className="text-muted-foreground text-sm text-pretty">
              Upload from your phone&apos;s browser instead. Your meeting shows up here too.
            </p>
            <a
              href={browserHref}
              className="bg-primary text-primary-foreground ease-fluid focus-visible:ring-ring/50 hover:bg-primary/90 mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
            >
              <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
              Upload in your browser
            </a>
          </div>
        ) : (
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
              ref={input}
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
            <span className="text-muted-foreground text-xs">
              MP3, M4A, WAV, OGG, WebM, MP4, MOV
            </span>
          </label>
        )}

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
            className="ease-fluid mt-4 w-full font-semibold duration-300"
            onClick={() => void sendFile(fileJob)}
          >
            <ArrowCounterClockwiseIcon />
            Retry upload
          </Button>
        ) : null}
      </div>
    </details>
  );
}
