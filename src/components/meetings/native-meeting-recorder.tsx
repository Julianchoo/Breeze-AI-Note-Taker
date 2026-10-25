"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CaretDownIcon, CheckCircleIcon, CircleNotchIcon, DeviceMobileIcon, DownloadSimpleIcon, MicrophoneIcon, PhoneSlashIcon,
  SlidersHorizontalIcon, StopIcon, UploadSimpleIcon, WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { phoneAudioStatus } from "@/lib/audio-status";
import {
  checkedNativeRequest, exportNativeRecording, interruptedByCall, nativeRecordings, startNativeRecording, stopNativeRecording,
  syncNativeRecording, type NativeRecording,
} from "@/lib/native-android-recorder";

/* Landing system classes (DESIGN.md "Landing system"). Markup only: the bridge calls above and below
   are unchanged. */
const SUMMARY =
  "ease-fluid hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-details-marker]:hidden";
const ALERT =
  "text-destructive border-destructive/25 bg-destructive/5 mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm";

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
          // A call cut this recording short: stay here so the explanation is seen before the notes.
          if (!starting.current && !phoneIsRecording && !interruptedByCall(item) && (startedHere.current === item.id || (!autoStart && !startedHere.current))) {
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
  const latest = recordings.reduce<NativeRecording | undefined>((newest, item) => !newest || item.startedAt > newest.startedAt ? item : newest, undefined);
  const callStopped = !active && latest?.stopped && interruptedByCall(latest) ? latest : undefined;
  const seconds = active ? Math.max(0, Math.floor((now - active.startedAt) / 1000)) : 0;
  return (
    <div className="flex flex-col gap-6">
      <section className="bg-card animate-landing-rise rounded-3xl border p-3 shadow-xs [animation-delay:80ms]">
        {/* Outer 24px radius, 12px gap: 12px well. */}
        <div
          className={`ease-fluid rounded-xl px-4 py-10 text-center transition-colors duration-700 ${active ? "bg-destructive/8" : "bg-band"}`}
        >
          <span className="bg-card inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${active ? "bg-destructive animate-pulse-ring" : "bg-muted-foreground/40"}`}
            />
            {active ? "Recording microphone" : "Android microphone"}
          </span>
          <p className={`ease-fluid mt-6 font-mono text-5xl tracking-tight tabular-nums transition-colors duration-700 sm:text-6xl ${active ? "text-foreground" : "text-muted-foreground/45"}`} role="timer" aria-label="Recording duration">
            {String(Math.floor(seconds / 3600)).padStart(2, "0")}:{String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xs text-sm text-pretty">
            {active ? "You can lock your screen or use other apps. Stop from here or the Android notification." : "Audio is saved on your phone, including while the screen is locked."}
          </p>
        </div>
        <div className="px-3 pt-6 pb-3">
          <Button className="ease-fluid h-14 w-full text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0" size="lg" variant={active ? "destructive" : "default"}
            disabled={busy || !ready} onClick={() => void (active ? stop() : start())}>
            {busy ? <CircleNotchIcon className="animate-spin" /> : active ? <StopIcon weight="fill" /> : <MicrophoneIcon weight="fill" />}
            {busy ? "Please wait…" : active ? "Stop and save meeting" : "Start recording"}
          </Button>
          {active ? null : (
            <p className="text-muted-foreground mx-auto mt-4 flex max-w-xs items-start gap-2 text-xs text-pretty">
              <PhoneSlashIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              WhatsApp and phone calls on this phone can&apos;t be recorded: Android gives the microphone to the call.
            </p>
          )}
          <details className="group/details mt-4">
            <summary className={SUMMARY}>
              <SlidersHorizontalIcon className="text-muted-foreground size-4" aria-hidden="true" />
              Meeting details
              <CaretDownIcon className="text-muted-foreground ease-fluid ml-auto size-4 transition-transform duration-300 group-open/details:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pt-4 pb-2">
              <label htmlFor="native-title" className="block text-sm font-semibold">Meeting name <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input id="native-title" className="mt-2 h-12 rounded-lg" value={active?.title ?? title}
                onChange={(event) => setTitle(event.target.value)} maxLength={160} disabled={!!active || busy}
                placeholder="Breeze will name your meeting for you" />
              {active ? <p className="text-muted-foreground mt-2 text-xs text-pretty">You can rename this meeting after recording.</p> : null}
              <p className="text-muted-foreground mt-3 text-xs text-pretty">Reopen this screen after recording to finish uploading audio and create your notes.</p>
            </div>
          </details>

          {callStopped ? (
            <div role="alert" className="border-destructive/25 bg-destructive/5 mt-4 flex gap-3 rounded-xl border p-4 text-sm">
              <PhoneSlashIcon className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">A call stopped the recording</p>
                <p className="text-muted-foreground mt-1 text-pretty">
                  During a WhatsApp or phone call, Android lets only the call app use the microphone, so Breeze can&apos;t record it from this phone. To record a call, join it from WhatsApp Web on a computer and record with Breeze there using meeting tab audio, or put the call on speaker and record from another device.
                </p>
                {callStopped.finished ? <Link href={`/meetings/${callStopped.id}`} className="text-primary mt-2 inline-block font-semibold underline underline-offset-4">Open the saved part</Link> : null}
              </div>
            </div>
          ) : null}
          {active?.error ? <div role="alert" className={ALERT}><WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{active.error}</span></div> : null}
          {error || actionError ? <div role="alert" className={ALERT}><WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{actionError || error} Saved audio stays on your phone.</span></div> : null}
        </div>
      </section>
      {recordings.some((item) => item.stopped) ? (
        <details className="group/saved bg-card animate-landing-rise rounded-3xl border p-3 shadow-xs [animation-delay:160ms]">
          <summary className={SUMMARY}>
            <DeviceMobileIcon className="text-muted-foreground size-4" aria-hidden="true" />
            Saved on this phone
            <CaretDownIcon className="text-muted-foreground ease-fluid ml-auto size-4 transition-transform duration-300 group-open/saved:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {recordings.filter((item) => item.stopped).map((item) => {
              const status = phoneAudioStatus(item, uploadingId === item.id);
              return <li key={item.id} className="bg-band rounded-xl p-4">
              <p className="text-sm font-semibold">{item.title}</p>
              <Badge variant={item.finished ? "success" : "secondary"} className="mt-2">
                {item.finished ? <CheckCircleIcon weight="fill" aria-hidden="true" /> : uploadingId === item.id ? <CircleNotchIcon className="animate-spin" aria-hidden="true" /> : <DeviceMobileIcon aria-hidden="true" />}
                {status.label}
              </Badge>
              <p className="text-muted-foreground mt-2 text-sm text-pretty">{status.detail}</p>
              {item.error ? <p role="alert" className="text-destructive mt-2 flex items-start gap-2 text-sm"><WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{item.error}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {item.finished ? <Link href={`/meetings/${item.id}`} className="text-primary text-sm font-semibold underline underline-offset-4">Open meeting</Link> : null}
                {item.chunks > 0 ? <Button variant="outline" size="sm" className="ease-fluid font-semibold duration-300" onClick={() => exportAudio(item)}><DownloadSimpleIcon />Export audio</Button> : null}
              </div>
            </li>; })}
          </ul>
          {recordings.some((item) => item.stopped && !item.finished) ? <Button variant="secondary" className="ease-fluid m-3 font-semibold duration-300" disabled={busy} onClick={() => void refresh()}><UploadSimpleIcon />Retry uploading</Button> : null}
        </details>
      ) : null}
    </div>
  );
}
