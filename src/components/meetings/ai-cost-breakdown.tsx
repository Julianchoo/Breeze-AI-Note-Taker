"use client";

import { CaretDownIcon, InfoIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AiCosts } from "@/lib/meeting-types";
import { usd } from "@/lib/utils";

function amount(value: number) {
  return value > 0 && value < 0.0001 ? "<$0.0001" : usd(value);
}

const statusLabels = {
  pending: "Pending",
  reported: "From reported usage",
  estimated: "Estimated usage",
  unknown: "Cost unknown",
} as const;

/** Owner-only disclosure: the summary is intentionally compact on the meeting page. */
export function AiCostBreakdown({ costs }: { costs: AiCosts }) {
  const incomplete = costs.unknownAttempts > 0 || costs.pendingAttempts > 0;
  const hasCosts = costs.totalUsd !== null || costs.attempts.length > 0;
  if (!hasCosts) return null;
  const total = costs.totalUsd === null ? null : amount(costs.totalUsd);
  const headline = total
    ? `${total}${incomplete ? " +" : ""} AI ${incomplete ? "subtotal" : "estimate"}`
    : costs.unknownAttempts > 0
      ? "AI cost unknown"
      : "AI cost pending";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ease-fluid hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-sm text-left underline decoration-dotted underline-offset-4 transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none"
          aria-label={`${headline}. View cost breakdown`}
        >
          <span>
            {total && (
              <span className="font-mono tabular-nums">
                {total}
                {incomplete ? " +" : ""}
              </span>
            )}
            {total ? ` AI ${incomplete ? "subtotal" : "estimate"}` : headline}
          </span>
          <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DialogTrigger>
      {/* Portaled outside .landing, so landing-island brings the landing tokens along. */}
      <DialogContent className="landing-island max-h-[85dvh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Estimated AI cost</DialogTitle>
          <DialogDescription className="text-pretty">
            Transcription and analysis for this meeting, including recorded retries and regenerated
            summaries.
          </DialogDescription>
        </DialogHeader>

        {incomplete && (
          <div className="bg-band flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
            <WarningIcon
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="text-pretty">
              {costs.unknownAttempts > 0 &&
                `${costs.unknownAttempts} ${costs.unknownAttempts === 1 ? "attempt has an unknown cost" : "attempts have unknown costs"}. `}
              {costs.pendingAttempts > 0 &&
                `${costs.pendingAttempts} ${costs.pendingAttempts === 1 ? "attempt is" : "attempts are"} pending. `}
              {total ? "The subtotal excludes those amounts." : "A total is not available yet."}
            </p>
          </div>
        )}

        {/* A band well with hairline rules between rows (DESIGN.md: rules or surface changes, no side borders on cards). */}
        <dl className="bg-band divide-border divide-y rounded-xl px-4 text-sm">
          {(
            [
              ["transcription", "Transcription", "Soniox", costs.transcriptionUsd],
              ["analysis", "Analysis", "OpenAI", costs.analysisUsd],
            ] as const
          ).map(([stage, title, provider, value]) => {
            const attempts = costs.attempts.filter((attempt) => attempt.stage === stage);
            const hasUnknown = attempts.some(
              (attempt) => attempt.status === "unknown" || attempt.status === "pending"
            );
            return (
              <div key={stage} className="flex items-baseline justify-between gap-4 py-3">
                <dt>
                  <span className="font-semibold">{title}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {provider}
                    {attempts.length > 0
                      ? ` · ${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"}`
                      : ""}
                  </span>
                </dt>
                <dd className="shrink-0 text-right">
                  {value === null ? (
                    <span className="text-muted-foreground text-xs">
                      {attempts.length ? "Not yet known" : "Not recorded"}
                    </span>
                  ) : (
                    <span className="font-mono tabular-nums">
                      {amount(value)}
                      {hasUnknown ? " +" : ""}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
          {costs.legacyUsd !== null && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span className="font-semibold">Earlier cost</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  No breakdown was recorded
                </span>
              </dt>
              <dd className="shrink-0 font-mono tabular-nums">{amount(costs.legacyUsd)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
            <dt>{incomplete ? "Recorded subtotal" : "Total estimate"}</dt>
            <dd className="font-mono tabular-nums">
              {total ? `${total}${incomplete ? " +" : ""}` : "Unavailable"}
            </dd>
          </div>
        </dl>

        {costs.attempts.length > 0 && (
          <details className="group/history rounded-xl border px-2">
            <summary className="ease-fluid hover:bg-accent focus-visible:ring-ring/50 -mx-2 flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-300 focus-visible:ring-[3px] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              Processing history
              <CaretDownIcon
                className="text-muted-foreground ease-fluid ml-auto size-4 transition-transform duration-300 group-open/history:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <ul className="divide-border divide-y px-2 pb-1">
              {costs.attempts.map((attempt, index) => (
                <li
                  key={attempt.id}
                  className="flex items-start justify-between gap-3 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {attempt.stage === "transcription" ? "Transcription" : "Analysis"} · attempt{" "}
                      {index + 1}
                    </p>
                    <p className="text-muted-foreground mt-1 break-words">
                      {attempt.provider === "soniox" ? "Soniox" : "OpenAI"} · {attempt.model}
                    </p>
                    <time
                      dateTime={attempt.createdAt}
                      className="text-muted-foreground mt-1 block font-mono tabular-nums"
                    >
                      {new Date(attempt.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    <p className="text-muted-foreground mt-1">
                      {attempt.provider === "soniox" && attempt.status === "reported"
                        ? "Cost reported by the provider"
                        : statusLabels[attempt.status]}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums">
                    {attempt.costUsd === null ? "—" : amount(attempt.costUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-muted-foreground text-xs text-pretty">
          Amounts are in USD and include costs reported by providers and list price estimates. Final
          invoices may differ.
          {costs.estimatedAttempts > 0
            ? " Some usage is estimated rather than reported by the provider."
            : ""}{" "}
          Hosting, storage, data transfer, database costs and taxes are excluded.
        </p>
      </DialogContent>
    </Dialog>
  );
}
