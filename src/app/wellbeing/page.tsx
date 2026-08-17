import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/format";
import { buildHeatmap } from "@/lib/insights";
import { getProfileState } from "@/lib/profile";
import { ActivityHeatmap, MetricBars, StatTile } from "@/components/insights/charts";
import WellbeingBoard from "@/components/wellbeing/wellbeing-board";
import ProfileCard from "@/components/wellbeing/profile-card";
import NutritionReport, { type Metric } from "@/components/wellbeing/nutrition-report";
import WeightChart from "@/components/wellbeing/weight-chart";
import { caloriesOf, dailyAverages, isLogged, proteinOf, scoreMap, seriesFor, sodiumOf, sugarOf, summarize, toDayRow, upkeepTone, UPKEEP_CADENCE, type DayRow, nightHours } from "@/lib/wellbeing";
import { assessCircadian, buildRhythm, fmtTime } from "@/lib/circadian";

export const dynamic = "force-dynamic";

export default async function WellbeingPage() {
  const nowMs = getNow();
  const [days, profile] = await Promise.all([
    prisma.healthDay.findMany({ include: { meals: { orderBy: { createdAt: "asc" } }, sleeps: true }, orderBy: { date: "desc" } }),
    getProfileState(nowMs),
  ]);

  const rows: DayRow[] = days.map(toDayRow);

  const t = profile.targets;
  const s = summarize(rows, t, nowMs);
  const logged = rows.filter(isLogged);

  const heat = buildHeatmap(logged.map((d) => new Date(d.date)), nowMs, 27);
  const sleepSeries = dailyAverages(logged, nowMs, 30, (d) => nightHours(d));
  const rhythm = buildRhythm(t.bedMin, t.wakeMin);
  const alignSeries = dailyAverages(logged, nowMs, 30, (d) => assessCircadian(d.sleeps, d.meals, rhythm).alignment);
  const moodSeries = dailyAverages(logged, nowMs, 30, (d) => d.mood);
  const scores = scoreMap(logged, t);
  const scoreSeries = dailyAverages(logged, nowMs, 30, (d) => scores.get(d.id) ?? null);
  const smokeSeries = dailyAverages(logged, nowMs, 30, (d) => d.smokes);
  const maxSmoke = Math.max(1, ...smokeSeries.map((b) => b.value ?? 0));

  // the nutrition report — one metric at a time, at whichever grain you want to read it
  const metrics: Metric[] = [
    {
      key: "water",
      label: "Water",
      unit: "L",
      target: t.waterMl,
      color: "var(--info)",
      mode: "atLeast",
      series: seriesFor(logged, nowMs, (d) => (d.waterMl > 0 ? d.waterMl : null)),
    },
    {
      key: "calories",
      label: "Calories",
      unit: " kcal",
      target: t.calories,
      color: "var(--accent)",
      mode: "band",
      series: seriesFor(logged, nowMs, (d) => (caloriesOf(d) > 0 ? caloriesOf(d) : null)),
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      target: t.proteinG,
      color: "var(--good)",
      mode: "atLeast",
      series: seriesFor(logged, nowMs, (d) => (proteinOf(d) > 0 ? proteinOf(d) : null)),
    },
    {
      key: "sodium",
      label: "Sodium",
      unit: "mg",
      target: t.sodiumMg,
      color: "var(--warn)",
      mode: "atMost",
      series: seriesFor(logged, nowMs, (d) => (sodiumOf(d) > 0 ? sodiumOf(d) : null)),
    },
    {
      key: "sugar",
      label: "Sugar",
      unit: "g",
      target: t.sugarG,
      color: "var(--bad)",
      mode: "atMost",
      series: seriesFor(logged, nowMs, (d) => (sugarOf(d) > 0 ? sugarOf(d) : null)),
    },
  ];

  const headline =
    logged.length === 0
      ? "The unglamorous stuff — brushing, bathing, eating, drinking, sleeping, breathing. Log it once and the trends do the rest."
      : s.today
      ? `Today's care score is ${s.todayScore}. ${s.streak > 1 ? `${s.streak} days logged in a row.` : "Keep it going tomorrow."}`
      : "You haven't checked in today. Takes twenty seconds.";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">10 · Wellbeing</div>
        <h1 className="display text-4xl">The body you live in</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">{headline}</p>
      </div>

      {s.smokeFreeStreak >= 3 && (
        <div className="card p-5 mb-4 flex items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--good)" }}>
          <span className="text-lg">🌬️</span>
          <div>
            <div className="text-sm text-ink">{s.smokeFreeStreak} days smoke-free.</div>
            <div className="label mt-0.5 text-good">Don&apos;t break the chain.</div>
          </div>
        </div>
      )}

      {s.overdue.length > 0 && (
        <div className="card p-5 mb-4 flex items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--bad)" }}>
          <span className="text-lg">{s.overdue[0].emoji}</span>
          <div>
            <div className="text-sm text-ink">
              {s.overdue.map((o) => `${o.label.toLowerCase()} — ${o.days} days`).join(" · ")}
            </div>
            <div className="label mt-0.5 text-bad">Overdue. You said every {UPKEEP_CADENCE - 1}–{UPKEEP_CADENCE} days.</div>
          </div>
        </div>
      )}

      {s.avgSleep7 !== null && s.avgSleep7 < 6.5 && (
        <div className="card p-5 mb-4 flex items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--warn)" }}>
          <span className="text-lg">😴</span>
          <div>
            <div className="text-sm text-ink">You&apos;re averaging {s.avgSleep7.toFixed(1)}h a night this week.</div>
            <div className="label mt-0.5 text-warn">Sleep debt compounds faster than anything else here.</div>
          </div>
        </div>
      )}

      {s.avgWater7 !== null && s.avgWater7 < t.waterMl * 0.7 && (
        <div className="card p-5 mb-4 flex items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--info)" }}>
          <span className="text-lg">💧</span>
          <div>
            <div className="text-sm text-ink">
              You&apos;re drinking {(s.avgWater7 / 1000).toFixed(1)}L a day — your target is {(t.waterMl / 1000).toFixed(1)}L.
            </div>
            <div className="label mt-0.5" style={{ color: "var(--info)" }}>
              Cheapest fix on this whole page.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatTile value={s.streak} label="Day streak" sub={s.streak ? "logged in a row" : "check in today"} accent={s.streak > 0} />
        <StatTile value={s.avgScore7 === null ? "—" : Math.round(s.avgScore7)} label="Care score" sub="7-day average" />
        <StatTile
          value={s.avgSleep7 === null ? "—" : `${s.avgSleep7.toFixed(1)}h`}
          label="Night sleep"
          sub={s.avgBedMin !== null ? `bed ~${fmtTime(s.avgBedMin)}` : "7-day average"}
          accent={s.avgSleep7 !== null && s.avgSleep7 >= 7}
        />
        <StatTile
          value={s.avgAlignment7 === null ? "—" : Math.round(s.avgAlignment7)}
          label="Circadian"
          sub={s.avgWakeMin !== null ? `wake ~${fmtTime(s.avgWakeMin)}` : "rhythm"}
          accent={s.avgAlignment7 !== null && s.avgAlignment7 >= 75}
        />
        <StatTile
          value={s.avgWater7 === null ? "—" : `${(s.avgWater7 / 1000).toFixed(1)}L`}
          label="Water"
          sub={`target ${(t.waterMl / 1000).toFixed(1)}L`}
          accent={s.avgWater7 !== null && s.avgWater7 >= t.waterMl}
        />
        <StatTile value={s.smokeFreeStreak} label="Smoke-free" sub={s.smokes7 ? `${s.smokes7} this week` : "clean week"} accent={s.smokeFreeStreak > 0} />
      </div>

      {/* upkeep — cadence chores, read as "how long since" */}
      <div className="card p-6 mb-6">
        <div className="flex items-baseline justify-between mb-5">
          <div className="section-title">Upkeep</div>
          <span className="label">every {UPKEEP_CADENCE - 1}–{UPKEEP_CADENCE} days</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            { label: "Room cleaned", emoji: "🧹", days: s.upkeep.roomCleaned, count: s.roomCleans },
            { label: "Beard trimmed", emoji: "✂️", days: s.upkeep.beardTrimmed, count: s.beardTrims },
          ].map((u) => {
            const { tone, state } = upkeepTone(u.days);
            const pct = u.days === null ? 100 : Math.min(100, (u.days / UPKEEP_CADENCE) * 100);
            return (
              <div key={u.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink">
                    {u.emoji} {u.label}
                  </span>
                  <span className="metric text-lg" style={{ color: tone }}>
                    {u.days === null ? "never" : u.days === 0 ? "today" : `${u.days}d ago`}
                  </span>
                </div>
                <div className="h-1 mt-2.5 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tone }} />
                </div>
                <div className="label mt-2" style={{ color: state === "overdue" ? "var(--bad)" : undefined }}>
                  {state === "never"
                    ? "not logged yet"
                    : state === "overdue"
                    ? "overdue"
                    : state === "due"
                    ? "due now"
                    : "fresh"}
                  {u.count > 0 && <span className="text-ink-faint"> · {u.count} logged</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <ProfileCard
          targets={t}
          profile={{
            sex: profile.sex,
            birthYear: profile.birthYear,
            heightCm: profile.heightCm,
            activity: profile.activity,
            goal: profile.goal,
            startWeightKg: profile.startWeightKg,
            weighedIn: profile.weights.length > 0,
          }}
        />
      </div>

      <WellbeingBoard rows={rows} targets={t} weights={profile.weights} />

      {logged.length > 0 && (
        <div className="mt-12 space-y-4">
          <div className="section-title">Nutrition report</div>
          <div className="card p-6">
            <NutritionReport metrics={metrics} />
          </div>

          <div className="section-title pt-4">Trends</div>

          <WeightChart weights={profile.weights} targets={t} />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="label">Sleep · last 30 days</div>
                <span className="label text-ink-faint/70 normal-case">7–9h band</span>
              </div>
              <MetricBars buckets={sleepSeries} max={12} unit="h" color="var(--info)" band={{ from: 7, to: 9 }} />
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="label">Circadian alignment · last 30 days</div>
                <span className="label text-ink-faint/70 normal-case">
                  {s.avgBedMin !== null && s.avgWakeMin !== null ? `~${fmtTime(s.avgBedMin)} → ${fmtTime(s.avgWakeMin)}` : "how your timing fits a healthy day"}
                </span>
              </div>
              <MetricBars buckets={alignSeries} max={100} color="var(--good)" />
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="label">Mood · last 30 days</div>
                <span className="label text-ink-faint/70 normal-case">
                  {s.avgMood7 === null ? "not rated" : `${Math.round(s.avgMood7)} avg this week`}
                </span>
              </div>
              <MetricBars buckets={moodSeries} max={100} color="var(--violet)" />
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="label">Care score · last 30 days</div>
                <span className="label text-ink-faint/70 normal-case">best {s.bestScore}</span>
              </div>
              <MetricBars buckets={scoreSeries} max={100} color="var(--accent)" />
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="label">Cigarettes · last 30 days</div>
                <span className="label text-ink-faint/70 normal-case">{s.smokesTotal} all-time</span>
              </div>
              <MetricBars buckets={smokeSeries} max={maxSmoke} color="var(--bad)" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-baseline justify-between mb-5">
              <div className="section-title">Nutrient coverage</div>
              <span className="label">share of your last {Math.min(30, logged.length)} logged days</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {s.nutrientCoverage.map((n) => (
                <div key={n.key} className="flex items-center gap-3">
                  <div className="w-20 text-[13px] text-ink-dim">{n.label}</div>
                  <div className="flex-1 track">
                    <span style={{ width: `${n.pct}%`, background: n.pct >= 60 ? "var(--good)" : n.pct >= 30 ? "var(--accent)" : "var(--warn)" }} />
                  </div>
                  <div className="metric text-xs w-9 text-right text-ink-dim">{n.pct}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Consistency</div>
              <span className="label">
                {s.logged} day{s.logged === 1 ? "" : "s"} logged · {s.hydratedDays} hydrated · {s.restedDays} well-rested
              </span>
            </div>
            <ActivityHeatmap data={heat} />
          </div>
        </div>
      )}
    </div>
  );
}
