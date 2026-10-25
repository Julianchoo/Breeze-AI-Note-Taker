import Link from "next/link";
import { MicrophoneIcon, UploadSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { RecordHandoff } from "@/components/meetings/recorder/record-handoff";

export const metadata = { title: "New meeting" };

/* Signed in main screen: the Record button is the hero. Landing system (DESIGN.md "Landing system"):
   flat surfaces, Geist only, Tailwind type and spacing steps, Phosphor icons, ease-fluid motion. */
export default function MeetingsPage() {
  return (
    <div className="landing">
      <section className="flex min-h-[calc(100svh-14rem)] flex-col items-center justify-center gap-8 px-4 py-12 sm:py-16">
        <h1 className="sr-only">New meeting</h1>
        {/* Translucent bezel around the button, echoing the framed product demo on the home. */}
        <div className="animate-landing-rise bg-card/60 border-foreground/10 rounded-full border p-3 shadow-[0_24px_64px_-32px_color-mix(in_oklch,var(--foreground)_45%,transparent)]">
          {/* Morphs into the recorder's clock well during the navigation (a React view transition). */}
          <RecordHandoff>
            <Link
              href="/meetings/new?record=1"
              prefetch={false}
              className="group bg-primary text-primary-foreground ease-fluid focus-visible:ring-ring/50 flex aspect-square w-52 shrink-0 flex-col items-center justify-center gap-3 rounded-full shadow-[0_16px_40px_-20px_color-mix(in_oklch,var(--primary)_70%,transparent)] transition-[scale,background-color,box-shadow] duration-300 hover:scale-[1.02] hover:bg-primary/90 hover:shadow-[0_24px_48px_-20px_color-mix(in_oklch,var(--primary)_80%,transparent)] focus-visible:ring-4 focus-visible:outline-none active:scale-[0.98] sm:w-60"
            >
              <MicrophoneIcon aria-hidden="true" weight="fill" className="size-10 sm:size-12" />
              <span className="text-lg font-semibold">Record</span>
            </Link>
          </RecordHandoff>
        </div>
        <div className="animate-landing-rise flex flex-col items-center gap-4 text-center [animation-delay:120ms]">
          <p className="text-muted-foreground text-base text-pretty">Tap to record your microphone</p>
          <Link
            href="/meetings/new"
            className="bg-card ease-fluid hover:bg-accent focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-xs transition-[background-color,scale] duration-300 focus-visible:ring-[3px] focus-visible:outline-none active:scale-[0.98]"
          >
            <UploadSimpleIcon className="text-muted-foreground size-4" aria-hidden="true" />
            Upload a recording
          </Link>
        </div>
      </section>
    </div>
  );
}
