import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const validChallenge = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validState = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(value);
type Handoff = { cookie: string; challenge: string; state: string; expires: number; sessionExpires: number };
function key(secret: string) {
  if (secret.length < 32) throw new Error("Authentication secret must have at least 32 characters");
  return Buffer.from(hkdfSync("sha256", secret, "breeze-android", "session-handoff-v1", 32));
}
export function sealHandoff(data: Handoff, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(data)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}
export function openHandoff(token: string, verifier: string, state: string, secret: string, now = Date.now()): Handoff {
  if (!/^[A-Za-z0-9_-]{40,4096}$/.test(token) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !validState(state)) throw new Error("Invalid handoff");
  const bytes = Buffer.from(token, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(-16));
  const data: Handoff = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString());
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (!validChallenge(data.challenge) || data.state !== state || !Number.isFinite(data.expires) || data.expires <= now || !Number.isFinite(data.sessionExpires) || data.sessionExpires <= now || !timingSafeEqual(Buffer.from(challenge), Buffer.from(data.challenge))) throw new Error("Expired or invalid handoff");
  if (!/^(?:__Secure-)?better-auth\.session_token=[A-Za-z0-9%._~+\/-]+$/.test(data.cookie)) throw new Error("Invalid session cookie");
  return data;
}
