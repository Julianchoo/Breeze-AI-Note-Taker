import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { MeetingError } from "./meeting-validation";
import { PRICING_VERSION, type CostMeasurement } from "./openai-pricing";
import { aiCostAttempts, meetings, user } from "./schema";
import type { AiCosts } from "./meeting-types";

type Attempt = typeof aiCostAttempts.$inferSelect;

/** Called before the billable request. Keep the hold even if the worker disappears. */
export async function beginAiAttempt(input: { meetingId: string; userId: string; leaseToken: string; provider: Attempt["provider"]; stage: Attempt["stage"]; model: string; reservedUsd: number; alreadySubmitted?: boolean }) {
  return db.transaction(async tx => {
    const [meeting] = await tx.select().from(meetings).where(and(eq(meetings.id, input.meetingId), eq(meetings.userId, input.userId), eq(meetings.leaseToken, input.leaseToken))).for("update");
    if (!meeting) throw new MeetingError("Processing was resumed elsewhere. Refresh to continue.", 409);
    const [owner] = await tx.select().from(user).where(eq(user.id, input.userId)).for("update");
    const [holds] = await tx.select({ total: sql<number>`coalesce(sum(${aiCostAttempts.reservedUsd}), 0)` }).from(aiCostAttempts).where(and(eq(aiCostAttempts.userId, input.userId), inArray(aiCostAttempts.status, ["pending", "unknown"])));
    // As before, a call may overshoot the limit. A lost response keeps a hold so retries cannot be free.
    if (!input.alreadySubmitted && (!owner || owner.spentUsd + Number(holds?.total ?? 0) >= owner.costLimitUsd)) throw new MeetingError("Your AI budget is used or reserved by unfinished requests. Wait for processing to finish, or ask the admin to reconcile unknown costs and raise the limit before retrying.", 403);
    const [attempt] = await tx.insert(aiCostAttempts).values({ meetingId: input.meetingId, userId: input.userId, provider: input.provider, stage: input.stage, model: input.model, reservedUsd: input.reservedUsd, pricingVersion: PRICING_VERSION }).returning();
    if (input.provider === "soniox") await tx.update(meetings).set({ sonioxCostAttemptId: attempt!.id }).where(eq(meetings.id, input.meetingId));
    return attempt!;
  });
}

/** Atomic, idempotent settlement. Accounting survives lost meeting leases and deletion. */
export async function recordAiCost(id: string, measurement: CostMeasurement, providerRequestId?: string | null) {
  await db.transaction(async tx => {
    const [attempt] = await tx.select().from(aiCostAttempts).where(eq(aiCostAttempts.id, id)).for("update");
    if (!attempt) return;
    if (attempt.status === "reported" || (attempt.status === "estimated" && measurement.status !== "reported")) return;
    const delta = (measurement.costUsd ?? 0) - (attempt.costUsd ?? 0);
    await tx.update(aiCostAttempts).set({ status: measurement.status, costUsd: measurement.costUsd, usage: measurement.usage, pricingVersion: measurement.pricingVersion, ...(providerRequestId && { providerRequestId }), updatedAt: new Date() }).where(eq(aiCostAttempts.id, id));
    if (measurement.costUsd !== null) {
      if (attempt.meetingId) await tx.update(meetings).set({ costUsd: sql`coalesce(${meetings.costUsd}, 0) + ${delta}` }).where(eq(meetings.id, attempt.meetingId));
      await tx.update(user).set({ spentUsd: sql`${user.spentUsd} + ${delta}` }).where(eq(user.id, attempt.userId));
    }
  });
}

export async function getAiCosts(meetingId: string): Promise<AiCosts> {
  return db.transaction(async tx => {
  // Hold the meeting row while reading attempts so a settlement cannot produce mismatched totals.
  const [meeting] = await tx.select({ totalUsd: meetings.costUsd }).from(meetings).where(eq(meetings.id, meetingId)).for("share");
  const totalUsd = meeting?.totalUsd ?? null;
  const attempts = await tx.select().from(aiCostAttempts).where(eq(aiCostAttempts.meetingId, meetingId)).orderBy(asc(aiCostAttempts.createdAt));
  const stageTotal = (stage: Attempt["stage"]) => {
    const known = attempts.filter(a => a.stage === stage && a.costUsd !== null);
    return known.length ? known.reduce((n, a) => n + a.costUsd!, 0) : null;
  };
  const accounted = attempts.reduce((n, a) => n + (a.costUsd ?? 0), 0);
  const legacy = totalUsd === null ? null : Math.max(0, totalUsd - accounted);
  return { totalUsd, transcriptionUsd: stageTotal("transcription"), analysisUsd: stageTotal("analysis"), legacyUsd: legacy !== null && legacy > 1e-9 ? legacy : null,
    pendingAttempts: attempts.filter(a => a.status === "pending").length, unknownAttempts: attempts.filter(a => a.status === "unknown").length, estimatedAttempts: attempts.filter(a => a.status === "estimated").length,
    attempts: attempts.map(a => ({ id: a.id, provider: a.provider, stage: a.stage, model: a.model, status: a.status, costUsd: a.costUsd, createdAt: a.createdAt.toISOString() })) };
  });
}

export async function attemptById(id: string | null): Promise<Attempt | undefined> {
  if (!id) return undefined;
  const [attempt] = await db.select().from(aiCostAttempts).where(eq(aiCostAttempts.id, id));
  return attempt;
}

/** A previous worker's synchronous call may have been billed; never silently forget it. */
export async function recoverInterruptedAnalysis(meetingId: string) {
  await db.update(aiCostAttempts).set({ status: "unknown", updatedAt: new Date() }).where(and(eq(aiCostAttempts.meetingId, meetingId), eq(aiCostAttempts.provider, "openai"), eq(aiCostAttempts.status, "pending")));
}
