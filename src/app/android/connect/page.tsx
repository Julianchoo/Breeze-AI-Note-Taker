"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

function Connect() {
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const challenge = params.get("challenge") ?? "";
  const state = params.get("state") ?? "";
  const valid = /^[A-Za-z0-9_-]{43}$/.test(challenge) && /^[A-Za-z0-9_-]{32,128}$/.test(state);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      if (!session) {
        const callbackURL = `/android/connect?challenge=${encodeURIComponent(challenge)}&state=${encodeURIComponent(state)}`;
        const result = await signIn.social({ provider: "google", callbackURL, errorCallbackURL: callbackURL + "&error=google" });
        if (result.error) throw new Error("Google sign-in failed. Try again.");
        return;
      }
      const response = await fetch("/api/android/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge, state }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not connect the app.");
      const url = `breeze://auth?token=${encodeURIComponent(body.token)}&state=${encodeURIComponent(state)}`;
      setLink(url);
      window.location.href = url;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not connect the app."); }
    finally { setBusy(false); }
  }
  return <main className="bg-background flex min-h-dvh items-center justify-center p-6"><section className="bg-card border-border w-full max-w-md space-y-6 rounded-2xl border p-8 shadow-sm"><p className="text-primary text-sm">Breeze for Android</p><h1 className="font-display text-3xl">Connect your phone</h1><p className="text-muted-foreground">{session ? `Continue as ${session.user.email} to connect your Android app.` : "Sign in with Google in your browser, then return to Breeze."}</p>{valid ? <Button className="w-full" onClick={connect} disabled={busy || isPending}>{busy ? "Connecting…" : session ? "Connect Android app" : "Continue with Google"}</Button> : <p role="alert" className="text-destructive">Open sign-in from the Breeze Android app to start.</p>}{link && <a className="text-primary block underline" href={link}>Return to Breeze</a>}{(error || params.get("error")) && <p role="alert" className="text-destructive text-sm">{error || "Google sign-in failed. Try again."}</p>}</section></main>;
}
export default function AndroidConnectPage() { return <Suspense><Connect /></Suspense>; }
