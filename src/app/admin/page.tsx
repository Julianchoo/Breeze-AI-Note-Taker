import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { count, desc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetings, user } from "@/lib/schema";
import { ADMIN_EMAIL, usd } from "@/lib/utils";

export const metadata = { title: "Admin" };

const date = (value: Date | null) =>
  value ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const monthLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  // 404 rather than 403 so the page's existence isn't revealed.
  if (session?.user.email !== ADMIN_EMAIL || !session.user.emailVerified) notFound();
}

async function setLimit(form: FormData) {
  "use server";
  await requireAdmin();
  const input = z.object({ id: z.string().min(1), limit: z.coerce.number().min(0).max(1000) }).parse(Object.fromEntries(form));
  await db.update(user).set({ costLimitUsd: input.limit }).where(eq(user.id, input.id));
  revalidatePath("/admin");
}

export default async function AdminPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      joined: user.createdAt,
      meetings: count(meetings.id),
      seconds: sql<number>`coalesce(sum(${meetings.durationSeconds}) filter (where ${meetings.status} = 'ready'), 0)`.mapWith(Number),
      cost: user.spentUsd,
      limit: user.costLimitUsd,
      lastMeeting: max(meetings.createdAt),
    })
    .from(user)
    .leftJoin(meetings, eq(meetings.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(user.spentUsd), desc(user.createdAt));

  const totals = rows.reduce(
    (t, r) => ({ meetings: t.meetings + r.meetings, seconds: t.seconds + r.seconds, cost: t.cost + r.cost }),
    { meetings: 0, seconds: 0, cost: 0 }
  );
  const atLimit = rows.filter((r) => r.cost >= r.limit).length;

  // Monthly spend across all users, from existing meetings only: cost of deleted meetings (or users) is missing here,
  // unlike the lifetime total above.
  const monthly = await db
    .select({
      month: sql<string>`date_trunc('month', ${meetings.createdAt})`,
      meetings: count(meetings.id),
      seconds: sql<number>`coalesce(sum(${meetings.durationSeconds}) filter (where ${meetings.status} = 'ready'), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${meetings.costUsd}), 0)`.mapWith(Number),
    })
    .from(meetings)
    .groupBy(sql`date_trunc('month', ${meetings.createdAt})`)
    .orderBy(sql`date_trunc('month', ${meetings.createdAt}) desc`);

  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <header className="animate-fade-up flex flex-col gap-3">
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Users &amp; usage</h1>
        </header>

        <div className="animate-fade-up mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 [animation-delay:80ms]">
          <Card className="rounded-2xl p-5">
            <p className="eyebrow">Total AI spend</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{usd(totals.cost)}</p>
          </Card>
          <Card className="rounded-2xl p-5">
            <p className="eyebrow">Minutes processed</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{Math.round(totals.seconds / 60)}</p>
          </Card>
          <Card className="rounded-2xl p-5">
            <p className="eyebrow">Meetings</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{totals.meetings}</p>
          </Card>
          <Card className="rounded-2xl p-5">
            <p className="eyebrow">Users</p>
            <p className="mt-2 font-mono text-2xl tabular-nums">{rows.length}</p>
            <p className="text-muted-foreground mt-1 text-xs">{atLimit} at limit</p>
          </Card>
        </div>

        <div className="rule-fade mt-10 h-px sm:mt-14" />

        <div className="animate-fade-up mt-8 overflow-x-auto [animation-delay:120ms]">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/70 border-b text-left text-xs">
                <th className="py-3 pr-4 font-medium">User</th>
                <th className="py-3 pr-4 font-medium">Joined</th>
                <th className="py-3 pr-4 text-right font-medium">Meetings</th>
                <th className="py-3 pr-4 text-right font-medium">Minutes</th>
                <th className="py-3 pr-4 text-right font-medium">AI cost</th>
                <th className="py-3 pr-4 text-right font-medium">Limit (USD)</th>
                <th className="py-3 font-medium">Last meeting</th>
              </tr>
            </thead>
            <tbody className="divide-border/70 divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-4 pr-4">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-muted-foreground text-xs">{r.email}</p>
                  </td>
                  <td className="text-muted-foreground py-4 pr-4 font-mono text-xs tabular-nums">{date(r.joined)}</td>
                  <td className="py-4 pr-4 text-right font-mono tabular-nums">{r.meetings}</td>
                  <td className="py-4 pr-4 text-right font-mono tabular-nums">{Math.round(r.seconds / 60)}</td>
                  <td
                    className={`py-4 pr-4 text-right font-mono tabular-nums ${r.cost >= r.limit ? "text-destructive" : ""}`}
                  >
                    {usd(r.cost)}
                    {r.cost >= r.limit && <span className="block text-[0.6875rem]">limit reached</span>}
                  </td>
                  <td className="py-4 pr-4">
                    <form action={setLimit} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Input
                        name="limit"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000"
                        required
                        defaultValue={r.limit}
                        aria-label={`AI cost limit for ${r.email}`}
                        className="h-8 w-20 text-right font-mono text-sm tabular-nums"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Save
                      </Button>
                    </form>
                  </td>
                  <td className="text-muted-foreground py-4 font-mono text-xs tabular-nums">{date(r.lastMeeting)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="animate-fade-up mt-14 flex flex-col gap-3" aria-labelledby="monthly-heading">
          <h2 id="monthly-heading" className="font-display text-2xl">
            Spend by month
          </h2>
          <p className="text-muted-foreground text-xs">
            Monthly figures come from existing meetings, so spend from deleted meetings only appears in the lifetime
            total above.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-muted-foreground border-border/70 border-b text-left text-xs">
                  <th className="py-3 pr-4 font-medium">Month</th>
                  <th className="py-3 pr-4 text-right font-medium">Meetings</th>
                  <th className="py-3 pr-4 text-right font-medium">Minutes</th>
                  <th className="py-3 text-right font-medium">AI cost</th>
                </tr>
              </thead>
              <tbody className="divide-border/70 divide-y">
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="py-4 pr-4 font-mono text-xs tabular-nums">{monthLabel(m.month)}</td>
                    <td className="py-4 pr-4 text-right font-mono tabular-nums">{m.meetings}</td>
                    <td className="py-4 pr-4 text-right font-mono tabular-nums">{Math.round(m.seconds / 60)}</td>
                    <td className="py-4 text-right font-mono tabular-nums">{usd(m.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
