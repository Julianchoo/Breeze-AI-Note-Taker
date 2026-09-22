# Meetings

Authenticated users own their meetings. APIs check ownership before accessing audio or metadata. Mutation requests require the application's Origin header. Audio uses private Vercel Blob and is served only through authenticated routes; database/Blob URLs and speaker references never reach the client.

Recordings are canonical WAV PCM16, mono, 16 kHz, split at exactly 120 seconds (final part may be shorter), up to 120 parts / four hours. Each upload stays below Vercel's function body limit. Uploads are idempotent by meeting/index and SHA-256; conflicting content is rejected. Finish validates all expected parts are present and contiguous. Saved incomplete recordings can finish from the saved consecutive parts. Audio still only in the browser cannot be recovered after that browser data is lost.

Processing performs one transcription part per request, then one summary request, driven by the meeting page. A durable database lease expires after 270 seconds; the OpenAI request times out after 210 seconds. Lease tokens fence late results. Closing the page pauses processing; reopening resumes. Failed jobs retain their audio and transcript and expose an explicit retry. The application does not automatically retry billable failures indefinitely.

OpenAI `gpt-4o-transcribe-diarize` preserves the source language and returns timestamped speaker segments. Up to four 2–8 second non-overlapping speaker samples provide known-speaker references across parts. Unmatched speakers get part-scoped labels; speaker identity remains probabilistic and names are not inferred. `gpt-4.1-mini` summarizes the whole transcript in the predominant meeting language, using JSON output for the Markdown summary and language. Silence produces a no-speech result. No transcript text is truncated before summarization.

Required server environment: POSTGRES_URL, BLOB_READ_WRITE_TOKEN (private store), OPENAI_API_KEY, existing Better Auth/Google settings. Run `pnpm db:generate` and `pnpm db:migrate` for schema changes, never `db:push`. Vercel processing routes request 240 seconds; the deployed plan must support that execution duration. Recordings require keeping the recording tab/device awake and browser permissions active.

Validation: `pnpm exec tsx scripts/check-meeting-core.ts` covers WAV boundaries, four-hour limits, complete chunk sequences and same-origin mutations. Full live provider checks require configured credentials, authenticated sessions and a sample recording; successful lint/build alone does not establish live transcription quality or four-hour endurance.

Official references: https://developers.openai.com/api/docs/guides/speech-to-text and https://developers.openai.com/api/docs/models/gpt-4.1-mini.
