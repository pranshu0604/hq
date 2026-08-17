"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { addMeal, deleteMeal, logWeight, saveDay, saveSleepSegments, suggestMeals, updateMeal, type DayPatch, type MealSuggestion } from "@/app/wellbeing/actions";
import {
  bedWake,
  caloriesOf,
  careScore,
  gapsFor,
  JUNK_LABELS,
  moodTone,
  napHours,
  nightHours,
  NUTRIENTS,
  NUTRIENT_TARGET,
  POSTURE_LABELS,
  proteinOf,
  sodiumOf,
  sugarOf,
  scoreTone,
  UPKEEP,
  UPKEEP_CADENCE,
  upkeepTone,
  type DayRow,
  type MealRow,
  type Upkeep,
} from "@/lib/wellbeing";
import { calorieTone, GLASS_ML, type Targets } from "@/lib/nutrition";
import { assessCircadian, buildRhythm, fmtDuration, fmtTime, parseHHMM, segMinutes, type SleepSeg } from "@/lib/circadian";
import { saveProfile } from "@/app/wellbeing/actions";
import CircadianCard from "@/components/wellbeing/circadian-card";

const RichEditor = dynamic(() => import("@/components/notes/rich-editor"), { ssr: false });

const EMPTY = (date: string): DayRow => ({
  id: "",
  date,
  brushed: 0,
  bathed: false,
  roomCleaned: false,
  beardTrimmed: false,
  smokes: 0,
  waterMl: 0,
  sleepHours: null,
  posture: null,
  mood: null,
  nutrients: [],
  notes: "",
  meals: [],
  sleeps: [],
});

export default function DayCheckin(props: {
  day: DayRow | null;
  date: string;
  onDate: (d: string) => void;
  isToday: boolean;
  targets: Targets;
  weightToday: number | null;
  prevWeight: number | null;
  /** days since each chore was last done BEFORE this date — the draft's own toggles override it */
  upkeepBase: Upkeep;
}) {
  return <Form key={props.date} {...props} initial={props.day ?? EMPTY(props.date)} serverMeals={props.day?.meals ?? []} />;
}

function Form({
  initial,
  date,
  onDate,
  isToday,
  targets,
  serverMeals,
  weightToday,
  prevWeight,
  upkeepBase,
}: {
  initial: DayRow;
  date: string;
  onDate: (d: string) => void;
  isToday: boolean;
  targets: Targets;
  serverMeals: DayRow["meals"];
  weightToday: number | null;
  prevWeight: number | null;
  upkeepBase: Upkeep;
}) {
  // local draft is the source of truth while you're editing; the server is written through
  const [d, setD] = useState<DayRow>(initial);
  const [, start] = useTransition();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // meals live on the server (they need ids); everything else is drafted locally
  const day: DayRow = { ...d, meals: serverMeals };
  // ticking a chore today resets its clock to 0 — otherwise it's however long it's been
  const upkeep: Upkeep = {
    roomCleaned: d.roomCleaned ? 0 : upkeepBase.roomCleaned,
    beardTrimmed: d.beardTrimmed ? 0 : upkeepBase.beardTrimmed,
  };
  const score = careScore(day, targets, upkeep);
  const gaps = gapsFor(day, targets, upkeep);
  const tone = scoreTone(score);

  const push = (patch: DayPatch, debounceKey?: string) => {
    const fire = () => start(() => void saveDay(date, patch));
    if (!debounceKey) return fire();
    clearTimeout(timers.current[debounceKey]);
    timers.current[debounceKey] = setTimeout(fire, 550);
  };

  const set = (patch: Partial<DayRow>, wire: DayPatch, debounceKey?: string) => {
    setD((cur) => ({ ...cur, ...patch }));
    push(wire, debounceKey);
  };

  const toggleNutrient = (k: string) => {
    const next = d.nutrients.includes(k) ? d.nutrients.filter((x) => x !== k) : [...d.nutrients, k];
    set({ nutrients: next }, { nutrients: next });
  };

  const setWater = (ml: number) => {
    const v = Math.max(0, Math.min(15000, ml));
    set({ waterMl: v }, { waterMl: v });
  };

  // sleep segments write through their own action (wholesale replace), debounced
  const setSleeps = (segs: SleepSeg[]) => {
    setD((cur) => ({ ...cur, sleeps: segs }));
    clearTimeout(timers.current.sleeps);
    timers.current.sleeps = setTimeout(
      () => start(() => void saveSleepSegments(date, segs.map((s) => ({ kind: s.kind, startMin: s.startMin, endMin: s.endMin })))),
      600
    );
  };

  const nh = nightHours(day);
  const nap = napHours(day);
  const { bedMin, wakeMin } = bedWake(day);
  const sleepHint =
    nh === null && nap === 0
      ? "when did you sleep & wake?"
      : [nh !== null ? fmtDuration(Math.round(nh * 60)) + " night" : null, bedMin !== null ? `bed ${fmtTime(bedMin)}` : null, wakeMin !== null ? `woke ${fmtTime(wakeMin)}` : null, nap > 0 ? `${fmtDuration(Math.round(nap * 60))} nap` : null]
          .filter(Boolean)
          .join(" · ");
  const rhythm = buildRhythm(targets.bedMin, targets.wakeMin);
  const circadian = assessCircadian(day.sleeps, day.meals, rhythm);

  const mood = d.mood ?? 50;
  const mt = moodTone(mood);

  const kcal = caloriesOf(day);
  const protein = proteinOf(day);
  const sodium = sodiumOf(day);
  const sugar = sugarOf(day);
  const glassTarget = Math.ceil(targets.waterMl / GLASS_ML);
  const glassesHad = Math.floor(d.waterMl / GLASS_ML);
  const waterPct = Math.min(100, (d.waterMl / targets.waterMl) * 100);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start justify-between gap-6 p-6 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="display text-2xl">{isToday ? "Today" : "That day"}</h2>
            <input type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} className="field-input w-auto py-1 text-xs" />
          </div>
          <p className="mt-2 text-[13px] text-ink-dim max-w-md">
            {score === 0
              ? "Nothing logged yet. Start anywhere — brushing counts."
              : gaps.length === 0
              ? "Everything's ticked. That's a day you looked after yourself."
              : `Still open — ${gaps.slice(0, 3).join(", ")}.`}
          </p>
        </div>
        <ScoreDial score={score} tone={tone} />
      </header>

      {/* hygiene */}
      <Block label="Hygiene">
        <div className="flex flex-wrap items-center gap-2">
          <Pill on={d.brushed >= 1} onClick={() => set({ brushed: d.brushed >= 1 ? 0 : 1 }, { brushed: d.brushed >= 1 ? 0 : 1 })}>
            ☀️ Brushed — morning
          </Pill>
          <Pill on={d.brushed >= 2} onClick={() => set({ brushed: d.brushed >= 2 ? 1 : 2 }, { brushed: d.brushed >= 2 ? 1 : 2 })}>
            🌙 Brushed — night
          </Pill>
          <span className="w-px h-6 bg-line-soft mx-1 hidden sm:block" />
          <Pill on={d.bathed} onClick={() => set({ bathed: !d.bathed }, { bathed: !d.bathed })}>
            🚿 Bathed
          </Pill>
        </div>
      </Block>

      {/* upkeep — every 3–4 days, not daily */}
      <Block label="Upkeep" hint={`every ${UPKEEP_CADENCE - 1}–${UPKEEP_CADENCE} days`}>
        <div className="flex flex-wrap gap-2">
          {UPKEEP.map((k) => {
            const on = d[k.key];
            const since = upkeep[k.key];
            const { tone: ut, state } = upkeepTone(since);
            return (
              <button
                key={k.key}
                onClick={() => set({ [k.key]: !on } as Partial<DayRow>, { [k.key]: !on })}
                className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] border transition-all"
                style={{
                  borderColor: on ? "var(--accent)" : state === "overdue" ? "var(--bad)" : "var(--line)",
                  background: on ? "var(--selected)" : "transparent",
                  color: on ? "var(--accent)" : "var(--ink-dim)",
                  fontWeight: on ? 500 : 400,
                }}
              >
                <span>
                  {k.emoji} {on ? `${k.label} ${k.verb}` : k.label}
                </span>
                <span className="font-mono text-[10px]" style={{ color: on ? "var(--accent)" : ut }}>
                  {since === null ? "never" : since === 0 ? "today" : `${since}d`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="label mt-2.5">
          {UPKEEP.filter((k) => upkeepTone(upkeep[k.key]).state === "overdue").length > 0 ? (
            <span className="text-bad">Overdue — knock it out today.</span>
          ) : (
            "Scored as 'not overdue', so skipping the in-between days costs you nothing."
          )}
        </div>
      </Block>

      {/* water */}
      <Block label="Water" hint={`${(d.waterMl / 1000).toFixed(2)} of ${(targets.waterMl / 1000).toFixed(1)} L · ${glassesHad}/${glassTarget} glasses`}>
        <div className="flex flex-wrap items-center gap-1">
          {Array.from({ length: glassTarget }, (_, i) => {
            const filled = glassesHad > i;
            return (
              <button
                key={i}
                aria-label={`${i + 1} glasses`}
                title={`${((i + 1) * GLASS_ML) / 1000} L`}
                onClick={() => setWater(filled && glassesHad === i + 1 ? i * GLASS_ML : (i + 1) * GLASS_ML)}
                className="relative h-9 w-6 border-b-2 transition-colors"
                style={{
                  borderColor: filled ? "var(--info)" : "var(--line)",
                  borderLeft: `1px solid ${filled ? "var(--info)" : "var(--line)"}`,
                  borderRight: `1px solid ${filled ? "var(--info)" : "var(--line)"}`,
                  background: filled ? "color-mix(in srgb, var(--info) 22%, transparent)" : "transparent",
                }}
              />
            );
          })}
          <div className="flex items-center gap-1.5 ml-3">
            <Step onClick={() => setWater(d.waterMl - GLASS_ML)} disabled={d.waterMl === 0}>
              −
            </Step>
            <Step onClick={() => setWater(d.waterMl + GLASS_ML)}>+</Step>
            <span className="metric text-lg ml-1.5" style={{ color: d.waterMl >= targets.waterMl ? "var(--good)" : "var(--info)" }}>
              {(d.waterMl / 1000).toFixed(2)}L
            </span>
          </div>
        </div>
        <div className="h-1 mt-3.5 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${waterPct}%`, background: d.waterMl >= targets.waterMl ? "var(--good)" : "var(--info)" }}
          />
        </div>
        <div className="label mt-2">
          {d.waterMl >= targets.waterMl
            ? "target hit — nicely done"
            : `${((targets.waterMl - d.waterMl) / 1000).toFixed(2)}L to go · target is 35ml per kg of you`}
        </div>
      </Block>

      {/* food */}
      <Block label="Food" hint={day.meals.length ? `${day.meals.length} meal${day.meals.length === 1 ? "" : "s"}` : "how many times, and how junk"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <Gauge
            label="Calories"
            value={kcal}
            target={targets.calories}
            unit=" kcal"
            color={calorieTone(kcal, targets.calories)}
            hint={kcal === 0 ? "not counted" : kcal > targets.calories ? `${kcal - targets.calories} over` : `${targets.calories - kcal} left`}
          />
          <Gauge
            label="Protein"
            value={protein}
            target={targets.proteinG}
            unit="g"
            color={protein >= targets.proteinG ? "var(--good)" : "var(--accent)"}
            hint={protein >= targets.proteinG ? "target hit" : `${targets.proteinG - protein}g left`}
          />
          <Gauge
            label="Sodium"
            value={sodium}
            target={targets.sodiumMg}
            unit="mg"
            ceiling
            color={sodium === 0 ? "var(--ink-faint)" : sodium <= targets.sodiumMg ? "var(--good)" : "var(--bad)"}
            hint={sodium === 0 ? "not counted" : sodium <= targets.sodiumMg ? `${targets.sodiumMg - sodium}mg headroom` : `${sodium - targets.sodiumMg}mg over`}
          />
          <Gauge
            label="Sugar"
            value={sugar}
            target={targets.sugarG}
            unit="g"
            ceiling
            color={sugar === 0 ? "var(--ink-faint)" : sugar <= targets.sugarG ? "var(--good)" : "var(--bad)"}
            hint={sugar === 0 ? "not counted" : sugar <= targets.sugarG ? `${targets.sugarG - sugar}g headroom` : `${sugar - targets.sugarG}g over`}
          />
        </div>
        <Meals date={date} meals={day.meals} />
      </Block>

      {/* nutrients */}
      <Block label="Nutrients" hint={`${d.nutrients.length}/${NUTRIENT_TARGET} for full credit`}>
        <div className="flex flex-wrap gap-1.5">
          {NUTRIENTS.map((n) => {
            const on = d.nutrients.includes(n.key);
            return (
              <button
                key={n.key}
                onClick={() => toggleNutrient(n.key)}
                className={`px-2.5 py-1 text-[12px] border transition-colors ${
                  on ? "border-good text-good bg-good/10 font-medium" : "border-line text-ink-faint hover:text-ink hover:border-line-strong"
                }`}
              >
                {on ? "✓ " : ""}
                {n.label}
              </button>
            );
          })}
        </div>
      </Block>

      {/* sleep — timed segments, so bed/wake/duration and the circadian read come for free */}
      <Block label="Sleep" hint={sleepHint}>
        <SleepEditor
          segs={d.sleeps}
          manualHours={d.sleepHours}
          onSegs={setSleeps}
          onManual={(v) => set({ sleepHours: v }, { sleepHours: v }, "sleep")}
        />
      </Block>

      {/* circadian rhythm — how your timing lines up with YOUR usual day */}
      <Block label="Circadian rhythm" hint={circadian.alignment !== null ? `${circadian.alignment}/100 aligned` : "add sleep & meal times"}>
        <RhythmSetting bedMin={targets.bedMin} wakeMin={targets.wakeMin} />
        <CircadianCard sleeps={d.sleeps} meals={day.meals} signals={circadian.signals} alignment={circadian.alignment} rhythm={rhythm} />
      </Block>

      {/* body */}
      <Block label="Body">
        <div className="grid sm:grid-cols-3 gap-6">
          <WeighIn date={date} weight={weightToday} prev={prevWeight} targets={targets} />

          <div>
            <div className="label mb-2.5">Posture</div>
            <div className="flex gap-1">
              {POSTURE_LABELS.map((lbl, i) => {
                const v = i + 1;
                const on = (d.posture ?? 0) >= v;
                return (
                  <button
                    key={lbl}
                    title={lbl}
                    onClick={() => set({ posture: d.posture === v ? null : v }, { posture: d.posture === v ? null : v })}
                    className="flex-1 h-7 border transition-colors"
                    style={{
                      background: on ? "var(--accent)" : "transparent",
                      borderColor: on ? "var(--accent)" : "var(--line)",
                      opacity: on ? 0.35 + v * 0.13 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div className="label mt-2">{d.posture ? POSTURE_LABELS[d.posture - 1].toLowerCase() : "not rated"}</div>
          </div>

          <div>
            <div className="label mb-2.5">Cigarettes</div>
            <div className="flex items-center gap-2">
              <Step onClick={() => set({ smokes: Math.max(0, d.smokes - 1) }, { smokes: Math.max(0, d.smokes - 1) })} disabled={d.smokes === 0}>
                −
              </Step>
              <span className={`metric text-2xl w-8 text-center ${d.smokes === 0 ? "text-good" : "text-bad"}`}>{d.smokes}</span>
              <Step onClick={() => set({ smokes: d.smokes + 1 }, { smokes: d.smokes + 1 })}>+</Step>
            </div>
            <div className={`label mt-2 ${d.smokes === 0 ? "text-good" : ""}`}>{d.smokes === 0 ? "smoke-free" : "logged honestly"}</div>
          </div>
        </div>
      </Block>

      {/* mind */}
      <Block label="Mind" hint={d.mood === null ? "1–100" : `${mood} · ${mt.word.toLowerCase()}`}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={100}
            value={mood}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ mood: v }, { mood: v }, "mood");
            }}
            className="flex-1 h-1 appearance-none rounded-full outline-none"
            style={{ background: `linear-gradient(90deg, ${mt.color} ${mood}%, var(--card-3) ${mood}%)`, accentColor: mt.color }}
          />
          <div className="w-16 text-right">
            <div className="metric text-2xl" style={{ color: d.mood === null ? "var(--ink-faint)" : mt.color }}>
              {d.mood === null ? "—" : mood}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <RichEditor
            initialHTML={initial.notes}
            onChange={(html) => set({ notes: html }, { notes: html }, "notes")}
            placeholder="How was the day, really? Type @ to link anything, paste an image…"
          />
        </div>
      </Block>
    </section>
  );
}

function WeighIn({ date, weight, prev, targets }: { date: string; weight: number | null; prev: number | null; targets: Targets }) {
  const [value, setValue] = useState(weight === null ? "" : String(weight));
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = (v: string) => {
    setValue(v);
    const n = Number(v);
    if (!v || Number.isNaN(n) || n < 20) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => start(() => void logWeight(date, n)), 700);
  };

  const delta = weight !== null && prev !== null ? Math.round((weight - prev) * 10) / 10 : null;

  return (
    <div>
      <div className="label mb-2.5">Weigh-in</div>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number"
          step="0.1"
          min="20"
          max="400"
          inputMode="decimal"
          value={value}
          placeholder="—"
          onChange={(e) => commit(e.target.value)}
          className="field-input w-20 text-center metric"
        />
        <span className="text-ink-faint text-sm">kg</span>
      </div>
      <div className="label mt-2">
        {weight === null ? (
          "not weighed"
        ) : (
          <span style={{ color: targets.bmiTone }}>
            BMI {targets.bmi} · {targets.bmiLabel.toLowerCase()}
            {delta !== null && delta !== 0 && (
              <span className="text-ink-faint">
                {" "}
                · {delta > 0 ? "+" : ""}
                {delta}kg
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function Gauge({
  label,
  value,
  target,
  unit,
  color,
  hint,
  ceiling,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  hint: string;
  ceiling?: boolean; // target is a max to stay under, not a goal to reach
}) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="label">{label}</span>
        <span className="label text-ink-faint/70 normal-case tracking-normal">{hint}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="metric text-xl" style={{ color: value ? color : "var(--ink-faint)" }}>
          {value || "—"}
        </span>
        <span className="text-ink-faint text-xs">
          {ceiling ? "≤ " : "/ "}
          {target}
          {unit}
        </span>
      </div>
      <div className="h-1 mt-2 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function MealItem({ meal }: { meal: MealRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    label: meal.label,
    junk: meal.junkLevel,
    kcal: meal.calories?.toString() ?? "",
    prot: meal.proteinG?.toString() ?? "",
    sodium: meal.sodiumMg?.toString() ?? "",
    sugar: meal.sugarG?.toString() ?? "",
    time: meal.timeMin !== null ? fmtTime(meal.timeMin) : "",
  });

  const save = () => {
    if (pending) return;
    start(() =>
      void updateMeal(meal.id, {
        label: f.label,
        junkLevel: f.junk,
        calories: f.kcal ? Number(f.kcal) : null,
        proteinG: f.prot ? Number(f.prot) : null,
        sodiumMg: f.sodium ? Number(f.sodium) : null,
        sugarG: f.sugar ? Number(f.sugar) : null,
        timeMin: f.time ? parseHHMM(f.time) : null,
      })
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-3 border-b border-line-soft">
        <input
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
          placeholder="What did you eat?"
          className="field-input w-full mb-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className="field-input w-auto" aria-label="Time eaten" />
          <input value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" placeholder="kcal" className="field-input w-20" />
          <input value={f.prot} onChange={(e) => setF({ ...f, prot: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" placeholder="prot g" className="field-input w-20" />
          <input value={f.sodium} onChange={(e) => setF({ ...f, sodium: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" placeholder="sod mg" className="field-input w-20" />
          <input value={f.sugar} onChange={(e) => setF({ ...f, sugar: e.target.value.replace(/[^0-9.]/g, "") })} inputMode="decimal" placeholder="sug g" className="field-input w-20" />
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                title={JUNK_LABELS[v]}
                onClick={() => setF({ ...f, junk: v })}
                className="h-7 w-6 text-[11px] font-mono border transition-colors"
                style={{
                  background: v <= f.junk && f.junk > 0 ? (f.junk >= 4 ? "var(--bad)" : "var(--warn)") : v === 0 && f.junk === 0 ? "var(--good)" : "transparent",
                  borderColor: v <= f.junk ? "transparent" : "var(--line)",
                  color: v <= f.junk ? "var(--accent-ink)" : "var(--ink-faint)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={save} disabled={pending} className="btn btn-primary text-[13px]">
            {pending ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn text-[13px]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 border-b border-line-soft">
      {meal.timeMin !== null && <span className="font-mono text-xs text-ink-dim w-12 shrink-0">{fmtTime(meal.timeMin)}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{meal.label || "Meal"}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="label" style={{ color: meal.junkLevel <= 1 ? "var(--good)" : meal.junkLevel >= 4 ? "var(--bad)" : "var(--warn)" }}>
            {JUNK_LABELS[meal.junkLevel]}
          </span>
          {meal.calories !== null && <span className="label text-ink-faint">{meal.calories} kcal</span>}
          {meal.proteinG !== null && <span className="label text-ink-faint">{meal.proteinG}g protein</span>}
          {meal.sodiumMg !== null && <span className="label text-ink-faint">{meal.sodiumMg}mg sodium</span>}
          {meal.sugarG !== null && <span className="label text-ink-faint">{meal.sugarG}g sugar</span>}
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit meal"
        className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
      >
        edit
      </button>
      <button
        onClick={() => start(() => void deleteMeal(meal.id))}
        disabled={pending}
        aria-label="Remove meal"
        className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

function Meals({ date, meals }: { date: string; meals: DayRow["meals"] }) {
  const [label, setLabel] = useState("");
  const [junk, setJunk] = useState(0);
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [sodium, setSodium] = useState("");
  const [sugar, setSugar] = useState("");
  const [time, setTime] = useState("");
  const [pending, start] = useTransition();

  // autocomplete against foods logged before
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const labelBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSug) return;
    const onDoc = (e: MouseEvent) => {
      if (labelBox.current && !labelBox.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showSug]);

  const onLabel = (v: string) => {
    setLabel(v);
    clearTimeout(sugTimer.current);
    if (!v.trim()) {
      setSuggestions([]);
      setShowSug(false);
      return;
    }
    sugTimer.current = setTimeout(async () => {
      const res = await suggestMeals(v);
      setSuggestions(res);
      setShowSug(res.length > 0);
    }, 200);
  };

  const pick = (s: MealSuggestion) => {
    setLabel(s.label);
    setJunk(s.junkLevel);
    setKcal(s.calories?.toString() ?? "");
    setProt(s.proteinG?.toString() ?? "");
    setSodium(s.sodiumMg?.toString() ?? "");
    setSugar(s.sugarG?.toString() ?? "");
    setShowSug(false);
  };

  const submit = () => {
    if (pending || !label.trim()) return;
    start(() =>
      void addMeal(date, {
        label,
        junkLevel: junk,
        calories: kcal ? Number(kcal) : null,
        proteinG: prot ? Number(prot) : null,
        sodiumMg: sodium ? Number(sodium) : null,
        sugarG: sugar ? Number(sugar) : null,
        timeMin: time ? parseHHMM(time) : null,
      })
    );
    setLabel("");
    setJunk(0);
    setKcal("");
    setProt("");
    setSodium("");
    setSugar("");
    setTime("");
    setShowSug(false);
  };

  return (
    <div>
      {meals.length > 0 && (
        <div className="border-t border-line-soft mb-4">
          {meals.map((m) => (
            <MealItem key={m.id} meal={m} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div ref={labelBox} className="relative flex-1 min-w-[160px]">
          <input
            value={label}
            onChange={(e) => onLabel(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSug(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") setShowSug(false);
            }}
            placeholder="What did you eat?"
            className="field-input w-full"
            autoComplete="off"
          />
          {showSug && (
            <div className="elevated absolute left-0 top-full mt-1 w-full min-w-[240px] rounded-lg border border-line bg-card p-1 z-30 origin-top animate-[pop-in_0.12s_ease] max-h-64 overflow-y-auto">
              {suggestions.map((s) => {
                const bits = [
                  s.calories !== null ? `${s.calories} kcal` : null,
                  s.proteinG !== null ? `${s.proteinG}g P` : null,
                  s.sodiumMg !== null ? `${s.sodiumMg}mg Na` : null,
                  s.sugarG !== null ? `${s.sugarG}g sug` : null,
                ].filter(Boolean);
                return (
                  <button
                    key={s.label}
                    onClick={() => pick(s)}
                    className="w-full text-left rounded-md px-2.5 py-1.5 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-ink truncate flex-1">{s.label}</span>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.junkLevel <= 1 ? "var(--good)" : s.junkLevel >= 4 ? "var(--bad)" : "var(--warn)" }} title={JUNK_LABELS[s.junkLevel]} />
                    </div>
                    {bits.length > 0 && <div className="label text-[10px] mt-0.5 normal-case tracking-normal text-ink-faint">{bits.join(" · ")}</div>}
                  </button>
                );
              })}
              <div className="label text-[9px] px-2.5 pt-1 pb-0.5 text-ink-faint/70">from foods you&apos;ve logged · fills the macros</div>
            </div>
          )}
        </div>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field-input w-auto" aria-label="Time eaten" title="When did you eat?" />
        <input
          value={kcal}
          onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric"
          placeholder="kcal"
          className="field-input w-20"
        />
        <input
          value={prot}
          onChange={(e) => setProt(e.target.value.replace(/[^0-9.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="decimal"
          placeholder="prot g"
          className="field-input w-20"
        />
        <input
          value={sodium}
          onChange={(e) => setSodium(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="numeric"
          placeholder="sod mg"
          className="field-input w-20"
        />
        <input
          value={sugar}
          onChange={(e) => setSugar(e.target.value.replace(/[^0-9.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          inputMode="decimal"
          placeholder="sug g"
          className="field-input w-20"
        />
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              title={JUNK_LABELS[v]}
              onClick={() => setJunk(v)}
              className="h-7 w-6 text-[11px] font-mono border transition-colors"
              style={{
                background: v <= junk && junk > 0 ? (junk >= 4 ? "var(--bad)" : "var(--warn)") : v === 0 && junk === 0 ? "var(--good)" : "transparent",
                borderColor: v <= junk ? "transparent" : "var(--line)",
                color: v <= junk ? "var(--accent-ink)" : "var(--ink-faint)",
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <button onClick={submit} disabled={pending} className="btn btn-primary">
          {pending ? "Adding…" : "Add meal"}
        </button>
      </div>
      <div className="label mt-2">junk: 0 = clean · 5 = pure grease — time, calories, protein, sodium and sugar are all optional</div>
    </div>
  );
}

// asked right where the comparison happens — set your usual sleep/wake once,
// update it whenever your schedule shifts, and the whole card re-judges against it.
function RhythmSetting({ bedMin, wakeMin }: { bedMin: number; wakeMin: number }) {
  const [, start] = useTransition();
  const [bed, setBed] = useState(fmtTime(bedMin));
  const [wake, setWake] = useState(fmtTime(wakeMin));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = (b: string, w: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sb = parseHHMM(b);
      const sw = parseHHMM(w);
      if (sb !== null && sw !== null) start(() => void saveProfile({ sleepTargetMin: sb, wakeTargetMin: sw }));
    }, 600);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-line-soft">
      <span className="label">I usually sleep at</span>
      <input
        type="time"
        value={bed}
        onChange={(e) => {
          setBed(e.target.value);
          save(e.target.value, wake);
        }}
        className="field-input w-auto"
        aria-label="Usual bedtime"
      />
      <span className="label">and wake at</span>
      <input
        type="time"
        value={wake}
        onChange={(e) => {
          setWake(e.target.value);
          save(bed, e.target.value);
        }}
        className="field-input w-auto"
        aria-label="Usual wake time"
      />
      <span className="label text-ink-faint/70 normal-case tracking-normal">— everything below is judged against this. Changed? Just update it.</span>
    </div>
  );
}

function SleepEditor({
  segs,
  manualHours,
  onSegs,
  onManual,
}: {
  segs: SleepSeg[];
  manualHours: number | null;
  onSegs: (s: SleepSeg[]) => void;
  onManual: (v: number | null) => void;
}) {
  const idc = useRef(0);
  const add = (kind: "NIGHT" | "NAP") => {
    const def = kind === "NIGHT" ? { startMin: 23 * 60, endMin: 7 * 60 } : { startMin: 14 * 60, endMin: 14 * 60 + 30 };
    onSegs([...segs, { id: `tmp-${idc.current++}`, kind, ...def }]);
  };
  const patch = (i: number, p: Partial<SleepSeg>) => onSegs(segs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const remove = (i: number) => onSegs(segs.filter((_, j) => j !== i));

  return (
    <div>
      {segs.length > 0 && (
        <div className="space-y-2 mb-3">
          {segs.map((s, i) => {
            const dur = segMinutes(s);
            const night = s.kind === "NIGHT";
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => patch(i, { kind: night ? "NAP" : "NIGHT" })}
                  className="px-2.5 py-1.5 border text-[12px] transition-colors shrink-0"
                  style={{
                    borderColor: night ? "var(--info)" : "var(--accent)",
                    color: night ? "var(--info)" : "var(--accent)",
                    background: night ? "color-mix(in srgb, var(--info) 10%, transparent)" : "var(--selected)",
                  }}
                  title="Tap to switch night / nap"
                >
                  {night ? "🌙 Night" : "☀️ Nap"}
                </button>
                <input
                  type="time"
                  value={fmtTime(s.startMin)}
                  onChange={(e) => {
                    const m = parseHHMM(e.target.value);
                    if (m !== null) patch(i, { startMin: m });
                  }}
                  className="field-input w-auto"
                  aria-label="From"
                />
                <span className="text-ink-faint">→</span>
                <input
                  type="time"
                  value={fmtTime(s.endMin)}
                  onChange={(e) => {
                    const m = parseHHMM(e.target.value);
                    if (m !== null) patch(i, { endMin: m });
                  }}
                  className="field-input w-auto"
                  aria-label="To"
                />
                <span className="metric text-sm" style={{ color: night ? "var(--info)" : "var(--accent)" }}>
                  {fmtDuration(dur)}
                </span>
                <button onClick={() => remove(i)} aria-label="Remove" className="text-ink-faint hover:text-bad transition-colors ml-auto">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => add("NIGHT")} className="btn text-[13px]">
          🌙 Add night sleep
        </button>
        <button onClick={() => add("NAP")} className="btn text-[13px]">
          ☀️ Add afternoon nap
        </button>
        {segs.length === 0 && (
          <span className="flex items-center gap-1.5 ml-1">
            <span className="label">or total</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              inputMode="decimal"
              value={manualHours ?? ""}
              placeholder="hrs"
              onChange={(e) => onManual(e.target.value === "" ? null : Number(e.target.value))}
              className="field-input w-16 text-center"
            />
          </span>
        )}
      </div>
      <div className="label mt-2">Add bed→wake times and it works out the duration. Woke in the night? Add a second night stretch.</div>
    </div>
  );
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-soft px-6 py-5">
      <div className="flex items-baseline justify-between mb-3.5">
        <div className="label">{label}</div>
        {hint && <div className="label text-ink-faint/70 normal-case tracking-normal">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[13px] border transition-all ${
        on ? "border-accent bg-selected text-accent font-medium" : "border-line text-ink-dim hover:text-ink hover:border-line-strong"
      }`}
    >
      {children}
    </button>
  );
}

function Step({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 border border-line text-ink-dim hover:text-ink hover:border-line-strong disabled:opacity-30 transition-colors grid place-items-center text-sm"
    >
      {children}
    </button>
  );
}

function ScoreDial({ score, tone }: { score: number; tone: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 72 72" className="-rotate-90 h-full w-full">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--card-3)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center leading-none">
        <div className="text-center">
          <div className="metric text-lg" style={{ color: tone }}>
            {score}
          </div>
          <div className="label text-[7px] mt-0.5">care</div>
        </div>
      </div>
    </div>
  );
}
