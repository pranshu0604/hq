import { prisma } from "@/lib/prisma";
import { buildHeatmap, weeklyBuckets, dailyBuckets, monthlyBuckets } from "@/lib/insights";
import { getNow } from "@/lib/format";
import { ActivityHeatmap, WeekBars, StatusBar, Ring, StatTile, MetricBars } from "@/components/insights/charts";
import ActivityGraph from "@/components/insights/activity-graph";
import AchievementsGrid from "@/components/game/achievements-grid";
import { getGameState } from "@/lib/gamification";
import { summarize, PLATFORMS } from "@/lib/social";
import { WORK_BUCKETS } from "@/lib/work";
import { caloriesOf, dailyAverages, isCleanDay, isLogged, nightHours, proteinOf, seriesFor, sodiumOf, sugarOf, summarize as summarizeHealth, type DayRow, scoreMap, toDayRow } from "@/lib/wellbeing";
import { getProfileState } from "@/lib/profile";
import NutritionReport, { type Metric } from "@/components/wellbeing/nutrition-report";
import WeightChart from "@/components/wellbeing/weight-chart";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [applications, projects, notes, todos, socialLogs, quotes, workouts, interactions, workItems, reflections, people, companies, healthRaw] = await Promise.all([
    prisma.application.findMany({ include: { platforms: { include: { emails: true } }, interviews: true } }),
    prisma.project.findMany({ include: { tasks: true } }),
    prisma.note.findMany(),
    prisma.todo.findMany(),
    prisma.socialLog.findMany({ select: { platform: true, createdAt: true } }),
    prisma.quote.findMany({ select: { createdAt: true, favorite: true } }),
    prisma.workout.findMany({ select: { date: true } }),
    prisma.interaction.findMany({ select: { date: true } }),
    prisma.workItem.findMany({ select: { createdAt: true, bucket: true } }),
    prisma.reflection.findMany({ select: { createdAt: true } }),
    prisma.person.findMany({ select: { createdAt: true } }),
    prisma.company.findMany({ select: { active: true } }),
    prisma.healthDay.findMany({ include: { meals: { select: { id: true, label: true, junkLevel: true, calories: true, proteinG: true, sodiumMg: true, sugarG: true, timeMin: true } }, sleeps: true }, orderBy: { date: "desc" } }),
  ]);

  const game = await getGameState();
  const nowMs = getNow();

  const profile = await getProfileState(nowMs);
  const T = profile.targets;
  const healthDays: DayRow[] = healthRaw.map(toDayRow);
  const loggedDays = healthDays.filter(isLogged);
  const health = summarizeHealth(healthDays, T, nowMs);
  const nutritionMetrics: Metric[] = [
    { key: "water", label: "Water", unit: "L", target: T.waterMl, color: "var(--info)", mode: "atLeast", series: seriesFor(loggedDays, nowMs, (d) => (d.waterMl > 0 ? d.waterMl : null)) },
    { key: "calories", label: "Calories", unit: " kcal", target: T.calories, color: "var(--accent)", mode: "band", series: seriesFor(loggedDays, nowMs, (d) => (caloriesOf(d) > 0 ? caloriesOf(d) : null)) },
    { key: "protein", label: "Protein", unit: "g", target: T.proteinG, color: "var(--good)", mode: "atLeast", series: seriesFor(loggedDays, nowMs, (d) => (proteinOf(d) > 0 ? proteinOf(d) : null)) },
    { key: "sodium", label: "Sodium", unit: "mg", target: T.sodiumMg, color: "var(--warn)", mode: "atMost", series: seriesFor(loggedDays, nowMs, (d) => (sodiumOf(d) > 0 ? sodiumOf(d) : null)) },
    { key: "sugar", label: "Sugar", unit: "g", target: T.sugarG, color: "var(--bad)", mode: "atMost", series: seriesFor(loggedDays, nowMs, (d) => (sugarOf(d) > 0 ? sugarOf(d) : null)) },
  ];
  const careScores = scoreMap(loggedDays, T);
  const careSeries = dailyAverages(loggedDays, nowMs, 30, (d) => careScores.get(d.id) ?? null);
  const sleepSeries = dailyAverages(loggedDays, nowMs, 30, (d) => nightHours(d));
  const moodSeries = dailyAverages(loggedDays, nowMs, 30, (d) => d.mood);
  const smokeSeries = dailyAverages(loggedDays, nowMs, 30, (d) => d.smokes);
  const maxSmoke = Math.max(1, ...smokeSeries.map((b) => b.value ?? 0));
  const foodSegments = [
    { label: "Clean", value: loggedDays.filter(isCleanDay).length, color: "var(--good)" },
    { label: "Mixed", value: loggedDays.filter((d) => d.meals.length > 0 && !isCleanDay(d) && !d.meals.some((m) => m.junkLevel >= 4)).length, color: "var(--warn)" },
    { label: "Junk", value: loggedDays.filter((d) => d.meals.some((m) => m.junkLevel >= 4)).length, color: "var(--bad)" },
  ];

  const events: Date[] = [
    ...applications.map((a) => a.createdAt),
    ...applications.flatMap((a) => a.platforms.map((p) => p.appliedOn)),
    ...applications.flatMap((a) => a.platforms.flatMap((p) => p.emails.map((e) => e.sentOn))),
    ...applications.flatMap((a) => a.interviews.map((iv) => iv.createdAt)),
    ...projects.map((p) => p.createdAt),
    ...projects.flatMap((p) => p.tasks.map((t) => t.createdAt)),
    ...notes.map((n) => n.createdAt),
    ...todos.map((t) => t.createdAt),
    ...socialLogs.map((s) => s.createdAt),
    ...quotes.map((q) => q.createdAt),
    ...workouts.map((w) => w.date),
    ...interactions.map((i) => i.date),
    ...workItems.map((w) => w.createdAt),
    ...loggedDays.map((d) => new Date(d.date)),
  ];

  const heat = buildHeatmap(events, nowMs);
  const appWeekly = weeklyBuckets(applications.filter((a) => a.status !== "PENDING").map((a) => a.submittedAt ?? a.createdAt), nowMs, 12);
  const socialWeekly = weeklyBuckets(socialLogs.map((s) => s.createdAt), nowMs, 12);
  const social = summarize(socialLogs, nowMs);

  const socialSegments = PLATFORMS.map((p, i) => ({
    label: p.label,
    value: socialLogs.filter((s) => s.platform === p.key).length,
    color: ["var(--accent)", "var(--info)", "var(--violet)"][i],
  }));

  const S = (k: string) => applications.filter((a) => a.status === k).length;
  const appSegments = [
    { label: "Parked", value: S("PENDING"), color: "var(--accent)" },
    { label: "Applied", value: S("APPLIED"), color: "var(--info)" },
    { label: "Response", value: S("RESPONSE"), color: "var(--warn)" },
    { label: "Interviewing", value: S("INTERVIEWING"), color: "var(--violet)" },
    { label: "Offer", value: S("OFFER"), color: "var(--good)" },
    { label: "Closed", value: S("REJECTED") + S("WITHDRAWN"), color: "var(--ink-faint)" },
  ];

  const PS = (k: string) => projects.filter((p) => p.status === k).length;
  const projSegments = [
    { label: "Idea", value: PS("IDEA"), color: "var(--info)" },
    { label: "Planning", value: PS("PLANNING"), color: "var(--warn)" },
    { label: "Building", value: PS("BUILDING"), color: "var(--accent)" },
    { label: "Shipped", value: PS("SHIPPED"), color: "var(--good)" },
    { label: "Abandoned", value: PS("ABANDONED"), color: "var(--ink-faint)" },
  ];

  const sentApps = applications.filter((a) => a.status !== "PENDING");
  const responded = sentApps.filter(
    (a) => a.platforms.some((p) => p.responseReceived) || ["RESPONSE", "INTERVIEWING", "OFFER"].includes(a.status)
  ).length;
  const responseRate = sentApps.length ? Math.round((responded / sentApps.length) * 100) : null;

  const emailCount = applications.reduce((n, a) => n + a.platforms.reduce((m, p) => m + p.emails.length, 0), 0);
  const interviewCount = applications.reduce((n, a) => n + a.interviews.length, 0);

  const taskTotal = projects.reduce((n, p) => n + p.tasks.length, 0);
  const taskDone = projects.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0);
  const todoDone = todos.filter((t) => t.done).length;

  const workoutHeat = buildHeatmap(workouts.map((w) => w.date), nowMs, 27);
  const connSeries = {
    daily: dailyBuckets(interactions.map((i) => i.date), nowMs, 30),
    weekly: weeklyBuckets(interactions.map((i) => i.date), nowMs, 12),
    monthly: monthlyBuckets(interactions.map((i) => i.date), nowMs, 12),
  };
  const WB = (k: string) => workItems.filter((w) => w.bucket === k).length;
  const workSegments = WORK_BUCKETS.map((b) => ({ label: b.label, value: WB(b.key), color: b.color }));
  const favoriteQuotes = quotes.filter((q) => q.favorite).length;

  const hasData = events.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">12 · Insights</div>
        <h1 className="display text-4xl">Progress &amp; Momentum</h1>
        <p className="mt-3 text-[15px] text-ink-dim">
          {hasData
            ? "Every application, email and task you log builds the picture below."
            : "This fills in as you use HQ — log an application or a task and your momentum starts showing here."}
        </p>
      </div>

      {/* stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatTile value={heat.currentStreak} label="Day streak" sub={heat.currentStreak ? "keep it alive" : "log something today"} accent={heat.currentStreak > 0} />
        <StatTile value={heat.longestStreak} label="Longest streak" />
        <StatTile value={applications.filter((a) => a.status !== "PENDING").length} label="Applications" sub={S("PENDING") ? `${S("PENDING")} parked` : undefined} />
        <StatTile value={emailCount} label="Outreach emails" />
        <StatTile value={interviewCount} label="Interviews" />
        <StatTile value={social.total} label="Social posts" sub={social.streak ? `${social.streak}-day presence` : "be visible today"} accent={social.streak > 0} />
      </div>

      {/* everything else at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatTile value={reflections.length} label="Reflections" />
        <StatTile value={quotes.length} label="Quotes" sub={favoriteQuotes ? `${favoriteQuotes} favorite${favoriteQuotes === 1 ? "" : "s"}` : undefined} />
        <StatTile value={workouts.length} label="Workouts" sub={workoutHeat.currentStreak ? `${workoutHeat.currentStreak}-day streak` : "train today"} accent={workoutHeat.currentStreak > 0} />
        <StatTile value={people.length} label="People" />
        <StatTile value={companies.length} label="Companies" />
        <StatTile value={workItems.length} label="Work items" sub={`${WB("DONE")} done`} />
      </div>

      {/* wellbeing at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatTile value={health.logged} label="Days logged" sub={health.streak ? `${health.streak}-day streak` : "check in today"} accent={health.streak > 0} />
        <StatTile value={health.avgScore30 === null ? "—" : Math.round(health.avgScore30)} label="Care score" sub="30-day average" />
        <StatTile value={health.avgSleep7 === null ? "—" : `${health.avgSleep7.toFixed(1)}h`} label="Slept" sub="7-day average" accent={health.avgSleep7 !== null && health.avgSleep7 >= 7} />
        <StatTile value={health.avgMood7 === null ? "—" : Math.round(health.avgMood7)} label="Mood" sub="7-day average" />
        <StatTile value={health.smokeFreeStreak} label="Smoke-free" sub={health.smokes7 ? `${health.smokes7} cigs this week` : "clean week"} accent={health.smokeFreeStreak > 0} />
        <StatTile
          value={health.avgWater7 === null ? "—" : `${(health.avgWater7 / 1000).toFixed(1)}L`}
          label="Water"
          sub={`target ${(T.waterMl / 1000).toFixed(1)}L`}
          accent={health.avgWater7 !== null && health.avgWater7 >= T.waterMl}
        />
      </div>

      {/* activity heatmap */}
      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="section-title">Activity</div>
          <span className="label">
            {heat.totalEvents} action{heat.totalEvents === 1 ? "" : "s"} · {heat.activeDays} active day{heat.activeDays === 1 ? "" : "s"}
          </span>
        </div>
        <ActivityHeatmap data={heat} />
      </div>

      {/* per-section progress */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Applications</div>
              <span className="label">response rate {responseRate === null ? "—" : `${responseRate}%`}</span>
            </div>
            <div className="mb-6">
              <div className="label mb-3">Added per week · last 12</div>
              <WeekBars buckets={appWeekly} />
            </div>
            <div>
              <div className="label mb-3">Pipeline</div>
              <StatusBar segments={appSegments} />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Social presence</div>
              <span className="label">
                {social.sweepDays} full sweep{social.sweepDays === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mb-6">
              <div className="label mb-3">Interactions per week · last 12</div>
              <WeekBars buckets={socialWeekly} />
            </div>
            <div>
              <div className="label mb-3">Where you show up</div>
              <StatusBar segments={socialSegments} />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="card p-6">
            <div className="section-title mb-5">Projects</div>
            <Ring value={taskDone} total={taskTotal} caption="tasks completed" />
            <div className="mt-6">
              <StatusBar segments={projSegments} />
            </div>
          </div>

          <div className="card p-6">
            <div className="section-title mb-5">Todos</div>
            <Ring value={todoDone} total={todos.length} caption="todos done" />
          </div>
        </div>
      </div>

      {/* work + relationships */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Work</div>
              <span className="label">
                {companies.filter((c) => c.active).length} active · {WB("DONE")} shipped
              </span>
            </div>
            <StatusBar segments={workSegments} />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Training</div>
              <span className="label">{workoutHeat.currentStreak}-day streak</span>
            </div>
            <ActivityHeatmap data={workoutHeat} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="card p-6">
            <ActivityGraph series={connSeries} title="People connected with" unit="touchpoint" />
          </div>
        </div>
      </div>

      {/* nutrition — read it daily, weekly or monthly */}
      <div className="card p-6 mt-4">
        <div className="flex items-baseline justify-between mb-5">
          <div className="section-title">Nutrition</div>
          <span className="label">
            {T.calories.toLocaleString()} kcal · {T.proteinG}g protein · {(T.waterMl / 1000).toFixed(1)}L · ≤{T.sodiumMg}mg sodium · ≤{T.sugarG}g sugar
          </span>
        </div>
        <NutritionReport metrics={nutritionMetrics} />
      </div>

      <div className="mt-4">
        <WeightChart weights={profile.weights} targets={T} />
      </div>

      {/* wellbeing */}
      <div className="grid grid-cols-12 gap-4 mt-4">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Care score</div>
              <span className="label">last 30 days · best {health.bestScore}</span>
            </div>
            <MetricBars buckets={careSeries} max={100} color="var(--accent)" />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Sleep</div>
              <span className="label">7–9h band · {health.restedDays} well-rested nights</span>
            </div>
            <MetricBars buckets={sleepSeries} max={12} unit="h" color="var(--info)" band={{ from: 7, to: 9 }} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Mood</div>
              <span className="label">{health.avgMood7 === null ? "not rated" : `${Math.round(health.avgMood7)} avg this week`}</span>
            </div>
            <MetricBars buckets={moodSeries} max={100} color="var(--violet)" />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Cigarettes</div>
              <span className="label">{health.smokesTotal} all-time</span>
            </div>
            <MetricBars buckets={smokeSeries} max={maxSmoke} color="var(--bad)" />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="card p-6 h-full">
            <div className="section-title mb-5">How you ate</div>
            <StatusBar segments={foodSegments} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="card p-6 h-full">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Nutrient coverage</div>
              <span className="label">last 30 logged days</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {health.nutrientCoverage.map((n) => (
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
        </div>
      </div>

      <div className="card p-6 mt-4">
        <AchievementsGrid achievements={game.achievements} />
      </div>
    </div>
  );
}
