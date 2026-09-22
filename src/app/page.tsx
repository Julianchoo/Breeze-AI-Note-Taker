import { redirect } from "next/navigation";
import { ArrowDown, AudioLines, FileText, Mic } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Separator } from "@/components/ui/separator";
import { getOptionalSession } from "@/lib/session";
export default async function Home() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="grid items-center gap-16 md:grid-cols-[1.3fr_1fr]">
        <div className="animate-fade-up flex flex-col items-start gap-6">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Be in the conversation
          </p>
          <h1 className="max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Good conversations.
            <br />
            <span className="text-muted-foreground">Clear takeaways.</span>
          </h1>
          <p className="text-muted-foreground max-w-md text-base leading-7">
            Record your meeting. Come back to the important ideas, decisions, and next steps — with
            the full conversation always within reach.
          </p>
          <GoogleSignInButton />
          <p className="text-muted-foreground text-xs">Made for Chrome and Edge on desktop.</p>
        </div>
        <div className="flex flex-col gap-8 border-l pl-8 sm:pl-12" aria-label="How Breeze works">
          {[
            {
              icon: Mic,
              title: "Press record",
              text: "Capture your microphone and a meeting tab.",
            },
            {
              icon: AudioLines,
              title: "Stay present",
              text: "Breeze keeps the conversation, including different speakers.",
            },
            {
              icon: FileText,
              title: "Leave with clarity",
              text: "A useful summary, a full transcript, and audio to revisit.",
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="flex gap-4">
              <span className="text-muted-foreground pt-1 font-mono text-xs">0{index + 1}</span>
              <div className="flex flex-col gap-2">
                <Icon className="text-muted-foreground mb-1 size-5" aria-hidden="true" />
                <h2 className="font-medium">{title}</h2>
                <p className="text-muted-foreground max-w-xs text-sm leading-6">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-20">
        <Separator />
        <p className="text-muted-foreground mt-6 flex items-center gap-3 text-sm">
          <ArrowDown className="size-4" aria-hidden="true" />
          Open Breeze in its own tab. No meeting bot required.
        </p>
      </div>
    </div>
  );
}
