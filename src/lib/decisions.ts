// Decision memory — record what you decided and WHY, so you stop re-litigating
// solved questions. A Decision is the SITUATION (a recurring question); each time
// you revisit it you add a REVISION (a new stance + why), keeping the full history
// so a recurring situation shows you every past call — even ones you'd forgotten.
import { prisma } from "@/lib/prisma";
import type { Decision, DecisionRevision } from "@prisma/client";

export type RevisionRow = {
  id: string;
  choice: string;
  reason: string;
  note: string;
  createdAt: string;
};

export type DecisionRow = {
  id: string;
  title: string;
  choice: string;
  reason: string;
  createdAt: string;
  reopenedAt: string | null;
  revisions: RevisionRow[]; // newest first; includes the current stance
};

function revRow(r: DecisionRevision): RevisionRow {
  return { id: r.id, choice: r.choice, reason: r.reason, note: r.note, createdAt: r.createdAt.toISOString() };
}

function toRow(d: Decision & { revisions?: DecisionRevision[] }): DecisionRow {
  return {
    id: d.id,
    title: d.title,
    choice: d.choice,
    reason: d.reason,
    createdAt: d.createdAt.toISOString(),
    reopenedAt: d.reopenedAt ? d.reopenedAt.toISOString() : null,
    revisions: (d.revisions ?? []).map(revRow),
  };
}

const withRevs = { revisions: { orderBy: { createdAt: "desc" as const } } };

export async function addDecision(input: { title: string; choice: string; reason?: string }): Promise<DecisionRow | null> {
  const title = input.title.trim().slice(0, 240);
  const choice = input.choice.trim().slice(0, 240);
  if (!title || !choice) return null;
  const reason = (input.reason ?? "").trim();
  const d = await prisma.decision.create({
    data: { title, choice, reason, revisions: { create: { choice, reason } } },
    include: withRevs,
  });
  return toRow(d);
}

export async function listDecisions(): Promise<DecisionRow[]> {
  const rows = await prisma.decision.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: withRevs });
  return rows.map(toRow);
}

/** Revisit a situation: log a NEW stance (choice + why + what changed) and make it
 *  current. The prior stances stay in the history. */
export async function reviseDecision(id: string, input: { choice: string; reason?: string; note?: string }): Promise<DecisionRow | null> {
  const choice = input.choice.trim().slice(0, 240);
  if (!choice) return null;
  const reason = (input.reason ?? "").trim();
  const note = (input.note ?? "").trim();
  await prisma.decisionRevision.create({ data: { decisionId: id, choice, reason, note } }).catch(() => null);
  const d = await prisma.decision
    .update({ where: { id }, data: { choice, reason, reopenedAt: null }, include: withRevs })
    .catch(() => null);
  return d ? toRow(d) : null;
}

export async function deleteDecision(id: string): Promise<void> {
  // revisions cascade via the FK
  await prisma.decision.delete({ where: { id } }).catch(() => null);
}

/** Remove a single history entry. Never removes the last remaining one; if the
 *  current stance is deleted, the container falls back to the newest survivor. */
export async function deleteRevision(revisionId: string): Promise<DecisionRow | null> {
  const rev = await prisma.decisionRevision.findUnique({ where: { id: revisionId } });
  if (!rev) return null;
  const count = await prisma.decisionRevision.count({ where: { decisionId: rev.decisionId } });
  if (count <= 1) return null; // keep at least one stance
  await prisma.decisionRevision.delete({ where: { id: revisionId } }).catch(() => null);
  const latest = await prisma.decisionRevision.findFirst({ where: { decisionId: rev.decisionId }, orderBy: { createdAt: "desc" } });
  const d = await prisma.decision
    .update({ where: { id: rev.decisionId }, data: latest ? { choice: latest.choice, reason: latest.reason } : {}, include: withRevs })
    .catch(() => null);
  return d ? toRow(d) : null;
}
