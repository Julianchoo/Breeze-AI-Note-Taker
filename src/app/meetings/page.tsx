import Link from "next/link";
import { Mic } from "lucide-react";

export const metadata = { title: "New meeting" };

export default function MeetingsPage() {
  return (
    <section className="glow-bg flex min-h-[calc(100svh-14rem)] flex-col items-center justify-center gap-8 px-6 py-12 sm:gap-10 sm:py-16">
      <h1 className="sr-only">New meeting</h1>
      <Link
        href="/meetings/new?record=1"
        prefetch={false}
        className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/50 flex aspect-square w-64 max-w-full shrink-0 flex-col items-center justify-center gap-5 rounded-full shadow-[0_14px_50px_-20px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-[transform,background-color,box-shadow] duration-200 hover:scale-[1.02] focus-visible:ring-4 focus-visible:ring-offset-4 active:scale-[0.97] sm:w-80 sm:gap-6"
      >
        <Mic aria-hidden="true" className="size-9 sm:size-11" strokeWidth={1.5} />
        <span className="text-base font-medium tracking-[0.14em] sm:text-lg">NEW MEETING</span>
      </Link>
    </section>
  );
}
