import type { Heatmap } from "@/lib/insights";

const LEVEL_BG = [
  "var(--card-3)",
  "rgba(183,121,50,0.32)",
  "rgba(183,121,50,0.55)",
  "rgba(183,121,50,0.80)",
  "var(--accent)",
];

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function ActivityHeatmap({ data }: { data: Heatmap }) {
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* month labels */}
          <div className="flex pl-[26px]">
            <div className="flex gap-[3px]">
              {data.columns.map((c, i) => (
                <div key={i} className="w-[11px] text-[9px] text-ink-faint whitespace-nowrap leading-none">
                  {c.month}
                </div>
              ))}
            </div>
          </div>

          <div className="flex mt-1.5">
            <div className="flex flex-col gap-[3px] mr-1.5 w-[20px]">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="h-[11px] text-[9px] text-ink-faint leading-[11px]">
                  {d}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {data.columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.days.map((day) => (
                    <span
                      key={day.key}
                      title={day.inFuture ? "" : `${day.count} ${day.count === 1 ? "action" : "actions"} · ${day.label}`}
                      className="h-[11px] w-[11px] rounded-[2px]"
                      style={{ background: day.inFuture ? "transparent" : LEVEL_BG[day.level] }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-ink-faint">
        Less
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: bg }} />
        ))}
        More
      </div>
    </div>
  );
}

export function WeekBars({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div>
      <div className="flex items-end gap-1.5 h-28">
        {buckets.map((b, i) => (
          <div
            key={i}
            title={`${b.count} · week of ${b.label}`}
            className="flex-1 rounded-t-[3px] transition-colors"
            style={{
              height: `${(b.count / max) * 100}%`,
              minHeight: b.count ? "5px" : "2px",
              background: b.count ? "var(--accent)" : "var(--card-3)",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2.5 label text-[9px]">
        <span>{buckets[0]?.label}</span>
        <span>this week</span>
      </div>
    </div>
  );
}

export function StatusBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, segments.reduce((n, s) => n + s.value, 0));
  const any = segments.some((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
        {any &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div key={s.label} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
            ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-ink-dim">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="metric text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Ring({ value, total, caption }: { value: number; total: number; caption: string }) {
  const pct = total ? value / total : 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--card-3)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="metric text-base">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div>
        <div className="metric text-2xl">
          {value}
          <span className="text-ink-faint text-base"> / {total}</span>
        </div>
        <div className="label mt-1">{caption}</div>
      </div>
    </div>
  );
}

// unlike WeekBars (which plots counts), this plots a measured VALUE per day —
// sleep hours, mood, care score — so gaps (unlogged days) must read as gaps, not zeros.
export function MetricBars({
  buckets,
  max,
  color = "var(--accent)",
  unit = "",
  band,
}: {
  buckets: { label: string; value: number | null }[];
  max: number;
  color?: string;
  unit?: string;
  band?: { from: number; to: number }; // optional "healthy range" shading
}) {
  return (
    <div>
      <div className="relative flex items-end gap-[2px] h-24">
        {band && (
          <div
            className="absolute inset-x-0 pointer-events-none border-y border-dashed"
            style={{
              bottom: `${(band.from / max) * 100}%`,
              height: `${((band.to - band.from) / max) * 100}%`,
              borderColor: "var(--line-strong)",
              background: "var(--neutral-tint)",
            }}
          />
        )}
        {buckets.map((b, i) => (
          <div key={i} className="relative flex-1 h-full flex items-end" title={b.value === null ? `not logged · ${b.label}` : `${b.value}${unit} · ${b.label}`}>
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: b.value === null ? "2px" : `${Math.min(100, (b.value / max) * 100)}%`,
                minHeight: "2px",
                background: b.value === null ? "var(--card-3)" : color,
                opacity: b.value === null ? 0.5 : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2.5 label text-[9px]">
        <span>{buckets[0]?.label}</span>
        <span>today</span>
      </div>
    </div>
  );
}

export function StatTile({ value, label, sub, accent }: { value: number | string; label: string; sub?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className={`metric text-3xl ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="label mt-2">{label}</div>
      {sub && <div className="text-[11px] text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}
