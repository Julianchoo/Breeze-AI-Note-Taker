"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AudioLines,
  Check,
  Copy,
  FileDown,
  FileText,
  Globe,
  Loader2,
  Lock,
  Mail,
  Mic,
  Monitor,
  Pause,
  Play,
  Sparkles,
  Square,
  Wind,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* A scripted, silent product tour. One clock (`elapsed`, in ms) drives every reveal, so pausing the clock
   freezes the whole story. The fake UI is decorative: buttons are styled spans, never focusable. */

const SCENES = [
  { label: "Record", ms: 4000, path: "meetings/new" },
  { label: "Transcribe", ms: 5000, path: "meetings/q3-launch-planning" },
  { label: "Summarize", ms: 6000, path: "meetings/q3-launch-planning" },
  { label: "Share", ms: 5000, path: "meetings/q3-launch-planning" },
] as const;
const LOOP_MS = SCENES.reduce((total, scene) => total + scene.ms, 0);
const TICK_MS = 100;
/* The last second of the loop fades the stage out before it starts over. */
const OUTRO_MS = 1000;
/* Reduced motion holds one meaningful frame: the finished summary. */
const STILL_FRAME_MS = SCENES[0].ms + SCENES[1].ms + SCENES[2].ms - TICK_MS;

const MEETING = "Q3 launch planning";
/* The stopwatch fast-forwards to 00:42:17 over the record scene. */
const RECORDED_SECONDS = 42 * 60 + 17;
const CLOCK_RAMP_MS = 3400;

const CARD_SHADOW = "shadow-[0_1px_2px_0_color-mix(in_oklch,var(--foreground)_6%,transparent)]";
const PRESSED = "ring-ring/50 scale-[0.98] ring-[3px]";

const SOURCES = [
  { icon: Mic, label: "Microphone", hint: "Your voice" },
  { icon: Monitor, label: "Meeting tab", hint: "Google Meet audio" },
] as const;

const SEGMENTS = [
  {
    at: 300,
    time: "12:04",
    speaker: "Maya",
    text: "Can we still hit October 14 for the Q3 launch?",
  },
  {
    at: 1300,
    time: "12:11",
    speaker: "Daniel",
    text: "Yes, if the export fix ships Thursday. It's in review.",
  },
  {
    at: 2300,
    time: "12:19",
    speaker: "Priya",
    text: "Then I'll brief support Friday and draft the release notes.",
  },
  {
    at: 3300,
    time: "12:26",
    speaker: "Maya",
    text: "Great. Daniel, can you own the rollback plan?",
  },
] as const;

/* Summary scene: "processing" until PROCESSING_MS, then sections reveal at their `at`. */
const PROCESSING_MS = 1400;
const SUMMARY = [
  { at: 1900, title: "Key ideas", items: ["Engineering is on track", "Support needs a heads-up"] },
  {
    at: 2600,
    title: "Decisions",
    items: ["Launch locked for Oct 14", "Export fix ships Thursday"],
  },
] as const;
const NEXT_STEPS_AT = 3300;
const NEXT_STEPS = [
  { task: "Ship the export fix", owner: "Daniel" },
  { task: "Brief support", owner: "Priya" },
  { task: "Write rollback plan", owner: "Daniel" },
] as const;
const DELIVERABLE_AT = 4400;

/* Share scene beats. */
const CREATE_LINK_AT = 700;
const COPY_LINK_AT = 1700;
const DOWNLOAD_AT = 2500;
const FILE_READY_AT = 3100;
const PRESS_MS = 200;

/* Deterministic bar shapes so server and client render the same markup. */
const BARS = Array.from({ length: 56 }, (_, index) => ({
  height: Math.round(35 + 65 * Math.abs(Math.sin(index * 1.7))),
  delay: -((index * 173) % 1100),
  duration: 0.8 + ((index * 7) % 5) / 10,
}));

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Which scene `elapsed` falls in, and how far into it. */
function locate(elapsed: number) {
  let start = 0;
  for (const [index, scene] of SCENES.entries()) {
    if (elapsed < start + scene.ms) return { scene: index, t: elapsed - start };
    start += scene.ms;
  }
  return { scene: SCENES.length - 1, t: SCENES.at(-1)!.ms };
}

function clock(seconds: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

/** Fade-and-rise entrance toggled by the clock rather than by mount, so it pauses with it. */
function reveal(visible: boolean) {
  return cn(
    "transition-[opacity,translate] duration-500 ease-out",
    !visible && "translate-y-2 opacity-0"
  );
}

function RecordScene({ t }: { t: number }) {
  const progress = Math.min(1, t / CLOCK_RAMP_MS);
  // Ease out so the fast-forward settles onto the final time instead of stopping dead.
  const seconds = Math.round(RECORDED_SECONDS * (1 - (1 - progress) ** 3));
  return (
    <div className={cn("bg-card rounded-2xl border p-4 sm:p-6", CARD_SHADOW)}>
      <p className="eyebrow">New recording</p>
      <p className="font-display mt-1.5 truncate text-2xl">{MEETING}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {SOURCES.map(({ icon: Icon, label, hint }) => (
          <div
            key={label}
            className="border-primary bg-primary/5 flex items-center gap-3 rounded-xl border p-3 sm:p-4"
          >
            <Icon className="text-primary size-5 shrink-0" />
            <span className="min-w-0 flex-1 text-sm font-medium">
              <span className="block truncate">{label}</span>
              <span className="text-muted-foreground mt-0.5 hidden truncate text-xs font-normal sm:block">
                {hint}
              </span>
            </span>
            <span className="bg-primary text-primary-foreground hidden size-4 shrink-0 items-center justify-center rounded-full sm:flex">
              <Check className="size-3" />
            </span>
          </div>
        ))}
      </div>
      <div className="border-destructive/30 bg-destructive/5 mt-4 rounded-2xl border px-4 py-4 text-center sm:py-5">
        <div className="flex items-center justify-center gap-2.5">
          <span className="bg-destructive animate-pulse-ring size-2.5 rounded-full" />
          <span className="eyebrow">Recording</span>
        </div>
        <p className="mt-3 font-mono text-4xl tracking-tight tabular-nums sm:text-5xl">
          {clock(seconds)}
        </p>
        <div className="mt-3 flex h-8 items-center justify-center gap-[3px] overflow-hidden">
          {BARS.map((bar, index) => (
            <span
              key={index}
              className="bg-destructive/55 animate-wave w-1 shrink-0 rounded-full"
              style={{
                height: `${bar.height}%`,
                animationDelay: `${bar.delay}ms`,
                animationDuration: `${bar.duration}s`,
              }}
            />
          ))}
        </div>
      </div>
      <span className={cn(buttonVariants({ variant: "destructive" }), "mt-4 w-full")}>
        <Square />
        Stop &amp; save meeting
      </span>
    </div>
  );
}

function TranscriptScene({ t }: { t: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-3">
          <p className="font-display text-2xl">Full transcript</p>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {SEGMENTS.filter((segment) => t >= segment.at).length} segments
          </span>
        </div>
        <Badge variant="secondary">
          <AudioLines />3 speakers
        </Badge>
      </div>
      <div className="rule-fade my-4 h-px" />
      <ol className="flex flex-col gap-1">
        {SEGMENTS.map((segment) => (
          <li
            key={segment.time}
            className={cn(
              "grid gap-1 py-2 sm:grid-cols-[7.5rem_1fr] sm:gap-5",
              reveal(t >= segment.at)
            )}
          >
            <div className="flex items-baseline gap-2.5 sm:flex-col sm:gap-1">
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {segment.time}
              </span>
              <span className="text-foreground/70 text-[0.6875rem] font-medium tracking-[0.12em] uppercase">
                {segment.speaker}
              </span>
            </div>
            <p className="text-sm leading-6 sm:text-[0.9375rem] sm:leading-7">{segment.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ProcessingCard({ t }: { t: number }) {
  return (
    <div className={cn("bg-card rounded-2xl border p-5 sm:p-7", CARD_SHADOW)}>
      <Badge variant="secondary">
        <Loader2 className="animate-spin" />
        Preparing your notes
      </Badge>
      <p className="font-display mt-4 flex items-center gap-2.5 text-2xl">
        <span className="bg-primary/70 size-2 shrink-0 animate-pulse rounded-full" />
        Writing your summary
      </p>
      <div className="bg-muted mt-5 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full origin-left rounded-full transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${Math.min(1, t / PROCESSING_MS)})` }}
        />
      </div>
      <p className="text-muted-foreground mt-3 text-xs">Transcript ready · 3 speakers</p>
    </div>
  );
}

function SummaryScene({ t }: { t: number }) {
  if (t < PROCESSING_MS) return <ProcessingCard t={t} />;
  return (
    <div className={cn("bg-card animate-fade-in rounded-2xl border p-4 sm:p-7", CARD_SHADOW)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">The takeaway</p>
          <p className="font-display text-2xl leading-tight sm:text-3xl">
            Q3 launch is on for Oct 14
          </p>
        </div>
        <Badge variant="success" className="shrink-0">
          <Check />
          Ready
        </Badge>
      </div>
      <div className="rule-fade my-4 h-px sm:my-5" />
      <div className="grid gap-3.5 md:grid-cols-3 md:gap-6">
        {SUMMARY.map(({ at, title, items }) => (
          <div
            key={title}
            className={cn(reveal(t >= at), title === "Key ideas" && "max-md:hidden")}
          >
            <p className="eyebrow">{title}</p>
            <ul className="mt-1.5 flex flex-col gap-0.5 sm:mt-2 sm:gap-1">
              {items.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm leading-6">
                  <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                  <span className="truncate">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className={reveal(t >= NEXT_STEPS_AT)}>
          <p className="eyebrow">Next steps</p>
          <ul className="mt-1.5 flex flex-col gap-0.5 sm:mt-2 sm:gap-1">
            {NEXT_STEPS.map(({ task, owner }) => (
              <li key={task} className="flex items-center gap-2.5 text-sm leading-6">
                <span className="border-input size-3.5 shrink-0 rounded-[4px] border" />
                <span className="min-w-0 flex-1 truncate">{task}</span>
                <span className="text-muted-foreground shrink-0 text-xs">{owner}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className={cn(
          "bg-muted/50 mt-4 flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 sm:mt-6 sm:px-4 sm:py-3",
          reveal(t >= DELIVERABLE_AT)
        )}
      >
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">Draft follow-up email</span>
            <Sparkles className="text-primary size-3.5 shrink-0" />
          </p>
          <p className="text-muted-foreground truncate text-xs">
            Hi all, quick recap: we launch on October 14, and…
          </p>
        </div>
        <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
          You asked for this
        </span>
      </div>
    </div>
  );
}

function ShareScene({ t }: { t: number }) {
  const shared = t >= CREATE_LINK_AT + PRESS_MS;
  const copied = t >= COPY_LINK_AT + PRESS_MS;
  const exporting = t >= DOWNLOAD_AT + PRESS_MS && t < FILE_READY_AT;
  const pressed = (at: number) => t >= at && t < at + PRESS_MS;
  return (
    <div className="flex flex-col gap-3.5 sm:gap-4">
      <div>
        <p className="eyebrow">Share &amp; export</p>
        <p className="font-display mt-1.5 truncate text-2xl">{MEETING}</p>
      </div>
      <div className={cn("bg-card rounded-2xl border p-4 sm:p-5", CARD_SHADOW)}>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "hidden size-9 shrink-0 items-center justify-center rounded-full transition-colors sm:flex",
              shared ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {shared ? <Globe className="size-4" /> : <Lock className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {shared ? "Anyone with the link" : "Only you"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {shared ? "View-only · no sign-in needed" : "This meeting is private."}
            </p>
          </div>
          <span
            className={cn(
              buttonVariants({ variant: shared ? "outline" : "default", size: "sm" }),
              "shrink-0",
              pressed(CREATE_LINK_AT) && PRESSED
            )}
          >
            {shared ? "Stop sharing" : "Create link"}
          </span>
        </div>
        <div className={cn("mt-4 flex items-center gap-2", reveal(shared))}>
          <span className="text-muted-foreground flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 font-mono text-xs shadow-xs">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">breeze.app/share/7kq2m9xd</span>
          </span>
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
              copied && "text-success",
              pressed(COPY_LINK_AT) && PRESSED
            )}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </span>
        </div>
      </div>
      <div className={cn("bg-card rounded-2xl border p-4 sm:p-5", CARD_SHADOW)}>
        <div className="flex items-center gap-3">
          <span className="bg-muted text-muted-foreground hidden size-9 shrink-0 items-center justify-center rounded-full sm:flex">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Word document</p>
            <p className="text-muted-foreground truncate text-xs">Summary + transcript</p>
          </div>
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
              pressed(DOWNLOAD_AT) && PRESSED
            )}
          >
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            Download .docx
          </span>
        </div>
        <div
          className={cn(
            "bg-muted/50 mt-4 flex items-center gap-3 rounded-xl border px-3 py-2.5",
            reveal(t >= FILE_READY_AT)
          )}
        >
          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            <FileText className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">q3-launch-planning.docx</span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
            24 KB
          </span>
          <Check className="text-success size-4 shrink-0" />
        </div>
      </div>
    </div>
  );
}

function BrowserChrome({ path }: { path: string }) {
  return (
    <div className="bg-muted/60">
      <div className="flex items-end gap-3 border-b px-3 pt-2.5 sm:px-4">
        <div className="flex shrink-0 gap-1.5 pb-3">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="bg-muted-foreground/30 size-2.5 rounded-full" />
          ))}
        </div>
        <div className="bg-card relative -mb-px flex min-w-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium">
          <Wind className="text-primary size-3.5 shrink-0" />
          <span className="truncate">Breeze</span>
          <X className="text-muted-foreground ml-4 size-3 shrink-0" />
        </div>
      </div>
      <div className="bg-card border-b px-3 py-2 sm:px-4">
        <div className="bg-muted text-muted-foreground flex h-7 min-w-0 items-center gap-2 rounded-full px-3 font-mono text-xs">
          <Lock className="size-3 shrink-0" />
          <span className="truncate">breeze.app/{path}</span>
        </div>
      </div>
    </div>
  );
}

export function ProductDemo() {
  const root = useRef<HTMLElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const playing = inView && !paused && !reducedMotion;

  // Only run while on screen in a visible tab.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let intersecting = false;
    const update = () => setInView(intersecting && document.visibilityState === "visible");
    const observer = new IntersectionObserver((entries) => {
      intersecting = entries.at(-1)?.isIntersecting ?? false;
      update();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setElapsed((value) => (value + TICK_MS) % LOOP_MS), TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const time = reducedMotion ? STILL_FRAME_MS : elapsed;
  const { scene, t } = locate(time);
  const fadingOut = time >= LOOP_MS - OUTRO_MS;

  return (
    <figure ref={root} className="flex flex-col gap-5">
      <div
        aria-hidden="true"
        className={cn(
          "bg-card overflow-hidden rounded-2xl border shadow-[0_10px_30px_-16px_color-mix(in_oklch,var(--foreground)_40%,transparent)] select-none",
          // The Pause button also freezes looping CSS (waveform, spinners). Only then: pausing while
          // offscreen or reduced would freeze entrance fades at opacity 0 and blank the frame.
          paused && "**:[animation-play-state:paused]"
        )}
      >
        <BrowserChrome path={SCENES[scene]!.path} />
        <div className="glow-bg bg-background h-[29rem] overflow-hidden sm:h-[31rem]">
          <div
            key={scene}
            className={cn(
              "animate-fade-in mx-auto max-w-3xl px-4 py-5 transition-opacity duration-700 sm:px-8 sm:py-8",
              fadingOut && "opacity-0"
            )}
          >
            {scene === 0 && <RecordScene t={t} />}
            {scene === 1 && <TranscriptScene t={t} />}
            {scene === 2 && <SummaryScene t={t} />}
            {scene === 3 && <ShareScene t={t} />}
          </div>
        </div>
      </div>

      <figcaption className="flex items-start gap-3 sm:gap-6">
        <span className="sr-only">
          Product tour: Breeze records your microphone and a meeting tab, builds a transcript
          labelled by speaker, writes a summary of key ideas, decisions, next steps and any extras
          you ask for, then lets you share a view-only link or download the notes as a Word
          document.
        </span>
        <ol aria-hidden="true" className="grid flex-1 grid-cols-4 gap-3 sm:gap-6">
          {SCENES.map(({ label, ms }, index) => (
            <li key={label} className="flex min-w-0 flex-col gap-2.5">
              <span className="bg-border h-0.5 overflow-hidden rounded-full">
                <span
                  className="bg-primary block h-full origin-left transition-transform duration-100 ease-linear"
                  style={{
                    transform: `scaleX(${index < scene ? 1 : index === scene ? t / ms : 0})`,
                  }}
                />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <span
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    index === scene ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "truncate text-xs sm:text-sm",
                    index === scene ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </span>
            </li>
          ))}
        </ol>
        {!reducedMotion && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground -mt-2 shrink-0"
            aria-label={paused ? "Play product tour" : "Pause product tour"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}
