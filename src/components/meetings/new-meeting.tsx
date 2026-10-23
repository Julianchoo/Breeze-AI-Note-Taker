"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasAndroidRecorder } from "@/lib/native-android-recorder";
import { MeetingRecorder } from "./meeting-recorder";
import { NativeMeetingRecorder } from "./native-meeting-recorder";

const subscribe = () => () => {};

export function NewMeeting({ userId, autoStart = false }: { userId: string; autoStart?: boolean }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const native = hydrated && hasAndroidRecorder();
  useEffect(() => {
    if (!autoStart) return;
    // The tap authorizes this visit only; reloading should not start another microphone session.
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [autoStart]);
  const Recorder = native ? NativeMeetingRecorder : MeetingRecorder;
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-14">
        <Link
          href="/meetings/history"
          className="text-muted-foreground hover:text-foreground hover:bg-accent -ml-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          My meetings
        </Link>
        <header className="mt-6 mb-6 sm:mt-8 sm:mb-8">
          <p className="eyebrow">New recording</p>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl">Your meeting</h1>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            {native
              ? "Record now. Breeze takes care of the notes."
              : "Record now. Add meeting-tab audio whenever you want."}
          </p>
        </header>
        {hydrated ? (
          <Recorder userId={userId} autoStart={autoStart} onFinished={(id) => router.push(`/meetings/${id}`)} />
        ) : (
          <div role="status" aria-busy="true" className="bg-card rounded-2xl border p-8 text-center text-sm text-muted-foreground">Preparing your microphone…</div>
        )}
      </div>
    </div>
  );
}

