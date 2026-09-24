export const CHUNK_SECONDS = 120;
// Non-final chunks are cut at the quietest moment between MIN_CHUNK_SECONDS and CHUNK_SECONDS.
export const MIN_CHUNK_SECONDS = 105;
export const MAX_MEETING_SECONDS = 4 * 60 * 60;
export const MAX_CHUNKS = Math.ceil(MAX_MEETING_SECONDS / MIN_CHUNK_SECONDS);
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
  /** Public link token; null = sharing off. Owner-only. */
  shareToken: string | null; shareSummary: boolean; shareRecording: boolean; shareTranscript: boolean;
};
/** What a public share link exposes; unshared sections are omitted. */
export type SharedMeeting = {
  title: string; createdAt: string; durationSeconds: number;
  labels: string[]; speakerNames: Record<string, string>;
  summary?: string | null; chunks?: { index: number; durationSeconds: number }[]; segments?: TranscriptSegment[];
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
