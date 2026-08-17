"use client";

import { useMemo, useState, useTransition } from "react";
import DayCheckin from "@/components/wellbeing/day-checkin";
import FilterBar from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { deleteDay } from "@/app/wellbeing/actions";
import { formatDate, stripHtml, todayInputValue } from "@/lib/format";
import type { Targets } from "@/lib/nutrition";
import { caloriesOf, isCleanDay, isLogged, proteinOf, scoreMap, scoreTone, upkeepAsOf, upkeepMap, upkeepTone, type DayRow, type WeightRow } from "@/lib/wellbeing";

const SORTS = [
  { value: "RECENT", label: "Most recent" },
  { value: "BEST", label: "Best days" },
  { value: "WORST", label: "Worst days" },
];

const FILTERS = [
  { value: "ALL", label: "All days" },
  { value: "SMOKED", label: "Smoked" },
  { value: "SMOKEFREE", label: "Smoke-free" },
  { value: "CLEAN", label: "Clean eating" },
  { value: "JUNK", label: "Junk day" },
  { value: "SHORT", label: "Short sleep" },
  { value: "DRY", label: "Under-hydrated" },
  { value: "OVERDUE", label: "Upkeep overdue" },
];

const dateKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function WellbeingBoard({ rows, targets, weights }: { rows: DayRow[]; targets: Targets; weights: WeightRow[] }) {
  const [date, setDate] = useState(() => todayInputValue());
  const [today] = useState(() => todayInputValue());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("RECENT");
  const [filter, setFilter] = useState("ALL");
  const [pending, start] = useTransition();

  const selected = rows.find((r) => dateKey(r.date) === date) ?? null;
  const history = useMemo(() => rows.filter(isLogged), [rows]);
  const scores = useMemo(() => scoreMap(history, targets), [history, targets]);
  const ups = useMemo(() => upkeepMap(history), [history]);
  const upkeepBase = useMemo(() => upkeepAsOf(history, date), [history, date]);
  const score = (r: DayRow) => scores.get(r.id) ?? 0;

  // weigh-in for the selected day, and the one before it (for the delta)
  const weightToday = weights.find((w) => dateKey(w.date) === date)?.kg ?? null;
  const prevWeight = weights.find((w) => dateKey(w.date) < date)?.kg ?? null;

  const shown = useMemo(() => {
    let out = history;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) => stripHtml(r.notes).toLowerCase().includes(q) || r.meals.some((m) => m.label.toLowerCase().includes(q)));
    }
    if (filter === "SMOKED") out = out.filter((r) => r.smokes > 0);
    if (filter === "SMOKEFREE") out = out.filter((r) => r.smokes === 0);
    if (filter === "CLEAN") out = out.filter(isCleanDay);
    if (filter === "JUNK") out = out.filter((r) => r.meals.some((m) => m.junkLevel >= 4));
    if (filter === "SHORT") out = out.filter((r) => r.sleepHours !== null && r.sleepHours < 7);
    if (filter === "DRY") out = out.filter((r) => r.waterMl < targets.waterMl);
    if (filter === "OVERDUE")
      out = out.filter((r) => {
        const u = ups.get(r.id);
        return !!u && (upkeepTone(u.roomCleaned).state === "overdue" || upkeepTone(u.beardTrimmed).state === "overdue");
      });

    const by = [...out];
    if (sort === "BEST") by.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
    else if (sort === "WORST") by.sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0));
    else by.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return by;
  }, [history, query, sort, filter, targets, scores, ups]);

  return (
    <div>
      <DayCheckin
        day={selected}
        date={date}
        onDate={setDate}
        isToday={date === today}
        targets={targets}
        weightToday={weightToday}
        prevWeight={prevWeight}
        upkeepBase={upkeepBase}
      />

      <div className="section-title mt-10 mb-4">The record</div>
      {history.length === 0 ? (
        <p className="text-sm text-ink-dim border-t border-line pt-6">
          Nothing logged yet. Every day you fill in above lands here — and the trends only get honest with time.
        </p>
      ) : (
        <>
          <FilterBar query={query} onQuery={setQuery} placeholder="Search meals & notes…" count={shown.length} total={history.length} noun="days">
            <Select className="w-40" options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter days" />
            <Select className="w-40" options={SORTS} value={sort} onChange={setSort} ariaLabel="Sort days" />
          </FilterBar>

          <div className="border-t border-line">
            {shown.map((r, i) => {
              const sc = score(r);
              const tone = scoreTone(sc);
              const note = stripHtml(r.notes);
              const isSel = dateKey(r.date) === date;
              const kcal = caloriesOf(r);
              const prot = proteinOf(r);
              return (
                <div
                  key={r.id}
                  style={{ animationDelay: `${Math.min(i * 25, 240)}ms` }}
                  className={`reveal-row group border-b border-line-soft py-3.5 ${isSel ? "bg-selected/40" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setDate(dateKey(r.date))}
                      className="w-24 shrink-0 text-left font-mono text-xs text-ink-dim hover:text-accent transition-colors"
                    >
                      {formatDate(r.date)}
                    </button>

                    <div className="w-8 shrink-0">
                      <span className="metric text-sm" style={{ color: tone }}>
                        {sc}
                      </span>
                    </div>

                    <div className="h-1 w-12 shrink-0 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${sc}%`, background: tone }} />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      <Chip on={r.brushed >= 2} dim={r.brushed === 1}>
                        🪥 {r.brushed}
                      </Chip>
                      <Chip on={r.bathed}>🚿</Chip>
                      {r.roomCleaned && <Chip on>🧹</Chip>}
                      {r.beardTrimmed && <Chip on>✂️</Chip>}
                      <Chip on={r.waterMl >= targets.waterMl} dim={r.waterMl > 0 && r.waterMl < targets.waterMl}>
                        💧 {(r.waterMl / 1000).toFixed(1)}L
                      </Chip>
                      <Chip on={r.meals.length > 0}>🍽 {r.meals.length}</Chip>
                      {kcal > 0 && <Chip on={Math.abs(kcal - targets.calories) / targets.calories <= 0.15}>{kcal} kcal</Chip>}
                      {prot > 0 && <Chip on={prot >= targets.proteinG}>{prot}g P</Chip>}
                      <Chip on={r.smokes === 0} bad={r.smokes > 0}>
                        🚬 {r.smokes}
                      </Chip>
                      {r.sleepHours !== null && <Chip on={r.sleepHours >= 7 && r.sleepHours <= 9}>😴 {r.sleepHours}h</Chip>}
                      {r.mood !== null && (
                        <Chip on={r.mood >= 60} bad={r.mood < 35}>
                          ♡ {r.mood}
                        </Chip>
                      )}
                      {note && <span className="text-xs text-ink-faint truncate max-w-[24%] hidden xl:block">{note}</span>}
                    </div>

                    <button
                      onClick={() => start(() => void deleteDay(r.id))}
                      disabled={pending}
                      aria-label="Delete day"
                      className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ on, bad, dim, children }: { on?: boolean; bad?: boolean; dim?: boolean; children: React.ReactNode }) {
  const color = bad ? "var(--bad)" : on ? "var(--good)" : dim ? "var(--warn)" : "var(--ink-faint)";
  return (
    <span
      className="text-[11px] font-mono px-1.5 py-0.5 border"
      style={{ color, borderColor: "color-mix(in srgb, currentColor 30%, transparent)", background: "color-mix(in srgb, currentColor 8%, transparent)" }}
    >
      {children}
    </span>
  );
}
