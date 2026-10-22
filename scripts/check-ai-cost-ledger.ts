import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { attemptById, beginAiAttempt, getAiCosts, recordAiCost, recoverInterruptedAnalysis } from "../src/lib/ai-costs";
import { db } from "../src/lib/db";
import { aiCostAttempts, meetings, user } from "../src/lib/schema";
import { PRICING_VERSION, type CostMeasurement } from "../src/lib/openai-pricing";

// This integration test creates and removes fixtures. It is restricted to a disposable local database.
const url = new URL(process.env.POSTGRES_URL!);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Use a disposable local POSTGRES_URL for ledger checks.");
const userId = `cost-test-${randomUUID()}`, leaseToken = randomUUID();
const known = (costUsd: number, status: "reported" | "estimated" = "reported"): CostMeasurement => ({ status, costUsd, usage: { inputTokens: 100 }, pricingVersion: PRICING_VERSION });
const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} != ${b}`);
async function run() {
  await db.insert(user).values({ id: userId, name: "Cost accounting fixture", email: `${userId}@example.invalid`, spentUsd: .2, costLimitUsd: .5 });
  const [meeting] = await db.insert(meetings).values({ userId, title: "Accounting fixture", costUsd: .2, leaseToken }).returning();
  const input = { meetingId: meeting!.id, userId, leaseToken, provider: "openai" as const, stage: "analysis" as const, model: "gpt-4.1", reservedUsd: .3 };
  const first = await beginAiAttempt(input);
  assert.equal((await attemptById(first.id))?.status, "pending");
  await Promise.all([recordAiCost(first.id, known(.05)), recordAiCost(first.id, known(.05))]);
  let costs = await getAiCosts(meeting!.id); close(costs.totalUsd, .25); close(costs.legacyUsd, .2); close(costs.analysisUsd, .05);
  const lost = await beginAiAttempt(input);
  await recoverInterruptedAnalysis(meeting!.id);
  assert.equal((await attemptById(lost.id))?.status, "unknown");
  costs = await getAiCosts(meeting!.id); assert.equal(costs.unknownAttempts, 1); close(costs.totalUsd, .25);
  await assert.rejects(beginAiAttempt(input), /budget is used or reserved/);
  // A late provider response settles the unknown hold once, even after another worker acquired the meeting.
  await db.update(meetings).set({ leaseToken: randomUUID() }).where(eq(meetings.id, meeting!.id));
  await recordAiCost(lost.id, known(.06)); await recordAiCost(lost.id, known(.06));
  costs = await getAiCosts(meeting!.id); close(costs.totalUsd, .31); assert.equal(costs.unknownAttempts, 0);
  await db.update(meetings).set({ leaseToken }).where(eq(meetings.id, meeting!.id));
  const transcription = await beginAiAttempt({ ...input, provider: "soniox", stage: "transcription", model: "stt-async-v5", reservedUsd: .2, alreadySubmitted: true });
  await recordAiCost(transcription.id, known(.1, "estimated"));
  await recordAiCost(transcription.id, known(.08)); await recordAiCost(transcription.id, known(.08));
  costs = await getAiCosts(meeting!.id); close(costs.totalUsd, .39); close(costs.transcriptionUsd, .08); close(costs.legacyUsd, .2); assert.equal(costs.estimatedAttempts, 0);
  const free = await beginAiAttempt({ ...input, reservedUsd: .01 });
  await recordAiCost(free.id, known(0)); assert.equal((await attemptById(free.id))?.costUsd, 0);
  // Deleting the meeting never resets lifetime spend or destroys the reconciliation trail.
  await db.delete(meetings).where(eq(meetings.id, meeting!.id));
  const [owner] = await db.select().from(user).where(eq(user.id, userId)); close(owner!.spentUsd, .39);
  assert.equal((await attemptById(first.id))?.meetingId, null);
  const persisted = await db.select().from(aiCostAttempts).where(eq(aiCostAttempts.userId, userId)); assert.equal(persisted.length, 4);
  console.log("AI ledger idempotence, late settlement, legacy preservation, budget holds and deletion checks passed.");
}
run().finally(async () => { await db.delete(user).where(eq(user.id, userId)); await db.$client.end(); }).catch(error => { console.error(error); process.exitCode = 1; });
