/** Bridge exposed only by the Android app on its configured HTTPS origin. */
export interface NativeRecording {
  id: string;
  userId: string;
  title: string;
  chunks: number;
  samples: number;
  stopped: boolean;
  finished: boolean;
  startedAt: number;
  uploaded: number[];
  error?: string;
}
interface AndroidBridge {
  signIn?(): void;
  getAppInfo?(): string;
  exportRecording?(id: string, userId: string): string;
  startRecording(id: string, userId: string, title: string): string;
  stopRecording(): string;
  getRecordings(userId: string): string;
  getSavedRecordings?(userId: string): string;
  getRecording(id: string, userId: string): string;
  readChunk(id: string, userId: string, index: number): string;
  markChunkUploaded(id: string, userId: string, index: number): string;
  markFinished(id: string, userId: string): string;
}
declare global {
  interface Window { BreezeAndroid?: AndroidBridge }
}
export function hasAndroidRecorder() {
  return typeof window !== "undefined" && !!window.BreezeAndroid;
}
export function parseNativeResult<T>(raw: string): T {
  const result = JSON.parse(raw);
  if (!result || result.ok !== true) {
    throw new Error(typeof result?.error === "string" ? result.error : "Android recorder returned an invalid response.");
  }
  return result as T;
}
function bridge() {
  if (!hasAndroidRecorder()) throw new Error("Android recorder is unavailable.");
  return window.BreezeAndroid!;
}
export function nativeRecordings(userId: string) {
  const recorder = bridge();
  const pending = parseNativeResult<{recordings: NativeRecording[]}>(recorder.getRecordings(userId)).recordings;
  const saved = recorder.getSavedRecordings
    ? parseNativeResult<{recordings: NativeRecording[]}>(recorder.getSavedRecordings(userId)).recordings
    : [];
  return [...new Map([...pending, ...saved].map((item) => [item.id, item])).values()];
}
export function nativeRecording(id: string, userId: string) {
  return parseNativeResult<{recording: NativeRecording}>(bridge().getRecording(id, userId)).recording;
}
export function startNativeRecording(id: string, userId: string, title: string) {
  return parseNativeResult<{recording: NativeRecording}>(bridge().startRecording(id, userId, title)).recording;
}
export function exportNativeRecording(id: string, userId: string) {
  const recorder = bridge();
  if (!recorder.exportRecording) throw new Error("Update the Android app to export saved audio.");
  parseNativeResult(recorder.exportRecording(id, userId));
}
export function stopNativeRecording() {
  return parseNativeResult<{recording: NativeRecording}>(bridge().stopRecording()).recording;
}
export async function checkedNativeRequest(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : `Request failed (${response.status}). Please retry.`);
  return result;
}
// Shared across component remounts: never run concurrent uploads/finish for one meeting.
const syncing = new Map<string, Promise<boolean>>();
export function syncNativeRecording(recording: NativeRecording): Promise<boolean> {
  const existing = syncing.get(recording.id);
  if (existing) return existing;
  const task = upload(recording).finally(() => syncing.delete(recording.id));
  syncing.set(recording.id, task);
  return task;
}
async function upload(recording: NativeRecording) {
  const current = nativeRecording(recording.id, recording.userId);
  if (current.finished) return true;
  const foreground = () => document.visibilityState === "visible" && navigator.onLine;
  for (let index = 0; index < current.chunks; index++) {
    if (!foreground()) return false;
    if (current.uploaded.includes(index)) continue;
    const chunk = parseNativeResult<{base64: string; index: number; uploaded: boolean}>(bridge().readChunk(current.id, current.userId, index));
    if (chunk.index !== index) throw new Error("Android audio part does not match the requested part.");
    if (chunk.uploaded) continue;
    const bytes = Uint8Array.from(atob(chunk.base64), (char) => char.charCodeAt(0));
    const receipt = await checkedNativeRequest(await fetch(`/api/meetings/${current.id}/chunks`, {
      method: "POST", headers: {"Content-Type": "audio/wav", "X-Chunk-Index": String(index)},
      body: new Blob([bytes], {type: "audio/wav"}), signal: AbortSignal.timeout(60000),
    }));
    if (receipt?.index !== index) throw new Error("Audio upload was not confirmed.");
    parseNativeResult(bridge().markChunkUploaded(current.id, current.userId, index));
  }
  // Only sealed, stopped recordings are finished. New chunks will be picked up next poll.
  if (!current.stopped || !foreground()) return false;
  if (!current.chunks) throw new Error("No audio was saved. This empty recording cannot be processed.");
  await checkedNativeRequest(await fetch(`/api/meetings/${current.id}`, {
    method: "PATCH", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({action: "finish", expectedChunks: current.chunks, durationSeconds: current.samples / 16000}),
    signal: AbortSignal.timeout(60000),
  }));
  parseNativeResult(bridge().markFinished(current.id, current.userId));
  return true;
}
