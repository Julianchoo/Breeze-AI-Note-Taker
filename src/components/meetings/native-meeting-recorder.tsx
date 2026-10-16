"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, UploadCloud, TriangleAlert, Download } from "lucide-react";
import { phoneAudioStatus } from "@/lib/audio-status";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkedNativeRequest, exportNativeRecording, nativeRecordings, startNativeRecording, stopNativeRecording,
  syncNativeRecording, type NativeRecording,
} from "@/lib/native-android-recorder";

export function NativeMeetingRecorder({ userId, onFinished }: {
  userId: string; onFinished: (id: string) => void;
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
          onFinishedRef.current(item.id);
          break;
        }
      }
      if (mounted.current && navigator.onLine) setError("");
    } catch (cause) {
      if (mounted.current) {
        setReady(true);
        setError(cause instanceof Error ? cause.message : "Could not upload audio. Retry when connected.");
      }
    } finally { refreshing.current = false; if (mounted.current) setUploadingId(null); }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    // Subscribe first; read bridge state asynchronously after React commits.
    queueMicrotask(() => {
      if (mounted.current) void refresh();
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
  }, [refresh]);

  const active = recordings.find((item) => !item.stopped && !item.finished);
  async function start() {
    if (busy || active || !ready) return;
    setBusy(true);
    setActionError("");
    try {
      const name = title.trim() || "Untitled meeting";
      const result = await checkedNativeRequest(await fetch("/api/meetings", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({title: name}), signal: AbortSignal.timeout(30000),
      }));
      if (typeof result?.meeting?.id !== "string") throw new Error("The meeting could not be created.");
      const recording = startNativeRecording(result.meeting.id, userId, name);
      setRecordings((items) => [recording, ...items]);
      setNow(Date.now());
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not start recording.");
    } finally { setBusy(false); }
  }
  async function stop() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const stopped = stopNativeRecording();
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
        <label htmlFor="native-title" className="text-sm font-medium">Meeting name</label>
        <Input id="native-title" className="mt-2 h-11 rounded-lg" value={active?.title ?? title}
          onChange={(event) => setTitle(event.target.value)} maxLength={160} disabled={!!active || busy}
          placeholder="e.g. Personal notes" />
        <div className="bg-muted/40 mt-7 rounded-2xl border px-4 py-8 text-center">
          <p className="eyebrow">{active ? "Recording microphone" : "Android microphone"}</p>
          <p className="mt-5 font-mono text-5xl tabular-nums" role="timer" aria-label="Recording duration">
            {String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            {active ? "You can lock your screen or use other apps. Stop from here or the Android notification." : "Audio is saved on your phone, including while the screen is locked."}
          </p>
        </div>
        <Button className="mt-6 w-full" size="lg" variant={active ? "destructive" : "default"}
          disabled={busy || !ready} onClick={() => void (active ? stop() : start())}>
          {active ? <Square /> : <Mic />}
          {busy ? "Please wait…" : active ? "Stop & save meeting" : "Start recording"}
        </Button>
        <p className="text-muted-foreground mt-4 text-sm leading-6">
          Audio uploads while this screen is open. Reopen it after recording to upload remaining audio and create your notes. Keep the app’s microphone notification enabled.
        </p>
        {active?.error ? <p role="alert" className="text-destructive mt-4 text-sm">{active.error}</p> : null}
        {error || actionError ? <div role="alert" className="text-destructive border-destructive/25 bg-destructive/5 mt-4 flex gap-2 rounded-xl border p-4 text-sm"><TriangleAlert className="size-4 shrink-0" /><span>{actionError || error} Saved audio stays on your phone.</span></div> : null}
      </section>
      {recordings.some((item) => item.stopped) ? (
        <section className="bg-card rounded-2xl border p-5 sm:p-8">
          <h2 className="font-display text-2xl">Saved on this phone</h2>
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
        </section>
      ) : null}
    </div>
  );
}
