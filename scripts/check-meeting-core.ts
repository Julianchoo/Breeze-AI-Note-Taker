import assert from "node:assert/strict";
import { sliceChunks } from "../src/lib/audio-file";
import { chunkIndex, estimateProgress, requireSameOrigin, segmentsByChunk, tokensToSegments, validateChunkSequence, wavDuration } from "../src/lib/meeting-validation";
import { callCostUsd } from "../src/lib/openai-pricing";

function wav(seconds: number) {
  const data = Buffer.alloc(44 + seconds * 32000);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVE", 8);
  data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22); data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(data.length - 44, 40);
  return data;
}
assert.equal(wavDuration(wav(120)), 120);
assert.equal(wavDuration(wav(0.5)), 0.5);
assert.throws(() => wavDuration(wav(121)));
const corrupt = wav(1); corrupt.writeUInt32LE(48000, 24);
assert.throws(() => wavDuration(corrupt));
assert.throws(() => wavDuration(Buffer.from("invalid")));
assert.equal(chunkIndex("137"), 137);
for (const index of [null, "", "138", "-1", "1.2", "Infinity"]) assert.throws(() => chunkIndex(index));
validateChunkSequence([{ index: 0, durationSeconds: 120 }, { index: 1, durationSeconds: 0.5 }], 2);
validateChunkSequence(Array.from({ length: 138 }, (_, index) => ({ index, durationSeconds: 105 })), 138);
assert.throws(() => validateChunkSequence(Array.from({ length: 139 }, (_, index) => ({ index, durationSeconds: 105 })), 139));
const sequence = (durations: number[]) => durations.map((durationSeconds, index) => ({ index, durationSeconds }));
validateChunkSequence(sequence([120, 120, 50]), 3);
validateChunkSequence(sequence([105, 119.5, 10]), 3);
assert.throws(() => validateChunkSequence(sequence([100, 120, 10]), 3));
assert.throws(() => validateChunkSequence(sequence([121, 120, 10]), 3));
// 5 min of noise with 200 ms of silence at 112 s: the first part is cut inside the silence.
const audio = Int16Array.from({ length: 300 * 16000 }, (_, i) => (i * 7919) % 16001 - 8000);
audio.fill(0, 111.9 * 16000, 112.1 * 16000);
const parts = sliceChunks(audio);
assert.ok(Math.abs(parts[0]!.length - 112 * 16000) <= 1600);
assert.equal(parts.reduce((n, part) => n + part.length, 0), audio.length);
validateChunkSequence(sequence(parts.map(part => part.length / 16000)), parts.length);
assert.equal(sliceChunks(audio.subarray(0, 120 * 16000)).length, 1);
assert.throws(() => validateChunkSequence([{ index: 1, durationSeconds: 1 }], 1));
assert.throws(() => validateChunkSequence([{ index: 0, durationSeconds: 1 }, { index: 1, durationSeconds: 1 }], 2));
assert.throws(() => validateChunkSequence([], 1));
requireSameOrigin(new Request("http://localhost:3000/api/meetings", { headers: { origin: "http://localhost:3000" } }));
assert.throws(() => requireSameOrigin(new Request("http://localhost:3000/api/meetings", { headers: { origin: "https://attacker.example" } })));
assert.throws(() => requireSameOrigin(new Request("http://localhost:3000/api/meetings")));
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
close(callCostUsd("gpt-4.1-mini", { usage: { prompt_tokens: 1_000_000, completion_tokens: 1_000_000, total_tokens: 2_000_000 } }), 2.0);
close(callCostUsd("gpt-4o-transcribe-diarize", { usage: { type: "tokens", input_tokens: 1_000_000, output_tokens: 1_000_000, total_tokens: 2_000_000, input_token_details: { audio_tokens: 1, text_tokens: 2 } } }), 12.5);
close(callCostUsd("gpt-4o-transcribe-diarize", { usage: { type: "duration", seconds: 120 } }), 0.012);
close(callCostUsd("gpt-4o-transcribe-diarize", { usage: { type: "tokens", total_tokens: 619, input_tokens: 160, input_token_details: { text_tokens: 0, audio_tokens: 160 }, output_tokens: 459 } }), 0.00499);
for (const body of [undefined, null, {}, "text", 7, { usage: null }, { usage: {} }, { usage: { type: "tokens" } }, { usage: { type: "duration", seconds: -1 } }, { usage: { prompt_tokens: NaN, completion_tokens: 1 } }, { usage: { prompt_tokens: Infinity, completion_tokens: 1 } }, { usage: { type: "unheard-of", credits: 5 } }]) assert.equal(callCostUsd("gpt-4.1-mini", body), 0);
// Soniox tokens: ms → s, split on speaker change, and on a sentence end only once the segment lasts 20 s.
const token = (text: string, start: number, end: number, speaker: string | number | null) => ({ text, start_ms: start, end_ms: end, speaker });
assert.deepEqual(tokensToSegments([token("Hel", 0, 200, "1"), token("lo.", 200, 500, "1"), token(" Hi", 600, 900, 2), token(" there", 900, 1200, 2)]), [
  { start: 0, end: 0.5, text: "Hello.", speaker: "Speaker 1" }, { start: 0.6, end: 1.2, text: "Hi there", speaker: "Speaker 2" }]);
assert.deepEqual(tokensToSegments([token("Long.", 0, 21_000, "1"), token(" Next", 21_000, 22_000, "1"), token(" more.", 22_000, 23_000, "1"), token(" Tail", 23_000, 24_000, "1")]).map(s => s.text), ["Long.", "Next more. Tail"]);
assert.deepEqual(tokensToSegments([token(" ", 0, 10, "1"), token("x", 10, 20, null)]), [{ start: 0.01, end: 0.02, text: "x", speaker: "Unknown speaker" }]);
const at = (start: number) => ({ start, end: start + 1, text: "t", speaker: "Speaker 1" });
assert.deepEqual(segmentsByChunk([at(0), at(119.9), at(120), at(230), at(300)], [120, 110, 50]).map(p => p.map(s => s.start)), [[0, 119.9], [120], [230, 300]]);
assert.deepEqual(segmentsByChunk([at(5)], [120, 60]), [[at(5)], []]);
// Estimated progress: starts at 0, never decreases (even across the phase flip), stays below 100 until done.
for (const d of [0, 60, 3600, 14_400]) {
  const w1 = Math.round(100 * (10 + d / 20) / (10 + d / 20 + 15 + d / 30));
  assert.equal(estimateProgress(d, false, 0), 0);
  assert.equal(estimateProgress(d, true, 0), w1);
  for (const transcribed of [false, true]) {
    let previous = transcribed ? w1 : 0;
    for (let t = 0; t <= 100_000; t += 7) {
      const value = estimateProgress(d, transcribed, t);
      assert.ok(value >= previous && value < 100, `${d}s ${transcribed} ${t}s → ${value}`);
      previous = value;
    }
    assert.ok(previous <= (transcribed ? 99 : w1));
  }
}
console.log("Meeting WAV, four-hour bounds, complete 105–120 s chunk sequence, CSRF, OpenAI cost, Soniox segment and progress estimate checks passed.");
