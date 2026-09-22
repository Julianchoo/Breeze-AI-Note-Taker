import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { encodeWav } from "../src/lib/audio-recorder";

const source = readFileSync("public/audio-capture-worklet.js", "utf8");
type Processor = {
  process: (inputs: Float32Array[][]) => boolean;
  finish: () => void;
  total: number;
  buffer: Int16Array;
  offset: number;
};
function harness(rate: number) {
  const messages: { samples?: Int16Array; stopped?: boolean; total: number }[] = [];
  let processor!: Processor;
  vm.runInNewContext(source, {
    sampleRate: rate,
    Int16Array,
    Math,
    AudioWorkletProcessor: class {
      port = {
        onmessage: null,
        postMessage: (data: (typeof messages)[number]) => messages.push(data),
      };
    },
    registerProcessor: (_: string, Constructor: new () => Processor) => {
      processor = new Constructor();
    },
  });
  return { processor, messages };
}

for (const rate of [16000, 44100, 48000]) {
  const { processor, messages } = harness(rate);
  let remaining = rate * 121;
  while (remaining > 0) {
    const size = Math.min(128, remaining);
    processor.process([[new Float32Array(size).fill(0.5)]]);
    remaining -= size;
  }
  processor.finish();
  const chunks = messages.filter((message) => message.samples);
  assert.deepEqual(
    chunks.map((chunk) => chunk.samples!.length),
    [16000 * 120, 16000]
  );
  assert.equal(processor.total, 16000 * 121);
  assert.ok(Math.abs(chunks[0]!.samples![0]! - 16384) <= 1);
  assert.ok(Math.abs(chunks[1]!.samples!.at(-1)! - 16384) <= 1);
  assert.equal(messages.at(-1)?.stopped, true);
  assert.equal(processor.process([[new Float32Array(128)]]), false);
}
const limit = harness(48000);
limit.processor.total = 16000 * 14400 - 10;
assert.equal(limit.processor.process([[new Float32Array(128)]]), false);
assert.equal(limit.processor.total, 16000 * 14400);
assert.equal(limit.messages[0]!.samples!.length, 10);
assert.equal(limit.messages[1]!.stopped, true);

async function checkWav() {
  const wav = await encodeWav(new Int16Array([-32768, 0, 32767])).arrayBuffer();
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 50);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
  assert.equal(encodeWav(new Int16Array(16000 * 120)).size, 3840044);
  console.log(
    "Audio recorder checks passed: continuous resampling, chunk boundary, final flush, four-hour limit, WAV encoding."
  );
}
void checkWav();
