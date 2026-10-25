import {
  CheckIcon,
  CheckSquareIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  SquareIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/* Small, static product vignettes for the home benefits bento (DESIGN.md "Home page").
   They reuse the fictional meeting from ProductDemo (Q3 launch planning with Maya, Daniel and Priya)
   and only show things the app really does: summary sections, speaker renaming, notes for the AI,
   share links with section toggles, and search across meetings with the match highlighted.
   Purely decorative: every vignette is aria-hidden and its card text carries the meaning. */

const SURFACE = "bg-card rounded-lg border shadow-xs";
const LABEL = "text-muted-foreground text-xs font-medium";
const MEETING_META = "Sep 29, 2026 · 43 min";

/* A few rows of the real summary structure: Decisions, Next steps, Open questions & risks. */
export function SummaryVisual() {
  return (
    <div className={cn(SURFACE, "p-4 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">Q3 launch planning</p>
          <p className="text-muted-foreground mt-1 font-mono text-xs tabular-nums">
            {MEETING_META}
          </p>
        </div>
        <span className="border-success/25 bg-success/12 text-success inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
          <CheckIcon weight="bold" className="size-3" />
          Ready
        </span>
      </div>
      <div className="bg-border my-4 h-px" />
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
        <div>
          <p className={LABEL}>Decisions</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {["Launch on October 14", "Export fix ships Thursday"].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={LABEL}>Next steps</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {[
              { task: "Ship export fix", owner: "Daniel", done: true },
              { task: "Brief support", owner: "Priya", done: false },
              { task: "Write rollback plan", owner: "Daniel", done: false },
            ].map(({ task, owner, done }) => (
              <li key={task} className="flex items-center gap-2">
                {done ? (
                  <CheckSquareIcon weight="fill" className="text-primary size-4 shrink-0" />
                ) : (
                  <SquareIcon className="text-muted-foreground size-4 shrink-0" />
                )}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    done && "text-muted-foreground line-through"
                  )}
                >
                  {task}
                </span>
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 text-xs">
                  {owner}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="max-sm:hidden">
          <p className={LABEL}>Open questions & risks</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {["No rollback plan yet", "Support macros in draft"].map((item) => (
              <li key={item} className="flex gap-2">
                <WarningIcon className="text-chart-2 mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* Renaming "Speaker 2" once, and the transcript picking the name up. */
export function SpeakersVisual() {
  return (
    <div className="flex flex-col gap-3">
      <div className={cn(SURFACE, "flex items-center gap-3 p-3")}>
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          S2
        </span>
        <span className="border-ring ring-ring/20 flex h-8 min-w-0 flex-1 items-center rounded-md border px-2 text-sm ring-4">
          Daniel
          <span className="bg-foreground ml-0.5 h-4 w-px animate-pulse" />
        </span>
        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-3 py-1 text-xs font-semibold">
          Save
        </span>
      </div>
      <ol className={cn(SURFACE, "flex flex-col gap-3 p-3 text-sm")}>
        {[
          { time: "12:04", speaker: "Maya", text: "Can we still hit October 14?" },
          {
            time: "12:11",
            speaker: "Daniel",
            text: "Yes, if the export fix ships Thursday.",
            renamed: true,
          },
        ].map(({ time, speaker, text, renamed }) => (
          <li key={time} className="flex flex-col gap-1">
            <span className="flex items-baseline gap-2">
              <span className="text-muted-foreground font-mono text-xs tabular-nums">{time}</span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  renamed ? "text-primary" : "text-foreground/70"
                )}
              >
                {speaker}
              </span>
            </span>
            <span className="truncate">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const AI_NOTE = "Priya is new to the launch team. Draft a follow up email she can send to support.";

/* The optional note for the AI, with the real 2000 character limit. */
export function NoteVisual() {
  return (
    <div className={cn(SURFACE, "flex flex-col gap-3 p-3")}>
      <p className="flex items-center gap-1 text-xs font-semibold">
        <SparkleIcon weight="fill" className="text-primary size-3.5" />
        Notes for the AI
      </p>
      <p className="bg-background rounded-md border px-3 py-2 text-sm text-pretty">{AI_NOTE}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {AI_NOTE.length}/2000
        </span>
        <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
          Process meeting
        </span>
      </div>
    </div>
  );
}

/* A view only link and the "Shared sections" checkboxes. */
export function ShareVisual() {
  return (
    <div className={cn(SURFACE, "flex flex-col gap-3 p-3")}>
      <div className="flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <GlobeIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">Anyone with the link</span>
          <span className="text-muted-foreground block truncate text-xs">
            View only, no account needed
          </span>
        </span>
      </div>
      <span className="bg-background text-muted-foreground flex h-8 items-center truncate rounded-md border px-2 font-mono text-xs">
        breeze.app/share/7kq2m9xd
      </span>
      <div className="flex flex-col gap-2 text-sm">
        {[
          { label: "AI summary", on: true },
          { label: "Transcript", on: false },
        ].map(({ label, on }) => (
          <span key={label} className="flex items-center gap-2">
            {on ? (
              <CheckSquareIcon weight="fill" className="text-primary size-4" />
            ) : (
              <SquareIcon className="text-muted-foreground size-4" />
            )}
            <span className={on ? undefined : "text-muted-foreground"}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* Search across titles, summaries and transcripts, with the first match highlighted like the app. */
export function SearchVisual() {
  const results = [
    {
      title: "Q3 launch planning",
      meta: MEETING_META,
      before: "Daniel, can you own the ",
      after: " plan?",
    },
    {
      title: "Support handoff",
      meta: "Sep 24, 2026 · 18 min",
      before: "Priya walks the team through ",
      after: " steps for exports.",
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <span className="bg-card border-ring ring-ring/20 flex h-10 items-center gap-2 rounded-full border px-3 text-sm shadow-xs ring-4">
        <MagnifyingGlassIcon className="text-muted-foreground size-4" />
        rollback
      </span>
      <ul className={cn(SURFACE, "flex flex-col gap-3 p-3")}>
        {results.map(({ title, meta, before, after }, index) => (
          <li key={title} className="flex flex-col gap-1">
            {index > 0 && <span className="bg-border mb-2 h-px" />}
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold">{title}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {meta.split(" · ")[0]}
              </span>
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {before}
              <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">rollback</mark>
              {after}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
