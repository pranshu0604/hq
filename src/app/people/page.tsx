import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/format";
import { dailyBuckets, weeklyBuckets, monthlyBuckets } from "@/lib/insights";
import { computeReachOut, sociability, type RangeKey, type RangeStat, type TopConnection } from "@/lib/people";
import PeopleBoard, { type PeopleRow } from "@/components/people/people-board";
import ConnectionAnalytics from "@/components/people/connection-analytics";
import ReachOutCard from "@/components/people/reach-out-card";
import ActivityGraph from "@/components/insights/activity-graph";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await prisma.person.findMany({
    include: { interactions: { select: { personId: true, date: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const nowMs = getNow();

  const startToday = new Date(nowMs);
  startToday.setHours(0, 0, 0, 0);
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - startToday.getDay());
  const startMonth = new Date(startToday.getFullYear(), startToday.getMonth(), 1);
  const startYear = new Date(startToday.getFullYear(), 0, 1);
  const starts: Record<RangeKey, Date> = { today: startToday, week: startWeek, month: startMonth, year: startYear, all: new Date(0) };

  const meta = new Map(people.map((p) => [p.id, { name: p.name, relation: p.relation }]));
  const allInteractions = people.flatMap((p) => p.interactions);

  const ranges = {} as Record<RangeKey, RangeStat>;
  for (const key of Object.keys(starts) as RangeKey[]) {
    const start = starts[key].getTime();
    const inRange = allInteractions.filter((i) => new Date(i.date).getTime() >= start);
    const counts = new Map<string, number>();
    for (const i of inRange) counts.set(i.personId, (counts.get(i.personId) ?? 0) + 1);
    const top: TopConnection[] = [...counts.entries()]
      .map(([id, count]) => ({ id, name: meta.get(id)?.name ?? "—", relation: meta.get(id)?.relation ?? "", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    ranges[key] = { total: inRange.length, people: counts.size, top };
  }

  const social = sociability(ranges.week.total);

  const rows: PeopleRow[] = people
    .map((p) => {
      const dates = p.interactions.map((i) => new Date(i.date).getTime());
      const last = dates.length ? Math.max(...dates) : null;
      return {
        id: p.id,
        name: p.name,
        relation: p.relation,
        handle: p.handle,
        total: p.interactions.length,
        lastISO: last ? new Date(last).toISOString() : null,
        connectedToday: dates.some((d) => d >= startToday.getTime()),
      };
    })
    .sort((a, b) => (b.lastISO ? new Date(b.lastISO).getTime() : 0) - (a.lastISO ? new Date(a.lastISO).getTime() : 0));

  const reachOut = computeReachOut(people, nowMs);
  const trackedCount = people.filter((p) => p.reminderDays && p.reminderDays > 0).length;

  const interactionDates = allInteractions.map((i) => i.date);
  const connSeries = {
    daily: dailyBuckets(interactionDates, nowMs, 30),
    weekly: weeklyBuckets(interactionDates, nowMs, 12),
    monthly: monthlyBuckets(interactionDates, nowMs, 12),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">08 · People</div>
        <h1 className="display text-4xl">Relationships</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">
          The people worth keeping close. Mark who you connected with — and let the app remind you who you&apos;ve been neglecting.
        </p>
      </div>

      {(reachOut.length > 0 || trackedCount > 0) && <ReachOutCard reachOut={reachOut} trackedCount={trackedCount} />}

      <ConnectionAnalytics ranges={ranges} sociability={social} weekTotal={ranges.week.total} weekPeople={ranges.week.people} />

      <div className="card p-6 my-4">
        <ActivityGraph series={connSeries} title="Connections over time" unit="touchpoint" />
      </div>

      <PeopleBoard rows={rows} />
    </div>
  );
}
