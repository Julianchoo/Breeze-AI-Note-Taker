import { z } from "zod";

// List prices only: not invoices, taxes, volume discounts or negotiated rates.
// Version is persisted with each attempt so historical amounts do not change when rates change.
// https://developers.openai.com/api/docs/pricing and /guides/prompt-caching
export const PRICING_VERSION = "2026-10-22";
const PRICING = {
  "gpt-4o-transcribe-diarize": { input: 2.5, output: 10, cached: 2.5, writes: false, perSecond: 0.006 / 60 },
  "gpt-4.1": { input: 2, output: 8, cached: 0.5, writes: false },
  "gpt-4.1-mini": { input: 0.4, output: 1.6, cached: 0.1, writes: false },
  "gpt-6-sol": { input: 2, output: 10, cached: 0.2, writes: true, longContext: { above: 272_000, input: 4, output: 15, cached: 0.4 } },
} as const;
export type OpenAiModel = keyof typeof PRICING;
export type CostMeasurement = {
  status: "reported" | "estimated" | "unknown";
  costUsd: number | null;
  usage: Record<string, number> | null;
  pricingVersion: string;
};
export const SONIOX_USD_PER_HOUR = 0.1;
const amount = z.number().finite().nonnegative();
const details = z.object({
  cached_tokens: amount.optional(), cache_write_tokens: amount.optional(),
  cache_write_tokens_details: z.object({ ttl_30m_tokens: amount, ttl_12h_tokens: amount }).optional(),
});
const usageSchema = z.union([
  z.object({ type: z.literal("duration"), seconds: amount }),
  z.object({ prompt_tokens: amount, completion_tokens: amount, prompt_tokens_details: details.optional() }),
  z.object({ type: z.literal("tokens").optional(), input_tokens: amount, output_tokens: amount, input_tokens_details: details.optional(), input_token_details: details.optional() }),
]);
const unknown = (): CostMeasurement => ({ status: "unknown", costUsd: null, usage: null, pricingVersion: PRICING_VERSION });

/** Uses provider-reported tokens, including reasoning within output tokens; unknown usage stays unknown. */
export function openAiCost(model: string, body: unknown): CostMeasurement {
  if (!Object.hasOwn(PRICING, model)) return unknown();
  const price = PRICING[model as OpenAiModel];
  const parsed = usageSchema.safeParse((body as { usage?: unknown } | null | undefined)?.usage);
  if (!parsed.success) return unknown();
  const u = parsed.data;
  if ("seconds" in u) return "perSecond" in price
    ? { status: "reported", costUsd: u.seconds * price.perSecond, usage: { seconds: u.seconds }, pricingVersion: PRICING_VERSION }
    : unknown();
  const input = "prompt_tokens" in u ? u.prompt_tokens : u.input_tokens;
  const output = "completion_tokens" in u ? u.completion_tokens : u.output_tokens;
  const d = "prompt_tokens" in u ? u.prompt_tokens_details : u.input_tokens_details ?? u.input_token_details;
  const cached = d?.cached_tokens ?? 0, writes = d?.cache_write_tokens ?? 0;
  const shortWrites = d?.cache_write_tokens_details?.ttl_30m_tokens ?? writes;
  const longWrites = d?.cache_write_tokens_details?.ttl_12h_tokens ?? 0;
  if (cached + writes > input || shortWrites + longWrites !== writes || (!price.writes && writes > 0)) return unknown();
  const rate = "longContext" in price && input > price.longContext.above ? price.longContext : price;
  // Cache reads, writes and ordinary tokens are disjoint subsets of total input tokens.
  const costUsd = ((input - cached - writes) * rate.input + cached * rate.cached + shortWrites * rate.input * 1.25 + longWrites * rate.input * 2.5 + output * rate.output) / 1_000_000;
  return { status: "reported", costUsd, usage: { inputTokens: input, outputTokens: output, cachedTokens: cached, cacheWrite30mTokens: shortWrites, cacheWrite12hTokens: longWrites }, pricingVersion: PRICING_VERSION };
}

/** Compatibility helper. Missing/malformed usage is null, never a fabricated zero charge. */
export function callCostUsd(model: string, body: unknown): number | null { return openAiCost(model, body).costUsd; }

/** Soniox's public async endpoint reports duration, not billed token counts. This is explicitly an estimate.
 * https://soniox.com/docs/api-reference/stt/transcriptions/get_transcription and https://soniox.com/pricing
 */
export function sonioxCost(seconds: number): CostMeasurement {
  if (!amount.safeParse(seconds).success) return unknown();
  return { status: "estimated", costUsd: seconds / 3600 * SONIOX_USD_PER_HOUR, usage: { audioSeconds: seconds }, pricingVersion: PRICING_VERSION };
}

/** Budget hold only, not a measured expense. One UTF-8 byte per token is deliberately conservative. */
export function analysisReservation(model: OpenAiModel, request: string): number {
  const price = PRICING[model];
  const input = Buffer.byteLength(request, "utf8"), output = model === "gpt-6-sol" ? 32_000 : 6000;
  const rate = "longContext" in price && input > price.longContext.above ? price.longContext : price;
  return (input * rate.input * (price.writes ? 1.25 : 1) + output * rate.output) / 1_000_000;
}
