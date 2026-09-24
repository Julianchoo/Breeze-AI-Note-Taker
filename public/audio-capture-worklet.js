/* global AudioWorkletProcessor, registerProcessor, sampleRate */
class BreezeCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(16000 * 120);
    this.offset = 0;
    this.total = 0;
    this.weight = 0;
    this.sum = 0;
    this.running = true;
    this.port.onmessage = ({ data }) => {
      if (data === "stop") this.finish();
    };
  }
  // Mirrors quietestCut in src/lib/audio-file.ts: center of the lowest-energy 100 ms window in [from, to].
  quietestCut(from, to) {
    const power = (i) => (i >= 0 && i < this.offset ? this.buffer[i] * this.buffer[i] : 0);
    let energy = 0;
    for (let i = from - 800; i < from + 800; i++) energy += power(i);
    let best = from, bestEnergy = energy;
    for (let center = from + 160; center <= to; center += 160) {
      for (let i = center - 160; i < center; i++) energy += power(i + 800) - power(i - 800);
      if (energy < bestEnergy) { bestEnergy = energy; best = center; }
    }
    return best;
  }
  flush(cut = this.offset) {
    if (!cut) return;
    const samples = this.buffer.slice(0, cut);
    this.port.postMessage({ samples, total: this.total }, [samples.buffer]);
    this.buffer.copyWithin(0, cut, this.offset);
    this.offset -= cut;
  }
  finish() {
    if (!this.running) return;
    this.running = false;
    this.flush();
    this.port.postMessage({ stopped: true, total: this.total });
  }
  process(inputs) {
    if (!this.running) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    // Weighted box resampling keeps fractional phase across render quanta.
    const ratio = sampleRate / 16000;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0;
      for (const channel of channels) value += channel[i] / channels.length;
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, ratio - this.weight);
        this.sum += value * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= ratio - 1e-8) {
          const sample = Math.max(-1, Math.min(1, this.sum / ratio));
          this.buffer[this.offset++] = Math.round(sample * (sample < 0 ? 32768 : 32767));
          this.total++;
          this.weight = 0;
          this.sum = 0;
          // Full at 120 s: send up to the quietest moment after 105 s so words aren't cut; keep the rest.
          if (this.offset === this.buffer.length) this.flush(this.quietestCut(16000 * 105, this.buffer.length - 800));
          if (this.total === 16000 * 60 * 60 * 4) {
            this.finish();
            return false;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("breeze-capture", BreezeCapture);
