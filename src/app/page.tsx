import type { ComponentType } from "react";
import { redirect } from "next/navigation";
import {
  BrowserIcon,
  ChatsCircleIcon,
  CheckIcon,
  CloudSlashIcon,
  CreditCardIcon,
  MicrophoneIcon,
  NotePencilIcon,
  ShieldCheckIcon,
  WindIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  NoteVisual,
  SearchVisual,
  ShareVisual,
  SpeakersVisual,
  SummaryVisual,
} from "@/components/home/benefit-visuals";
import { FAQ, FaqList, faqJsonLd } from "@/components/home/faq";
import { HomeCta } from "@/components/home/home-cta";
import { ProductDemo } from "@/components/home/product-demo";
import { Reveal } from "@/components/home/reveal";
import { TaglineReveal } from "@/components/home/tagline-reveal";
import { getOptionalSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

/* Public home page. Follows the landing system (.claude/skills/landing-page-design, recorded in
   DESIGN.md "Landing system"), a deliberate exception to the warm editorial system used everywhere else.
   Every claim on this page is a fact about the product today; there is no invented social proof. */

const TITLE = "Meeting notes without a bot in your call";
const DESCRIPTION =
  "Breeze records your meeting from its own browser tab, then gives you a summary of decisions and next steps and a full transcript split by speaker.";

export const metadata: Metadata = {
  // The layout's "%s | Breeze" template only applies to child segments, so the root page sets it in full.
  title: { absolute: `${TITLE} | Breeze` },
  description: DESCRIPTION,
  // Page level openGraph replaces the layout's object, so the shared fields are repeated here.
  openGraph: {
    title: `${TITLE} | Breeze`,
    description: DESCRIPTION,
    siteName: "Breeze",
    type: "website",
  },
};

const WITHOUT = [
  "You type while people talk and miss the next point",
  "Decisions live in someone's memory until the follow up",
  "Many note takers send a bot into the call as a participant",
] as const;

const WITH = [
  "You listen and talk. Breeze records from its own tab",
  "Decisions, next steps and open questions come back in one summary",
  "Nobody new shows up in the participant list",
] as const;

/* Bento: the summary is the headline benefit, so it gets the wide tile. Spans are per breakpoint:
   two columns from sm (summary full width), six columns from lg (4 + 2, then 2 + 2 + 2). */
type Benefit = { visual: ComponentType; title: string; text: string; span: string };

const BENEFITS: readonly Benefit[] = [
  {
    visual: SummaryVisual,
    title: "Know what was decided",
    text: "Your summary is sorted into decisions, next steps, open questions and risks, so the follow up is already written.",
    span: "sm:col-span-2 lg:col-span-4",
  },
  {
    visual: SpeakersVisual,
    title: "See who said what",
    text: "The transcript is split by speaker. Name a speaker once and the summary uses that name.",
    span: "sm:col-span-2 lg:col-span-2",
  },
  {
    visual: NoteVisual,
    title: "Ask for what matters",
    text: "Before processing, tell Breeze what to focus on or which questions to answer.",
    span: "lg:col-span-2",
  },
  {
    visual: ShareVisual,
    title: "Share without sending files",
    text: "Create a view only link with the sections you choose, or download a Word document.",
    span: "lg:col-span-2",
  },
  {
    visual: SearchVisual,
    title: "Find it again in seconds",
    text: "Search titles, summaries and transcripts across every meeting you have recorded.",
    span: "sm:col-span-2 lg:col-span-2",
  },
];

const STEPS = [
  {
    icon: MicrophoneIcon,
    title: "Record",
    text: "Choose your microphone and the meeting tab, then press record. Or upload an audio or video file you already have.",
  },
  {
    icon: NotePencilIcon,
    title: "Add context if you want",
    text: "Leave a note for the AI, like who the client is or which decision you care about. Then process the meeting.",
  },
  {
    icon: ChatsCircleIcon,
    title: "Read and share",
    text: "Read the summary, check the full transcript when you need the exact words, then share a link or a Word document.",
  },
] as const;

const REASSURANCES = [
  { icon: CreditCardIcon, text: "No credit card needed" },
  { icon: BrowserIcon, text: "Nothing to install on a computer" },
  { icon: CloudSlashIcon, text: "Audio leaves our servers once it is transcribed" },
] as const;

/* Three short lines so each one fits the 680px cap at text-5xl and breaks where the thought does. */
const TAGLINE = ["Say what you mean.", "Hear what they say.", "Breeze keeps the record."];

/* Sections reached from the island menu clear the floating nav when scrolled to. */
const ANCHOR_SECTION = "scroll-mt-24 focus:outline-none";

/* Shared section heading: a small sentence case label, an h2, and optional supporting copy. */
function SectionHeading({
  id,
  label,
  title,
  body,
  center = false,
}: {
  id: string;
  label: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <div
      className={center ? "mx-auto flex max-w-170 flex-col items-center text-center" : "max-w-170"}
    >
      <p className="text-primary text-sm font-semibold">{label}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {body && (
        <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">{body}</p>
      )}
    </div>
  );
}

export default async function Home() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <div className="landing">
      <script
        type="application/ld+json"
        // Escaping "<" keeps the JSON from ever closing the script tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }}
      />

      {/* Hero. The product demo is the protagonist: wide, framed, and sitting half on the band below,
          so it bridges the hero and the next section. */}
      <section aria-labelledby="hero-title" className="relative pt-12 sm:pt-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6">
          <p className="animate-landing-rise text-primary text-sm font-semibold">
            AI meeting notes
          </p>
          <h1
            id="hero-title"
            className="text-heading-gradient animate-landing-rise mt-4 max-w-170 text-4xl font-semibold tracking-tight text-balance [animation-delay:80ms] sm:text-6xl"
          >
            <span className="block">Stay in the conversation.</span>{" "}
            <span className="block">Breeze writes the notes.</span>
          </h1>
          <p className="text-muted-foreground animate-landing-rise mt-6 max-w-170 text-lg text-pretty [animation-delay:160ms] sm:text-xl">
            <span className="sm:block">Record any meeting from a browser tab.</span>{" "}
            <span className="sm:block">
              Get the decisions and next steps, plus a full transcript by speaker.
            </span>
          </p>
          <div className="animate-landing-rise mt-8 w-full [animation-delay:240ms]">
            <HomeCta />
          </div>
          <p className="text-muted-foreground animate-landing-rise mt-6 text-sm text-pretty [animation-delay:320ms]">
            <ShieldCheckIcon
              weight="fill"
              className="text-primary mr-2 inline size-4 align-text-bottom"
              aria-hidden="true"
            />
            No bot joins your call. Breeze listens from its own tab.
          </p>
        </div>
        <div className="relative mt-12 sm:mt-16">
          {/* Flat band behind the lower half of the demo; it continues into the next section. */}
          <div aria-hidden="true" className="bg-band absolute inset-x-0 top-1/2 bottom-0" />
          <div className="animate-landing-rise relative mx-auto max-w-6xl px-4 [animation-delay:400ms] sm:px-6">
            <ProductDemo />
          </div>
        </div>
      </section>

      {/* Problem to solution: heading on one side, a layered comparison on the other where the
          "with Breeze" card sits on top and clearly wins. */}
      <section
        aria-labelledby="problem-title"
        className="bg-band px-4 pt-20 pb-24 sm:px-6 sm:pt-24"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <Reveal className="lg:col-span-5">
            <SectionHeading
              id="problem-title"
              label="Why Breeze"
              title="Taking notes means half listening"
              body="You either type and miss the next point, or listen and lose the details. Breeze takes the second job off your hands."
            />
          </Reveal>
          <div className="lg:col-span-7">
            <Reveal>
              <div className="border-foreground/15 rounded-3xl border border-dashed p-6 pb-16 sm:p-8 sm:pr-24 sm:pb-20">
                <h3 className="text-muted-foreground text-base font-semibold">Without Breeze</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {WITHOUT.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-3 text-base">
                      <span className="border-foreground/15 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border">
                        <XIcon weight="bold" className="size-3" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120} className="relative -mt-10 sm:ml-12">
              <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-[0_32px_64px_-32px_color-mix(in_oklch,var(--primary)_70%,transparent)] sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold">With Breeze</h3>
                  <span className="bg-primary-foreground/15 flex size-10 items-center justify-center rounded-full">
                    <WindIcon weight="bold" className="size-5" aria-hidden="true" />
                  </span>
                </div>
                <ul className="mt-6 flex flex-col gap-4">
                  {WITH.map((item) => (
                    <li key={item} className="flex gap-3 text-base font-medium sm:text-lg">
                      <span className="bg-primary-foreground text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                        <CheckIcon weight="bold" className="size-3" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Benefits: a bento of real looking product vignettes rather than icon cards. */}
      <section aria-labelledby="benefits-title" className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading
              id="benefits-title"
              label="What you get"
              title="Everything you need after the call ends"
              body="One recording gives you a summary, a transcript by speaker, and a link you can send."
              center
            />
          </Reveal>
          <ul className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {BENEFITS.map(({ visual: Visual, title, text, span }, index) => (
              <li key={title} className={span}>
                <Reveal className="h-full" delay={(index % 3) * 80}>
                  {/* Card radius 24px, 12px inset, so the well is 12px (rounded-xl). */}
                  <div className="bg-card flex h-full flex-col rounded-3xl border p-3">
                    <div
                      aria-hidden="true"
                      className={cn(
                        "bg-band flex flex-1 flex-col justify-center overflow-hidden rounded-xl p-4 select-none sm:p-6",
                        index === 0 && "lg:p-8"
                      )}
                    >
                      <Visual />
                    </div>
                    <div className="px-3 pt-6 pb-3">
                      <h3 className="text-lg font-semibold">{title}</h3>
                      <p className="text-muted-foreground mt-2 text-base text-pretty">{text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works: an open timeline on the band, not another row of cards. */}
      <section
        id="how-it-works"
        tabIndex={-1}
        aria-labelledby="steps-title"
        className={cn(ANCHOR_SECTION, "bg-band px-4 py-24 sm:px-6")}
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading
              id="steps-title"
              label="How it works"
              title="From record to recap in three steps"
            />
          </Reveal>
          <ol className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ icon: StepIcon, title, text }, index) => (
              <li key={title}>
                <Reveal className="flex h-full flex-col" delay={index * 120}>
                  <div className="flex items-center gap-4">
                    <span className="bg-card text-primary flex size-12 shrink-0 items-center justify-center rounded-full border shadow-xs">
                      <StepIcon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="bg-foreground/10 h-px flex-1" aria-hidden="true" />
                  </div>
                  <span className="text-foreground/20 mt-8 font-mono text-5xl tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-base text-pretty">{text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tagline reveal */}
      <section className="px-4 py-24 sm:px-6" aria-labelledby="tagline">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 py-12 text-center">
          <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full">
            <WindIcon weight="bold" className="size-6" aria-hidden="true" />
          </span>
          <TaglineReveal id="tagline" lines={TAGLINE} />
        </div>
      </section>

      {/* FAQ: sticky heading beside the answers on wide screens. */}
      <section
        id="faq"
        tabIndex={-1}
        aria-labelledby="faq-title"
        className={cn(ANCHOR_SECTION, "bg-band px-4 py-24 sm:px-6")}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <SectionHeading
                id="faq-title"
                label="Questions"
                title="What people ask before their first recording"
                body={`${FAQ.length} straight answers about privacy, devices and what Breeze does with your audio.`}
              />
            </div>
          </Reveal>
          <Reveal className="lg:col-span-7">
            <FaqList />
          </Reveal>
        </div>
      </section>

      {/* Risk reversal and final CTA, identical to the hero's */}
      <section aria-labelledby="cta-title" className="px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-6xl">
          <div className="bg-card flex flex-col items-center rounded-4xl border px-4 py-16 text-center shadow-[0_32px_64px_-40px_color-mix(in_oklch,var(--foreground)_45%,transparent)] sm:px-12 sm:py-24">
            <p className="text-primary text-sm font-semibold">Free to start</p>
            <h2
              id="cta-title"
              className="mt-3 max-w-170 text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
            >
              Try it on your next meeting
            </h2>
            <p className="text-muted-foreground mt-4 max-w-170 text-base text-pretty sm:text-lg">
              Record one meeting and see what comes back: a summary, a transcript and a link to
              share.
            </p>
            <ul className="mt-8 flex flex-col items-start gap-3 text-left sm:flex-row sm:flex-wrap sm:justify-center sm:gap-2">
              {REASSURANCES.map(({ icon: ReassuranceIcon, text }) => (
                <li
                  key={text}
                  className="text-foreground/80 sm:bg-band flex items-center gap-2 text-sm sm:rounded-full sm:border sm:px-3 sm:py-2"
                >
                  <ReassuranceIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-10 w-full">
              <HomeCta />
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
