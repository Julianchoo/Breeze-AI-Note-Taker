import { ImageResponse } from "next/og";
import { getSharedMeeting } from "@/lib/meetings";

export const alt = "Shared meeting notes from Breeze";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Fixed hex: Satori can't read theme tokens. Light-theme background, foreground, muted-foreground, primary, border. */
const C = { bg: "#f8f5ef", fg: "#2f2925", muted: "#776b62", primary: "#af5336", border: "#e2dbd1" };

/* Fetches only the glyphs needed from Google Fonts; falls back to Satori's default font if it fails. */
async function font(family: string, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)).text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const meeting = await getSharedMeeting((await params).token);
  const title = meeting.title.length > 90 ? `${meeting.title.slice(0, 89)}…` : meeting.title;
  const date = new Date(meeting.createdAt).toLocaleDateString("en-US", { dateStyle: "long" });
  const minutes = `${Math.max(1, Math.round(meeting.durationSeconds / 60))} min`;
  const sections = [meeting.summary && "AI summary", meeting.chunks && "Recording", meeting.segments && "Transcript"].filter((s): s is string => !!s);
  const [serif, sans] = await Promise.all([
    font("Instrument+Serif", title),
    font("Geist:wght@500", `Breeze SHARED MEETING NOTES ${date} ${minutes} AI summary Recording Transcript ·`),
  ]);
  const fonts = [
    ...(serif ? [{ name: "Serif", data: serif, weight: 400 as const }] : []),
    ...(sans ? [{ name: "Sans", data: sans, weight: 500 as const }] : []),
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 72, background: C.bg, color: C.fg, fontFamily: "Sans",
          backgroundImage: "radial-gradient(circle at 50% -20%, rgba(175,83,54,0.16), transparent 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill={C.primary} />
            <g transform="translate(4 4)" fill="none" stroke="#fcfaf6" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
              <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
              <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
            </g>
          </svg>
          <span style={{ fontSize: 34 }}>Breeze</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 22, letterSpacing: 5, color: C.muted }}>SHARED MEETING NOTES</span>
          <span style={{ fontFamily: "Serif", fontSize: title.length > 45 ? 68 : 84, lineHeight: 1.05, letterSpacing: -1 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: C.muted }}>
          <span>{date} · {minutes}</span>
          {sections.map((s) => (
            <span key={s} style={{ marginLeft: 6, padding: "6px 18px", borderRadius: 999, border: `2px solid ${C.border}`, color: C.fg, fontSize: 22 }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
