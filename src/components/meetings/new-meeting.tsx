"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="landing">
      <div className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:pt-12 sm:pb-24">
        <Link
          href="/meetings/history"
          className="text-muted-foreground hover:text-foreground hover:bg-accent ease-fluid focus-visible:ring-ring/50 -ml-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-[background-color,color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          My meetings
        </Link>
        <header className="animate-landing-rise mt-6 mb-8 flex flex-col gap-3 sm:mt-8">
          <p className="text-primary text-sm font-semibold">New recording</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Your meeting</h1>
          <p className="text-muted-foreground text-base text-pretty">
            {native
              ? "Record now. Breeze takes care of the notes."
              : "Record now. Add meeting tab audio whenever you want."}
          </p>
        </header>
        {hydrated ? (
          <Recorder userId={userId} autoStart={autoStart} onFinished={(id) => router.push(`/meetings/${id}`)} />
        ) : (
          <div role="status" aria-busy="true" className="bg-card rounded-3xl border p-3 shadow-xs">
            <div className="bg-band flex flex-col items-center gap-4 rounded-xl px-4 py-10">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-12 w-56" />
              <span className="text-muted-foreground text-sm">Preparing your microphone…</span>
            </div>
            <Skeleton className="mt-6 h-14 w-full rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}
