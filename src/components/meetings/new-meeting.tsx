"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MeetingRecorder } from "./meeting-recorder";
export function NewMeeting({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <Link
        href="/meetings"
        className="text-muted-foreground hover:text-foreground mb-10 inline-flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="size-4" />
        My meetings
      </Link>
      <MeetingRecorder userId={userId} onFinished={(id) => router.push(`/meetings/${id}`)} />
    </div>
  );
}
