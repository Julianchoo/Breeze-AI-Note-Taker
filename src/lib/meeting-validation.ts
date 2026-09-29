import { CHUNK_SECONDS, MAX_CHUNKS, MIN_CHUNK_SECONDS, type TranscriptSegment } from "./meeting-types";

export class MeetingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
// A per-minute rate limit: not a failure, the caller waits `waitMs` and continues.
export class RateLimited extends MeetingError {
  constructor(public waitMs: number) { super("OpenAI is rate limiting requests. Wait a minute and retry.", 502); }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new MeetingError("Invalid request origin.", 403);
}
export function chunkIndex(value: string | null) {
  if (!value || !/^\d+$/.test(value)) throw new MeetingError("Invalid chunk index.");
  const index = Number(value);
  if (index < 0 || index >= MAX_CHUNKS) throw new MeetingError("Recording exceeds four hours.");
  return index;
}
export const MAX_WAV_BYTES = 44 + CHUNK_SECONDS * 16000 * 2;
// The recorder emits this canonical PCM format. Reject ambiguous/unsupported WAVs.
export function wavDuration(wav: Buffer) {
  if (wav.length < 46 || wav.length > MAX_WAV_BYTES ||
      wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE" ||
      wav.toString("ascii", 12, 16) !== "fmt " || wav.readUInt32LE(16) !== 16 ||
      wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt32LE(24) !== 16000 ||
      wav.readUInt32LE(28) !== 32000 || wav.readUInt16LE(32) !== 2 || wav.readUInt16LE(34) !== 16 ||
      wav.toString("ascii", 36, 40) !== "data" || wav.readUInt32LE(40) !== wav.length - 44 ||
      wav.readUInt32LE(4) !== wav.length - 8 || (wav.length - 44) % 2 !== 0) {
    throw new MeetingError("Expected a 16 kHz mono PCM16 WAV of up to two minutes.");
  }
  return (wav.length - 44) / 32000;
}
// A meeting's parts joined into one WAV: part 0's header with the total size, then every part's PCM after its own 44-byte header.
export function joinedWavHeader(first: Buffer, dataBytes: number) {
  const header = Buffer.from(first.subarray(0, 44)); header.writeUInt32LE(36 + dataBytes, 4); header.writeUInt32LE(dataBytes, 40);
  return header;
}
// Canonical parts (see wavDuration) hold exactly duration × 32000 PCM bytes, so the joined layout is known without downloading.
export const partDataBytes = (durationSeconds: number) => Math.round(durationSeconds * 32000);
/** Byte ranges of the part files that make up bytes [start, end) of the joined WAV; part -1 is the joined header. */
export function joinedWavPieces(dataBytes: number[], start: number, end: number) {
  const pieces: { part: number; from: number; to: number }[] = [];
  for (let part = -1, at = 0; part < dataBytes.length && at < end; part++) {
    const length = part < 0 ? 44 : dataBytes[part]!, skip = part < 0 ? 0 : 44, from = Math.max(start, at), to = Math.min(end, at + length);
    if (from < to) pieces.push({ part, from: from - at + skip, to: to - at + skip });
    at += length;
  }
  return pieces;
}
export function validateChunkSequence(chunks: { index: number; durationSeconds: number }[], expected: number) {
  if (!Number.isInteger(expected) || expected < 1 || expected > MAX_CHUNKS || chunks.length !== expected ||
      chunks.some((chunk, index) => chunk.index !== index || (index < expected - 1 && (chunk.durationSeconds < MIN_CHUNK_SECONDS || chunk.durationSeconds > CHUNK_SECONDS)))) {
    throw new MeetingError("Some audio parts are missing. Retry saving before finishing.", 409);
  }
}
// Soniox tokens carry their own spacing. A segment ends on a speaker change, or at a sentence end once it lasts 20 s.
export function tokensToSegments(tokens: { text: string; start_ms: number; end_ms: number; speaker?: string | number | null | undefined }[]) {
  const segments: TranscriptSegment[] = [];
  for (const t of tokens) {
    const speaker = t.speaker == null ? "Unknown speaker" : `Speaker ${t.speaker}`, last = segments[segments.length - 1];
    if (last && last.speaker === speaker && !(/[.?!]\s*$/.test(last.text) && last.end - last.start >= 20)) { last.text += t.text; last.end = t.end_ms / 1000; }
    else segments.push({ start: t.start_ms / 1000, end: t.end_ms / 1000, text: t.text, speaker });
  }
  return segments.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text);
}
// Each segment belongs to the part its start falls in; part starts are the sum of earlier part durations.
export function segmentsByChunk(segments: TranscriptSegment[], durations: number[]) {
  const parts = durations.map(() => [] as TranscriptSegment[]);
  for (const s of segments) {
    let i = 0, end = durations[0] ?? 0;
    while (i < durations.length - 1 && s.start >= end) end += durations[++i]!;
    parts[i]?.push(s);
  }
  return parts;
}
// Groups whole transcript lines into parts of at most maxChars (joined with "\n"); a longer line is hard-split on its own.
export function splitTranscript(lines: string[], maxChars: number) {
  const parts: string[] = []; let current: string | undefined;
  for (const line of lines) {
    if (current !== undefined && current.length + 1 + line.length <= maxChars) { current += "\n" + line; continue; }
    if (current !== undefined) parts.push(current);
    current = line;
    while (current.length > maxChars) { parts.push(current.slice(0, maxChars)); current = current.slice(maxChars); }
  }
  if (current !== undefined) parts.push(current);
  return parts;
}
/* Soniox reports no progress, so the UI estimates it from elapsed time: ~10 s + d/20 to transcribe and ~15 s + d/30
   to summarize d seconds of audio. Each phase eases to 90% at its expected time, then creeps towards 99%. */
export function estimateProgress(audioSeconds: number, transcribed: boolean, elapsedSeconds: number) {
  const t1 = 10 + audioSeconds / 20, t2 = 15 + audioSeconds / 30, w1 = t1 / (t1 + t2);
  const expected = transcribed ? t2 : t1, t = Math.max(0, elapsedSeconds);
  const f = t < expected ? 0.9 * t / expected : 0.9 + 0.09 * (1 - Math.exp(-(t - expected) / expected));
  // Capped: the ceiling is 99.x% for long recordings, which would otherwise round to a premature 100%.
  return Math.min(99, Math.round(100 * (transcribed ? w1 + (1 - w1) * f : w1 * f)));
}
