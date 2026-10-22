import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { recordAiCost } from "./ai-costs";
import { db } from "./db";
import { aiCostAttempts } from "./schema";
import type { CostMeasurement } from "./openai-pricing";

const count = z.number().int().nonnegative();
const logSchema = z.object({
  client_reference_id: z.string(), model: z.string(), cost_usd: z.string().regex(/^\d+(?:\.\d+)?$/),
  input_text_tokens: count, input_audio_tokens: count, output_text_tokens: count,
});
const pageSchema = z.object({ usage_logs: z.array(z.unknown()), next_page_cursor: z.string().nullish() });

/** Only matched numeric billing data is retained; other customers' requests and text never leave this function. */
export function matchedSonioxCost(logs: unknown[], reference: string, model: string): CostMeasurement | null {
  const matches = logs.flatMap(log => { const p = logSchema.safeParse(log); return p.success && p.data.client_reference_id === reference && p.data.model === model ? [p.data] : []; });
  // An unexpected duplicate reference must not be guessed or summed twice.
  if (matches.length !== 1) return null;
  const log = matches[0]!, costUsd = Number(log.cost_usd);
  if (!Number.isFinite(costUsd)) return null;
  return { status: "reported", costUsd, usage: { inputTextTokens: log.input_text_tokens, inputAudioTokens: log.input_audio_tokens, outputTextTokens: log.output_text_tokens }, pricingVersion: "soniox-provider-billing-v1" };
}

/** Billing logs may lag, be unavailable, or outlive the endpoint's retention. Absence is never proof of zero. */
export async function reconcileSonioxAttempt(attempt: typeof aiCostAttempts.$inferSelect): Promise<boolean> {
  if (!process.env.SONIOX_API_KEY || attempt.status === "reported") return false;
  const now = Date.now(), start = attempt.createdAt.getTime() - 60_000;
  const end = Math.min(now + 1000, start + 31 * 86400_000);
  const params = new URLSearchParams({ start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(), limit: "1000", sort: "end_time_desc" });
  try {
    // Bounded work: absence after these pages keeps an explicit estimate/unknown status.
    for (let page = 0; page < 2; page++) {
      const response = await fetch(`https://api.soniox.com/v1/usage-logs?${params}`, { headers: { Authorization: `Bearer ${process.env.SONIOX_API_KEY}` }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) return false;
      const result = pageSchema.safeParse(await response.json());
      if (!result.success) return false;
      const measurement = matchedSonioxCost(result.data.usage_logs, attempt.id, attempt.model);
      if (measurement) { await recordAiCost(attempt.id, measurement); return true; }
      if (!result.data.next_page_cursor) break;
      params.set("cursor", result.data.next_page_cursor);
    }
  } catch { /* Accounting is best effort; never lose the explicit estimate/unknown on provider errors. */ }
  return false;
}

/** Owner reads can reconcile late billing logs. Throttle, bound work, and never block meeting access on billing. */
export async function reconcileMeetingSonioxCosts(meetingId: string) {
  const [attempt] = await db.select().from(aiCostAttempts).where(and(eq(aiCostAttempts.meetingId, meetingId), eq(aiCostAttempts.provider, "soniox"), inArray(aiCostAttempts.status, ["estimated", "unknown"]), lt(aiCostAttempts.updatedAt, new Date(Date.now() - 60_000)))).orderBy(asc(aiCostAttempts.updatedAt), asc(aiCostAttempts.createdAt)).limit(1);
  if (!attempt) return;
  await db.update(aiCostAttempts).set({ updatedAt: new Date() }).where(eq(aiCostAttempts.id, attempt.id));
  await reconcileSonioxAttempt(attempt);
}
