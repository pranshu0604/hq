"use client";

import {
  anchorPos,
  buildRhythm,
  fmtTime,
  mealWindow,
  type Rhythm,
  type Signal,
  type SleepSeg,
  type TimedMeal,
} from "@/lib/circadian";

// a segment can straddle the 18:00 anchor; return the 1–2 rects it occupies
function rects(startMin: number, endMin: number): { left: number; width: number }[] {
  const a = anchorPos(startMin);
  const b = anchorPos(endMin);
  if (b >= a) return [{ left: a, width: Math.max(0.004, b - a) }];
  return [
    { left: a, width: 1 - a },
    { left: 0, width: b },
  ];
}

// hour ticks along the 18:00→18:00 axis
const TICKS = [18, 21, 0, 3, 6, 9, 12, 15].map((h) => ({ h, pos: anchorPos(h * 60) }));

const STATUS_COLOR: Record<Signal["status"], string> = {
  good: "var(--good)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  none: "var(--ink-faint)",
};

export default function CircadianCard({
  sleeps,
  meals,
  signals,
  alignment,
  rhythm = buildRhythm(),
}: {
  sleeps: SleepSeg[];
  meals: TimedMeal[];
  signals: Signal[];
  alignment: number | null;
  rhythm?: Rhythm;
}) {
  const timedMeals = meals.filter((m) => m.timeMin !== null) as { timeMin: number; label: string }[];
  const hasAny = sleeps.length > 0 || timedMeals.length > 0;

  // your windows on the axis
  const idealSleep = rects(rhythm.bedMin, rhythm.wakeMin)[0];
  const idealMeals = Object.values(rhythm.meals).map((w) => rects(w[0], w[1])[0]);

  return (
    <div>
      {alignment !== null && (
        <div className="flex items-center gap-3 mb-4">
          <span className="metric text-2xl" style={{ color: alignment >= 75 ? "var(--good)" : alignment >= 50 ? "var(--warn)" : "var(--bad)" }}>
            {alignment}
          </span>
          <span className="label">/ 100 aligned with a healthy rhythm</span>
        </div>
      )}

      {/* 24h timeline, 6pm → 6pm so a normal night runs left-to-right */}
      <div className="relative h-16 rounded-md overflow-hidden mb-1" style={{ background: "var(--card-3)" }}>
        {/* ideal sleep band */}
        <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${idealSleep.left * 100}%`, width: `${idealSleep.width * 100}%`, background: "color-mix(in srgb, var(--good) 12%, transparent)" }} />
        {/* ideal meal windows — subtle ticks at the top */}
        {idealMeals.map((w, i) => (
          <div key={i} className="absolute top-0 h-1.5 pointer-events-none" style={{ left: `${w.left * 100}%`, width: `${w.width * 100}%`, background: "color-mix(in srgb, var(--accent) 45%, transparent)" }} />
        ))}

        {/* your sleep segments */}
        {sleeps.flatMap((s, si) =>
          rects(s.startMin, s.endMin).map((r, ri) => (
            <div
              key={`${si}-${ri}`}
              title={`${s.kind === "NAP" ? "Nap" : "Sleep"} ${fmtTime(s.startMin)}–${fmtTime(s.endMin)}`}
              className="absolute rounded-sm"
              style={{
                left: `${r.left * 100}%`,
                width: `${r.width * 100}%`,
                top: s.kind === "NAP" ? "50%" : "28%",
                height: s.kind === "NAP" ? "34%" : "44%",
                background: s.kind === "NAP" ? "var(--accent)" : "var(--info)",
                opacity: 0.9,
              }}
            />
          ))
        )}

        {/* meals as ticks */}
        {timedMeals.map((m, i) => {
          const inWindow = mealWindow(m.timeMin, rhythm) !== null;
          return (
            <div
              key={i}
              title={`${m.label || "Meal"} · ${fmtTime(m.timeMin)}`}
              className="absolute bottom-0 w-[2px] h-full"
              style={{ left: `${anchorPos(m.timeMin) * 100}%`, background: inWindow ? "var(--good)" : "var(--warn)" }}
            >
              <span className="absolute -top-0.5 -translate-x-1/2 text-[8px]" style={{ color: inWindow ? "var(--good)" : "var(--warn)" }}>
                ●
              </span>
            </div>
          );
        })}
      </div>

      {/* axis labels */}
      <div className="relative h-3 mb-4 text-[9px] text-ink-faint">
        {TICKS.map((t) => (
          <span key={t.h} className="absolute -translate-x-1/2 font-mono" style={{ left: `${t.pos * 100}%` }}>
            {String(t.h).padStart(2, "0")}
          </span>
        ))}
      </div>

      {!hasAny ? (
        <p className="text-[13px] text-ink-dim">Log your bed/wake times and put a time on your meals — this fills in with how your day compares to a healthy circadian rhythm.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 label text-[9px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "var(--info)" }} /> sleep
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} /> nap
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: "color-mix(in srgb, var(--good) 40%, transparent)" }} /> your usual sleep
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--good)" }} /> meal
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {signals.filter((s) => s.status !== "none").map((s) => (
              <div key={s.key} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[s.status] }} />
                <div className="min-w-0">
                  <span className="text-ink">{s.label}</span>
                  <span className="text-ink-faint"> — {s.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
