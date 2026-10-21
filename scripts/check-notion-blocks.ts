import assert from "node:assert/strict";
import { type Block, blockBatches, meetingBlocks, notionInput } from "../src/lib/notion";

type Rich = { text: { content: string; link?: { url: string } }; annotations: Record<string, boolean> }[];
const body = (b: Block) => b[b.type] as { rich_text: Rich; children?: Block[] };
const plain = (b: Block) => body(b).rich_text.map((r) => r.text.content).join("");
const size = (b: Block): number => 1 + (body(b).children ?? []).reduce((n, c) => n + size(c), 0);

const summary = [
  "# Overview",
  "Speaker 1 agreed on **the budget**, *maybe* `v2`. See [docs](https://example.com).",
  "- top",
  "  - child",
  "    - grandchild",
  "1. first",
  "2. second",
  "> quoted",
  "---",
].join("\n");
const segments = [
  { start: 65, end: 70, speaker: "Speaker 1", text: "Hello." },
  { start: 3725, end: 3730, speaker: "Speaker 2", text: "x".repeat(4500) },
];
const blocks = meetingBlocks({ summary, speakerNames: { "Speaker 1": "Ana" } }, segments, "https://breeze.app/meetings/1");

assert.deepEqual(blocks.map((b) => b.type), [
  "paragraph", "heading_1", "heading_1", "paragraph", "bulleted_list_item", "numbered_list_item",
  "numbered_list_item", "quote", "divider", "heading_1", "paragraph", "paragraph",
]);
assert.equal(body(blocks[0]!).rich_text[1]!.text.link?.url, "https://breeze.app/meetings/1");
assert.equal(plain(blocks[1]!), "Summary");
// Speaker labels are replaced with names; inline styles map to Notion annotations.
const para = body(blocks[3]!).rich_text;
assert.equal(plain(blocks[3]!), "Ana agreed on the budget, maybe v2. See docs.");
assert.deepEqual(para.find((r) => r.text.content === "the budget")?.annotations, { bold: true });
assert.deepEqual(para.find((r) => r.text.content === "maybe")?.annotations, { italic: true });
assert.deepEqual(para.find((r) => r.text.content === "v2")?.annotations, { code: true });
assert.equal(para.find((r) => r.text.content === "docs")?.text.link?.url, "https://example.com");
// Grandchildren are lifted next to the child: at most two nesting levels.
const top = body(blocks[4]!);
assert.deepEqual(top.children!.map(plain), ["child", "grandchild"]);
assert.ok(top.children!.every((c) => !body(c).children));
// Transcript: "[m:ss] Name:" in bold, long text split into ≤2000-char pieces.
assert.equal(plain(blocks[10]!), "[1:05] Ana: Hello.");
assert.deepEqual(body(blocks[10]!).rich_text[0]!.annotations, { bold: true });
const long = body(blocks[11]!).rich_text;
assert.equal(long[0]!.text.content, "[62:05] Speaker 2:");
assert.deepEqual(long.slice(1).map((r) => r.text.content.length), [2000, 2000, 501]);
// A summary-only meeting has no transcript heading; localhost links stay plain text.
const bare = meetingBlocks({ summary: "Hi", speakerNames: {} }, [], "http://localhost:3000/meetings/1");
assert.deepEqual(bare.map((b) => b.type), ["paragraph", "heading_1", "paragraph"]);
assert.equal(body(bare[0]!).rich_text[1]!.text.link, undefined);
// Emoji are never split across two text objects.
const emoji = meetingBlocks({ summary: `${"a".repeat(1999)}😀b`, speakerNames: {} }, [], "x");
assert.deepEqual(body(emoji[2]!).rich_text.map((r) => r.text.content.length), [1999, 3]);

// Batches hold ≤100 blocks counting nested children, and keep every block in order.
const many = meetingBlocks(
  { summary: Array.from({ length: 30 }, (_, i) => `- item ${i}\n  - sub ${i}`).join("\n"), speakerNames: {} },
  Array.from({ length: 250 }, (_, i) => ({ start: i, end: i + 1, speaker: "S", text: `t${i}` })),
  "x"
);
const batches = blockBatches(many);
assert.ok(batches.every((batch) => batch.reduce((n, b) => n + size(b), 0) <= 100));
assert.deepEqual(batches.flat(), many);
assert.equal(batches.length, 4);
assert.deepEqual(blockBatches([]), []);

assert.throws(() => notionInput.parse({ name: " " }));
assert.throws(() => notionInput.parse({ name: "x", temas: ["a,b"] }));
assert.deepEqual(notionInput.parse({ name: " x ", date: "2026-10-20" }), { name: "x", date: "2026-10-20", pillars: [], temas: [] });
console.log("notion blocks: ok");
