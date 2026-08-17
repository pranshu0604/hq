// The NOW engine — one authoritative "what am I doing right now", shared by the
// web app, the menu-bar readout, and the floating desktop beacon. Pure logic +
// the few prisma writes; revalidation happens in the callers (route handler).
import { prisma } from "@/lib/prisma";
import type { FocusSession } from "@prisma/client";

export type NowState = {
  id: string;
  label: string;
  kind: string; // FOCUS | CULTURE
  goal: string;
  nextAction: string;
  todoId: string | null;
  projectId: string | null;
  plannedMin: number;
  startedAt: string;
  endsAt: string;
  paused: boolean;
  remainingMs: number; // computed for "now"
  done: boolean; // timer elapsed and not paused
  status: string;
};

function remainingMs(row: Pick<FocusSession, "paused" | "endsAt" | "remainingMs">, nowMs: number) {
  return row.paused ? Math.max(0, row.remainingMs) : Math.max(0, row.endsAt.getTime() - nowMs);
}

function toNow(row: FocusSession, nowMs: number): NowState {
  const rem = remainingMs(row, nowMs);
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    goal: row.goal,
    nextAction: row.nextAction,
    todoId: row.todoId,
    projectId: row.projectId,
    plannedMin: row.plannedMin,
    startedAt: row.startedAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    paused: row.paused,
    remainingMs: rem,
    done: !row.paused && rem <= 0,
    status: row.status,
  };
}

/** the single ACTIVE session, if any */
export async function getCurrentNow(nowMs = Date.now()): Promise<NowState | null> {
  const row = await prisma.focusSession.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  return row ? toNow(row, nowMs) : null;
}

export type StartInput = {
  label: string;
  minutes: number;
  kind?: string;
  goal?: string;
  nextAction?: string;
  todoId?: string | null;
  projectId?: string | null;
};

/** start a fresh session — any previous ACTIVE one is abandoned (only one NOW) */
export async function startFocus(input: StartInput): Promise<NowState> {
  const minutes = Math.min(600, Math.max(1, Math.round(input.minutes || 25)));
  const now = Date.now();
  const ms = minutes * 60_000;
  const kind = input.kind === "CULTURE" ? "CULTURE" : "FOCUS";
  await prisma.focusSession.updateMany({ where: { status: "ACTIVE" }, data: { status: "ABANDONED", endedAt: new Date(now) } });
  const row = await prisma.focusSession.create({
    data: {
      label: (input.label || (kind === "CULTURE" ? "Culture" : "Focus")).trim().slice(0, 120) || "Focus",
      kind,
      goal: (input.goal || "").trim(),
      nextAction: (input.nextAction || "").trim(),
      todoId: input.todoId ?? null,
      projectId: input.projectId ?? null,
      plannedMin: minutes,
      startedAt: new Date(now),
      endsAt: new Date(now + ms),
      paused: false,
      remainingMs: ms,
      status: "ACTIVE",
    },
  });
  return toNow(row, now);
}

/** toggle pause/resume on the current session */
export async function pauseFocus(): Promise<NowState | null> {
  const row = await prisma.focusSession.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (!row) return null;
  const now = Date.now();
  if (row.paused) {
    const up = await prisma.focusSession.update({
      where: { id: row.id },
      data: { paused: false, endsAt: new Date(now + Math.max(0, row.remainingMs)) },
    });
    return toNow(up, now);
  }
  const up = await prisma.focusSession.update({
    where: { id: row.id },
    data: { paused: true, remainingMs: Math.max(0, row.endsAt.getTime() - now) },
  });
  return toNow(up, now);
}

/** end the current session — DONE (finished) or ABANDONED (dropped) */
export async function finishFocus(status: "DONE" | "ABANDONED" = "DONE"): Promise<NowState | null> {
  const row = await prisma.focusSession.findFirst({ where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (!row) return null;
  const now = Date.now();
  const up = await prisma.focusSession.update({
    where: { id: row.id },
    data: { status, endedAt: new Date(now), remainingMs: 0 },
  });
  return toNow(up, now);
}
