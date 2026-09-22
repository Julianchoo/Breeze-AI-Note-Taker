import { CHUNK_SECONDS, MAX_CHUNKS } from "./meeting-types";

export class MeetingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
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
export function validateChunkSequence(chunks: { index: number; durationSeconds: number }[], expected: number) {
  if (!Number.isInteger(expected) || expected < 1 || expected > MAX_CHUNKS || chunks.length !== expected ||
      chunks.some((chunk, index) => chunk.index !== index || (index < expected - 1 && chunk.durationSeconds !== CHUNK_SECONDS))) {
    throw new MeetingError("Some audio parts are missing. Retry saving before finishing.", 409);
  }
}
