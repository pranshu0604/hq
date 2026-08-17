import type { GameState } from "@/lib/gamification";

export default function MomentumBar({ state }: { state: GameState }) {
  const pct = state.xpForLevel ? Math.min(100, Math.round((state.xpIntoLevel / state.xpForLevel) * 100)) : 100;

  return (
    <div className="card p-5 flex flex-col lg:flex-row lg:items-center gap-5">
      <div className="flex items-center gap-3.5 shrink-0">
        <div className="grid place-items-center h-11 w-11 rounded-xl bg-accent text-[color:var(--accent-ink)] shadow-[0_3px_14px_-4px_var(--accent)]">
          <span className="metric text-lg">{state.level}</span>
        </div>
        <div>
          <div className="label">Level {state.level}</div>
          <div className="text-sm font-semibold">{state.levelName}</div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between label mb-1.5">
          <span>{state.xp} XP</span>
          <span>{state.xpForLevel != null ? `${state.xpIntoLevel} / ${state.xpForLevel} → ${state.nextLevelName}` : "max level"}</span>
        </div>
        <div className="track">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-ink-dim mt-2.5">{state.encouragement}</p>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <div className="text-center">
          <div className="metric text-2xl">
            <span className={state.streak > 0 ? "" : "opacity-40"}>🔥</span> {state.streak}
          </div>
          <div className="label mt-1">day streak</div>
        </div>
        <div className="w-px self-stretch bg-line-soft" />
        <DailyTiers state={state} />
      </div>
    </div>
  );
}

function DailyTiers({ state }: { state: GameState }) {
  const { dailyTiers: tiers, dailyTierIndex: idx, applicationsToday: today } = state;
  const cur = idx >= 0 ? tiers[idx] : null;
  const next = tiers[idx + 1] ?? null;
  const floor = idx >= 0 ? tiers[idx].count : 0;
  const segPct = next ? Math.min(100, Math.round(((today - floor) / (next.count - floor)) * 100)) : 100;

  return (
    <div className="min-w-[128px]">
      <div className="flex items-baseline gap-1.5">
        <span className="metric text-2xl">{today}</span>
        <span className="label">today</span>
      </div>
      <div className="label mt-1 mb-1.5 normal-case tracking-normal">
        {cur ? (
          <span className="text-accent">
            {cur.emoji} {cur.label}
          </span>
        ) : (
          <span>
            {next!.count - today} to {next!.label}
          </span>
        )}
      </div>
      <div className="track h-1.5" title={next ? `${next.count - today} more → ${next.label}` : "top tier"}>
        <span style={{ width: `${segPct}%` }} />
      </div>
      <div className="label mt-1.5 text-[9px]">
        {next ? (
          <>
            next · {next.emoji} {next.label} @ {next.count}
          </>
        ) : (
          <span className="text-accent">🏆 top tier — machine</span>
        )}
      </div>
    </div>
  );
}
