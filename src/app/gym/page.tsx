import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/format";
import { buildHeatmap } from "@/lib/insights";
import { MUSCLE_GROUPS, parseGroups } from "@/lib/gym";
import { ActivityHeatmap, StatTile } from "@/components/insights/charts";
import GymLog, { type WorkoutRow } from "@/components/gym/gym-log";

export const dynamic = "force-dynamic";

export default async function GymPage() {
  const workouts = await prisma.workout.findMany({ orderBy: { date: "desc" } });
  const nowMs = getNow();

  const rows: WorkoutRow[] = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    groups: parseGroups(w.groups),
    notes: w.notes,
    durationMin: w.durationMin,
  }));

  const heat = buildHeatmap(workouts.map((w) => w.date), nowMs, 27);

  const startWeek = new Date(nowMs);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  startWeek.setHours(0, 0, 0, 0);
  const startMonth = new Date(nowMs);
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const thisWeek = workouts.filter((w) => w.date >= startWeek).length;
  const thisMonth = workouts.filter((w) => w.date >= startMonth).length;

  // per-group frequency
  const freq = new Map<string, number>();
  for (const w of workouts) for (const g of parseGroups(w.groups)) freq.set(g, (freq.get(g) ?? 0) + 1);
  const groupBars = MUSCLE_GROUPS.map((g) => ({ group: g, count: freq.get(g) ?? 0 })).filter((b) => b.count > 0);
  const maxFreq = Math.max(1, ...groupBars.map((b) => b.count));
  const topGroup = [...groupBars].sort((a, b) => b.count - a.count)[0];

  const lastDate = workouts[0]?.date ?? null;
  const daysSince = lastDate ? Math.floor((nowMs - lastDate.getTime()) / 86400000) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">09 · Gym</div>
        <h1 className="display text-4xl">Training</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">
          {workouts.length === 0
            ? "Did you train today? Log it — the graph below is the only motivation that doesn't lie."
            : daysSince === 0
            ? "Logged today. That's the whole game — show up, mark it, repeat."
            : `${daysSince} day${daysSince === 1 ? "" : "s"} since your last session${daysSince && daysSince >= 2 ? " — time to move." : "."}`}
        </p>
      </div>

      {workouts.length > 0 && daysSince !== null && daysSince >= 3 && (
        <div className="card p-5 mb-4 flex items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--warn)" }}>
          <span className="text-lg">🏋️</span>
          <div>
            <div className="text-sm text-ink">It&apos;s been {daysSince} days since your last session.</div>
            <div className="label mt-0.5 text-warn">More than two days off — time to get back under the bar.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatTile value={heat.currentStreak} label="Day streak" sub={heat.currentStreak ? "keep it alive" : "train today"} accent={heat.currentStreak > 0} />
        <StatTile value={thisWeek} label="This week" />
        <StatTile value={thisMonth} label="This month" />
        <StatTile value={workouts.length} label="All-time sessions" />
      </div>

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="section-title">Consistency</div>
          {topGroup && <span className="label">most trained · {topGroup.group.toLowerCase()}</span>}
        </div>
        <ActivityHeatmap data={heat} />
      </div>

      {groupBars.length > 0 && (
        <div className="card p-6 mb-4">
          <div className="section-title mb-5">Muscle split</div>
          <div className="space-y-3">
            {groupBars
              .sort((a, b) => b.count - a.count)
              .map((b) => (
                <div key={b.group} className="flex items-center gap-4">
                  <div className="w-24 text-[13px] text-ink-dim">{b.group}</div>
                  <div className="flex-1 track">
                    <span style={{ width: `${(b.count / maxFreq) * 100}%` }} />
                  </div>
                  <div className="metric text-sm w-6 text-right">{b.count}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      <GymLog rows={rows} />
    </div>
  );
}
