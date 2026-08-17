// Project health — not a productivity score, a rot detector. Flags active
// projects that are quietly dying so you can Resume / Replan / Kill instead of
// silently accumulating them.
export type Health = { level: "GREEN" | "AMBER" | "RED"; reasons: string[] };

export function projectHealth(
  p: { status: string; updatedAt: Date | string; nextAction: string; targetDate: Date | string | null },
  nowMs = Date.now(),
): Health {
  if (["SHIPPED", "ABANDONED"].includes(p.status)) return { level: "GREEN", reasons: [] };

  const reasons: string[] = [];
  let score = 0;

  const daysSince = Math.floor((nowMs - new Date(p.updatedAt).getTime()) / 86400000);
  if (daysSince >= 12) {
    reasons.push(`${daysSince}d untouched`);
    score += 2;
  } else if (daysSince >= 6) {
    reasons.push(`${daysSince}d untouched`);
    score += 1;
  }

  if (!p.nextAction.trim()) {
    reasons.push("no next action");
    score += 1;
  }

  if (p.targetDate) {
    const d = Math.floor((new Date(p.targetDate).getTime() - nowMs) / 86400000);
    if (d < 0) {
      reasons.push("past target date");
      score += 2;
    } else if (d <= 7) {
      reasons.push(`target in ${d}d`);
      score += 1;
    }
  }

  const level = score >= 3 ? "RED" : score >= 1 ? "AMBER" : "GREEN";
  return { level, reasons };
}

export const HEALTH_TONE: Record<Health["level"], string> = {
  GREEN: "var(--good)",
  AMBER: "var(--warn)",
  RED: "var(--bad)",
};
