"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Plus, RotateCcw, TriangleAlert } from "lucide-react";
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
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-medium">
        {legend} <span className="text-muted-foreground font-normal">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ id, name }) => {
          const on = selected.includes(id);
          return (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={on ? "default" : "outline"}
              aria-pressed={on}
              onClick={() => onToggle(id)}
            >
              {on && <Check aria-hidden="true" />}
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
        <label htmlFor="notion-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="notion-name"
          required
          maxLength={2000}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="notion-date" className="text-sm font-medium">
          Meeting date <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="notion-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="font-mono tabular-nums"
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
        >
          <p className="text-destructive flex items-start gap-2.5 text-sm leading-6">
            <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoadError("");
              setAttempt((value) => value + 1);
            }}
          >
            <RotateCcw />
            Try again
          </Button>
        </div>
      ) : !options ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading Notion options</span>
          <Skeleton className="h-4 w-20 rounded-full" />
          <div className="flex flex-wrap gap-1.5">
            {["w-20", "w-24", "w-16", "w-28", "w-20", "w-24"].map((width, index) => (
              <Skeleton key={index} className={`h-8 rounded-full ${width}`} />
            ))}
          </div>
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <Chips legend="Pillars" options={options.pillars} selected={pillars} onToggle={(id) => setPillars(toggle(pillars, id))} />
          <div className="flex flex-col gap-2.5">
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
                className="min-w-0 flex-1"
              />
              <Button type="button" variant="outline" disabled={!newTema.trim()} onClick={addTema}>
                <Plus />
                Add
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="notion-type" className="text-sm font-medium">
              Type <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              id="notion-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
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
        <label htmlFor="notion-participants" className="text-sm font-medium">
          Participants <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="notion-participants"
          maxLength={2000}
          value={participants}
          onChange={(event) => setParticipants(event.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={sending || !options || !name.trim()}>
          {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Notion</DialogTitle>
          <DialogDescription>
            Creates a new page in your Meetings database with the summary and transcript.
          </DialogDescription>
        </DialogHeader>
        <NotionForm meeting={meeting} onSent={onSent} />
      </DialogContent>
    </Dialog>
  );
}
