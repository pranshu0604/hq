"use client";

import { useState, useTransition } from "react";
import { saveProfile } from "@/app/wellbeing/actions";
import { Select } from "@/components/ui/select";
import { ACTIVITY, feetInches, GOALS, SEXES, type Targets } from "@/lib/nutrition";

// the one card that explains every other number on this page
export default function ProfileCard({
  targets,
  profile,
}: {
  targets: Targets;
  profile: { sex: string; birthYear: number; heightCm: number; activity: string; goal: string; startWeightKg: number; weighedIn: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const t = targets;

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="section-title">Your numbers</div>
          <p className="text-[13px] text-ink-dim mt-2">
            {t.age}, {SEXES.find((s) => s.key === t.sex)?.label.toLowerCase()} · {feetInches(t.heightCm)} · {t.weightKg}kg
            {!profile.weighedIn && <span className="text-ink-faint"> (no weigh-in yet)</span>} · {t.activity.label.toLowerCase()} ·{" "}
            {t.goal.label.toLowerCase()}
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="label hover:text-accent transition-colors shrink-0">
          {open ? "done" : "edit"}
        </button>
      </div>

      {/* the targets everything else is measured against */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 border-t border-line-soft pt-5">
        <Num value={t.calories.toLocaleString()} unit="kcal" label="Calories a day" sub={`${t.tdee.toLocaleString()} burn ${t.goal.kcal ? (t.goal.kcal > 0 ? `+${t.goal.kcal}` : t.goal.kcal) : "· maintain"}`} />
        <Num value={t.proteinG} unit="g" label="Protein a day" sub={`${t.proteinRange[0]}–${t.proteinRange[1]}g healthy range`} />
        <Num value={(t.waterMl / 1000).toFixed(1)} unit="L" label="Water a day" sub="35ml per kg" />
        <Num value={t.bmi} unit="" label="BMI" sub={`${t.bmiLabel} · healthy ${t.healthyRange[0]}–${t.healthyRange[1]}kg`} tone={t.bmiTone} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-5 pt-4 border-t border-line-soft label">
        <span>BMR {t.bmr.toLocaleString()} kcal — what you&apos;d burn asleep all day</span>
        <span>TDEE {t.tdee.toLocaleString()} kcal — with your activity</span>
        <span>Fibre {t.fibreG}g</span>
        <span>Sodium ≤{t.sodiumMg.toLocaleString()}mg — WHO ceiling</span>
        <span>Sugar ≤{t.sugarG}g — added-sugar ceiling</span>
      </div>

      {open && (
        <div className="mt-5 pt-5 border-t border-line-soft grid sm:grid-cols-3 gap-4">
          <Field label="Born">
            <input
              type="number"
              defaultValue={profile.birthYear}
              min="1900"
              max={new Date().getFullYear() - 5}
              onChange={(e) => e.target.value.length === 4 && start(() => void saveProfile({ birthYear: Number(e.target.value) }))}
              className="field-input w-full"
            />
          </Field>
          <Field label="Height (cm)">
            <input
              type="number"
              step="0.5"
              defaultValue={profile.heightCm}
              onChange={(e) => Number(e.target.value) >= 100 && start(() => void saveProfile({ heightCm: Number(e.target.value) }))}
              className="field-input w-full"
            />
          </Field>
          <Field label="Weight if never weighed (kg)">
            <input
              type="number"
              step="0.1"
              defaultValue={profile.startWeightKg}
              onChange={(e) => Number(e.target.value) >= 20 && start(() => void saveProfile({ startWeightKg: Number(e.target.value) }))}
              className="field-input w-full"
            />
          </Field>
          <Field label="Sex">
            <Select
              className="w-full"
              options={SEXES.map((s) => ({ value: s.key, label: s.label }))}
              value={profile.sex}
              onChange={(v) => start(() => void saveProfile({ sex: v }))}
              ariaLabel="Sex"
            />
          </Field>
          <Field label="Activity">
            <Select
              className="w-full"
              options={ACTIVITY.map((a) => ({ value: a.key, label: `${a.label} — ${a.hint}` }))}
              value={profile.activity}
              onChange={(v) => start(() => void saveProfile({ activity: v }))}
              ariaLabel="Activity level"
            />
          </Field>
          <Field label="Goal">
            <Select
              className="w-full"
              options={GOALS.map((g) => ({ value: g.key, label: `${g.label} — ${g.hint}` }))}
              value={profile.goal}
              onChange={(v) => start(() => void saveProfile({ goal: v }))}
              ariaLabel="Goal"
            />
          </Field>
        </div>
      )}
    </section>
  );
}

function Num({ value, unit, label, sub, tone }: { value: string | number; unit: string; label: string; sub: string; tone?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="metric text-2xl" style={tone ? { color: tone } : undefined}>
          {value}
        </span>
        <span className="text-ink-faint text-sm">{unit}</span>
      </div>
      <div className="label mt-1.5">{label}</div>
      <div className="text-[11px] text-ink-faint mt-1">{sub}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}
