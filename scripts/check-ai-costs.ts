import assert from "node:assert/strict";
import { analysisReservation, callCostUsd, openAiCost, sonioxCost } from "../src/lib/openai-pricing";
import { matchedSonioxCost } from "../src/lib/soniox-usage";

function close(actual: number | null, expected: number) { assert.ok(actual !== null && Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`); }
// Only usage is stored. Reasoning is already part of completion tokens, never added twice.
const result = openAiCost("gpt-4.1", { secret: "never stored", usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 }, completion_tokens_details: { reasoning_tokens: 100 } } });
close(result.costUsd, (600 * 2 + 400 * 0.5 + 200 * 8) / 1e6);
assert.deepEqual(result.usage, { inputTokens: 1000, outputTokens: 200, cachedTokens: 400, cacheWrite30mTokens: 0, cacheWrite12hTokens: 0 });
close(callCostUsd("gpt-6-sol", { usage: { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400, cache_write_tokens: 300 } } }), (300 * 2 + 400 * .2 + 300 * 2.5 + 200 * 10) / 1e6);
close(callCostUsd("gpt-6-sol", { usage: { input_tokens: 300_000, output_tokens: 100, input_tokens_details: { cached_tokens: 100_000, cache_write_tokens: 100_000 } } }), (100_000 * 4 + 100_000 * .4 + 100_000 * 5 + 100 * 15) / 1e6);
close(callCostUsd("gpt-6-sol", { usage: { input_tokens: 1000, output_tokens: 10, input_tokens_details: { cached_tokens: 400, cache_write_tokens: 500, cache_write_tokens_details: { ttl_30m_tokens: 300, ttl_12h_tokens: 200 } } } }), (100 * 2 + 400 * .2 + 300 * 2.5 + 200 * 5 + 10 * 10) / 1e6);
for (const model of ["unknown", "__proto__", "toString"]) assert.equal(callCostUsd(model, { usage: { prompt_tokens: 1, completion_tokens: 1 } }), null);
for (const details of [{ cached_tokens: 1001 }, { cache_write_tokens: -1 }, { cache_write_tokens: 100, cache_write_tokens_details: { ttl_30m_tokens: 50, ttl_12h_tokens: 60 } }]) assert.equal(callCostUsd("gpt-6-sol", { usage: { prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: details } }), null);
assert.equal(callCostUsd("gpt-4.1", {}), null);
assert.equal(callCostUsd("gpt-4.1", { usage: { prompt_tokens: 0, completion_tokens: 0 } }), 0);
assert.equal(sonioxCost(3600).status, "estimated"); close(sonioxCost(3600).costUsd, .1);
assert.equal(sonioxCost(NaN).costUsd, null);
assert.ok(analysisReservation("gpt-6-sol", "hello") >= .32);
const log = { client_reference_id: "our-attempt", model: "stt-async-v5", cost_usd: "0.1045000000", input_text_tokens: 45, input_audio_tokens: 30000, output_text_tokens: 16000, provider_secret: "excluded" };
const billed = matchedSonioxCost([log, { ...log, client_reference_id: "someone-else", cost_usd: "100" }], "our-attempt", "stt-async-v5");
assert.equal(billed?.status, "reported"); close(billed?.costUsd ?? null, .1045);
assert.deepEqual(billed?.usage, { inputTextTokens: 45, inputAudioTokens: 30000, outputTextTokens: 16000 });
assert.equal(matchedSonioxCost([log], "other", "stt-async-v5"), null);
assert.equal(matchedSonioxCost([log, log], "our-attempt", "stt-async-v5"), null);
for (const cost of ["NaN", "Infinity", "-1", "1e999", "0.1 USD"]) assert.equal(matchedSonioxCost([{ ...log, cost_usd: cost }], "our-attempt", "stt-async-v5"), null);
console.log("AI pricing, cache disjointness, unknown-vs-zero, Soniox reference matching and cost sanitization checks passed.");
