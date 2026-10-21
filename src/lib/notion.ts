import { fromMarkdown } from "mdast-util-from-markdown";
import { z } from "zod";
import { getServerEnv } from "./env";
import { MeetingError } from "./meeting-validation";
import { relabel, timestamp } from "./search-text";
import type { Meeting, TranscriptSegment } from "./meeting-types";

// The admin's Notion workspace: the Meetings database and the Pillars database its relation points to.
const MEETINGS_SOURCE = "19663fb3-50b6-81c0-b12c-000b119bf1f8";
const PILLARS_SOURCE = "1e563fb3-50b6-80ae-88c2-000b80dee534";
// Notion caps a text object at 2000 characters and a request at 100 blocks.
const TEXT_LIMIT = 2000;
const BLOCK_LIMIT = 100;

type MdNode = ReturnType<typeof fromMarkdown>["children"][number];
type Annotations = { bold?: boolean; italic?: boolean; code?: boolean };
type RichText = { type: "text"; text: { content: string; link?: { url: string } }; annotations: Annotations };
export type Block = { type: string; [type: string]: unknown };
export type NotionOptions = { pillars: { id: string; name: string }[]; temas: string[]; types: string[] };

// Commas are not allowed in Notion select option names.
const option = z.string().trim().min(1).max(100).regex(/^[^,]+$/);
export const notionInput = z.object({
  name: z.string().trim().min(1).max(TEXT_LIMIT),
  date: z.iso.date().optional(),
  pillars: z.array(z.guid()).max(100).default([]),
  temas: z.array(option).max(100).default([]),
  type: option.optional(),
  participants: z.string().trim().max(TEXT_LIMIT).optional(),
});

async function notion<T>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const key = getServerEnv().NOTION_API_KEY;
  if (!key) throw new MeetingError("Notion is not configured.", 503);
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Notion's code and message help debugging and never contain the key or meeting content.
    console.error("Notion request failed", response.status, data.code, data.message);
    throw new MeetingError("Notion could not complete the request. Please retry.", 502);
  }
  return data as T;
}

export async function notionOptions(): Promise<NotionOptions> {
  type Options = { options: { name: string }[] };
  type Source = { properties: { Tema?: { multi_select?: Options }; Type?: { select?: Options } } };
  type Pillar = { id: string; properties: { Pillar?: { title?: { plain_text: string }[] } } };
  // ponytail: one page of 100 pillars, paginate if the Pillars database ever outgrows it.
  const [source, pillars] = await Promise.all([
    notion<Source>(`data_sources/${MEETINGS_SOURCE}`),
    notion<{ results: Pillar[] }>(`data_sources/${PILLARS_SOURCE}/query`, { page_size: 100 }),
  ]);
  return {
    pillars: pillars.results.map((page) => ({
      id: page.id,
      name: page.properties.Pillar?.title?.map((part) => part.plain_text).join("") || "Untitled",
    })),
    temas: source.properties.Tema?.multi_select?.options.map((o) => o.name) ?? [],
    types: source.properties.Type?.select?.options.map((o) => o.name) ?? [],
  };
}

function text(content: string, annotations: Annotations = {}, url?: string): RichText[] {
  const parts: RichText[] = [];
  for (let at = 0; at < content.length; ) {
    let end = Math.min(at + TEXT_LIMIT, content.length);
    // Never split a surrogate pair (emoji) across two text objects.
    if (end < content.length && /[\uD800-\uDBFF]/.test(content[end - 1]!)) end--;
    parts.push({ type: "text", text: { content: content.slice(at, end), ...(url && { link: { url } }) }, annotations });
    at = end;
  }
  return parts;
}
const block = (type: string, richText: RichText[], children: Block[] = []): Block => ({
  type,
  [type]: { rich_text: richText, ...(children.length > 0 && { children }) },
});

// Mirrors meeting-docx.ts: unknown inline nodes fall back to their children or raw value, so no text is lost.
function rich(nodes: MdNode[], style: Annotations = {}, url?: string): RichText[] {
  return nodes.flatMap((node) => {
    if (node.type === "strong") return rich(node.children, { ...style, bold: true }, url);
    if (node.type === "emphasis") return rich(node.children, { ...style, italic: true }, url);
    if (node.type === "inlineCode") return text(node.value, { ...style, code: true }, url);
    if (node.type === "break") return text("\n", style);
    if (node.type === "link") return rich(node.children, style, /^https?:\/\//i.test(node.url) ? node.url : url);
    if ("children" in node) return rich(node.children, style, url);
    return "value" in node ? text(node.value.replace(/\n/g, " "), style, url) : [];
  });
}
function blocks(nodes: MdNode[]): Block[] {
  return nodes.flatMap((node) => {
    if (node.type === "heading") return [block(`heading_${Math.min(node.depth, 3)}`, rich(node.children))];
    if (node.type === "list") return list(node.children, node.ordered ?? false, 0);
    if (node.type === "blockquote") return node.children.map((child) => block("quote", rich([child])));
    if (node.type === "thematicBreak") return [{ type: "divider", divider: {} }];
    if (node.type === "code") return [{ type: "code", code: { rich_text: text(node.value), language: "plain text" } }];
    return [block("paragraph", rich([node]))];
  });
}
// Notion creates at most two nesting levels per request, so items below the first sub-list are lifted to it.
function list(items: MdNode[], ordered: boolean, depth: number): Block[] {
  const type = ordered ? "numbered_list_item" : "bulleted_list_item";
  return items.flatMap((item) => {
    if (!("children" in item)) return [];
    const [first, ...rest] = item.children;
    const nested = rest.flatMap((child) =>
      child.type === "list" ? list(child.children, child.ordered ?? false, depth + 1) : [block("paragraph", rich([child]))]
    );
    return depth === 0 ? [block(type, rich(first ? [first] : []), nested)] : [block(type, rich(first ? [first] : [])), ...nested];
  });
}

/** Page body: a link back to Breeze, the relabeled summary, then the transcript as in the Word export. */
export function meetingBlocks(meeting: Pick<Meeting, "summary" | "speakerNames">, segments: TranscriptSegment[], meetingUrl: string): Block[] {
  const labels = [...new Set(segments.map((segment) => segment.speaker))];
  // Notion rejects non-public link targets such as localhost, so dev builds get the URL as plain text.
  const link = text(meetingUrl, {}, meetingUrl.startsWith("https://") ? meetingUrl : undefined);
  return [
    block("paragraph", [...text("Open in Breeze: "), ...link]),
    block("heading_1", text("Summary")),
    ...blocks(fromMarkdown(relabel(meeting.summary ?? "", labels, meeting.speakerNames)).children),
    ...(segments.length
      ? [
          block("heading_1", text("Transcript")),
          ...segments.map((segment) =>
            block("paragraph", [
              ...text(`[${timestamp(segment.start)}] ${meeting.speakerNames[segment.speaker] || segment.speaker}:`, { bold: true }),
              ...text(` ${segment.text}`),
            ])
          ),
        ]
      : []),
  ];
}

const size = (b: Block): number =>
  1 + ((b[b.type] as { children?: Block[] }).children ?? []).reduce((sum, child) => sum + size(child), 0);
/** Top-level blocks grouped so each request, nested children included, stays within Notion's 100-block limit. */
export function blockBatches(all: Block[]) {
  const batches: Block[][] = [];
  let count = BLOCK_LIMIT;
  for (const b of all) {
    // ponytail: a single list item with 100+ sub-items still overflows; split its children if that ever happens.
    const n = size(b);
    if (count + n > BLOCK_LIMIT) {
      batches.push([]);
      count = 0;
    }
    batches[batches.length - 1]!.push(b);
    count += n;
  }
  return batches;
}

/** Creates a new Meetings page (one per send) and returns its URL. Empty fields are left unset. */
export async function createNotionPage(input: z.infer<typeof notionInput>, body: Block[]) {
  const temas = [...new Map(input.temas.map((name) => [name.toLowerCase(), name])).values()];
  const properties = {
    // "@date - Name", matching the user's Notion automation for manually created meetings.
    Name: {
      title: input.date
        ? [{ type: "mention", mention: { date: { start: input.date } } }, ...text(` - ${input.name}`)]
        : text(input.name),
    },
    ...(input.date && { "Meeting date": { date: { start: input.date } } }),
    ...(temas.length > 0 && { Tema: { multi_select: temas.map((name) => ({ name })) } }),
    ...(input.type && { Type: { select: { name: input.type } } }),
    ...(input.pillars.length > 0 && { Pillars: { relation: input.pillars.map((id) => ({ id })) } }),
    ...(input.participants && { Participants: { rich_text: text(input.participants) } }),
  };
  const [first = [], ...rest] = blockBatches(body);
  const page = await notion<{ id: string; url: string }>("pages", {
    parent: { type: "data_source_id", data_source_id: MEETINGS_SOURCE },
    properties,
    children: first,
  });
  for (const children of rest) await notion(`blocks/${page.id}/children`, { children }, "PATCH");
  return page.url;
}
