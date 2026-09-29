import { and, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { MeetingError, joinedWavHeader, joinedWavPieces } from "./meeting-validation";
import { account } from "./schema";

const GRAPH = "https://graph.microsoft.com/v1.0", FOLDER = "Audios Breeze";
// Graph wants fragments in multiples of 320 KiB; ~9.4 MB per PUT.
const FRAGMENT = 30 * 320 * 1024;
const RECONNECT = "Could not save the audio to OneDrive. Reconnect OneDrive from your account menu and retry.";

async function microsoftAccount(userId: string) {
  const [row] = await db.select({ id: account.id }).from(account).where(and(eq(account.providerId, "microsoft"), eq(account.userId, userId)));
  return row;
}
export const onedriveConnected = async (userId: string) => !!(await microsoftAccount(userId));
async function token(userId: string) {
  const row = await microsoftAccount(userId);
  if (!row) throw new MeetingError("Connect OneDrive from your account menu, then retry.", 409);
  // Refreshes (and re-encrypts) the stored token when it is about to expire.
  const { accessToken } = await auth.api.getAccessToken({ body: { accountId: row.id, userId } }).catch(() => { throw new MeetingError(RECONNECT, 502); });
  return accessToken;
}
async function graph(userId: string, path: string, body: unknown) {
  return fetch(`${GRAPH}${path}`, { method: "POST", headers: { Authorization: `Bearer ${await token(userId)}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
}
export async function ensureFolder(userId: string) {
  const response = await graph(userId, "/me/drive/root/children", { name: FOLDER, folder: {}, "@microsoft.graph.conflictBehavior": "fail" });
  if (response.ok) return;
  const code = response.status === 409 && (await response.json().catch(() => null) as { error?: { code?: string } } | null)?.error?.code;
  if (code !== "nameAlreadyExists") throw new MeetingError(RECONNECT, 502);
}
// OneDrive rejects " * : < > ? / \ | and control characters in names.
export const archiveName = (createdAt: Date, title: string) => `${createdAt.toISOString().slice(0, 10)} ${title}`.replace(/["*:<>?/\\|\u0000-\u001f]/g, "-").trim() + ".wav";
const nextStart = (body: unknown) => Number((body as { nextExpectedRanges?: string[] }).nextExpectedRanges?.[0]?.split("-")[0] ?? NaN);

/**
 * Streams a meeting's parts to OneDrive as one WAV through a resumable upload session. `save` persists the session URL
 * (null = start over) so a later call resumes; returns true once OneDrive holds the complete file, false when `deadline` hit first.
 */
export async function archiveToOneDrive({ userId, name, parts, read, uploadUrl, save, deadline = Infinity }: {
  userId: string; name: string; parts: { path: string; dataBytes: number }[]; read: (path: string) => Promise<Buffer>;
  uploadUrl: string | null; save: (uploadUrl: string | null) => Promise<void>; deadline?: number;
}) {
  const dataBytes = parts.map(p => p.dataBytes), total = 44 + dataBytes.reduce((n, b) => n + b, 0);
  let url = uploadUrl, offset = 0;
  // The upload URL is pre-authenticated: it must never get the Authorization header.
  const put = (bytes: Buffer, start: number) => fetch(url!, { method: "PUT", headers: { "Content-Range": `bytes ${start}-${start + bytes.length - 1}/${total}` }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(120_000) });
  if (url) {
    const status = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (status.status === 404) { url = null; await save(null); } // session expired
    else if (!status.ok) throw new MeetingError(RECONNECT, 502);
    else offset = nextStart(await status.json());
    // ponytail: a session that finished right before its URL was cleared also reads as expired, so the retry uploads "name 1.wav" too.
  }
  const cache = new Map<number, Buffer>();
  while (Date.now() < deadline) {
    if (!url) {
      await ensureFolder(userId);
      const response = await graph(userId, `/me/drive/root:/${encodeURIComponent(FOLDER)}/${encodeURIComponent(name)}:/createUploadSession`, { item: { "@microsoft.graph.conflictBehavior": "rename" } });
      if (!response.ok) throw new MeetingError(RECONNECT, 502);
      url = ((await response.json()) as { uploadUrl: string }).uploadUrl; offset = 0;
      await save(url);
    }
    if (!Number.isInteger(offset) || offset < 0 || offset >= total) throw new MeetingError(RECONNECT, 502);
    // Only the parts this fragment touches are downloaded; earlier ones are dropped.
    const pieces = joinedWavPieces(dataBytes, offset, Math.min(offset + FRAGMENT, total));
    for (const key of cache.keys()) if (key < pieces[0]!.part) cache.delete(key);
    const bytes: Buffer[] = [];
    for (const { part, from, to } of pieces) {
      const index = Math.max(part, 0);
      if (!cache.has(index)) cache.set(index, await read(parts[index]!.path));
      const file = cache.get(index)!;
      bytes.push(part < 0 ? joinedWavHeader(file, total - 44).subarray(from, to) : file.subarray(from, to));
    }
    const response = await put(Buffer.concat(bytes), offset);
    if (response.status === 404) { url = null; await save(null); continue; } // session expired mid-upload: start over
    if (response.status === 202) { offset = nextStart(await response.json()); continue; }
    if ((response.status === 200 || response.status === 201) && ((await response.json()) as { size?: number }).size === total) return true;
    throw new MeetingError(RECONNECT, 502);
  }
  return false;
}
