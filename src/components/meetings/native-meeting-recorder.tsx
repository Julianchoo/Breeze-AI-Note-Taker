"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, UploadCloud, TriangleAlert, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phoneAudioStatus } from "@/lib/audio-status";
import {
  checkedNativeRequest, exportNativeRecording, nativeRecordings, startNativeRecording, stopNativeRecording,
  syncNativeRecording, type NativeRecording,
} from "@/lib/native-android-recorder";

export function NativeMeetingRecorder({ userId, onFinished, autoStart = false }: {
  userId: string; onFinished: (id: string) => void; autoStart?: boolean;
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [recordings, setRecordings] = useState<NativeRecording[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const mounted = useRef(false);
  const refreshing = useRef(false);
  const starting = useRef(false);
  const autoStartHandled = useRef(false);
  const startedHere = useRef<string | null>(null);
  const notified = useRef(new Set<string>());
  // Finished local copies whose meeting was checked on the server: true = deleted there, so hidden here.
  const deleted = useRef(new Map<string, boolean>());
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  const refresh = useCallback(async () => {
    if (refreshing.current || document.visibilityState !== "visible") return;
    refreshing.current = true;
    try {
      // ponytail: the phone keeps the files (the bridge has no delete); add one to the Android app to free the space.
      for (const item of nativeRecordings(userId).filter((recording) => recording.finished && !deleted.current.has(recording.id))) {
        const response = await fetch(`/api/meetings/${item.id}`).catch(() => null);
        if (response && response.status !== 401) deleted.current.set(item.id, response.status === 404);
      }
      const items = nativeRecordings(userId).filter((recording) => !deleted.current.get(recording.id));
      if (mounted.current) {
        setRecordings(items);
        setReady(true);
        setNow(Date.now());
      }
      for (const item of items.filter((recording) => !recording.finished)) {
        if (!mounted.current) break;
        if (mounted.current && navigator.onLine) setUploadingId(item.id);
        const finished = await syncNativeRecording(item, (updated) => {
          if (mounted.current) setRecordings((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
        });
        if (mounted.current) setUploadingId(null);
        if (finished && mounted.current && !notified.current.has(item.id)) {
          notified.current.add(item.id);
          // Recover older audio in the background without taking a new recording away.
          // Upload completion may arrive after a manual start. Re-read the service rather
          // than using the snapshot from before the awaited upload.
          const phoneIsRecording = nativeRecordings(userId).some((entry) => !entry.stopped && !entry.finished);
          if (!starting.current && !phoneIsRecording && (startedHere.current === item.id || (!autoStart && !startedHere.current))) {
            onFinishedRef.current(item.id);
            break;
          }
        }
      }
      if (mounted.current && navigator.onLine) setError("");
    } catch (cause) {
      if (mounted.current) {
        setReady(true);
        setError(cause instanceof Error ? cause.message : "Could not upload audio. Retry when connected.");
      }
    } finally { refreshing.current = false; if (mounted.current) setUploadingId(null); }
  }, [userId, autoStart]);

  useEffect(() => {
    mounted.current = true;
    // Subscribe first; read bridge state asynchronously after React commits.
    queueMicrotask(() => {
      if (!mounted.current) return;
      try {
        // Make the local recorder ready immediately; older uploads must not delay the microphone.
        setRecordings(nativeRecordings(userId));
        setReady(true);
        setNow(Date.now());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read saved phone audio.");
      }
      void refresh();
    });
    const timer = setInterval(() => void refresh(), 3000);
    const retry = () => void refresh();
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
      // The foreground service owns recording; leaving this page must not stop it.
    };
  }, [refresh, userId]);

  const active = recordings.find((item) => !item.stopped && !item.finished);
  const start = useCallback(async () => {
    if (starting.current || busy || !ready) return;
    // Read the bridge again: its foreground service can keep recording while this page is closed.
    try {
      const current = nativeRecordings(userId);
      const existing = current.find((item) => !item.stopped && !item.finished);
      if (existing) {
        // Reopening New meeting adopts the service session instead of creating another.
        // Its eventual Stop & save should still open the completed notes.
        startedHere.current = existing.id;
        setRecordings(current);
        return;
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not check the phone recorder.");
      return;
    }
    starting.current = true;
    setBusy(true);
    setActionError("");
    try {
      const name = title.trim() || "Untitled meeting";
      const result = await checkedNativeRequest(await fetch("/api/meetings", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({title: name}), signal: AbortSignal.timeout(30000),
      }));
      if (typeof result?.meeting?.id !== "string") throw new Error("The meeting could not be created.");
      if (!mounted.current) return;
      const recording = startNativeRecording(result.meeting.id, userId, name);
      startedHere.current = recording.id;
      setRecordings((items) => [recording, ...items]);
      setNow(Date.now());
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not start recording.");
    } finally { starting.current = false; if (mounted.current) setBusy(false); }
  }, [busy, ready, title, userId]);

  useEffect(() => {
    if (!autoStart || !ready || autoStartHandled.current) return;
    // Defer until after commit; Strict Mode cancels its first scheduled attempt.
    const timer = setTimeout(() => {
      if (!mounted.current || autoStartHandled.current) return;
      autoStartHandled.current = true;
      void start();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoStart, ready, start]);

  async function stop() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const stopped = stopNativeRecording();
      startedHere.current = stopped.id;
      setRecordings((items) => items.map((item) => item.id === stopped.id ? stopped : item));
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not stop recording. Check the Android notification.");
    } finally { setBusy(false); }
  }
  function exportAudio(item: NativeRecording) {
    setActionError("");
    try {
      exportNativeRecording(item.id, userId);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not export saved audio.");
    }
  }
  const seconds = active ? Math.max(0, Math.floor((now - active.startedAt) / 1000)) : 0;
  return (
    <div className="space-y-6">
      <section className="bg-card animate-fade-up rounded-2xl border p-5 sm:p-8">
        <div className="px-4 py-6 text-center">
          <p className="eyebrow flex items-center justify-center gap-2">
            {active ? <span className="bg-destructive animate-pulse-ring size-2 rounded-full" aria-hidden="true" /> : null}
            {active ? "Recording microphone" : "Android microphone"}
          </p>
          <p className="mt-5 font-mono text-5xl tabular-nums" role="timer" aria-label="Recording duration">
            {String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            {active ? "You can lock your screen or use other apps. Stop from here or the Android notification." : "Audio is saved on your phone, including while the screen is locked."}
          </p>
        </div>
        <Button className="mt-6 h-16 w-full text-base" size="lg" variant={active ? "destructive" : "default"}
          disabled={busy || !ready} onClick={() => void (active ? stop() : start())}>
          {active ? <Square /> : <Mic />}
          {busy ? "Please wait…" : active ? "Stop & save meeting" : "Start recording"}
        </Button>
        <details className="mt-5 text-muted-foreground">
          <summary className="cursor-pointer text-sm font-medium">Meeting details</summary>
          <label htmlFor="native-title" className="mt-4 block text-sm font-medium">Meeting name <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input id="native-title" className="mt-2 h-11 rounded-lg" value={active?.title ?? title}
            onChange={(event) => setTitle(event.target.value)} maxLength={160} disabled={!!active || busy}
            placeholder="Breeze will name your meeting for you" />
          {active ? <p className="text-muted-foreground mt-2 text-xs leading-5">You can rename this meeting after recording.</p> : null}
          <p className="text-muted-foreground mt-3 text-xs leading-5">Reopen this screen after recording to finish uploading audio and create your notes.</p>
        </details>

        {active?.error ? <p role="alert" className="text-destructive mt-4 text-sm">{active.error}</p> : null}
        {error || actionError ? <div role="alert" className="text-destructive border-destructive/25 bg-destructive/5 mt-4 flex gap-2 rounded-xl border p-4 text-sm"><TriangleAlert className="size-4 shrink-0" /><span>{actionError || error} Saved audio stays on your phone.</span></div> : null}
      </section>
      {recordings.some((item) => item.stopped) ? (
        <details className="bg-card rounded-2xl border p-5 sm:p-8">
          <summary className="cursor-pointer text-sm font-medium">Saved on this phone</summary>
          <ul className="mt-4 space-y-4">
            {recordings.filter((item) => item.stopped).map((item) => {
              const status = phoneAudioStatus(item, uploadingId === item.id);
              return <li key={item.id}>
              <p className="text-sm font-medium">{item.title}</p>
              <Badge variant={item.finished ? "success" : "secondary"} className="mt-2">{status.label}</Badge>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{status.detail}</p>
              {item.error ? <p role="alert" className="text-destructive mt-2 text-sm">{item.error}</p> : null}
              {item.finished ? <Link href={`/meetings/${item.id}`} className="text-primary mt-2 block text-sm underline underline-offset-4">Open meeting</Link> : null}
              {item.chunks > 0 ? <Button variant="outline" size="sm" className="mt-2" onClick={() => exportAudio(item)}><Download />Export audio</Button> : null}
            </li>; })}
          </ul>
          {recordings.some((item) => item.stopped && !item.finished) ? <Button variant="secondary" className="mt-5" disabled={busy} onClick={() => void refresh()}><UploadCloud />Retry uploading</Button> : null}
        </details>
      ) : null}
    </div>
  );
}
