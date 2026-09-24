# Share links — design

## Goal
The meeting owner can turn on a public, view-only link (no login). Each section — AI summary, recording, transcript — is shared independently. The link can be turned off or regenerated (the old link then stops working).

## Decisions (from the user)
- Access: anyone with the link, no login. The token is a random UUID.
- Control: on/off plus regenerate. No expiry.
- Recording: listen only. No download button, `controlsList="nodownload"`. This is a weak deterrent and that is accepted.
- Defaults when the link is created: summary on, recording off, transcript off.

## Data
New columns on `meetings`:
- `share_token uuid unique null` — null means sharing is off.
- `share_summary boolean not null default true`
- `share_recording boolean not null default false`
- `share_transcript boolean not null default false`

Apply them with `pnpm db:generate` + `pnpm db:migrate`. Never `push`.

## Server
- The `Meeting` type exposes `shareToken`, `shareSummary`, `shareRecording` and `shareTranscript`. Only the owner receives it.
- `updateMeeting` accepts `{ share: { enabled?, regenerate?, summary?, recording?, transcript? } }`:
  - `enabled: true` with no token: set a random UUID.
  - `enabled: false`: set the token to null.
  - `regenerate`: set a new UUID. Only allowed while the link is on.
  - The three section booleans are updated as given.
- `getSharedMeeting(token)` rejects a token that is not a UUID with 404, then looks the meeting up by `share_token` and returns 404 if nothing matches. It returns only the title, createdAt and durationSeconds, the speaker labels and speakerNames, plus each section that is shared: the summary, the chunks as `{index, durationSeconds}`, the segments. Sections that are not shared are never sent to the client.
- `GET /api/share/[token]/audio/[index]` is public. It returns 404 unless the token exists and `share_recording` is on. It reuses the existing byte-range audio serving.

## UI
- The owner's detail header gets a Share icon button, which opens a Dialog with:
  - the on/off toggle
  - the link as a read-only input with a copy button
  - three section checkboxes
  - a Regenerate button
- `/share/[token]` is a public server page with `noindex`. It renders the title and date, then only the sections that are shared, using the same summary prose, audio player and transcript list as the owner view. Everything is read-only: no editing speakers, no admin actions. A transcript timestamp jumps the audio only when the recording is shared.
- Follows DESIGN.md.

## Out of scope
Sharing by email, link expiry, view counts.

## Testing
Run `pnpm lint`, `pnpm typecheck` and `pnpm build:ci`. Then check the live dev server:
1. Only the summary shows by default.
2. Toggling the transcript on makes it show.
3. The audio route returns 404 while the recording is off.
4. After Regenerate, the old token returns 404.
5. After the link is turned off, it returns 404.
