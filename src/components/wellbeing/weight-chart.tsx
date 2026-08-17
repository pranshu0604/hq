"use client";

import { useState, useTransition } from "react";
import { deleteWeight, logWeight } from "@/app/wellbeing/actions";
import { formatDate } from "@/lib/format";
import type { Targets } from "@/lib/nutrition";
import type { WeightRow } from "@/lib/wellbeing";

// the scale, not the barbell. a line you want to read as a trend, not a verdict.
export default function WeightChart({ weights, targets }: { weights: WeightRow[]; targets: Targets }) {
  const asc = [...weights].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (asc.length === 0) {
    return (
      <div className="card p-6">
        <div className="section-title mb-4">Body weight</div>
        <p className="text-sm text-ink-dim">
          No weigh-ins yet. Log one in the check-in above and this becomes a trend line — every target on this page moves with it.
        </p>
      </div>
    );
  }

  const latest = asc[asc.length - 1];
  const first = asc[0];
  const change = Math.round((latest.kg - first.kg) * 10) / 10;

  const [lo, hi] = targets.healthyRange;
  const vals = asc.map((w) => w.kg);
  const min = Math.min(lo - 1, ...vals);
  const max = Math.max(hi + 1, ...vals);
  const span = max - min || 1;
  const y = (kg: number) => 100 - ((kg - min) / span) * 100;

  const pts = asc.map((w, i) => ({ x: asc.length === 1 ? 50 : (i / (asc.length - 1)) * 100, y: y(w.kg), w }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="section-title">Body weight</div>
          <div className="flex items-baseline gap-2 mt-2.5">
            <span className="metric text-3xl">{latest.kg}</span>
            <span className="text-ink-faint text-sm">kg</span>
            {change !== 0 && asc.length > 1 && (
              <span className="label ml-1" style={{ color: change > 0 ? "var(--warn)" : "var(--info)" }}>
                {change > 0 ? "+" : ""}
                {change}kg since {formatDate(first.date)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="metric text-xl" style={{ color: targets.bmiTone }}>
            {targets.bmi}
          </div>
          <div className="label mt-1">BMI · {targets.bmiLabel.toLowerCase()}</div>
        </div>
      </div>

      <div className="relative h-40">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {/* healthy BMI band for your height */}
          <rect x="0" y={y(hi)} width="100" height={Math.max(0, y(lo) - y(hi))} fill="var(--good)" opacity="0.08" />
          <line x1="0" y1={y(lo)} x2="100" y2={y(lo)} stroke="var(--good)" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
          <line x1="0" y1={y(hi)} x2="100" y2={y(hi)} stroke="var(--good)" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.5" />
          {asc.length > 1 && <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />}
        </svg>
        {pts.map((p) => (
          <span
            key={p.w.id}
            title={`${p.w.kg}kg · ${formatDate(p.w.date)}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          />
        ))}
        <span className="absolute right-0 text-[9px] font-mono text-good" style={{ top: `${y(hi)}%` }}>
          healthy {lo}–{hi}kg
        </span>
      </div>

      <div className="flex justify-between mt-2 label text-[9px]">
        <span>{formatDate(first.date)}</span>
        <span>{formatDate(latest.date)}</span>
      </div>

      {weights.length > 1 && (
        <div className="mt-5 pt-4 border-t border-line-soft max-h-40 overflow-y-auto">
          {weights.slice(0, 12).map((w, i) => {
            const prev = weights[i + 1];
            const delta = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
            return <WeightRowItem key={w.id} w={w} delta={delta} />;
          })}
        </div>
      )}
    </div>
  );
}

function WeightRowItem({ w, delta }: { w: WeightRow; delta: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(w.kg));
  const [pending, start] = useTransition();

  const save = () => {
    const n = Number(value);
    if (n >= 20) start(() => void logWeight(w.date, n)); // upsert by date = edit
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-3 py-1.5 text-sm">
      <span className="font-mono text-xs text-ink-dim w-24">{formatDate(w.date)}</span>
      {editing ? (
        <input
          autoFocus
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") setEditing(false);
          }}
          className="field-input w-20 text-center metric py-0.5"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="metric text-sm hover:text-accent transition-colors" title="Click to edit">
          {w.kg}kg
        </button>
      )}
      {delta !== null && delta !== 0 && (
        <span className="label" style={{ color: delta > 0 ? "var(--warn)" : "var(--info)" }}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
      <button
        onClick={() => start(() => void deleteWeight(w.id))}
        disabled={pending}
        aria-label="Delete weigh-in"
        className="ml-auto text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
