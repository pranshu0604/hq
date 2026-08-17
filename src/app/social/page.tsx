import { prisma } from "@/lib/prisma";
import { getNow, dayLabel } from "@/lib/format";
import { buildHeatmap, dayKey } from "@/lib/insights";
import { summarize, SWEEP_SIZE, PLATFORMS } from "@/lib/social";
import { ActivityHeatmap } from "@/components/insights/charts";
import PresenceTiles from "@/components/social/presence-tiles";
import SocialComposer from "@/components/social/social-composer";
import SocialLogList, { type LogDay, type LogRow } from "@/components/social/social-log-list";
import type { PlatformKey } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const logs = await prisma.socialLog.findMany({ orderBy: { createdAt: "desc" } });
  const nowMs = getNow();
  const s = summarize(logs, nowMs);

  const heat = buildHeatmap(
    logs.map((l) => l.createdAt),
    nowMs,
    27
  );

  // group the log into days, newest first
  const byDay = new Map<string, LogRow[]>();
  for (const l of logs.slice(0, 120)) {
    const k = dayKey(new Date(l.createdAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push({
      id: l.id,
      platform: l.platform as PlatformKey,
      action: l.action,
      note: l.note,
      link: l.link,
      createdAt: l.createdAt.toISOString(),
      time: l.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    });
  }
  const days: LogDay[] = [...byDay.entries()].map(([k, rows]) => ({
    label: dayLabel(new Date(`${k}T00:00:00`)),
    sweep: new Set(rows.map((r) => r.platform)).size >= SWEEP_SIZE,
    rows,
  }));

  const remaining = SWEEP_SIZE - s.platformsToday;
  const headline = s.sweep
    ? "Full sweep. All three, today."
    : s.today === 0
    ? "Were you visible today?"
    : `${remaining} platform${remaining === 1 ? "" : "s"} left for the sweep.`;

  const sub = s.sweep
    ? "This is the day that compounds. Reach is a byproduct of showing up."
    : s.today === 0
    ? "One post. One reply. One comment. Tap the platform the moment you do it — the reps are the strategy."
    : "You've broken the seal. Finish the round.";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">04 · Social</div>
        <h1 className="display text-4xl">Presence</h1>
      </div>

      {/* today — the whole point of the page */}
      <section className="card-hero p-7 mb-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="label text-accent">Today</div>
          <div className="flex items-center gap-4">
            <span className="label">
              <span className={s.streak > 0 ? "" : "opacity-40"}>🔥</span> {s.streak} day{s.streak === 1 ? "" : "s"}
            </span>
            <span className="label">{s.total} all-time</span>
          </div>
        </div>

        <h2 className="display text-3xl leading-tight">{headline}</h2>
        <p className="text-ink-dim text-sm mt-2.5 max-w-lg">{sub}</p>

        <div className="mt-6">
          <PresenceTiles counts={s.todayByPlatform} />
        </div>
      </section>

      <div className="mb-8">
        <SocialComposer />
      </div>

      {/* consistency */}
      <section className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="section-title">Consistency</div>
          <span className="label">
            {heat.activeDays} active day{heat.activeDays === 1 ? "" : "s"} · {s.sweepDays} sweep{s.sweepDays === 1 ? "" : "s"}
          </span>
        </div>
        <ActivityHeatmap data={heat} />
      </section>

      {/* all-time split */}
      <section className="card p-6 mb-4">
        <div className="section-title mb-5">By platform</div>
        <div className="grid grid-cols-3 gap-px bg-line-soft">
          {PLATFORMS.map((p) => {
            const n = logs.filter((l) => l.platform === p.key).length;
            const pct = logs.length ? Math.round((n / logs.length) * 100) : 0;
            return (
              <div key={p.key} className="bg-card px-4 py-3">
                <div className="metric text-2xl">{n}</div>
                <div className="text-[13px] text-ink-dim mt-1">{p.label}</div>
                <div className="label text-[9px] mt-0.5">{pct}% of all</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* log */}
      <section className="card p-6">
        <div className="section-title mb-5">Log</div>
        <SocialLogList days={days} />
      </section>
    </div>
  );
}
