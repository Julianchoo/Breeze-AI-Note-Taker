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
  flush() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({ samples, total: this.total }, [samples.buffer]);
    this.offset = 0;
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
          if (this.offset === this.buffer.length) this.flush();
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
