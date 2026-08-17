// Capture — the open-loop inbox. Dump anything from anywhere; it's auto-sorted so
// your head doesn't have to hold it. One store for capture, worry-parking,
// rabbit-holes and commitments. Tasks can be promoted to a real Todo (reuse, not
// a parallel task system).
import { prisma } from "@/lib/prisma";
import type { Capture } from "@prisma/client";

export type CaptureKind = "TASK" | "IDEA" | "WORRY" | "RABBIT_HOLE" | "COMMITMENT";
export type CaptureStatus = "OPEN" | "PARKED" | "ACTIONED" | "DROPPED";

export type CaptureRow = {
  id: string;
  text: string;
  kind: CaptureKind;
  status: CaptureStatus;
  who: string;
  todoId: string | null;
  createdAt: string;
};

export const KIND_LABEL: Record<CaptureKind, string> = {
  TASK: "Task",
  IDEA: "Idea",
  WORRY: "Worry",
  RABBIT_HOLE: "Rabbit hole",
  COMMITMENT: "Commitment",
};

const FEAR = /\b(worried|worry|worries|scared|afraid|anxious|anxiety|nervous|stressed|panic|doubt|dread|fear)\b/i;
const RESEARCH = /\b(research|how does|how do|how to|why does|why do|look into|investigate|read about|understand how|explore|deep ?dive|figure out how|what is|whats|learn (about|how))\b/i;
const COMMIT = /\b(promised|i'?ll|i will|i said|owe|get back to|send (it|this|them|him|her)|by (tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|the weekend))\b/i;
const TASK_VERB = /^(email|e-mail|send|call|text|message|dm|ping|finish|fix|build|write|buy|book|schedule|submit|apply|pay|renew|update|prepare|prep|review|clean|reply|respond|follow ?up|order|cancel|email|remind|book|file|print|sign|draft)\b/i;

/** best-guess bucket for a raw capture — the user can always recategorize */
export function categorize(text: string): CaptureKind {
  const t = text.trim();
  if (FEAR.test(t)) return "WORRY";
  if (RESEARCH.test(t)) return "RABBIT_HOLE";
  if (COMMIT.test(t)) return "COMMITMENT";
  if (TASK_VERB.test(t)) return "TASK";
  if (t.endsWith("?")) return "WORRY"; // a lingering open question
  return "IDEA";
}

function toRow(c: Capture): CaptureRow {
  return {
    id: c.id,
    text: c.text,
    kind: c.kind as CaptureKind,
    status: c.status as CaptureStatus,
    who: c.who,
    todoId: c.todoId,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function addCapture(text: string, kind?: CaptureKind, who = ""): Promise<CaptureRow> {
  const clean = text.trim().slice(0, 500);
  const c = await prisma.capture.create({
    data: { text: clean, kind: kind ?? categorize(clean), who: who.trim(), status: "OPEN" },
  });
  return toRow(c);
}

export async function listCaptures(includeResolved = false): Promise<CaptureRow[]> {
  const rows = await prisma.capture.findMany({
    where: includeResolved ? {} : { status: { in: ["OPEN", "PARKED"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toRow);
}

export async function captureCounts(): Promise<{ open: number; parked: number; worries: number; rabbitHoles: number; commitments: number }> {
  const [open, parked, worries, rabbitHoles, commitments] = await Promise.all([
    prisma.capture.count({ where: { status: "OPEN" } }),
    prisma.capture.count({ where: { status: "PARKED" } }),
    prisma.capture.count({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "WORRY" } }),
    prisma.capture.count({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "RABBIT_HOLE" } }),
    prisma.capture.count({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "COMMITMENT" } }),
  ]);
  return { open, parked, worries, rabbitHoles, commitments };
}

export async function setCaptureStatus(id: string, status: CaptureStatus): Promise<CaptureRow | null> {
  const c = await prisma.capture.update({ where: { id }, data: { status } }).catch(() => null);
  return c ? toRow(c) : null;
}

export async function setCaptureKind(id: string, kind: CaptureKind): Promise<CaptureRow | null> {
  const c = await prisma.capture.update({ where: { id }, data: { kind } }).catch(() => null);
  return c ? toRow(c) : null;
}

/** edit the text of a capture in place */
export async function updateCaptureText(id: string, text: string): Promise<CaptureRow | null> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return null;
  const c = await prisma.capture.update({ where: { id }, data: { text: clean } }).catch(() => null);
  return c ? toRow(c) : null;
}

/** promote a capture into a real Todo and mark it actioned (reuse the todo system) */
export async function promoteToTodo(id: string): Promise<CaptureRow | null> {
  const cap = await prisma.capture.findUnique({ where: { id } });
  if (!cap) return null;
  const todo = await prisma.todo.create({ data: { title: cap.text.slice(0, 200) } });
  const c = await prisma.capture.update({ where: { id }, data: { status: "ACTIONED", todoId: todo.id } });
  return toRow(c);
}

export async function deleteCapture(id: string): Promise<void> {
  await prisma.capture.delete({ where: { id } }).catch(() => null);
}
