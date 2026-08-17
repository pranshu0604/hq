// presence tracking — showing up on X / LinkedIn / Instagram is effort you control,
// so it's scored like applications: by consistency, not by reach.

import { dayKey } from "@/lib/insights";

export const PLATFORMS = [
  { key: "X", label: "X", hint: "post or reply" },
  { key: "LINKEDIN", label: "LinkedIn", hint: "post or comment" },
  { key: "INSTAGRAM", label: "Instagram", hint: "post or story" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

export const ACTIONS = [
  { value: "POST", label: "Post" },
  { value: "COMMENT", label: "Comment" },
  { value: "DM", label: "DM" },
  { value: "STORY", label: "Story" },
  { value: "CONNECT", label: "Connect" },
];

export const ACTION_LABEL: Record<string, string> = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]));

// hitting all three in one day
export const SWEEP_SIZE = PLATFORMS.length;

export type SocialEvent = { platform: string; createdAt: Date | string };

export type SocialSummary = {
  today: number;
  todayByPlatform: Record<string, number>;
  platformsToday: number;
  sweep: boolean;
  streak: number;
  total: number;
  sweepDays: number;
};

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** consecutive days ending today (or yesterday, if today isn't logged yet) with at least one action */
function socialStreak(days: Set<string>, nowMs: number) {
  const walk = startOfDay(nowMs);
  if (!days.has(dayKey(walk))) walk.setDate(walk.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(walk))) {
    n++;
    walk.setDate(walk.getDate() - 1);
  }
  return n;
}

export function summarize(logs: SocialEvent[], nowMs: number): SocialSummary {
  const today = startOfDay(nowMs);
  const todayK = dayKey(today);

  const days = new Set<string>();
  const perDayPlatforms = new Map<string, Set<string>>();
  const todayByPlatform: Record<string, number> = Object.fromEntries(PLATFORMS.map((p) => [p.key, 0]));

  for (const l of logs) {
    const k = dayKey(new Date(l.createdAt));
    days.add(k);
    if (!perDayPlatforms.has(k)) perDayPlatforms.set(k, new Set());
    perDayPlatforms.get(k)!.add(l.platform);
    if (k === todayK && l.platform in todayByPlatform) todayByPlatform[l.platform]++;
  }

  const platformsToday = Object.values(todayByPlatform).filter((n) => n > 0).length;
  let sweepDays = 0;
  for (const [, set] of perDayPlatforms) if (set.size >= SWEEP_SIZE) sweepDays++;

  return {
    today: Object.values(todayByPlatform).reduce((a, b) => a + b, 0),
    todayByPlatform,
    platformsToday,
    sweep: platformsToday >= SWEEP_SIZE,
    streak: socialStreak(days, nowMs),
    total: logs.length,
    sweepDays,
  };
}
