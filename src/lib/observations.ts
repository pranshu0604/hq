// Personal operating manual — "how I work best". Observations you choose to
// keep, not diagnoses. Kept deliberately plain so it never becomes a chore.
import { prisma } from "@/lib/prisma";
import type { Observation } from "@prisma/client";

export type ObservationRow = { id: string; text: string; createdAt: string };

const toRow = (o: Observation): ObservationRow => ({ id: o.id, text: o.text, createdAt: o.createdAt.toISOString() });

export async function addObservation(text: string): Promise<ObservationRow | null> {
  const t = text.trim().slice(0, 300);
  if (!t) return null;
  return toRow(await prisma.observation.create({ data: { text: t } }));
}

export async function listObservations(): Promise<ObservationRow[]> {
  return (await prisma.observation.findMany({ orderBy: { createdAt: "desc" }, take: 200 })).map(toRow);
}

export async function deleteObservation(id: string): Promise<void> {
  await prisma.observation.delete({ where: { id } }).catch(() => null);
}

// seed prompts — things worth noticing about yourself, to make the blank page easier
export const MANUAL_PROMPTS = [
  "I start more reliably after a concrete first action",
  "I underestimate tasks longer than an hour",
  "I do my best deep work between …",
  "I rabbit-hole during technical work",
  "I abandon projects during the maintenance phase",
  "I perform socially better when I'm not overloaded",
];
