import { AUDIO_SAMPLE_RATE } from "./audio-recorder";
import { CHUNK_SECONDS, MAX_MEETING_SECONDS, MIN_CHUNK_SECONDS } from "./meeting-types";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const CHUNK_SAMPLES = CHUNK_SECONDS * AUDIO_SAMPLE_RATE;
const MIN_CHUNK_SAMPLES = MIN_CHUNK_SECONDS * AUDIO_SAMPLE_RATE;
const QUIET_WINDOW = AUDIO_SAMPLE_RATE / 10;
const QUIET_STRIDE = QUIET_WINDOW / 10;

/** Averages all channels into one PCM16 track, same scaling as the capture worklet. */
export function mixToInt16(channels: Float32Array[]): Int16Array {
  const length = channels[0]?.length ?? 0;
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const channel of channels) sum += channel[i]!;
    const sample = Math.max(-1, Math.min(1, sum / channels.length));
    out[i] = Math.round(sample * (sample < 0 ? 32768 : 32767));
  }
  return out;
}

/** Center of the lowest-energy 100 ms window whose center lies in [from, to]. Mirrored in public/audio-capture-worklet.js. */
export function quietestCut(samples: Int16Array, from: number, to: number): number {
  const half = QUIET_WINDOW / 2;
  const power = (i: number) => (i >= 0 && i < samples.length ? samples[i]! * samples[i]! : 0);
  // Sliding sum: the capture worklet runs this on the audio thread, so no per-window rescans.
  let energy = 0;
  for (let i = from - half; i < from + half; i++) energy += power(i);
  let best = from, bestEnergy = energy;
  for (let center = from + QUIET_STRIDE; center <= to; center += QUIET_STRIDE) {
    for (let i = center - QUIET_STRIDE; i < center; i++) energy += power(i + half) - power(i - half);
    if (energy < bestEnergy) { bestEnergy = energy; best = center; }
  }
  return best;
}

/**
 * Splits into parts of MIN_CHUNK_SECONDS–CHUNK_SECONDS, cut at the quietest moment so words aren't split;
 * only the last may be shorter (the server requires this).
 */
export function sliceChunks(samples: Int16Array): Int16Array[] {
  const chunks: Int16Array[] = [];
  for (let start = 0; start < samples.length; ) {
    const end = samples.length - start > CHUNK_SAMPLES
      // Stop half a window short of 120 s: the live worklet has no audio past it to score later windows.
      ? quietestCut(samples, start + MIN_CHUNK_SAMPLES, start + CHUNK_SAMPLES - QUIET_WINDOW / 2)
      : samples.length;
    chunks.push(samples.subarray(start, end));
    start = end;
  }
  return chunks;
}

/** Decodes any browser-supported audio/video file to 16 kHz mono PCM16. Throws user-facing messages. */
export async function decodeAudioFile(file: File): Promise<Int16Array> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files up to 500 MB are supported.");
  // decodeAudioData resamples to the context's rate, so a 16 kHz context does the resampling.
  // ponytail: the whole file is decoded in memory (~1 GB peak for a 4-hour stereo file);
  // switch to streaming decode (WebCodecs AudioDecoder) if long uploads crash tabs.
  const context = new OfflineAudioContext(1, 1, AUDIO_SAMPLE_RATE);
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(
      "This file's audio format isn't supported by your browser. Try an MP3, M4A or WAV file."
    );
  }
  if (buffer.duration > MAX_MEETING_SECONDS)
    throw new Error("Files up to 4 hours long are supported.");
  if (buffer.length === 0) throw new Error("This file doesn't contain any audio.");
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i)
  );
  return mixToInt16(channels);
}
