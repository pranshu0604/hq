"use client";

import { useState } from "react";
import type { Bucket } from "@/lib/wellbeing";

type Series = { daily: Bucket[]; weekly: Bucket[]; monthly: Bucket[] };
type Grain = "daily" | "weekly" | "monthly";

export type Metric = {
  key: string;
  label: string;
  unit: string;
  target: number;
  color: string;
  series: Series;
  /** atLeast: more is fine (water, protein) · band: sit inside it (calories) · atMost: a ceiling to stay under (sodium, sugar) */
  mode: "atLeast" | "band" | "atMost";
};

const GRAINS: { key: Grain; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const fmt = (n: number, unit: string) => (unit === "L" ? (n / 1000).toFixed(2) : Math.round(n).toLocaleString());

export default function NutritionReport({ metrics }: { metrics: Metric[] }) {
  const [grain, setGrain] = useState<Grain>("daily");
  const [active, setActive] = useState(metrics[0]?.key ?? "");
  const m = metrics.find((x) => x.key === active) ?? metrics[0];
  if (!m) return null;

  const data = m.series[grain];
  const logged = data.filter((b) => b.value !== null) as { label: string; value: number }[];
  const avg = logged.length ? logged.reduce((n, b) => n + b.value, 0) / logged.length : null;
  const meets = (v: number) => (m.mode === "atLeast" ? v >= m.target : m.mode === "atMost" ? v <= m.target : Math.abs(v - m.target) / m.target <= 0.15);
  const hit = logged.filter((b) => meets(b.value)).length;
  const max = Math.max(m.target * 1.35, ...logged.map((b) => b.value));
  const period = grain === "daily" ? "days" : grain === "weekly" ? "weeks" : "months";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1">
          {metrics.map((x) => (
            <button
              key={x.key}
              onClick={() => setActive(x.key)}
              className={`px-2.5 py-1 text-[12px] border transition-colors ${
                x.key === m.key ? "font-medium" : "border-line text-ink-faint hover:text-ink hover:border-line-strong"
              }`}
              style={x.key === m.key ? { borderColor: x.color, color: x.color, background: `color-mix(in srgb, ${x.color} 10%, transparent)` } : undefined}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-line-soft p-0.5">
          {GRAINS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGrain(g.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${grain === g.key ? "bg-selected text-accent font-medium" : "text-ink-dim hover:text-ink"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mb-5">
        <div>
          <span className="metric text-3xl" style={{ color: m.color }}>
            {avg === null ? "—" : fmt(avg, m.unit)}
          </span>
          <span className="text-ink-faint text-sm ml-1">
            {m.unit} avg / {grain === "daily" ? "day" : grain === "weekly" ? "week" : "month"}
          </span>
        </div>
        <div className="label">
          target {fmt(m.target, m.unit)}
          {m.unit}
        </div>
        <div className="label">
          hit on {hit} of {logged.length} logged {period}
        </div>
      </div>

      {/* bars against a target line */}
      <div className="relative h-32">
        <div
          className="absolute inset-x-0 border-t border-dashed pointer-events-none z-10"
          style={{ bottom: `${(m.target / max) * 100}%`, borderColor: m.color, opacity: 0.6 }}
        >
          <span className="absolute right-0 -top-4 text-[9px] font-mono" style={{ color: m.color }}>
            {m.mode === "atMost" ? "ceiling" : "target"}
          </span>
        </div>
        <div className="flex items-end gap-[2px] h-full">
          {data.map((b, i) => {
            const on = b.value !== null;
            const good = on && meets(b.value!);
            return (
              <div
                key={i}
                className="relative flex-1 h-full flex items-end"
                title={on ? `${fmt(b.value!, m.unit)}${m.unit} · ${b.label}` : `not logged · ${b.label}`}
              >
                <div
                  className="w-full rounded-t-[2px] transition-all"
                  style={{
                    height: on ? `${Math.min(100, (b.value! / max) * 100)}%` : "2px",
                    minHeight: "2px",
                    background: on ? m.color : "var(--card-3)",
                    opacity: on ? (good ? 1 : 0.45) : 0.5,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between mt-2.5 label text-[9px]">
        <span>{data[0]?.label}</span>
        <span>{grain === "daily" ? "today" : grain === "weekly" ? "this week" : "this month"}</span>
      </div>
      <div className="label mt-3 text-ink-faint/70 normal-case tracking-normal">
        Solid bars {m.mode === "atLeast" ? "hit the target" : m.mode === "atMost" ? "stayed under the ceiling" : "landed within 15% of target"} · faded ones{" "}
        {m.mode === "atMost" ? "went over" : "fell short"} · grey means unlogged.
      </div>
    </div>
  );
}
