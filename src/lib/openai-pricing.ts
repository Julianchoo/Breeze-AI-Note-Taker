import { z } from "zod";

// OpenAI list prices in USD per 1M tokens.
// Checked 2026-09-23 against https://developers.openai.com/api/docs/pricing — update the numbers and this date together.
// List prices only: excludes tax, volume discounts and committed-spend rates.
const PRICING = {
  // perSecond is OpenAI's own ~$0.006/min figure, used ONLY for the `duration` usage variant.
  "gpt-4o-transcribe-diarize": { input: 2.5, output: 10, perSecond: 0.006 / 60 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
} as const;

// Soniox stt-async-v5 list price, speaker diarization included. Checked 2026-09-24 against https://soniox.com/pricing.
export const SONIOX_USD_PER_HOUR = 0.1;

const amount =z.number().finite().nonnegative();
const usageSchema = z.union([
  z.object({ type: z.literal("tokens"), input_tokens: amount, output_tokens: amount }),
  z.object({ type: z.literal("duration"), seconds: amount }),
  z.object({ prompt_tokens: amount, completion_tokens: amount }),
]);

/** Cost of one OpenAI call from its whole response body; returns 0 when usage is absent, malformed or unknown, and never throws. */
export function callCostUsd(model: keyof typeof PRICING, body: unknown): number {
  const parsed = usageSchema.safeParse((body as { usage?: unknown } | null | undefined)?.usage);
  if (!parsed.success) return 0;
  const usage = parsed.data, price = PRICING[model];
  if ("type" in usage && usage.type === "duration") return "perSecond" in price ? usage.seconds * price.perSecond : 0;
  const input = "type" in usage ? usage.input_tokens : usage.prompt_tokens, output = "type" in usage ? usage.output_tokens : usage.completion_tokens;
  return (input * price.input + output * price.output) / 1_000_000;
}
