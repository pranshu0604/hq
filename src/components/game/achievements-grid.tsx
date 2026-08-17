import type { Achievement } from "@/lib/gamification";

export default function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="section-title">Achievements</div>
        <span className="label">
          {unlocked} of {achievements.length} unlocked
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`card flex items-start gap-3 p-4 transition-opacity ${a.unlocked ? "" : "opacity-45"}`}
          >
            <span
              className={`grid place-items-center h-9 w-9 rounded-lg text-lg shrink-0 ${a.unlocked ? "bg-selected" : "grayscale"}`}
              style={a.unlocked ? undefined : { background: "var(--card-3)" }}
            >
              {a.emoji}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium flex items-center gap-1.5">
                {a.title}
                {a.unlocked && <span className="text-accent text-xs">✓</span>}
              </div>
              <div className="text-xs text-ink-faint mt-0.5">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
