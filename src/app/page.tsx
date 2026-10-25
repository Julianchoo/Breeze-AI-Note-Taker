import { redirect } from "next/navigation";
import {
  BrowserIcon,
  ChatsCircleIcon,
  CheckIcon,
  CloudSlashIcon,
  CreditCardIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  NotePencilIcon,
  ShareNetworkIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { FAQ, FaqList, faqJsonLd } from "@/components/home/faq";
import { HomeCta } from "@/components/home/home-cta";
import { ProductDemo } from "@/components/home/product-demo";
import { Reveal } from "@/components/home/reveal";
import { TaglineReveal } from "@/components/home/tagline-reveal";
import { getOptionalSession } from "@/lib/session";
import type { Icon } from "@phosphor-icons/react";
import type { Metadata } from "next";

/* Public home page. Follows the landing system (.claude/skills/landing-page-design, recorded in
   DESIGN.md "Home page"), a deliberate exception to the warm editorial system used everywhere else.
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

type Benefit = { icon: Icon; title: string; text: string; wide?: boolean };

const BENEFITS: readonly Benefit[] = [
  {
    icon: ListChecksIcon,
    title: "Know what was decided",
    text: "Your summary is sorted into decisions, next steps, open questions and risks, so the follow up is already written.",
    wide: true,
  },
  {
    icon: UsersThreeIcon,
    title: "See who said what",
    text: "The transcript is split by speaker. Name a speaker once and the summary uses that name.",
    wide: true,
  },
  {
    icon: SparkleIcon,
    title: "Ask for what matters",
    text: "Before processing, tell Breeze what to focus on or which questions to answer.",
  },
  {
    icon: ShareNetworkIcon,
    title: "Share without sending files",
    text: "Create a view only link with the sections you choose, or download a Word document.",
  },
  {
    icon: MagnifyingGlassIcon,
    title: "Find it again in seconds",
    text: "Search titles, summaries and transcripts across every meeting you have recorded.",
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

      {/* Hero */}
      <section aria-labelledby="hero-title" className="px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <p className="animate-landing-rise text-primary text-sm font-semibold">
            AI meeting notes
          </p>
          <h1
            id="hero-title"
            className="text-heading-gradient animate-landing-rise mt-4 max-w-170 text-4xl font-semibold tracking-tight text-balance [animation-delay:80ms] sm:text-5xl"
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
        <div className="animate-landing-rise mx-auto mt-16 max-w-5xl [animation-delay:400ms] sm:mt-20">
          <ProductDemo />
        </div>
      </section>

      {/* Problem to solution */}
      <section aria-labelledby="problem-title" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHeading
              id="problem-title"
              label="Why Breeze"
              title="Taking notes means half listening"
              body="You either type and miss the next point, or listen and lose the details. Breeze takes the second job off your hands."
            />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Reveal className="h-full">
              <div className="bg-card h-full rounded-3xl border p-6 sm:p-8">
                <h3 className="text-lg font-semibold">Without Breeze</h3>
                <ul className="mt-6 flex flex-col gap-4">
                  {WITHOUT.map((item) => (
                    <li key={item} className="text-muted-foreground flex gap-3 text-base">
                      <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full">
                        <XIcon weight="bold" className="size-3" aria-hidden="true" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal className="h-full" delay={120}>
              <div className="bg-card border-primary/30 h-full rounded-3xl border p-6 sm:p-8">
                <h3 className="text-lg font-semibold">With Breeze</h3>
                <ul className="mt-6 flex flex-col gap-4">
                  {WITH.map((item) => (
                    <li key={item} className="flex gap-3 text-base">
                      <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full">
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

      {/* Benefits */}
      <section aria-labelledby="benefits-title" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHeading
              id="benefits-title"
              label="What you get"
              title="Everything you need after the call ends"
            />
          </Reveal>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {BENEFITS.map(({ icon: BenefitIcon, title, text, wide }, index) => (
              <li key={title} className={wide ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-2"}>
                <Reveal className="h-full" delay={(index % 3) * 80}>
                  <div className="bg-card flex h-full flex-col gap-4 rounded-3xl border p-6 sm:p-8">
                    <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                      <BenefitIcon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-muted-foreground text-base text-pretty">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="steps-title" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <SectionHeading
              id="steps-title"
              label="How it works"
              title="From record to recap in three steps"
            />
          </Reveal>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: StepIcon, title, text }, index) => (
              <li key={title}>
                <Reveal className="h-full" delay={index * 120}>
                  <div className="bg-card flex h-full flex-col gap-4 rounded-3xl border p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-mono text-sm tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <StepIcon className="text-muted-foreground size-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="text-muted-foreground text-base text-pretty">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tagline reveal */}
      <section className="px-4 py-24 sm:px-6" aria-labelledby="tagline">
        <div className="mx-auto flex max-w-5xl justify-center text-center">
          <TaglineReveal id="tagline" lines={TAGLINE} />
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <SectionHeading
              id="faq-title"
              label="Questions"
              title="What people ask before their first recording"
              body={`${FAQ.length} straight answers about privacy, devices and what Breeze does with your audio.`}
            />
          </Reveal>
          <Reveal className="mt-12">
            <FaqList />
          </Reveal>
        </div>
      </section>

      {/* Risk reversal and final CTA, identical to the hero's */}
      <section aria-labelledby="cta-title" className="px-4 pt-20 pb-24 sm:px-6 sm:pt-24">
        <Reveal className="mx-auto max-w-5xl">
          <div className="bg-card flex flex-col items-center rounded-3xl border px-6 py-16 text-center sm:px-12 sm:py-20">
            <h2
              id="cta-title"
              className="max-w-170 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Try it on your next meeting
            </h2>
            <ul className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-6">
              {REASSURANCES.map(({ icon: ReassuranceIcon, text }) => (
                <li key={text} className="text-muted-foreground flex items-center gap-2 text-sm">
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
