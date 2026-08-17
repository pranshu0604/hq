"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { RANGE_OPTS, type RangeKey, type RangeStat, type Sociability } from "@/lib/people";

export default function ConnectionAnalytics({
  ranges,
  sociability,
  weekTotal,
  weekPeople,
}: {
  ranges: Record<RangeKey, RangeStat>;
  sociability: Sociability;
  weekTotal: number;
  weekPeople: number;
}) {
  const [range, setRange] = useState<RangeKey>("week");
  const stat = ranges[range];
  const max = Math.max(1, ...stat.top.map((t) => t.count));
  const toneClass = sociability.tone === "accent" ? "text-accent" : sociability.tone === "dim" ? "text-ink" : "text-ink-faint";

  return (
    <div className="card-hero p-6 mb-4">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="label text-accent mb-1.5">This week</div>
          <div className={`display text-3xl ${toneClass}`}>{sociability.label}</div>
          <p className="text-ink-dim text-sm mt-1.5">
            {weekTotal === 0
              ? "No connections logged yet. Reach out to someone today."
              : `${weekTotal} interaction${weekTotal === 1 ? "" : "s"} with ${weekPeople} ${weekPeople === 1 ? "person" : "people"}.`}
          </p>
        </div>
        <Select
          className="w-36 shrink-0"
          options={RANGE_OPTS}
          value={range}
          onChange={(v) => setRange(v as RangeKey)}
          align="right"
          ariaLabel="Range"
        />
      </div>

      <div className="label mb-3">
        Top connections · {RANGE_OPTS.find((r) => r.value === range)?.label.toLowerCase()}
      </div>
      {stat.top.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing in this range yet.</p>
      ) : (
        <div className="space-y-2.5">
          {stat.top.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3">
              <span className="metric text-xs w-4 text-ink-faint text-right">{i + 1}</span>
              <span className="w-32 shrink-0 truncate text-sm text-ink">{t.name}</span>
              <div className="flex-1 track">
                <span style={{ width: `${(t.count / max) * 100}%` }} />
              </div>
              <span className="metric text-sm w-6 text-right">{t.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
