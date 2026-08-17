// Decision memory — record what you decided and WHY, so you stop re-litigating
// solved questions. An anti-rumination tool for an analytical brain.
import { prisma } from "@/lib/prisma";
import type { Decision } from "@prisma/client";

export type DecisionRow = {
  id: string;
  title: string;
  choice: string;
  reason: string;
  createdAt: string;
  reopenedAt: string | null;
};

function toRow(d: Decision): DecisionRow {
  return {
    id: d.id,
    title: d.title,
    choice: d.choice,
    reason: d.reason,
    createdAt: d.createdAt.toISOString(),
    reopenedAt: d.reopenedAt ? d.reopenedAt.toISOString() : null,
  };
}

export async function addDecision(input: { title: string; choice: string; reason?: string }): Promise<DecisionRow | null> {
  const title = input.title.trim().slice(0, 240);
  const choice = input.choice.trim().slice(0, 240);
  if (!title || !choice) return null;
  const d = await prisma.decision.create({ data: { title, choice, reason: (input.reason ?? "").trim() } });
  return toRow(d);
}

export async function listDecisions(): Promise<DecisionRow[]> {
  const rows = await prisma.decision.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map(toRow);
}

export async function reopenDecision(id: string, nowMs = Date.now()): Promise<DecisionRow | null> {
  const d = await prisma.decision.update({ where: { id }, data: { reopenedAt: new Date(nowMs) } }).catch(() => null);
  return d ? toRow(d) : null;
}

export async function deleteDecision(id: string): Promise<void> {
  await prisma.decision.delete({ where: { id } }).catch(() => null);
}
