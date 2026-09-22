import { redirect } from "next/navigation";
import { AppWindow, AudioLines, FileText, Mic } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { getOptionalSession } from "@/lib/session";

const STEPS = [
  {
    icon: Mic,
    title: "Press record",
    text: "Capture your microphone and a meeting tab.",
  },
  {
    icon: AudioLines,
    title: "Stay present",
    text: "Breeze keeps the conversation, including who said what.",
  },
  {
    icon: FileText,
    title: "Leave with clarity",
    text: "A useful summary, a full transcript, and audio to revisit.",
  },
] as const;

export default async function Home() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <section className="animate-fade-up flex max-w-3xl flex-col items-start gap-7">
          <p className="eyebrow">Be in the conversation</p>
          <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
            Good conversations.
            <br />
            <span className="text-muted-foreground">Clear takeaways.</span>
          </h1>
          <p className="text-muted-foreground max-w-lg text-lg leading-8 text-balance">
            Record your meeting. Come back to the important ideas, decisions, and next steps — with
            the full conversation always within reach.
          </p>
          <div className="animate-fade-up w-full [animation-delay:120ms]">
            <GoogleSignInButton />
          </div>
        </section>

        <div className="rule-fade mt-20 h-px sm:mt-28" />

        <section
          className="animate-fade-up grid [animation-delay:220ms] sm:mt-4 md:grid-cols-3"
          aria-label="How Breeze works"
        >
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <article
              key={title}
              className="border-border flex flex-col gap-3 border-b py-8 last:border-b-0 md:border-b-0 md:pr-10 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-10"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary font-mono text-xs tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="bg-border h-px flex-1" aria-hidden="true" />
                <Icon className="text-muted-foreground size-4" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="text-muted-foreground max-w-xs text-sm leading-6">{text}</p>
            </article>
          ))}
        </section>

        <div className="animate-fade-up mt-16 [animation-delay:300ms]">
          <div className="rule-fade h-px" />
          <div className="text-muted-foreground mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5">
              <AppWindow className="size-4 shrink-0" aria-hidden="true" />
              Breeze runs in its own tab. No meeting bot joins your call.
            </p>
            <p className="font-mono text-xs">Chrome and Edge on desktop</p>
          </div>
        </div>
      </div>
    </div>
  );
}
