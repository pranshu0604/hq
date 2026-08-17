// Scheduled transitions — behavioral alarms. A reminder fires three nudges: a
// lead ("in 5 min"), a start ("now"), and a late ("you haven't started"). The
// desktop polls pollDue() and shows them; the logic lives here so it's the one
// source of truth. (Distinct from lib/reminders.ts, which is the push digest.)
import { prisma } from "@/lib/prisma";
import type { Reminder } from "@prisma/client";

export type ReminderRow = {
  id: string;
  label: string;
  at: string;
  leadMin: number;
  todoId: string | null;
  status: string;
};

export type DueNudge = { id: string; label: string; type: "lead" | "start" | "late"; todoId: string | null; leadMin: number };

function toRow(r: Reminder): ReminderRow {
  return { id: r.id, label: r.label, at: r.at.toISOString(), leadMin: r.leadMin, todoId: r.todoId, status: r.status };
}

export async function addReminder(input: { label: string; at: string; leadMin?: number; todoId?: string | null }): Promise<ReminderRow | null> {
  const label = input.label.trim().slice(0, 160);
  const at = new Date(input.at);
  if (!label || isNaN(at.getTime())) return null;
  const r = await prisma.reminder.create({
    data: { label, at, leadMin: Math.min(120, Math.max(0, input.leadMin ?? 5)), todoId: input.todoId ?? null },
  });
  return toRow(r);
}

/** today's schedule + anything still pending nearby */
export async function listReminders(nowMs = Date.now()): Promise<ReminderRow[]> {
  const from = new Date(nowMs - 3 * 3600_000); // keep recently-passed visible for a bit
  const rows = await prisma.reminder.findMany({
    where: { at: { gte: from }, status: { not: "DONE" } },
    orderBy: { at: "asc" },
    take: 30,
  });
  return rows.map(toRow);
}

export async function setReminderStatus(id: string, status: "PENDING" | "STARTED" | "DONE" | "SKIPPED"): Promise<ReminderRow | null> {
  const r = await prisma.reminder.update({ where: { id }, data: { status } }).catch(() => null);
  return r ? toRow(r) : null;
}

/** push a reminder later and re-arm its nudges */
export async function snoozeReminder(id: string, minutes = 10): Promise<ReminderRow | null> {
  const r = await prisma.reminder.findUnique({ where: { id } });
  if (!r) return null;
  const base = Math.max(Date.now(), r.at.getTime());
  const up = await prisma.reminder.update({
    where: { id },
    data: { at: new Date(base + minutes * 60_000), status: "PENDING", firedLead: false, firedStart: false, firedLate: false },
  });
  return toRow(up);
}

export async function deleteReminder(id: string): Promise<void> {
  await prisma.reminder.delete({ where: { id } }).catch(() => null);
}

/** which nudges are due right now — marks them fired so each only fires once */
export async function pollDue(nowMs = Date.now()): Promise<DueNudge[]> {
  const soon = new Date(nowMs + 60 * 60_000); // only consider the next hour of leads
  const rows = await prisma.reminder.findMany({ where: { status: "PENDING", at: { lte: soon } } });
  const out: DueNudge[] = [];
  for (const r of rows) {
    const at = r.at.getTime();
    if (!r.firedLead && r.leadMin > 0 && nowMs >= at - r.leadMin * 60_000 && nowMs < at) {
      await prisma.reminder.update({ where: { id: r.id }, data: { firedLead: true } });
      out.push({ id: r.id, label: r.label, type: "lead", todoId: r.todoId, leadMin: r.leadMin });
    } else if (!r.firedStart && nowMs >= at && nowMs < at + 5 * 60_000) {
      await prisma.reminder.update({ where: { id: r.id }, data: { firedStart: true } });
      out.push({ id: r.id, label: r.label, type: "start", todoId: r.todoId, leadMin: r.leadMin });
    } else if (!r.firedLate && nowMs >= at + 7 * 60_000) {
      await prisma.reminder.update({ where: { id: r.id }, data: { firedLate: true } });
      out.push({ id: r.id, label: r.label, type: "late", todoId: r.todoId, leadMin: r.leadMin });
    }
  }
  return out;
}
