import assert from "node:assert/strict";
import { captureAudio } from "../src/lib/audio-recorder";

class Track extends EventTarget {
  stopped = false;
  stop() { this.stopped = true; }
}
class Stream {
  constructor(readonly tracks: Track[]) {}
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks; }
}
class Node {
  gain = { value: 0 };
  disconnected = false;
  connect(target: Node) { return target; }
  disconnect() { this.disconnected = true; }
}
const gains: Node[] = [];
const messages: string[] = [];
let worklet!: Worklet;
class Worklet extends Node {
  constructor() { super(); worklet = this; }
  port: { postMessage: (message: string) => void; onmessage?: (event: {data: {stopped: boolean; total: number}}) => void } = {
    postMessage: (message) => messages.push(message),
  };
}
class Context {
  state = "running";
  destination = new Node();
  audioWorklet = { addModule: async () => {} };
  createGain() { const gain = new Node(); gains.push(gain); return gain; }
  createMediaStreamSource() { return new Node(); }
  async resume() {}
  async close() {}
}
Object.assign(globalThis, {AudioContext: Context, AudioWorkletNode: Worklet, MediaStream: Stream});
const media = (stream: Stream) => stream as unknown as MediaStream;

async function main() {
  const mic = new Track();
  let optionalEnded = 0;
  let lost = 0;
  let stopped = 0;
  const recording = await captureAudio([media(new Stream([mic]))], () => {}, () => stopped++, () => lost++);
  assert.equal(gains.at(-1)?.gain.value, 1);
  const tab = new Track();
  const removeTab = recording.addStream(media(new Stream([tab])), () => optionalEnded++);
  assert.equal(gains.at(-1)?.gain.value, 0.5, "sources share headroom while mixed");
  tab.dispatchEvent(new Event("ended"));
  assert.equal(optionalEnded, 1);
  assert.equal(tab.stopped, true);
  assert.equal(mic.stopped, false, "ending tab share preserves microphone capture");
  assert.equal(lost, 0);
  assert.deepEqual(messages, [], "removing optional source never flushes or stops worklet");
  removeTab();
  const nextTab = new Track();
  const removeNext = recording.addStream(media(new Stream([nextTab])), () => optionalEnded++);
  removeNext();
  nextTab.dispatchEvent(new Event("ended"));
  assert.equal(optionalEnded, 1, "manual removal detaches source listeners");
  assert.equal(nextTab.stopped, true);
  mic.dispatchEvent(new Event("ended"));
  assert.equal(lost, 1, "microphone loss still stops and preserves recording");
  assert.deepEqual(messages, ["stop"]);
  const lateTab = new Track();
  assert.throws(() => recording.addStream(media(new Stream([lateTab]))), /already stopped/);
  assert.equal(lateTab.stopped, true, "late picker result releases its stream");
  worklet.port.onmessage?.({data: {stopped: true, total: 0}});
  assert.equal(mic.stopped, true);
  assert.equal(stopped, 1);
  console.log("Audio source checks passed: optional tab add/remove/end, microphone loss, late capture cleanup.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
