// Wellbeing — the parts of a day you actually control: hygiene, food, water, sleep, breath, mood.
// Pure math only (callers pass nowMs + targets) so component render stays lint-pure.

import { dayKey } from "@/lib/insights";
import type { Targets } from "@/lib/nutrition";
import { nightMinutesFromSegs, napMinutes, bedAndWake, assessCircadian, buildRhythm, type SleepSeg } from "@/lib/circadian";

export const NUTRIENTS = [
  { key: "PROTEIN", label: "Protein" },
  { key: "CARBS", label: "Carbs" },
  { key: "FIBRE", label: "Fibre" },
  { key: "GREENS", label: "Greens" },
  { key: "VITAMINS", label: "Vitamins" },
  { key: "B12", label: "B12" },
  { key: "OMEGA3", label: "Omega-3" },
  { key: "IRON", label: "Iron" },
  { key: "CALCIUM", label: "Calcium" },
] as const;

// hitting this many distinct nutrients earns full credit — you don't need all of them every day
export const NUTRIENT_TARGET = 6;

export const POSTURE_LABELS = ["Slouched", "Poor", "Okay", "Good", "Upright"];

export const JUNK_LABELS = ["Clean", "Mostly fine", "A bit off", "Junk", "Proper junk", "Pure grease"];

export const IDEAL_SLEEP = { min: 7, max: 9 };

// upkeep — chores that run on a cadence, not daily. do them at least every CADENCE days.
export const UPKEEP_CADENCE = 4;
export const UPKEEP = [
  { key: "roomCleaned", label: "Room", emoji: "🧹", verb: "cleaned" },
  { key: "beardTrimmed", label: "Beard", emoji: "✂️", verb: "trimmed" },
] as const;

export type UpkeepKey = (typeof UPKEEP)[number]["key"];
/** days since each chore was last done, as of a given day. null = never done */
export type Upkeep = Record<UpkeepKey, number | null>;

export const NO_UPKEEP: Upkeep = { roomCleaned: null, beardTrimmed: null };

/** within cadence = fine. 3–4 days = due. 5+ = overdue. */
export function upkeepTone(days: number | null) {
  if (days === null) return { tone: "var(--ink-faint)", state: "never" as const };
  if (days >= UPKEEP_CADENCE + 1) return { tone: "var(--bad)", state: "overdue" as const };
  if (days >= UPKEEP_CADENCE - 1) return { tone: "var(--warn)", state: "due" as const };
  return { tone: "var(--good)", state: "fresh" as const };
}

const isOk = (days: number | null) => days !== null && days <= UPKEEP_CADENCE;

const diffDays = (a: Date, b: Date) => Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / 86400000);

/** days since each chore was last done BEFORE the given date (the date's own flags excluded) */
export function upkeepAsOf(days: DayRow[], dateISO: string): Upkeep {
  const target = dayStart(new Date(dateISO));
  const out: Upkeep = { roomCleaned: null, beardTrimmed: null };
  for (const k of UPKEEP) {
    const prior = days
      .filter((d) => d[k.key] && dayStart(new Date(d.date)) < target)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    out[k.key] = prior ? diffDays(target, new Date(prior.date)) : null;
  }
  return out;
}

/** upkeep state for every logged day, walking forward through history */
export function upkeepMap(days: DayRow[]): Map<string, Upkeep> {
  const asc = [...days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last: Record<string, Date | null> = { roomCleaned: null, beardTrimmed: null };
  const map = new Map<string, Upkeep>();
  for (const d of asc) {
    const date = new Date(d.date);
    const up: Upkeep = { roomCleaned: null, beardTrimmed: null };
    for (const k of UPKEEP) {
      if (d[k.key]) {
        up[k.key] = 0;
        last[k.key] = date;
      } else {
        up[k.key] = last[k.key] ? diffDays(date, last[k.key]!) : null;
      }
    }
    map.set(d.id, up);
  }
  return map;
}

export type MealRow = {
  id: string;
  label: string;
  junkLevel: number;
  calories: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
  sugarG: number | null;
  timeMin: number | null;
};

export type DayRow = {
  id: string;
  date: string; // ISO
  brushed: number;
  bathed: boolean;
  roomCleaned: boolean;
  beardTrimmed: boolean;
  smokes: number;
  waterMl: number;
  sleepHours: number | null;
  posture: number | null;
  mood: number | null;
  nutrients: string[];
  notes: string;
  meals: MealRow[];
  sleeps: SleepSeg[];
};

export type WeightRow = { id: string; date: string; kg: number; note: string };

/** effective night-sleep hours: from timed segments if any, else the manual fallback */
export function nightHours(d: DayRow): number | null {
  const mins = nightMinutesFromSegs(d.sleeps);
  if (mins > 0) return Math.round((mins / 60) * 10) / 10;
  return d.sleepHours;
}
export const napHours = (d: DayRow) => Math.round((napMinutes(d.sleeps) / 60) * 10) / 10;
export const bedWake = (d: DayRow) => bedAndWake(d.sleeps);

// the shape prisma hands back — one mapper, so every page reads a day the same way
type RawDay = {
  id: string;
  date: Date;
  brushed: number;
  bathed: boolean;
  roomCleaned: boolean;
  beardTrimmed: boolean;
  smokes: number;
  waterMl: number;
  sleepHours: number | null;
  posture: number | null;
  mood: number | null;
  nutrients: string;
  notes: string;
  meals: { id: string; label: string; junkLevel: number; calories: number | null; proteinG: number | null; sodiumMg: number | null; sugarG: number | null; timeMin: number | null }[];
  sleeps: { id: string; kind: string; startMin: number; endMin: number }[];
};

export function toDayRow(d: RawDay): DayRow {
  return {
    id: d.id,
    date: d.date.toISOString(),
    brushed: d.brushed,
    bathed: d.bathed,
    roomCleaned: d.roomCleaned,
    beardTrimmed: d.beardTrimmed,
    smokes: d.smokes,
    waterMl: d.waterMl,
    sleepHours: d.sleepHours,
    posture: d.posture,
    mood: d.mood,
    nutrients: parseNutrients(d.nutrients),
    notes: d.notes,
    meals: d.meals.map((m) => ({ id: m.id, label: m.label, junkLevel: m.junkLevel, calories: m.calories, proteinG: m.proteinG, sodiumMg: m.sodiumMg, sugarG: m.sugarG, timeMin: m.timeMin })),
    sleeps: d.sleeps.map((s) => ({ id: s.id, kind: s.kind === "NAP" ? "NAP" : "NIGHT", startMin: s.startMin, endMin: s.endMin })),
  };
}

export function parseNutrients(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter((x) => NUTRIENTS.some((n) => n.key === x));
}

export function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** a row only counts as "logged" once it carries at least one real signal */
export function isLogged(d: DayRow) {
  return (
    d.brushed > 0 ||
    d.bathed ||
    d.roomCleaned ||
    d.beardTrimmed ||
    d.smokes > 0 ||
    d.waterMl > 0 ||
    d.sleepHours !== null ||
    d.sleeps.length > 0 ||
    d.posture !== null ||
    d.mood !== null ||
    d.nutrients.length > 0 ||
    d.meals.length > 0 ||
    d.notes.trim().length > 0
  );
}

export const caloriesOf = (d: DayRow) => d.meals.reduce((n, m) => n + (m.calories ?? 0), 0);
export const proteinOf = (d: DayRow) => Math.round(d.meals.reduce((n, m) => n + (m.proteinG ?? 0), 0));
export const sodiumOf = (d: DayRow) => d.meals.reduce((n, m) => n + (m.sodiumMg ?? 0), 0);
export const sugarOf = (d: DayRow) => Math.round(d.meals.reduce((n, m) => n + (m.sugarG ?? 0), 0));

export function avgJunk(meals: MealRow[]): number | null {
  if (!meals.length) return null;
  return meals.reduce((n, m) => n + m.junkLevel, 0) / meals.length;
}

/** a day is "clean eating" when every meal logged was at most mildly off */
export function isCleanDay(d: DayRow) {
  return d.meals.length > 0 && d.meals.every((m) => m.junkLevel <= 1);
}

function sleepPoints(h: number | null) {
  if (h === null) return 0;
  if (h >= IDEAL_SLEEP.min && h <= IDEAL_SLEEP.max) return 15;
  const off = h < IDEAL_SLEEP.min ? IDEAL_SLEEP.min - h : h - IDEAL_SLEEP.max;
  return Math.max(0, 15 - off * 5);
}

/**
 * 0–100 "care score" — what fraction of the controllables you actually did, against YOUR targets.
 * Upkeep is scored as "not overdue", not "done today" — a chore on a 4-day cadence shouldn't
 * punish you on the three days you correctly skip it.
 */
export function careScore(d: DayRow, t: Targets, up: Upkeep = NO_UPKEEP): number {
  const hygiene = Math.min(2, d.brushed) * 5 + (d.bathed ? 10 : 0); // 20
  const upkeep = (isOk(up.roomCleaned) ? 2.5 : 0) + (isOk(up.beardTrimmed) ? 2.5 : 0); // 5
  const j = avgJunk(d.meals);
  const food = j === null ? 0 : 15 * (1 - j / 5); // 15
  const nutrients = (Math.min(NUTRIENT_TARGET, d.nutrients.length) / NUTRIENT_TARGET) * 10; // 10
  const water = Math.min(1, d.waterMl / t.waterMl) * 10; // 10
  const protein = Math.min(1, proteinOf(d) / t.proteinG) * 5; // 5
  const breath = d.smokes === 0 ? 10 : Math.max(0, 10 - d.smokes * 2.5); // 10
  const sleep = sleepPoints(nightHours(d)); // 15
  const posture = ((d.posture ?? 0) / 5) * 5; // 5
  const mood = ((d.mood ?? 0) / 100) * 5; // 5
  return Math.round(hygiene + upkeep + food + nutrients + water + protein + breath + sleep + posture + mood);
}

/** days since each chore was last done, as of today (today's own flags count as 0) */
export function currentUpkeep(days: DayRow[], nowMs: number): Upkeep {
  const today = dayStart(new Date(nowMs));
  const out: Upkeep = { roomCleaned: null, beardTrimmed: null };
  for (const k of UPKEEP) {
    const last = days
      .filter((d) => d[k.key])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    out[k.key] = last ? Math.max(0, diffDays(today, new Date(last.date))) : null;
  }
  return out;
}

/** care score for every day, with upkeep resolved from history */
export function scoreMap(days: DayRow[], t: Targets): Map<string, number> {
  const ups = upkeepMap(days);
  return new Map(days.map((d) => [d.id, careScore(d, t, ups.get(d.id) ?? NO_UPKEEP)]));
}

/** what's still missing today — drives the nudges on the check-in card */
export function gapsFor(d: DayRow, t: Targets, up: Upkeep = NO_UPKEEP): string[] {
  const gaps: string[] = [];
  if (d.brushed < 2) gaps.push(d.brushed === 0 ? "brush" : "brush again tonight");
  if (!d.bathed) gaps.push("bathe");
  for (const k of UPKEEP) if (!isOk(up[k.key])) gaps.push(`${k.verb === "cleaned" ? "clean the room" : "trim your beard"}`);
  if (!d.meals.length) gaps.push("log a meal");
  if (d.waterMl < t.waterMl) gaps.push(`${Math.round((t.waterMl - d.waterMl) / 100) / 10}L more water`);
  if (proteinOf(d) < t.proteinG) gaps.push(`${t.proteinG - proteinOf(d)}g more protein`);
  if (d.nutrients.length < NUTRIENT_TARGET) gaps.push("more nutrients");
  if (nightHours(d) === null) gaps.push("log last night's sleep");
  if (d.mood === null) gaps.push("rate how you feel");
  return gaps;
}

function streakOn(dayKeys: Set<string>, nowMs: number) {
  const walk = dayStart(new Date(nowMs));
  if (!dayKeys.has(dayKey(walk))) walk.setDate(walk.getDate() - 1); // grace: today not logged yet
  let n = 0;
  while (dayKeys.has(dayKey(walk))) {
    n++;
    walk.setDate(walk.getDate() - 1);
  }
  return n;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type WellbeingSummary = {
  today: DayRow | null;
  todayScore: number;
  logged: number;
  streak: number;
  smokeFreeStreak: number;
  smokeFreeDays: number;
  smokes7: number;
  smokesTotal: number;
  cleanDays: number;
  avgSleep7: number | null;
  avgMood7: number | null;
  avgScore7: number | null;
  avgScore30: number | null;
  bestScore: number;
  perfectHygieneStreak: number;
  nutrientCoverage: { key: string; label: string; pct: number }[];
  restedDays: number;
  // nutrition
  waterToday: number;
  avgWater7: number | null;
  avgCalories7: number | null;
  avgProtein7: number | null;
  caloriesToday: number;
  proteinToday: number;
  avgSodium7: number | null;
  avgSugar7: number | null;
  sodiumToday: number;
  sugarToday: number;
  overSodiumDays: number; // days over the sodium ceiling
  overSugarDays: number; // days over the sugar ceiling
  hydratedDays: number; // hit the water target
  hydrationStreak: number;
  proteinDays: number; // hit the protein target
  // circadian
  avgBedMin: number | null; // avg bedtime (minutes from midnight) over last 7 nights
  avgWakeMin: number | null;
  avgAlignment7: number | null; // avg circadian alignment 0–100
  napDays: number;
  todayAlignment: number | null;
  alignedDays: number; // days with alignment ≥ 75
  // upkeep
  upkeep: Upkeep;
  roomCleans: number;
  beardTrims: number;
  overdue: { key: UpkeepKey; label: string; emoji: string; days: number }[];
};

export function summarize(days: DayRow[], t: Targets, nowMs: number): WellbeingSummary {
  const logged = days.filter(isLogged);
  const scores = scoreMap(logged, t);
  const score = (d: DayRow) => scores.get(d.id) ?? 0;
  const upkeep = currentUpkeep(logged, nowMs);
  const keys = new Set(logged.map((d) => dayKey(new Date(d.date))));
  const todayK = dayKey(dayStart(new Date(nowMs)));
  const today = days.find((d) => dayKey(new Date(d.date)) === todayK) ?? null;

  const sorted = [...logged].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const last7 = sorted.filter((d) => nowMs - new Date(d.date).getTime() < 7 * 86400000);
  const last30 = sorted.slice(0, 30);

  const smokeFreeKeys = new Set(logged.filter((d) => d.smokes === 0).map((d) => dayKey(new Date(d.date))));
  const hygieneKeys = new Set(logged.filter((d) => d.brushed >= 2 && d.bathed).map((d) => dayKey(new Date(d.date))));
  const hydratedKeys = new Set(logged.filter((d) => d.waterMl >= t.waterMl).map((d) => dayKey(new Date(d.date))));

  const coverBase = last30.length || 1;
  const nutrientCoverage = NUTRIENTS.map((n) => ({
    key: n.key,
    label: n.label,
    pct: Math.round((last30.filter((d) => d.nutrients.includes(n.key)).length / coverBase) * 100),
  }));

  const sleeps7 = last7.map(nightHours).filter((h): h is number => h !== null);
  const moods7 = last7.map((d) => d.mood).filter((m): m is number => m !== null);

  // circadian: average bedtime/wake on a continuous scale so post-midnight bedtimes don't skew low
  const beds7 = last7.map((d) => bedAndWake(d.sleeps).bedMin).filter((m): m is number => m !== null).map((m) => (m < 12 * 60 ? m + 1440 : m));
  const wakes7 = last7.map((d) => bedAndWake(d.sleeps).wakeMin).filter((m): m is number => m !== null);
  const rhythm = buildRhythm(t.bedMin, t.wakeMin);
  const align7 = last7.map((d) => assessCircadian(d.sleeps, d.meals, rhythm).alignment).filter((a): a is number => a !== null);
  const avgBed = mean(beds7);
  const waters7 = last7.filter((d) => d.waterMl > 0).map((d) => d.waterMl);
  const kcal7 = last7.map(caloriesOf).filter((n) => n > 0);
  const prot7 = last7.map(proteinOf).filter((n) => n > 0);
  const sodium7 = last7.map(sodiumOf).filter((n) => n > 0);
  const sugar7 = last7.map(sugarOf).filter((n) => n > 0);

  return {
    today,
    todayScore: today ? score(today) : 0,
    logged: logged.length,
    streak: streakOn(keys, nowMs),
    smokeFreeStreak: streakOn(smokeFreeKeys, nowMs),
    smokeFreeDays: smokeFreeKeys.size,
    smokes7: last7.reduce((n, d) => n + d.smokes, 0),
    smokesTotal: logged.reduce((n, d) => n + d.smokes, 0),
    cleanDays: logged.filter(isCleanDay).length,
    avgSleep7: mean(sleeps7),
    avgMood7: mean(moods7),
    avgScore7: mean(last7.map(score)),
    avgScore30: mean(last30.map(score)),
    bestScore: logged.reduce((n, d) => Math.max(n, score(d)), 0),
    perfectHygieneStreak: streakOn(hygieneKeys, nowMs),
    nutrientCoverage,
    restedDays: logged.filter((d) => {
      const h = nightHours(d);
      return h !== null && h >= IDEAL_SLEEP.min && h <= IDEAL_SLEEP.max;
    }).length,
    waterToday: today?.waterMl ?? 0,
    avgWater7: mean(waters7),
    avgCalories7: mean(kcal7),
    avgProtein7: mean(prot7),
    caloriesToday: today ? caloriesOf(today) : 0,
    proteinToday: today ? proteinOf(today) : 0,
    avgSodium7: mean(sodium7),
    avgSugar7: mean(sugar7),
    sodiumToday: today ? sodiumOf(today) : 0,
    sugarToday: today ? sugarOf(today) : 0,
    overSodiumDays: logged.filter((d) => sodiumOf(d) > t.sodiumMg).length,
    overSugarDays: logged.filter((d) => sugarOf(d) > t.sugarG).length,
    hydratedDays: hydratedKeys.size,
    hydrationStreak: streakOn(hydratedKeys, nowMs),
    proteinDays: logged.filter((d) => proteinOf(d) >= t.proteinG).length,
    avgBedMin: avgBed === null ? null : Math.round(avgBed) % 1440,
    avgWakeMin: wakes7.length ? Math.round(mean(wakes7)!) : null,
    avgAlignment7: mean(align7),
    napDays: logged.filter((d) => napMinutes(d.sleeps) > 0).length,
    todayAlignment: today ? assessCircadian(today.sleeps, today.meals, rhythm).alignment : null,
    alignedDays: logged.filter((d) => (assessCircadian(d.sleeps, d.meals, rhythm).alignment ?? 0) >= 75).length,
    upkeep,
    roomCleans: logged.filter((d) => d.roomCleaned).length,
    beardTrims: logged.filter((d) => d.beardTrimmed).length,
    overdue: UPKEEP.filter((k) => upkeepTone(upkeep[k.key]).state === "overdue").map((k) => ({
      key: k.key,
      label: k.label,
      emoji: k.emoji,
      days: upkeep[k.key]!,
    })),
  };
}

export type Bucket = { label: string; value: number | null };

/** average a numeric field per calendar day over the last n days */
export function dailyAverages(days: DayRow[], nowMs: number, n: number, pick: (d: DayRow) => number | null): Bucket[] {
  const start = dayStart(new Date(nowMs));
  start.setDate(start.getDate() - (n - 1));
  const byKey = new Map<string, number>();
  for (const d of days) {
    const v = pick(d);
    if (v === null) continue;
    byKey.set(dayKey(new Date(d.date)), v);
  }
  return Array.from({ length: n }, (_, i) => {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    return { label: cur.toLocaleDateString("en-US", { day: "numeric", month: "short" }), value: byKey.get(dayKey(cur)) ?? null };
  });
}

/** mean-per-week over the last n Sunday-aligned weeks (unlogged days don't drag the average to zero) */
export function weeklyAverages(days: DayRow[], nowMs: number, n: number, pick: (d: DayRow) => number | null): Bucket[] {
  const today = dayStart(new Date(nowMs));
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const start = new Date(sunday);
  start.setDate(sunday.getDate() - (n - 1) * 7);
  const startMs = start.getTime();

  const sums = Array.from({ length: n }, () => [] as number[]);
  for (const d of days) {
    const v = pick(d);
    if (v === null) continue;
    const idx = Math.floor((dayStart(new Date(d.date)).getTime() - startMs) / (7 * 86400000));
    if (idx >= 0 && idx < n) sums[idx].push(v);
  }
  return sums.map((vals, i) => {
    const s = new Date(start);
    s.setDate(start.getDate() + i * 7);
    return { label: s.toLocaleDateString("en-US", { day: "numeric", month: "short" }), value: mean(vals) === null ? null : Math.round(mean(vals)! * 10) / 10 };
  });
}

/** mean-per-month over the last n calendar months */
export function monthlyAverages(days: DayRow[], nowMs: number, n: number, pick: (d: DayRow) => number | null): Bucket[] {
  const now = new Date(nowMs);
  const first = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  const sums = Array.from({ length: n }, () => [] as number[]);
  for (const d of days) {
    const v = pick(d);
    if (v === null) continue;
    const dt = new Date(d.date);
    const idx = (dt.getFullYear() - first.getFullYear()) * 12 + (dt.getMonth() - first.getMonth());
    if (idx >= 0 && idx < n) sums[idx].push(v);
  }
  return sums.map((vals, i) => {
    const m = new Date(first.getFullYear(), first.getMonth() + i, 1);
    return {
      label: m.toLocaleDateString("en-US", { month: "short" }) + (m.getMonth() === 0 ? ` '${String(m.getFullYear()).slice(2)}` : ""),
      value: mean(vals) === null ? null : Math.round(mean(vals)! * 10) / 10,
    };
  });
}

/** the three grains a report can be read at, for one metric */
export function seriesFor(days: DayRow[], nowMs: number, pick: (d: DayRow) => number | null) {
  return {
    daily: dailyAverages(days, nowMs, 30, pick),
    weekly: weeklyAverages(days, nowMs, 12, pick),
    monthly: monthlyAverages(days, nowMs, 12, pick),
  };
}

export function moodTone(mood: number) {
  if (mood >= 80) return { color: "var(--good)", word: "Flying" };
  if (mood >= 60) return { color: "var(--good)", word: "Good" };
  if (mood >= 40) return { color: "var(--warn)", word: "Okay" };
  if (mood >= 20) return { color: "var(--bad)", word: "Low" };
  return { color: "var(--bad)", word: "Rough" };
}

export function scoreTone(score: number) {
  if (score >= 80) return "var(--good)";
  if (score >= 55) return "var(--accent)";
  if (score >= 30) return "var(--warn)";
  return "var(--bad)";
}
