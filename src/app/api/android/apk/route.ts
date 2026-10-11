/** Public, fixed-source APK download. Never forwards user cookies or credentials. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const APK_URL = "https://github.com/Julianchoo/Breeze-AI-Note-Taker/releases/download/android-latest/breeze.apk";
const MAX_BYTES = 4 * 1024 * 1024;

export async function GET() {
  try {
    const upstream = await fetch(APK_URL, {
      cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(60_000),
    });
    const host = new URL(upstream.url).hostname;
    const length = Number(upstream.headers.get("content-length"));
    if (!upstream.ok || !upstream.body ||
      !["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(host) ||
      !Number.isInteger(length) || length < 1024 || length > MAX_BYTES) {
      await upstream.body?.cancel();
      throw new Error("APK unavailable");
    }
    const reader = upstream.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > length || total > MAX_BYTES) throw new Error("APK exceeds expected size");
        parts.push(next.value);
      }
    } catch (error) { await reader.cancel(); throw error; }
    if (total !== length) throw new Error("Incomplete APK");
    const body = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.byteLength; }
    if (body[0] !== 0x50 || body[1] !== 0x4b || body[2] !== 3 || body[3] !== 4) {
      throw new Error("Invalid APK");
    }
    return new Response(body, { headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="breeze.apk"',
      "Content-Length": String(length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response("The Android download is temporarily unavailable. Return to /android and try the GitHub download link.", {
      status: 502, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
