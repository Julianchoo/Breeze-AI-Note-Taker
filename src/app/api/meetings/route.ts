import type { Meeting } from "@/lib/meeting-types";
import { createMeeting, listMeetings, meetingRoute } from "@/lib/meetings";
import { relabel, stripMarkdown } from "@/lib/search-text";
export const runtime = "nodejs";

/** Longest list preview, in characters; the card clamps it to one or two lines anyway. */
const PREVIEW_MAX_LENGTH = 160;
/** A sentence end this early is more likely a label than the point of the meeting, so keep reading. */
const PREVIEW_MIN_SENTENCE = 40;
/** First sentence: ends at . ! or ? followed by a capital letter or the end, so "e.g. 10%" and "3.5" keep going. */
const FIRST_SENTENCE = new RegExp(`^.{${PREVIEW_MIN_SENTENCE},}?[.!?](?=\\s+\\p{Lu}|\\s*$)`, "u");

/** First body paragraph of the summary: headings and rules are skipped, a list item counts on its own. */
function firstParagraph(markdown: string) {
  const lines: string[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const skip = !line || /^#{1,6}\s/.test(line) || /^[-*_]{3,}$/.test(line) || line.startsWith("```");
    if (skip) {
      if (lines.length) break;
      continue;
    }
    const listItem = /^(?:[-*+]|\d+[.)])\s/.test(line);
    if (listItem && lines.length) break;
    lines.push(line);
    if (listItem) break;
  }
  return lines.join(" ");
}

/** One plain text sentence from the summary (≤160 chars, cut at a word), with confirmed speaker names
 * applied as the detail page does. The full summary never leaves the server from the list route. */
function summaryPreview(summary: string, speakerNames: Record<string, string>) {
  const text = relabel(
    stripMarkdown(firstParagraph(summary)).replace(/\[probable:\s*([^\]]+)\]/g, "$1"),
    Object.keys(speakerNames),
    speakerNames
  );
  if (!text) return null;
  const sentence = FIRST_SENTENCE.exec(text)?.[0] ?? text;
  if (sentence.length <= PREVIEW_MAX_LENGTH) return sentence;
  const cut = sentence.lastIndexOf(" ", PREVIEW_MAX_LENGTH - 1);
  return `${sentence.slice(0, cut > 0 ? cut : PREVIEW_MAX_LENGTH - 1).replace(/[\s,;:]+$/, "")}…`;
}

/** List rows swap the full Markdown summary for a short preview; only ready meetings get one. */
function listItem({ summary, ...meeting }: Meeting) {
  return {
    ...meeting,
    preview: meeting.status === "ready" && summary ? summaryPreview(summary, meeting.speakerNames) : null,
  };
}

export function GET(request: Request) {
  return meetingRoute(request, async (userId) =>
    Response.json({ meetings: (await listMeetings(userId)).map(listItem) })
  );
}
export function POST(request: Request) {
  return meetingRoute(request, async (userId) =>
    Response.json({ meeting: await createMeeting(userId, await request.json()) }, { status: 201 })
  );
}
