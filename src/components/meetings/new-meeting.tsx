"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MeetingRecorder } from "./meeting-recorder";
export function NewMeeting({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-14">
        <Link
          href="/meetings"
          className="text-muted-foreground hover:text-foreground hover:bg-accent -ml-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          My meetings
        </Link>
        <header className="mt-8 mb-8 sm:mt-10 sm:mb-10">
          <p className="eyebrow">New recording</p>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl">Ready when you are</h1>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            Name the meeting, pick what Breeze should listen to, then press record. Notes are
            written for you the moment you stop.
          </p>
        </header>
        <MeetingRecorder userId={userId} onFinished={(id) => router.push(`/meetings/${id}`)} />
      </div>
    </div>
  );
}
