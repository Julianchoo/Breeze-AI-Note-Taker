"use client";
import { useEffect, useState } from "react";
import {
  ArrowClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  WarningIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting } from "@/lib/meeting-types";
import type { NotionOptions } from "@/lib/notion";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "This request could not be completed.");
  return data;
}
const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function Chips({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-semibold">
        {legend} <span className="text-muted-foreground font-normal">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, name }) => {
          const on = selected.includes(id);
          return (
            <Button
              key={id}
              type="button"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className="ease-fluid h-10 px-3 font-semibold duration-300"
            >
              {on && <CheckIcon aria-hidden="true" />}
              {name}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* Mounted only while the dialog is open, so every open starts from fresh options and the meeting's defaults. */
function NotionForm({ meeting, onSent }: { meeting: Meeting; onSent: (url: string) => void }) {
  const [options, setOptions] = useState<NotionOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState(meeting.title);
  // Local calendar date, YYYY-MM-DD.
  const [date, setDate] = useState(new Date(meeting.createdAt).toLocaleDateString("en-CA"));
  const [pillars, setPillars] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [newTema, setNewTema] = useState("");
  const [type, setType] = useState("");
  const [participants, setParticipants] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<NotionOptions>(`/api/meetings/${meeting.id}/notion`, { signal: controller.signal })
      .then(setOptions)
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof Error ? error.message : "Could not load Notion options.");
      });
    return () => controller.abort();
  }, [meeting.id, attempt]);

  // Reuses an existing tag when the typed one only differs in case, so Notion gets no near-duplicates.
  function addTema() {
    const typed = newTema.replace(/,/g, " ").trim();
    if (!typed) return;
    const match = [...(options?.temas ?? []), ...temas].find(
      (tema) => tema.toLowerCase() === typed.toLowerCase()
    );
    const tema = match ?? typed;
    if (!temas.includes(tema)) setTemas([...temas, tema]);
    setNewTema("");
  }
  async function send() {
    setSending(true);
    try {
      const { url } = await request<{ url: string }>(`/api/meetings/${meeting.id}/notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date: date || undefined,
          pillars,
          temas,
          type: type || undefined,
          participants: participants.trim() || undefined,
        }),
      });
      toast.success("Sent to Notion.", {
        action: { label: "Open", onClick: () => window.open(url, "_blank", "noopener") },
      });
      onSent(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send to Notion.");
      setSending(false);
    }
  }

  const temaChips = [...(options?.temas ?? []), ...temas.filter((t) => !options?.temas.includes(t))];
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="notion-name" className="text-sm font-semibold">
          Name
        </label>
        <Input
          id="notion-name"
          required
          maxLength={2000}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 rounded-lg"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="notion-date" className="text-sm font-semibold">
          Meeting date <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="notion-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 rounded-lg font-mono tabular-nums"
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="text-destructive flex items-start gap-2 text-sm text-pretty">
            <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ease-fluid h-10 px-3 font-semibold duration-300"
            onClick={() => {
              setLoadError("");
              setAttempt((value) => value + 1);
            }}
          >
            <ArrowClockwiseIcon aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : !options ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading Notion options</span>
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex flex-wrap gap-2">
            {["w-20", "w-24", "w-16", "w-28", "w-20", "w-24"].map((width, index) => (
              <Skeleton key={index} className={`h-10 rounded-full ${width}`} />
            ))}
          </div>
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <Chips
            legend="Pillars"
            options={options.pillars}
            selected={pillars}
            onToggle={(id) => setPillars(toggle(pillars, id))}
          />
          <div className="flex flex-col gap-3">
            <Chips
              legend="Tema"
              options={temaChips.map((tema) => ({ id: tema, name: tema }))}
              selected={temas}
              onToggle={(tema) => setTemas(toggle(temas, tema))}
            />
            <div className="flex gap-2">
              <label htmlFor="notion-new-tema" className="sr-only">
                New tema
              </label>
              <Input
                id="notion-new-tema"
                maxLength={100}
                value={newTema}
                placeholder="New tema"
                onChange={(event) => setNewTema(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addTema();
                }}
                className="h-11 min-w-0 flex-1 rounded-lg"
              />
              <Button
                type="button"
                variant="outline"
                className="ease-fluid h-11 font-semibold duration-300"
                disabled={!newTema.trim()}
                onClick={addTema}
              >
                <PlusIcon aria-hidden="true" />
                Add
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="notion-type" className="text-sm font-semibold">
              Type <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              id="notion-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
            >
              <option value="">None</option>
              {options.types.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="notion-participants" className="text-sm font-semibold">
          Participants <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="notion-participants"
          maxLength={2000}
          value={participants}
          onChange={(event) => setParticipants(event.target.value)}
          className="h-11 rounded-lg"
        />
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={sending || !options || !name.trim()}
          className="ease-fluid h-12 w-full text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
        >
          {sending ? (
            <CircleNotchIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <PaperPlaneTiltIcon aria-hidden="true" />
          )}
          Send to Notion
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NotionDialog({
  meeting,
  open,
  onOpenChange,
  onSent,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (url: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Portaled outside .landing, so landing-island brings the landing tokens along. */}
      <DialogContent className="landing-island max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="text-left">
          <DialogTitle>Send to Notion</DialogTitle>
          <DialogDescription className="text-pretty">
            Creates a new page in your Meetings database with the summary and transcript.
          </DialogDescription>
        </DialogHeader>
        <NotionForm meeting={meeting} onSent={onSent} />
      </DialogContent>
    </Dialog>
  );
}
