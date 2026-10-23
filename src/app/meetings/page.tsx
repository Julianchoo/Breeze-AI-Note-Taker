import Link from "next/link";
import { Mic, UploadCloud } from "lucide-react";

export const metadata = { title: "New meeting" };

export default function MeetingsPage() {
  return (
    <section className="flex min-h-[calc(100svh-14rem)] flex-col items-center justify-center gap-8 px-6 py-12 sm:py-16">
      <h1 className="sr-only">New meeting</h1>
      <Link
        href="/meetings/new?record=1"
        prefetch={false}
        className="animate-fade-up bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 flex aspect-square w-52 shrink-0 flex-col items-center justify-center gap-3 rounded-full shadow-[0_16px_40px_-20px_color-mix(in_oklch,var(--primary)_70%,transparent)] transition-[transform,background-color] duration-200 focus-visible:ring-4 focus-visible:ring-offset-4 focus-visible:outline-none active:scale-[0.97] sm:w-60"
      >
        <Mic aria-hidden="true" className="size-10 sm:size-11" strokeWidth={1.75} />
        <span className="text-lg font-medium">Record</span>
      </Link>
      <div className="animate-fade-up flex flex-col items-center gap-2 text-center [animation-delay:120ms]">
        <p className="text-muted-foreground text-sm">Tap to record your microphone</p>
        <Link
          href="/meetings/new"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors"
        >
          <UploadCloud className="size-4" aria-hidden="true" />
          Upload a recording
        </Link>
      </div>
    </section>
  );
}
