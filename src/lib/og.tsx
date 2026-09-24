/* Shared pieces for Open Graph images (Satori). Fixed hex: Satori can't read theme tokens. Light-theme background, foreground, muted-foreground, primary, border. */
export const OG = { width: 1200, height: 630, bg: "#f8f5ef", fg: "#2f2925", muted: "#776b62", primary: "#af5336", border: "#e2dbd1" };
export const ogFrame = {
  width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
  padding: 72, background: OG.bg, color: OG.fg, fontFamily: "Sans",
  backgroundImage: "radial-gradient(circle at 50% -20%, rgba(175,83,54,0.16), transparent 60%)",
} as const;

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
export async function ogFonts(serifText: string, sansText: string) {
  const [serif, sans] = await Promise.all([font("Instrument+Serif", serifText), font("Geist:wght@500", `Breeze ${sansText}`)]);
  return [
    ...(serif ? [{ name: "Serif", data: serif, weight: 400 as const }] : []),
    ...(sans ? [{ name: "Sans", data: sans, weight: 500 as const }] : []),
  ];
}

export function OgBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width="52" height="52" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill={OG.primary} />
        <g transform="translate(4 4)" fill="none" stroke="#fcfaf6" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.8 19.6A2 2 0 1 0 14 16H2" />
          <path d="M17.5 8a2.5 2.5 0 1 1 2 4H2" />
          <path d="M9.8 4.4A2 2 0 1 1 11 8H2" />
        </g>
      </svg>
      <span style={{ fontSize: 34 }}>Breeze</span>
    </div>
  );
}
