// pure date-math for the activity heatmap + streaks (no wall-clock read here;
// callers pass nowMs so component render stays lint-pure)

export function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function level(c: number) {
  if (c <= 0) return 0;
  if (c <= 1) return 1;
  if (c <= 3) return 2;
  if (c <= 5) return 3;
  return 4;
}

export type HeatCell = { key: string; count: number; level: number; inFuture: boolean; label: string };
export type HeatColumn = { days: HeatCell[]; month: string };

export type Heatmap = {
  columns: HeatColumn[];
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalEvents: number;
};

// events: any timestamps that count as "activity" on their day
export function buildHeatmap(events: (Date | string)[], nowMs: number, weeksCount = 53): Heatmap {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKey(new Date(e));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const sundayThisWeek = new Date(today);
  sundayThisWeek.setDate(today.getDate() - today.getDay());
  const start = new Date(sundayThisWeek);
  start.setDate(sundayThisWeek.getDate() - (weeksCount - 1) * 7);

  const columns: HeatColumn[] = [];
  const cursor = new Date(start);
  let prevMonth = -1;

  for (let w = 0; w < weeksCount; w++) {
    const days: HeatCell[] = [];
    let monthLabel = "";
    for (let d = 0; d < 7; d++) {
      const inFuture = cursor.getTime() > today.getTime();
      const key = dayKey(cursor);
      const count = inFuture ? 0 : counts.get(key) ?? 0;
      if (d === 0) {
        const m = cursor.getMonth();
        if (m !== prevMonth && cursor.getDate() <= 7) {
          monthLabel = cursor.toLocaleString("en-US", { month: "short" });
          prevMonth = m;
        }
      }
      days.push({
        key,
        count,
        level: level(count),
        inFuture,
        label: cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push({ days, month: monthLabel });
  }

  // streaks
  const active = (k: string) => (counts.get(k) ?? 0) > 0;
  let currentStreak = 0;
  const walk = new Date(today);
  if (!active(dayKey(walk))) walk.setDate(walk.getDate() - 1); // grace: today not yet logged
  while (active(dayKey(walk))) {
    currentStreak++;
    walk.setDate(walk.getDate() - 1);
  }

  let longestStreak = 0;
  let run = 0;
  const scan = new Date(start);
  while (scan.getTime() <= today.getTime()) {
    if (active(dayKey(scan))) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
    scan.setDate(scan.getDate() + 1);
  }

  let totalEvents = 0;
  let activeDays = 0;
  for (const [, c] of counts) {
    totalEvents += c;
    if (c > 0) activeDays++;
  }

  return { columns, currentStreak, longestStreak, activeDays, totalEvents };
}

// bucket dates into the last n calendar days
export function dailyBuckets(dates: (Date | string)[], nowMs: number, n = 30) {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (n - 1));

  const buckets = Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { start: d, count: 0, label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }) };
  });
  const startMs = start.getTime();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (t < startMs) continue;
    const idx = Math.floor((t - startMs) / 86400000);
    if (idx >= 0 && idx < n) buckets[idx].count++;
  }
  return buckets;
}

// bucket dates into the last n calendar months
export function monthlyBuckets(dates: (Date | string)[], nowMs: number, n = 12) {
  const now = new Date(nowMs);
  const buckets = Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1) + i, 1);
    return { start: d, count: 0, label: d.toLocaleDateString("en-US", { month: "short" }) + (d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(2)}` : "") };
  });
  const index = (d: Date) => (d.getFullYear() - buckets[0].start.getFullYear()) * 12 + (d.getMonth() - buckets[0].start.getMonth());
  for (const raw of dates) {
    const d = new Date(raw);
    const idx = index(d);
    if (idx >= 0 && idx < n) buckets[idx].count++;
  }
  return buckets;
}

// bucket dates into the last n Sunday-aligned weeks
export function weeklyBuckets(dates: (Date | string)[], nowMs: number, n = 12) {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const start = new Date(sunday);
  start.setDate(sunday.getDate() - (n - 1) * 7);

  const buckets = Array.from({ length: n }, (_, i) => {
    const s = new Date(start);
    s.setDate(start.getDate() + i * 7);
    return { start: s, count: 0, label: s.toLocaleDateString("en-US", { day: "numeric", month: "short" }) };
  });

  const startMs = start.getTime();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (t < startMs) continue;
    const idx = Math.floor((t - startMs) / (7 * 86400000));
    if (idx >= 0 && idx < n) buckets[idx].count++;
  }
  return buckets;
}
