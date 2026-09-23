import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { count, desc, eq, max, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetings, user } from "@/lib/schema";
import { ADMIN_EMAIL, usd } from "@/lib/utils";

export const metadata = { title: "Admin" };

const date = (value: Date | null) =>
  value ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  // 404 rather than 403 so the page's existence isn't revealed.
  if (session?.user.email !== ADMIN_EMAIL || !session.user.emailVerified) notFound();

  const cost = sql<number>`coalesce(sum(${meetings.costUsd}), 0)`.mapWith(Number);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      joined: user.createdAt,
      meetings: count(meetings.id),
      seconds: sql<number>`coalesce(sum(${meetings.durationSeconds}) filter (where ${meetings.status} = 'ready'), 0)`.mapWith(Number),
      cost,
      lastMeeting: max(meetings.createdAt),
    })
    .from(user)
    .leftJoin(meetings, eq(meetings.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(cost), desc(user.createdAt));

  const totals = rows.reduce(
    (t, r) => ({ meetings: t.meetings + r.meetings, seconds: t.seconds + r.seconds, cost: t.cost + r.cost }),
    { meetings: 0, seconds: 0, cost: 0 }
  );

  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
        <header className="animate-fade-up flex flex-col gap-3">
          <p className="eyebrow">Admin</p>
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">Users &amp; usage</h1>
          <p className="text-muted-foreground font-mono text-xs tabular-nums sm:text-sm">
            {rows.length} users · {totals.meetings} meetings · {Math.round(totals.seconds / 60)} min processed ·{" "}
            {usd(totals.cost)} AI cost
          </p>
        </header>

        <div className="rule-fade mt-10 h-px sm:mt-14" />

        <div className="animate-fade-up mt-8 overflow-x-auto [animation-delay:120ms]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-muted-foreground border-border/70 border-b text-left text-xs">
                <th className="py-3 pr-4 font-medium">User</th>
                <th className="py-3 pr-4 font-medium">Joined</th>
                <th className="py-3 pr-4 text-right font-medium">Meetings</th>
                <th className="py-3 pr-4 text-right font-medium">Minutes</th>
                <th className="py-3 pr-4 text-right font-medium">AI cost</th>
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
                  <td className="py-4 pr-4 text-right font-mono tabular-nums">{usd(r.cost)}</td>
                  <td className="text-muted-foreground py-4 font-mono text-xs tabular-nums">{date(r.lastMeeting)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
