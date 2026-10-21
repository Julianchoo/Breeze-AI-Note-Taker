// Pure text helpers shared by the server and the client (no db imports, no "use client": callable from routes).
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
export function timestamp(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
/* Replaces whole speaker labels with their display names in one pass. Longest-first alternation keeps
   "Part 2 · Speaker 1" whole; the letter/digit guards stop "Speaker 1" matching inside "Speaker 10". */
export function relabel(text: string, labels: string[], names: Record<string, string>) {
  if (!labels.length || !Object.keys(names).length) return text;
  names = { ...names };
  // The summary model tends to shorten "Part 1 · Speaker 1" to "Speaker 1"; accept that short form when unambiguous.
  const short = labels.map((label) => /^Part \d+ · (.+)$/.exec(label)?.[1]);
  short.forEach((alias, i) => {
    const label = labels[i]!;
    if (
      alias &&
      Object.hasOwn(names, label) &&
      !labels.includes(alias) &&
      short.filter((s) => s === alias).length === 1
    )
      names[alias] = names[label]!;
  });
  const alternatives = [...labels, ...Object.keys(names).filter((key) => !labels.includes(key))]
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
    "gu"
  );
  return text.replace(pattern, (label) => (Object.hasOwn(names, label) ? names[label]! : label));
}
