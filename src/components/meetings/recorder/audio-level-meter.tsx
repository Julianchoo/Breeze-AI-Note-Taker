"use client";

import { useEffect, useRef } from "react";

/* Live input level for the web recorder's clock well (DESIGN.md "Landing system", recorder card).

   Read only by construction: it opens its own analysis AudioContext and attaches a
   MediaStreamAudioSourceNode to the streams the recorder already captured. A MediaStream can feed
   any number of source nodes, each reading its own copy of the samples, so this tap cannot change
   what captureAudio() records, encodes, chunks, caches or uploads. It never calls getUserMedia, never
   stops, mutes or clones a track, and never touches the recorder's own AudioContext. Any failure
   here is swallowed: the meter just stays flat. */

const BAR_COUNT = 32;
const BAR_INDEXES = Array.from({ length: BAR_COUNT }, (_, index) => index);
/* A new bar enters every ~70ms, so the row shows roughly the last two seconds of sound. */
const STEP_MS = 70;
/* Reduced motion: no scrolling history; a still level meter refreshed twice a second. */
const REDUCED_MOTION_STEP_MS = 500;
const ANALYSER_FFT_SIZE = 1024;
/* Speech with noise suppression sits around -35 to -15 dBFS; map that range to most of the height. */
const FLOOR_DB = -60;
const CEILING_DB = -10;
const MIN_SCALE = 0.08;

function rmsLevel(samples: Float32Array) {
  let sum = 0;
  for (let index = 0; index < samples.length; index++) sum += samples[index]! * samples[index]!;
  const rms = Math.sqrt(sum / samples.length);
  const decibels = 20 * Math.log10(Math.max(rms, 1e-8));
  return Math.min(1, Math.max(0, (decibels - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
}

function settleFlat(bars: readonly HTMLElement[]) {
  for (const bar of bars) {
    bar.style.transform = `scaleY(${MIN_SCALE})`;
    bar.style.opacity = "";
  }
}

export function AudioLevelMeter({
  streams,
  active,
}: {
  /** Streams the recorder is already capturing. Read only: tracks are never stopped here. */
  streams: readonly MediaStream[];
  /** True only while audio is being captured; otherwise the bars settle flat. */
  active: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = row.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLElement[];
    if (!active || streams.length === 0 || typeof window.AudioContext !== "function") {
      settleFlat(bars);
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContext({ latencyHint: "interactive" });
    } catch {
      settleFlat(bars);
      return;
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = ANALYSER_FFT_SIZE;
    // Some engines only pull an analyser that reaches the destination; a muted gain keeps it
    // silent, so nothing is played back and no echo can reach the microphone.
    const sink = context.createGain();
    sink.gain.value = 0;
    analyser.connect(sink).connect(context.destination);

    const sources: MediaStreamAudioSourceNode[] = [];
    for (const stream of streams) {
      const tracks = stream.getAudioTracks().filter((track) => track.readyState === "live");
      if (!tracks.length) continue;
      try {
        // READ-ONLY TAP: a new source node over the same live tracks. No track is stopped or changed.
        const source = context.createMediaStreamSource(new MediaStream(tracks));
        source.connect(analyser);
        sources.push(source);
      } catch {
        // Unsupported or already ended source: leave it out of the meter, never out of the recording.
      }
    }
    // Autoplay policy may hold a fresh context suspended; the meter then stays flat, harmlessly.
    void context.resume().catch(() => undefined);

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const step = reducedMotion ? REDUCED_MOTION_STEP_MS : STEP_MS;
    const samples = new Float32Array(analyser.fftSize);
    const history = new Float32Array(BAR_COUNT);
    let peak = 0;
    let lastStep = 0;
    let frame = 0;

    const paint = () => {
      if (reducedMotion) {
        // Still bars lit from left to right up to the current level, like a hardware VU meter.
        const lit = Math.round(history[BAR_COUNT - 1]! * BAR_COUNT);
        bars.forEach((bar, index) => {
          bar.style.transform = "scaleY(0.5)";
          bar.style.opacity = index < lit ? "1" : "0.25";
        });
        return;
      }
      bars.forEach((bar, index) => {
        bar.style.transform = `scaleY(${Math.max(MIN_SCALE, history[index]!)})`;
      });
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      analyser.getFloatTimeDomainData(samples);
      // Keep the loudest moment between steps so short syllables still show.
      peak = Math.max(peak, rmsLevel(samples));
      if (now - lastStep < step) return;
      lastStep = now;
      history.copyWithin(0, 1);
      history[BAR_COUNT - 1] = peak;
      peak = 0;
      paint();
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      // Disconnect only the meter's own nodes and close only its own context. The recorder owns
      // the tracks and stops them itself when it finishes.
      for (const source of sources) source.disconnect();
      analyser.disconnect();
      sink.disconnect();
      void context.close().catch(() => undefined);
      settleFlat(bars);
    };
  }, [active, streams]);

  return (
    <div
      ref={row}
      aria-hidden="true"
      className="mx-auto mt-6 flex h-10 max-w-full items-center justify-center gap-1 overflow-hidden"
    >
      {BAR_INDEXES.map((index) => (
        <span
          key={index}
          style={{ transform: `scaleY(${MIN_SCALE})` }}
          className={`h-full w-1 shrink-0 origin-center rounded-full transition-[transform,opacity,background-color] ${
            active
              ? "bg-destructive/70 duration-100 ease-linear"
              : "bg-muted-foreground/30 ease-fluid duration-700"
          }`}
        />
      ))}
    </div>
  );
}
