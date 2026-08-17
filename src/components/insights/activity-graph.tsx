"use client";

import { useState } from "react";

type Bucket = { label: string; count: number };
type Series = { daily: Bucket[]; weekly: Bucket[]; monthly: Bucket[] };
type Grain = "daily" | "weekly" | "monthly";

const GRAINS: { key: Grain; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export default function ActivityGraph({ series, title = "Connections", unit = "connection" }: { series: Series; title?: string; unit?: string }) {
  const [grain, setGrain] = useState<Grain>("weekly");
  const data = series[grain];
  const max = Math.max(1, ...data.map((b) => b.count));
  const total = data.reduce((n, b) => n + b.count, 0);
  // avoid crowding daily labels
  const labelEvery = grain === "daily" ? 5 : grain === "weekly" ? 2 : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="section-title">{title}</div>
          <div className="label mt-1">
            {total} {total === 1 ? unit : `${unit}s`} · last {data.length} {grain === "daily" ? "days" : grain === "weekly" ? "weeks" : "months"}
          </div>
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

      <div className="flex items-end gap-[3px] h-28">
        {data.map((b, i) => (
          <div key={i} className="flex-1 h-full flex items-end" title={`${b.count} · ${b.label}`}>
            <div
              className="w-full rounded-t-[2px] transition-all"
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? "4px" : "2px", background: b.count ? "var(--accent)" : "var(--card-3)" }}
            />
          </div>
        ))}
      </div>
      <div className="flex mt-2">
        {data.map((b, i) => (
          <div key={i} className="flex-1 text-center label text-[8px] leading-none overflow-hidden whitespace-nowrap">
            {i % labelEvery === 0 ? b.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
