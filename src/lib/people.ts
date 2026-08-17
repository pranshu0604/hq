// relationships are effort you control too — the app nudges you to keep in touch,
// and reflects back how social you've actually been.

export const INTERACTION_KINDS = [
  { value: "met", label: "Met up" },
  { value: "call", label: "Called" },
  { value: "text", label: "Texted" },
  { value: "dm", label: "DM'd" },
  { value: "hangout", label: "Hung out" },
  { value: "other", label: "Other" },
];

export const INTERACTION_LABEL: Record<string, string> = Object.fromEntries(INTERACTION_KINDS.map((k) => [k.value, k.label]));

export type Sociability = { label: string; tone: "faint" | "dim" | "accent" };

export function sociability(weekCount: number): Sociability {
  if (weekCount === 0) return { label: "Quiet week", tone: "faint" };
  if (weekCount <= 2) return { label: "Keeping in touch", tone: "dim" };
  if (weekCount <= 6) return { label: "Social", tone: "accent" };
  if (weekCount <= 14) return { label: "Very social", tone: "accent" };
  return { label: "Social butterfly", tone: "accent" };
}

export const RANGE_OPTS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];
export type RangeKey = "today" | "week" | "month" | "year" | "all";

export type TopConnection = { id: string; name: string; relation: string; count: number };
export type RangeStat = { total: number; people: number; top: TopConnection[] };

// keep-in-touch cadences (days). 0 = off.
export const CADENCES = [
  { value: "0", label: "No reminder" },
  { value: "1", label: "Daily" },
  { value: "2", label: "Every 2 days" },
  { value: "3", label: "Every 3 days" },
  { value: "7", label: "Weekly" },
  { value: "14", label: "Every 2 weeks" },
  { value: "30", label: "Monthly" },
  { value: "90", label: "Quarterly" },
  { value: "180", label: "Twice a year" },
  { value: "365", label: "Yearly" },
];

export function cadenceLabel(days: number | null | undefined): string {
  if (!days) return "Not tracked";
  return CADENCES.find((c) => c.value === String(days))?.label ?? `Every ${days}d`;
}

export type ReachOutPerson = {
  id: string;
  name: string;
  relation: string;
  reminderDays: number;
  lastMs: number | null; // null = no interaction ever logged
  daysSince: number;
  overdueDays: number;
};

type PersonForReach = {
  id: string;
  name: string;
  relation: string;
  reminderDays: number | null;
  createdAt: Date | string;
  interactions: { date: Date | string }[];
};

// people you track who are now due (last contact older than their cadence).
// with no interactions yet, the clock runs from when you added them.
export function computeReachOut(people: PersonForReach[], nowMs: number): ReachOutPerson[] {
  const out: ReachOutPerson[] = [];
  for (const p of people) {
    if (!p.reminderDays || p.reminderDays <= 0) continue;
    const dates = p.interactions.map((i) => new Date(i.date).getTime());
    const baseline = dates.length ? Math.max(...dates) : new Date(p.createdAt).getTime();
    const daysSince = Math.floor((nowMs - baseline) / 86400000);
    if (daysSince >= p.reminderDays) {
      out.push({
        id: p.id,
        name: p.name,
        relation: p.relation,
        reminderDays: p.reminderDays,
        lastMs: dates.length ? baseline : null,
        daysSince,
        overdueDays: daysSince - p.reminderDays,
      });
    }
  }
  out.sort((a, b) => b.overdueDays - a.overdueDays);
  return out;
}
