export const CHUNK_SECONDS = 120;
export const MAX_MEETING_SECONDS = 4 * 60 * 60;
export const MAX_CHUNKS = MAX_MEETING_SECONDS / CHUNK_SECONDS;
export type MeetingStatus = "recording" | "processing" | "ready" | "error";
export type Meeting = {
  id: string; title: string; status: MeetingStatus;
  createdAt: string; updatedAt: string; durationSeconds: number;
  expectedChunks: number | null; error: string | null;
  summary: string | null; detectedLanguage: string | null;
};
export type MeetingChunk = {
  index: number; durationSeconds: number; status: "pending" | "ready";
};
export type TranscriptSegment = {
  start: number; end: number; text: string; speaker: string;
};
export type MeetingDetail = {
  meeting: Meeting; chunks: MeetingChunk[]; segments: TranscriptSegment[];
};
