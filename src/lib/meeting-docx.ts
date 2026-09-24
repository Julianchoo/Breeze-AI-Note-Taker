import { timestamp } from "@/components/meetings/meeting-sections";
import type { TranscriptSegment } from "@/lib/meeting-types";

type MdNode = ReturnType<typeof import("mdast-util-from-markdown").fromMarkdown>["children"][number];
type RunStyle = { bold?: boolean; italics?: boolean; font?: string };
/** Empty `segments` = summary only. `summary` should already be relabeled with speaker names. */
export type MeetingDocxInput = {
  title: string; createdAt: string; durationSeconds: number; summary: string;
  segments: TranscriptSegment[]; speakerNames: Record<string, string>;
};

/* Builds the Word document without touching the DOM, so it also runs in Node. docx and the Markdown
   parser load on demand to stay out of the page bundle. */
export async function buildMeetingDocx(input: MeetingDocxInput) {
  const [
    { AlignmentType, Document, HeadingLevel, LevelFormat, Paragraph, TextRun },
    { fromMarkdown },
  ] = await Promise.all([import("docx"), import("mdast-util-from-markdown")]);
  let orderedLists = 0;

  // Unknown inline nodes fall back to their children or raw value, so no text is lost.
  function runs(nodes: MdNode[], style: RunStyle = {}): InstanceType<typeof TextRun>[] {
    return nodes.flatMap((node) => {
      if (node.type === "strong") return runs(node.children, { ...style, bold: true });
      if (node.type === "emphasis") return runs(node.children, { ...style, italics: true });
      if (node.type === "inlineCode") return [new TextRun({ ...style, text: node.value, font: "Consolas" })];
      if (node.type === "break") return [new TextRun({ break: 1 })];
      if ("children" in node) return runs(node.children, style);
      // Soft line breaks inside a Markdown paragraph are just spaces.
      return "value" in node ? [new TextRun({ ...style, text: node.value.replace(/\n/g, " ") })] : [];
    });
  }
  function blocks(nodes: MdNode[]): InstanceType<typeof Paragraph>[] {
    return nodes.flatMap((node) => {
      if (node.type === "heading")
        return [new Paragraph({ heading: HeadingLevel[`HEADING_${Math.min(node.depth, 3) as 1 | 2 | 3}`], children: runs(node.children) })];
      if (node.type === "list") return list(node.children, node.ordered ?? false, 0);
      if (node.type === "blockquote")
        return node.children.map(
          (child) => new Paragraph({ indent: { left: 720 }, children: runs([child], { italics: true }) })
        );
      if (node.type === "thematicBreak") return [new Paragraph({ thematicBreak: true })];
      if (node.type === "code")
        return node.value.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Consolas" })] }));
      return [new Paragraph({ children: runs([node]) })];
    });
  }
  // Only an item's first paragraph carries the marker; each ordered list restarts at 1 via its own instance.
  function list(items: MdNode[], ordered: boolean, level: number): InstanceType<typeof Paragraph>[] {
    const instance = ordered ? ++orderedLists : 0;
    return items.flatMap((item) =>
      "children" in item
        ? item.children.flatMap((child, index) => {
            if (child.type === "list") return list(child.children, child.ordered ?? false, level + 1);
            const marker = ordered
              ? { numbering: { reference: "ordered", level, instance } }
              : { bullet: { level } };
            return [new Paragraph({ ...(index === 0 ? marker : { indent: { left: 720 * (level + 1) } }), children: runs([child]) })];
          })
        : []
    );
  }

  const date = new Date(input.createdAt).toLocaleDateString(undefined, { dateStyle: "long" });
  return new Document({
    title: input.title,
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(input.title)] }),
          new Paragraph({ children: [new TextRun({ text: `${date} · ${timestamp(input.durationSeconds)}`, color: "7F7F7F" })] }),
          ...blocks(fromMarkdown(input.summary).children),
          ...(input.segments.length
            ? [
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Transcript")] }),
                ...input.segments.map(
                  (segment) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `[${timestamp(segment.start)}] ${input.speakerNames[segment.speaker] || segment.speaker}`,
                          bold: true,
                        }),
                        new TextRun({ text: segment.text, break: 1 }),
                      ],
                    })
                ),
              ]
            : []),
        ],
      },
    ],
  });
}

export async function downloadMeetingDocx(input: MeetingDocxInput) {
  const { Packer } = await import("docx");
  const url = URL.createObjectURL(await Packer.toBlob(await buildMeetingDocx(input)));
  const link = document.createElement("a");
  link.href = url;
  // Strip characters Windows/macOS reject in filenames, plus trailing dots and spaces.
  link.download = `${input.title.replace(/[\\/:*?"<>|]/g, "").replace(/[.\s]+$/, "").trim() || "Meeting"}.docx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
