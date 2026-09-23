// Pure text helpers shared by the search API and the meeting list (no db imports: safe for the client).
/** Lowercased, accent-stripped copy of `text`; map[i] = index in `text` of folded char i. */
function fold(text: string) {
  let folded = ""; const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const part = text[i]!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    folded += part; for (let j = 0; j < part.length; j++) map.push(i);
  }
  return { folded, map };
}
/** [start, end) of the first case- and accent-insensitive match of `query` in `text`, as indexes into the original text. */
export function findMatch(text: string, query: string): [number, number] | null {
  const needle = fold(query.trim()).folded; if (!needle) return null;
  const { folded, map } = fold(text);
  const at = folded.indexOf(needle); if (at < 0) return null;
  const end = at + needle.length;
  return [map[at]!, end < map.length ? map[end]! : text.length];
}
export function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[^\n]*/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:#{1,6}|>+|[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, " ")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ").trim();
}
/** ~60 chars before / ~100 after the match, cut at word boundaries, "…" on cut ends. */
export function excerpt(text: string, query: string, before = 60, after = 100) {
  // ponytail: Postgres unaccent also folds ß/æ/ø, NFD doesn't; on such a miss we fall back to the text's start.
  const [s, e] = findMatch(text, query) ?? [0, 0];
  let start = Math.max(0, s - before), end = Math.min(text.length, e + after);
  if (start > 0) { const space = text.indexOf(" ", start); start = space >= 0 && space < s ? space + 1 : s; }
  if (end < text.length) { const space = text.lastIndexOf(" ", end); end = space > e ? space : e; }
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
