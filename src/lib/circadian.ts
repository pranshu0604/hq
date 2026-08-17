// Circadian rhythm — the WHEN of sleep and food, judged against a healthy day.
// All times are minutes-from-local-midnight (0–1439). Pure functions only.

export type SleepKind = "NIGHT" | "NAP";
export type SleepSeg = { id: string; kind: SleepKind; startMin: number; endMin: number };
export type TimedMeal = { timeMin: number | null; label: string };

// health constants that don't depend on your schedule
export const CIRCADIAN = {
  nightHours: { min: 7, max: 9 },
  nap: { maxMin: 30, latestStart: 15 * 60 }, // ≤30 min, before 15:00
  lastMealBeforeBedMin: 180, // finish eating ≥3h before bed
  eatingWindowMaxMin: 12 * 60, // first→last meal within 12h
  breakfastWithinWakeMin: 120, // eat within 2h of waking
  tolerance: 45, // ± minutes around your usual time still counts as "on rhythm"
} as const;

export const DEFAULT_BED = 23 * 60; // 23:00
export const DEFAULT_WAKE = 7 * 60; // 07:00

const mod = (m: number) => ((m % 1440) + 1440) % 1440;
const inWin = (m: number, lo: number, hi: number) => (lo <= hi ? m >= lo && m <= hi : m >= lo || m <= hi);

// your personal rhythm — bed/wake windows plus meal windows anchored to YOUR day
// (breakfast after you wake, dinner well before you sleep), not a fixed clock.
export type Rhythm = {
  bedMin: number;
  wakeMin: number;
  bedWindow: [number, number];
  wakeWindow: [number, number];
  meals: { breakfast: [number, number]; lunch: [number, number]; dinner: [number, number] };
};

export function buildRhythm(bedMin = DEFAULT_BED, wakeMin = DEFAULT_WAKE): Rhythm {
  const tol = CIRCADIAN.tolerance;
  // continuous evening scale so "bed - 5h" works even past midnight
  const bedC = bedMin < 12 * 60 ? bedMin + 1440 : bedMin;
  const bfEnd = wakeMin + 135; // ~2h after waking
  const dinStart = bedC - 300; // ~5h before bed
  const lunchC = (bfEnd + dinStart) / 2;
  return {
    bedMin,
    wakeMin,
    bedWindow: [mod(bedMin - tol), mod(bedMin + tol)],
    wakeWindow: [mod(wakeMin - tol), mod(wakeMin + tol)],
    meals: {
      breakfast: [mod(wakeMin + 15), mod(bfEnd)],
      lunch: [mod(lunchC - 60), mod(lunchC + 60)],
      dinner: [mod(bedC - 300), mod(bedC - 150)], // 5h–2.5h before bed
    },
  };
}

// the timeline is anchored at 18:00 so a normal evening→morning runs left→right
// without wrapping: dinner · bedtime · sleep · wake · breakfast · lunch.
export const DAY_ANCHOR = 18 * 60;

export function toClock(min: number): number {
  return ((min % 1440) + 1440) % 1440;
}

/** "HH:MM" from minutes */
export function fmtTime(min: number | null): string {
  if (min === null || min === undefined) return "—";
  const m = toClock(Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** minutes from an <input type="time"> "HH:MM" string, or null */
export function parseHHMM(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** duration of a segment in minutes, wrapping across midnight */
export function segMinutes(s: { startMin: number; endMin: number }): number {
  return (((s.endMin - s.startMin) % 1440) + 1440) % 1440;
}

/** position 0–1 on the 18:00-anchored timeline */
export function anchorPos(min: number): number {
  return ((((min - DAY_ANCHOR) % 1440) + 1440) % 1440) / 1440;
}

export const nightSegs = (segs: SleepSeg[]) => segs.filter((s) => s.kind === "NIGHT");
export const napSegs = (segs: SleepSeg[]) => segs.filter((s) => s.kind === "NAP");

export const napMinutes = (segs: SleepSeg[]) => napSegs(segs).reduce((n, s) => n + segMinutes(s), 0);
export const nightMinutesFromSegs = (segs: SleepSeg[]) => nightSegs(segs).reduce((n, s) => n + segMinutes(s), 0);

/** bedtime & wake read off the night segments, ordered along the evening→morning axis */
export function bedAndWake(segs: SleepSeg[]): { bedMin: number | null; wakeMin: number | null } {
  const night = [...nightSegs(segs)].sort((a, b) => anchorPos(a.startMin) - anchorPos(b.startMin));
  if (night.length === 0) return { bedMin: null, wakeMin: null };
  return { bedMin: night[0].startMin, wakeMin: night[night.length - 1].endMin };
}

// bedtime lands late-evening or after midnight; put it on a continuous scale
// (>=1440 once past midnight) so "later" always means a bigger number.
function bedContinuous(bedMin: number): number {
  return bedMin < 12 * 60 ? bedMin + 1440 : bedMin;
}
function mealContinuous(mealMin: number): number {
  return mealMin < 6 * 60 ? mealMin + 1440 : mealMin; // a 1am snack sits after midnight
}

export type Signal = { key: string; label: string; status: "good" | "warn" | "bad" | "none"; detail: string };

/** grade a day's timing against YOUR rhythm; returns signals + a 0–100 alignment */
export function assessCircadian(segs: SleepSeg[], meals: TimedMeal[], rhythm: Rhythm = buildRhythm()): { signals: Signal[]; alignment: number | null } {
  const signals: Signal[] = [];
  const { bedMin, wakeMin } = bedAndWake(segs);
  const timed = meals.filter((m) => m.timeMin !== null) as { timeMin: number; label: string }[];
  const scored: number[] = []; // each 0..1

  // how far a time is from your usual, in minutes (shortest way round the clock)
  const offset = (a: number, b: number) => {
    const d = Math.abs(mod(a) - mod(b));
    return Math.min(d, 1440 - d);
  };

  // bedtime — judged against YOUR usual bedtime
  if (bedMin === null) {
    signals.push({ key: "bed", label: "Bedtime", status: "none", detail: "add when you went to sleep" });
  } else {
    const off = offset(bedMin, rhythm.bedMin);
    const late = bedContinuous(bedMin) > bedContinuous(rhythm.bedMin);
    const ok = off <= CIRCADIAN.tolerance;
    scored.push(ok ? 1 : Math.max(0, 1 - (off - CIRCADIAN.tolerance) / 120));
    signals.push({
      key: "bed",
      label: "Bedtime",
      status: ok ? "good" : off <= 90 ? "warn" : "bad",
      detail: `${fmtTime(bedMin)} · you usually sleep ${fmtTime(rhythm.bedMin)}${ok ? " — right on rhythm" : late ? ` — ${fmtDuration(off)} late` : ` — ${fmtDuration(off)} early`}`,
    });
  }

  // wake — judged against YOUR usual wake time
  if (wakeMin === null) {
    signals.push({ key: "wake", label: "Wake", status: "none", detail: "add when you woke up" });
  } else {
    const off = offset(wakeMin, rhythm.wakeMin);
    const ok = off <= CIRCADIAN.tolerance;
    scored.push(ok ? 1 : Math.max(0, 1 - (off - CIRCADIAN.tolerance) / 120));
    signals.push({
      key: "wake",
      label: "Wake",
      status: ok ? "good" : off <= 90 ? "warn" : "bad",
      detail: `${fmtTime(wakeMin)} · you usually wake ${fmtTime(rhythm.wakeMin)}${ok ? " — on rhythm" : ` — ${fmtDuration(off)} off`}`,
    });
  }

  // night duration
  const nightMin = nightMinutesFromSegs(segs);
  if (nightMin > 0) {
    const h = nightMin / 60;
    const ok = h >= CIRCADIAN.nightHours.min && h <= CIRCADIAN.nightHours.max;
    scored.push(ok ? 1 : Math.max(0, 1 - Math.abs(h - 8) / 4));
    signals.push({
      key: "dur",
      label: "Night sleep",
      status: ok ? "good" : h < CIRCADIAN.nightHours.min ? "bad" : "warn",
      detail: `${fmtDuration(nightMin)} across ${nightSegs(segs).length} stretch${nightSegs(segs).length === 1 ? "" : "es"} · aim ${CIRCADIAN.nightHours.min}–${CIRCADIAN.nightHours.max}h`,
    });
  }

  // nap
  const naps = napSegs(segs);
  if (naps.length) {
    const total = napMinutes(segs);
    const latest = Math.max(...naps.map((n) => n.startMin));
    const good = total <= CIRCADIAN.nap.maxMin && latest <= CIRCADIAN.nap.latestStart;
    signals.push({
      key: "nap",
      label: "Nap",
      status: good ? "good" : "warn",
      detail: `${fmtDuration(total)}${latest > CIRCADIAN.nap.latestStart ? " · late in the day" : total > CIRCADIAN.nap.maxMin ? " · long — can dent night sleep" : " · short and early, ideal"}`,
    });
  }

  // last meal before bed
  if (bedMin !== null && timed.length) {
    const lastMeal = timed.reduce((a, b) => (mealContinuous(b.timeMin) > mealContinuous(a.timeMin) ? b : a));
    const gap = bedContinuous(bedMin) - mealContinuous(lastMeal.timeMin);
    const ok = gap >= CIRCADIAN.lastMealBeforeBedMin;
    scored.push(ok ? 1 : Math.max(0, gap / CIRCADIAN.lastMealBeforeBedMin));
    signals.push({
      key: "lastmeal",
      label: "Last meal → bed",
      status: ok ? "good" : "bad",
      detail: `${fmtDuration(Math.max(0, gap))} gap (last ate ${fmtTime(lastMeal.timeMin)}) · aim ≥3h`,
    });
  }

  // eating window
  if (timed.length >= 2) {
    const cs = timed.map((m) => mealContinuous(m.timeMin));
    const window = Math.max(...cs) - Math.min(...cs);
    const ok = window <= CIRCADIAN.eatingWindowMaxMin;
    scored.push(ok ? 1 : Math.max(0, 1 - (window - CIRCADIAN.eatingWindowMaxMin) / 240));
    signals.push({
      key: "window",
      label: "Eating window",
      status: ok ? "good" : "warn",
      detail: `${fmtDuration(window)} first→last · aim ≤12h`,
    });
  }

  // breakfast timing after waking
  if (wakeMin !== null && timed.length) {
    const first = timed.reduce((a, b) => (mealContinuous(b.timeMin) < mealContinuous(a.timeMin) ? b : a));
    const after = mealContinuous(first.timeMin) - wakeMin;
    if (after >= 0) {
      const ok = after <= CIRCADIAN.breakfastWithinWakeMin;
      signals.push({
        key: "breakfast",
        label: "First meal",
        status: ok ? "good" : "warn",
        detail: `${fmtDuration(after)} after waking (${fmtTime(first.timeMin)}) · aim ≤2h`,
      });
    }
  }

  const alignment = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) : null;
  return { signals, alignment };
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** which of your meal windows a time falls in (for colouring), or null */
export function mealWindow(min: number, rhythm: Rhythm = buildRhythm()): "breakfast" | "lunch" | "dinner" | null {
  for (const [k, w] of Object.entries(rhythm.meals)) {
    if (inWin(min, w[0], w[1])) return k as "breakfast" | "lunch" | "dinner";
  }
  return null;
}
