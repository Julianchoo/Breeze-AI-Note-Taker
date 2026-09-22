export const AUDIO_SAMPLE_RATE = 16000;

export function encodeWav(samples: Int16Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i]!, true);
  return new Blob([buffer], { type: "audio/wav" });
}

export async function captureAudio(
  streams: MediaStream[],
  onChunk: (blob: Blob, totalSamples: number) => void,
  onStopped: (totalSamples: number) => void,
  onLost: (reason: string) => void
) {
  const context = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  try {
    await context.audioWorklet.addModule("/audio-capture-worklet.js");
    const node = new AudioWorkletNode(context, "breeze-capture", {
      channelCount: 1,
      channelCountMode: "explicit",
    });
    const silence = context.createGain();
    silence.gain.value = 0;
    node.connect(silence).connect(context.destination);
    let stopping = false;
    const stop = () => {
      if (!stopping) {
        stopping = true;
        node.port.postMessage("stop");
      }
    };
    const dispose = () => {
      stopping = true;
      streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
      node.disconnect();
      void context.close();
    };
    for (const stream of streams) {
      const gain = context.createGain();
      gain.gain.value = 1 / streams.length;
      context
        .createMediaStreamSource(new MediaStream(stream.getAudioTracks()))
        .connect(gain)
        .connect(node);
      stream.getTracks().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (!stopping) {
              onLost(
                "An audio source disconnected. Your recording has been stopped and preserved."
              );
              stop();
            }
          },
          { once: true }
        )
      );
      stream.getAudioTracks().forEach((track) =>
        track.addEventListener(
          "mute",
          () => {
            if (!stopping) {
              onLost(
                "An audio source became unavailable. Your recording has been stopped and preserved."
              );
              stop();
            }
          },
          { once: true }
        )
      );
    }
    context.onstatechange = () => {
      if (!stopping && context.state === "suspended") {
        onLost("Audio capture was suspended. Stop and save the recording before continuing.");
        void context
          .resume()
          .then(stop)
          .catch(() => {
            dispose();
            onStopped(0);
          });
      }
    };
    node.port.onmessage = ({ data }) => {
      if (data.samples) onChunk(encodeWav(data.samples), data.total);
      if (data.stopped) {
        dispose();
        onStopped(data.total);
      }
    };
    await context.resume();
    return { stop, dispose };
  } catch (error) {
    streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    await context.close();
    throw error;
  }
}
