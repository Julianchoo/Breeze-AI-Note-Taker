import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

/* Every answer states only what the product does today (see docs/features/meetings.md,
   docs/android.md and the recorder). The same list feeds the visible FAQ and the FAQPage JSON-LD,
   so the two can never drift apart. Answers are plain text on purpose: JSON-LD needs strings. */
export const FAQ = [
  {
    question: "Does a bot join my call?",
    answer:
      "No. Breeze records from its own browser tab on your computer. You choose your microphone and, if you like, the tab where the meeting is playing. Nobody new appears in the participant list.",
  },
  {
    question: "Should I tell people I am recording?",
    answer:
      "Yes. Because Breeze does not announce itself in the call, let everyone know before you start and follow the recording rules where you and they are.",
  },
  {
    question: "Which meeting apps does it work with?",
    answer:
      "Any meeting that plays in a Chrome or Edge tab, such as Google Meet. Pick that tab when you start and turn on tab audio sharing. Use headphones so voices are not captured twice.",
  },
  {
    question: "Which browsers and devices can record?",
    answer:
      "Chrome or Edge on a desktop computer. Phone browsers cannot capture audio from another tab. On Android 8 or newer, the Breeze app records from the microphone, even with the screen locked.",
  },
  {
    question: "Can I upload a recording I already have?",
    answer:
      "Yes. Drop in an MP3, M4A, WAV, OGG, WebM, MP4 or MOV file and Breeze processes it like a live recording.",
  },
  {
    question: "How long can a meeting be?",
    answer: "Up to four hours per recording. For anything longer, start a second recording.",
  },
  {
    question: "Can it tell who is speaking?",
    answer:
      "Yes. The transcript is split by speaker and labelled Speaker 1, Speaker 2 and so on. Breeze does not guess names. Rename a speaker once and the summary uses that name.",
  },
  {
    question: "Which languages does it understand?",
    answer:
      "Breeze identifies the language being spoken and writes the summary in the language most of the meeting was held in.",
  },
  {
    question: "Where is my audio stored, and who can see it?",
    answer:
      "Audio is uploaded to private storage only for as long as it takes to transcribe. Once the transcript is saved, Breeze deletes the audio from its servers. Transcription runs on Soniox, which is asked to delete its copy too, and OpenAI writes the summary from the transcript. A copy of meetings recorded in Breeze stays in your browser, or on your phone with the Android app, so you can save the audio yourself. Nobody else sees a meeting unless you create a share link.",
  },
  {
    question: "Can I delete a meeting?",
    answer:
      "Yes. Deleting a meeting removes its summary, its transcript and any audio still waiting on the server. You can also stop sharing a link at any time.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "Not on a computer. Breeze runs in the browser. The Android app is a download from this site, not from the Play Store.",
  },
] as const;

/** FAQPage structured data for search and answer engines, built from the visible questions. */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/* Native <details> keeps the FAQ keyboard and screen reader accessible with no client JS. */
export function FaqList() {
  return (
    <div className="flex flex-col gap-2">
      {FAQ.map(({ question, answer }) => (
        <details key={question} className="group bg-card rounded-xl border">
          <summary className="ease-fluid hover:bg-accent flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-4 text-base font-semibold transition-colors duration-300 active:translate-y-px [&::-webkit-details-marker]:hidden">
            <span className="text-balance">{question}</span>
            <PlusIcon
              aria-hidden="true"
              className="text-muted-foreground ease-fluid size-4 shrink-0 transition-transform duration-700 group-open:rotate-45"
            />
          </summary>
          <p className="text-muted-foreground px-6 pt-2 pb-6 text-base text-pretty">{answer}</p>
        </details>
      ))}
    </div>
  );
}
