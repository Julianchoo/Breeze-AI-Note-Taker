export const CHUNK_SECONDS = 120;
export const MAX_MEETING_SECONDS = 4 * 60 * 60;
export const MAX_CHUNKS = MAX_MEETING_SECONDS / CHUNK_SECONDS;
// "review": recording finished, waiting for the user's optional AI notes before processing starts.
export type MeetingStatus = "recording" | "review" | "processing" | "ready" | "error";
export type Meeting = {
  id: string; title: string; status: MeetingStatus;
  createdAt: string; updatedAt: string; durationSeconds: number;
  expectedChunks: number | null; error: string | null;
  summary: string | null; detectedLanguage: string | null;
  costUsd: number | null;
  /** Confirmed renames, raw speaker label → display name. Applied at display time to transcript and summary. */
  speakerNames: Record<string, string>;
  /** AI-suggested names (label → name), only when explicit in the transcript. Shown for the user to confirm. */
  speakerSuggestions: Record<string, string>;
  /** Optional user notes/focus/questions passed to the summary prompt. */
  aiContext: string | null;
};
export type SearchResult = {
  id: string; title: string; createdAt: string; status: MeetingStatus;
  /** Plain-text snippet around the first match; null when only the title matched. */
  excerpt: string | null;
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
