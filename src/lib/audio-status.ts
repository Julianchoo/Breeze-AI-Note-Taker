import type { NativeRecording } from "./native-android-recorder";

/** Upload receipts and OneDrive confirmation are separate facts. */
export function phoneAudioStatus(recording: NativeRecording, uploading: boolean) {
  const uploaded = new Set(recording.uploaded.filter((index) => index >= 0 && index < recording.chunks)).size;
  if (recording.finished) return { label: "Uploaded", detail: "Audio retained on this phone. Open the meeting to check processing and OneDrive." };
  if (uploading) return { label: "Uploading", detail: `${uploaded} of ${recording.chunks} audio parts confirmed. Audio retained on this phone.` };
  return { label: "Saved on phone", detail: `${uploaded} of ${recording.chunks} audio parts uploaded. Reopen this screen with internet to finish.` };
}

export function archiveAudioStatus(hasAudio: boolean) {
  return hasAudio ? "Saved in OneDrive" : "OneDrive archive not confirmed";
}
