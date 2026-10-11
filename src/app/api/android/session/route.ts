import { NextRequest, NextResponse } from "next/server";
import { openHandoff, sealHandoff, validChallenge, validState } from "@/lib/android-handoff";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (Number(request.headers.get("content-length")) > 8192) return reply({ error: "Request too large" }, 413);
  const raw = await request.text();
  if (raw.length > 8192) return reply({ error: "Request too large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid request" }, 400); }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) return reply({ error: "Android sign-in is not configured" }, 503);
  try {
    if (body.token !== undefined) {
      const data = openHandoff(body.token, body.verifier, body.state, secret);
      const response = reply({ ok: true });
      response.headers.append("Set-Cookie", `${data.cookie}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${Math.max(1, Math.floor((data.sessionExpires - Date.now()) / 1000))}`);
      return response;
    }
    if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Invalid origin" }, 403);
    if (!validChallenge(body.challenge) || !validState(body.state)) return reply({ error: "Invalid request" }, 400);
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    if (!session) return reply({ error: "Sign in first" }, 401);
    const cookie = (request.headers.get("cookie") ?? "").split(";").map(value => value.trim()).find(value => /^(?:__Secure-)?better-auth\.session_token=/.test(value));
    if (!cookie) return reply({ error: "Session cookie missing" }, 401);
    const token = sealHandoff({ cookie, challenge: body.challenge, state: body.state, expires: Date.now() + 120_000, sessionExpires: new Date(session.session.expiresAt).getTime() }, secret);
    return reply({ token, state: body.state });
  } catch { return reply({ error: "The sign-in link expired or is invalid. Start again in the Android app." }, 400); }
}
