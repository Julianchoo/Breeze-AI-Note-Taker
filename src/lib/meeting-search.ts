import { and, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { MeetingError } from "./meeting-validation";
import { meetingChunks, meetings } from "./schema";
import { excerpt, stripMarkdown } from "./search-text";
import type { SearchResult } from "./meeting-types";

export async function searchMeetings(userId: string, raw: string | null): Promise<SearchResult[]> {
  const q = (raw ?? "").trim();
  if (q.length < 2 || q.length > 100) throw new MeetingError("Search must be 2 to 100 characters.");
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const like = (value: SQL) => sql`unaccent(${value}) ilike unaccent(${pattern}::text)`;
  // First matching transcript segment in chunk/segment order. Elements, not segments::text, so JSON keys never match.
  const segment = db.select({ text: sql<string>`s.value->>'text'`.as("segment_text") })
    .from(sql`${meetingChunks} cross join lateral jsonb_array_elements(case when jsonb_typeof(${meetingChunks.segments}) = 'array' then ${meetingChunks.segments} end) with ordinality s`)
    .where(and(eq(meetingChunks.meetingId, meetings.id), like(sql`s.value->>'text'`)))
    .orderBy(meetingChunks.index, sql`s.ordinality`).limit(1).as("segment");
  const summaryHit = like(sql`${meetings.summary}`);
  const rows = await db.select({ id: meetings.id, title: meetings.title, status: meetings.status, createdAt: meetings.createdAt, summary: sql<string | null>`case when ${summaryHit} then ${meetings.summary} end`, segment: segment.text })
    .from(meetings).leftJoinLateral(segment, sql`true`)
    .where(and(eq(meetings.userId, userId), or(like(sql`${meetings.title}`), summaryHit, isNotNull(segment.text))))
    .orderBy(desc(meetings.createdAt)).limit(50);
  return rows.map(r => ({ id: r.id, title: r.title, status: r.status, createdAt: r.createdAt.toISOString(), excerpt: r.summary ? excerpt(stripMarkdown(r.summary), q) : r.segment ? excerpt(r.segment.replace(/\s+/g, " ").trim(), q) : null }));
}
