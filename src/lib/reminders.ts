// Daily push digest — assembles the one notification the scheduled LaunchAgent
// fires (via /api/push/digest → sendPush). Mirrors the dashboard "mission brief":
// only genuinely actionable, time-sensitive items; returns null when nothing's due.
//
// NOTE: reconstructed after the original (untracked, never committed) was lost.
// Same contract — buildDigest(nowMs) -> PushPayload | null.
import { prisma } from "@/lib/prisma";
import type { PushPayload } from "@/lib/push";
import { getProfileState } from "@/lib/profile";
import { summarize as summarizeHealth, isLogged, gapsFor, toDayRow, type DayRow } from "@/lib/wellbeing";
import { computeReachOut } from "@/lib/people";
import { dayLabel } from "@/lib/format";

const DEAD = ["REJECTED", "WITHDRAWN"];
const NOT_OUT = "PENDING";

export async function buildDigest(nowMs = Date.now()): Promise<PushPayload | null> {
  const [applications, todos, people, workouts, healthRaw] = await Promise.all([
    prisma.application.findMany({ include: { platforms: true, interviews: true } }),
    prisma.todo.findMany(),
    prisma.person.findMany({ include: { interactions: { select: { date: true } } } }),
    prisma.workout.findMany({ select: { date: true }, orderBy: { date: "desc" } }),
    prisma.healthDay.findMany({
      include: {
        meals: { select: { id: true, label: true, junkLevel: true, calories: true, proteinG: true, sodiumMg: true, sugarG: true, timeMin: true } },
        sleeps: true,
      },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ]);

  const { targets } = await getProfileState(nowMs);
  const healthDays: DayRow[] = healthRaw.map(toDayRow);
  const health = summarizeHealth(healthDays, targets, nowMs);
  const loggedToday = health.today ? isLogged(health.today) : false;

  const startToday = new Date(nowMs);
  startToday.setHours(0, 0, 0, 0);

  const active = applications.filter((a) => !DEAD.includes(a.status) && a.status !== NOT_OUT);
  const waiting = active.filter((a) => a.status === "APPLIED" && !a.platforms.some((p) => p.responseReceived));
  const stale = waiting.filter((a) => (nowMs - new Date(a.createdAt).getTime()) / 86400000 >= 7);
  const offers = active.filter((a) => a.status === "OFFER").length;
  const overdueTodos = todos.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < startToday).length;

  const nextInterview = applications
    .flatMap((a) => a.interviews.map((iv) => ({ ...iv, company: a.company })))
    .filter((iv) => iv.scheduledOn && new Date(iv.scheduledOn).getTime() >= nowMs - 3600_000)
    .sort((a, b) => new Date(a.scheduledOn!).getTime() - new Date(b.scheduledOn!).getTime())[0];

  const dueReachOut = computeReachOut(people, nowMs).length;
  const gymDaysSince = workouts[0] ? Math.floor((nowMs - new Date(workouts[0].date).getTime()) / 86400000) : null;

  const msgs: string[] = [];
  if (nextInterview?.scheduledOn) msgs.push(`Interview — ${nextInterview.company} ${dayLabel(nextInterview.scheduledOn)}`);
  if (offers) msgs.push(`${offers} offer${offers === 1 ? "" : "s"} on the table`);
  if (stale.length) msgs.push(`${stale.length} application${stale.length === 1 ? "" : "s"} gone stale`);
  else if (waiting.length) msgs.push(`${waiting.length} waiting on your reply`);
  if (overdueTodos) msgs.push(`${overdueTodos} todo${overdueTodos === 1 ? "" : "s"} overdue`);
  if (dueReachOut) msgs.push(`${dueReachOut} ${dueReachOut === 1 ? "person" : "people"} due for a catch-up`);
  for (const o of health.overdue) msgs.push(`${o.label} — ${o.days}d overdue`);
  if (gymDaysSince !== null && gymDaysSince >= 3) msgs.push(`${gymDaysSince}d since the gym`);
  if (!loggedToday) msgs.push("Wellbeing not logged today");
  else {
    const gaps = health.today ? gapsFor(health.today, targets, health.upkeep) : [];
    if (loggedToday && health.waterToday < targets.waterMl) msgs.push(`${((targets.waterMl - health.waterToday) / 1000).toFixed(1)}L water still to drink`);
    if (gaps.length) msgs.push(`Still for you — ${gaps.slice(0, 2).join(", ")}`);
  }

  if (!msgs.length) return null;
  return { title: "HQ — today", body: msgs.slice(0, 5).join(" · "), url: "/", tag: "hq-digest" };
}
