import assert from "node:assert/strict";
import { chunkIndex, requireSameOrigin, validateChunkSequence, wavDuration } from "../src/lib/meeting-validation";

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
assert.equal(chunkIndex("119"), 119);
for (const index of [null, "", "120", "-1", "1.2", "Infinity"]) assert.throws(() => chunkIndex(index));
validateChunkSequence([{ index: 0, durationSeconds: 120 }, { index: 1, durationSeconds: 0.5 }], 2);
validateChunkSequence(Array.from({ length: 120 }, (_, index) => ({ index, durationSeconds: 120 })), 120);
assert.throws(() => validateChunkSequence([{ index: 1, durationSeconds: 1 }], 1));
assert.throws(() => validateChunkSequence([{ index: 0, durationSeconds: 1 }, { index: 1, durationSeconds: 1 }], 2));
assert.throws(() => validateChunkSequence([], 1));
requireSameOrigin(new Request("http://localhost:3000/api/meetings", { headers: { origin: "http://localhost:3000" } }));
assert.throws(() => requireSameOrigin(new Request("http://localhost:3000/api/meetings", { headers: { origin: "https://attacker.example" } })));
assert.throws(() => requireSameOrigin(new Request("http://localhost:3000/api/meetings")));
console.log("Meeting WAV, four-hour bounds, complete chunk sequence, and CSRF checks passed.");
