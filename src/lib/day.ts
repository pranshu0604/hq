// The day system — operating mode + shutdown, one row per day (DayPlan).
//   energy: LOW | NORMAL | HIGH   → what HQ suggests you spend yourself on
//   maintenance: minimum-viable-day, collapses expectations without guilt
//   shutdown: finished / remaining / tomorrow's first action → context inherited
// Kept separate from wellbeing's HealthDay so that stays untouched.
import { prisma } from "@/lib/prisma";
import type { DayPlan } from "@prisma/client";

export type Energy = "LOW" | "NORMAL" | "HIGH" | "";

export type DayState = {
  date: string;
  energy: Energy;
  maintenance: boolean;
  finished: string;
  remaining: string;
  firstAction: string;
  shutAt: string | null;
};

export type MorningBrief = { firstAction: string; fromDate: string } | null;

function startOfDay(ms = Date.now()): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toState(d: DayPlan): DayState {
  return {
    date: d.date.toISOString(),
    energy: (d.energy || "") as Energy,
    maintenance: d.maintenance,
    finished: d.finished,
    remaining: d.remaining,
    firstAction: d.firstAction,
    shutAt: d.shutAt ? d.shutAt.toISOString() : null,
  };
}

export async function getToday(nowMs = Date.now()): Promise<DayState | null> {
  const date = startOfDay(nowMs);
  const d = await prisma.dayPlan.findUnique({ where: { date } });
  return d ? toState(d) : null;
}

export async function setEnergy(energy: Energy, nowMs = Date.now()): Promise<DayState> {
  const date = startOfDay(nowMs);
  const valid = energy === "LOW" || energy === "NORMAL" || energy === "HIGH" ? energy : "";
  const d = await prisma.dayPlan.upsert({ where: { date }, create: { date, energy: valid }, update: { energy: valid } });
  return toState(d);
}

export async function setMaintenance(on: boolean, nowMs = Date.now()): Promise<DayState> {
  const date = startOfDay(nowMs);
  const d = await prisma.dayPlan.upsert({ where: { date }, create: { date, maintenance: on }, update: { maintenance: on } });
  return toState(d);
}

export async function recordShutdown(
  input: { finished?: string; remaining?: string; firstAction?: string },
  nowMs = Date.now(),
): Promise<DayState> {
  const date = startOfDay(nowMs);
  const data = {
    finished: (input.finished ?? "").trim(),
    remaining: (input.remaining ?? "").trim(),
    firstAction: (input.firstAction ?? "").trim(),
    shutAt: new Date(nowMs),
  };
  const d = await prisma.dayPlan.upsert({ where: { date }, create: { date, ...data }, update: data });
  return toState(d);
}

/** the "first action" you set at your last shutdown, if it's still ahead of today */
export async function getMorningBrief(nowMs = Date.now()): Promise<MorningBrief> {
  const today = startOfDay(nowMs);
  const d = await prisma.dayPlan.findFirst({
    where: { firstAction: { not: "" }, shutAt: { not: null }, date: { lt: today } },
    orderBy: { date: "desc" },
  });
  if (!d || !d.firstAction) return null;
  return { firstAction: d.firstAction, fromDate: d.date.toISOString() };
}

// what to spend yourself on, given today's energy — labels only, HQ stays advisory
export const ENERGY_GUIDE: Record<Exclude<Energy, "">, { title: string; blurb: string; kinds: string[] }> = {
  LOW: { title: "Low", blurb: "Protect yourself. Small, mechanical wins.", kinds: ["emails", "applications", "errands", "docs", "simple fixes"] },
  NORMAL: { title: "Normal", blurb: "Steady work.", kinds: ["DSA", "normal dev", "meetings", "follow-ups"] },
  HIGH: { title: "High", blurb: "Spend it on the hard thing — pick ONE.", kinds: ["architecture", "hard coding", "learning", "big decisions"] },
};
