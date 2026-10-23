import Link from "next/link";
import { Mic, UploadCloud } from "lucide-react";

export const metadata = { title: "New meeting" };

export default function MeetingsPage() {
  return (
    <section className="glow-bg flex min-h-[calc(100svh-14rem)] flex-col items-center justify-center gap-10 px-6 py-12 sm:gap-12 sm:py-16">
      <header className="animate-fade-up flex flex-col items-center gap-3 text-center">
        <p className="eyebrow">Ready when you are</p>
        <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl">New meeting</h1>
      </header>

      <div className="animate-fade-up relative my-6 grid place-items-center [animation-delay:120ms] sm:my-8">
        {/* Decorative halo: two static rings plus one slowly radiating outward. */}
        <span
          aria-hidden="true"
          className="border-primary/15 pointer-events-none absolute -inset-5 rounded-full border sm:-inset-7"
        />
        <span
          aria-hidden="true"
          className="border-primary/8 pointer-events-none absolute -inset-11 rounded-full border sm:-inset-14"
        />
        <span
          aria-hidden="true"
          className="bg-primary/15 animate-halo pointer-events-none absolute inset-0 rounded-full"
        />

        <Link
          href="/meetings/new?record=1"
          prefetch={false}
          className="group bg-primary text-primary-foreground focus-visible:ring-ring/50 relative flex aspect-square w-56 shrink-0 flex-col items-center justify-center gap-4 overflow-hidden rounded-full shadow-[0_24px_60px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent),inset_0_1px_0_0_color-mix(in_oklch,var(--primary-foreground)_25%,transparent)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_32px_70px_-24px_color-mix(in_oklch,var(--primary)_80%,transparent),inset_0_1px_0_0_color-mix(in_oklch,var(--primary-foreground)_25%,transparent)] focus-visible:ring-4 focus-visible:ring-offset-4 focus-visible:outline-none active:translate-y-0 active:scale-[0.97] sm:w-72 sm:gap-5"
        >
          {/* Soft top-left light so the disc reads as a surface, not a flat fill. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(from_var(--primary)_calc(l_+_0.14)_c_h_/_0.55),transparent_60%)]"
          />
          <span
            aria-hidden="true"
            className="bg-primary-foreground/12 ring-primary-foreground/25 relative flex size-16 items-center justify-center rounded-full ring-1 transition-transform duration-300 ease-out group-hover:scale-110 sm:size-20"
          >
            <Mic className="size-7 sm:size-9" strokeWidth={1.75} />
          </span>
          <span className="relative flex flex-col items-center gap-1.5">
            <span className="text-sm font-medium tracking-[0.2em] uppercase sm:text-base">
              Start recording
            </span>
            <span className="text-primary-foreground/75 text-xs">Tap to begin</span>
          </span>
        </Link>
      </div>

      <div className="animate-fade-up flex flex-col items-center gap-3 text-center [animation-delay:220ms]">
        <p className="text-muted-foreground max-w-sm text-sm leading-6">
          Records your microphone instantly — no setup needed.
        </p>
        <Link
          href="/meetings/new"
          className="text-muted-foreground hover:text-foreground hover:bg-accent/40 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors"
        >
          <UploadCloud className="size-4" aria-hidden="true" />
          Upload a recording instead
        </Link>
      </div>
    </section>
  );
}
