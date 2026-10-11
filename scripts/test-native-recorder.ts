import assert from "node:assert/strict";
import type { NativeRecording } from "../src/lib/native-android-recorder";

async function main() {
  const modulePath = "../src/lib/native-android-recorder.ts";
  const { parseNativeResult, syncNativeRecording, nativeRecordings, exportNativeRecording } = await import(modulePath);
  assert.throws(() => parseNativeResult('{"ok":false,"error":"Storage full"}'), /Storage full/);
  assert.throws(() => parseNativeResult('{"recordings":[]}'), /invalid response/);
  assert.throws(() => parseNativeResult("broken"));
  const state: NativeRecording = {id: "meeting", userId: "user", title: "Test", chunks: 2,
    samples: 32000, stopped: true, finished: false, startedAt: 0, uploaded: []};
  const requests: string[] = [];
  let failSecond = true;
  let receiptMismatch = false;
  const visibility = { visibilityState: "visible" };
  const ok = (value = {}) => JSON.stringify({ok: true, ...value});
  Object.defineProperty(globalThis, "document", {value: visibility, configurable: true});
  Object.defineProperty(globalThis, "navigator", {value: {onLine: true}, configurable: true});
  Object.defineProperty(globalThis, "window", {value: {BreezeAndroid: {
    getRecording: () => ok({recording: structuredClone(state)}),
    getRecordings: () => ok({recordings: [structuredClone(state)]}),
    getSavedRecordings: () => ok({recordings: [structuredClone(state), {...state, id: "finished", stopped: true, finished: true}]}),
    exportRecording: (id: string, userId: string) => {assert.equal(id, state.id); assert.equal(userId, state.userId); return ok();},
    readChunk: (_id: string, _user: string, index: number) => ok({base64: "UklGRg==", index, samples: 16000, uploaded: state.uploaded.includes(index)}),
    markChunkUploaded: (_id: string, _user: string, index: number) => {state.uploaded.push(index); return ok();},
    markFinished: () => {state.finished = true; return ok();},
  }}, configurable: true});
  assert.deepEqual(nativeRecordings("user").map((item: NativeRecording) => item.id), ["meeting", "finished"], "saved audio remains accessible without duplicate pending entries");
  exportNativeRecording(state.id, state.userId);
  globalThis.fetch = async (url, options) => {
    if (options?.method === "POST") {
      const index = Number((options.headers as Record<string, string>)["X-Chunk-Index"]);
      requests.push(`chunk${index}`);
      if (index === 1 && failSecond) return Response.json({error: "Offline"}, {status: 503});
      return Response.json({index: receiptMismatch ? 999 : index});
    }
    requests.push("finish");
    assert.equal(String(url), "/api/meetings/meeting");
    assert.deepEqual(JSON.parse(String(options?.body)), {action: "finish", expectedChunks: 2, durationSeconds: 2});
    return Response.json({ok: true});
  };
  const first = syncNativeRecording(state);
  assert.equal(syncNativeRecording(state), first, "concurrent callers share upload job");
  await assert.rejects(first, /Offline/);
  assert.deepEqual(state.uploaded, [0], "only confirmed receipts are persisted");
  assert.equal(state.finished, false);
  failSecond = false;
  receiptMismatch = true;
  await assert.rejects(syncNativeRecording(state), /not confirmed/);
  assert.deepEqual(state.uploaded, [0]);
  receiptMismatch = false;
  assert.equal(await syncNativeRecording(state), true);
  assert.deepEqual(requests, ["chunk0", "chunk1", "chunk1", "chunk1", "finish"], "retry skips persisted receipt and finishes once");
  await syncNativeRecording(state);
  assert.equal(requests.filter((request) => request === "finish").length, 1);
  state.finished = false;
  state.uploaded = [];
  requests.length = 0;
  visibility.visibilityState = "hidden";
  assert.equal(await syncNativeRecording(state), false);
  assert.deepEqual(requests, [], "hidden web view leaves upload for foreground recovery");
  visibility.visibilityState = "visible";
  state.stopped = false;
  assert.equal(await syncNativeRecording(state), false);
  assert.ok(!requests.includes("finish"), "ongoing service recording never finishes");
  console.log("Native recorder recovery tests passed.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
