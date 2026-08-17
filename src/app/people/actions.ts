"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function refresh(id?: string) {
  revalidatePath("/people");
  if (id) revalidatePath(`/people/${id}`);
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function createPerson(formData: FormData): Promise<string | null> {
  const name = str(formData, "name");
  if (!name) return null;
  const person = await prisma.person.create({
    data: { name, relation: str(formData, "relation"), handle: str(formData, "handle") },
  });
  refresh(person.id);
  return person.id;
}

function reminderFrom(formData: FormData): number | null {
  const n = Number(formData.get("reminderDays"));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function updatePerson(id: string, formData: FormData) {
  await prisma.person.update({
    where: { id },
    data: {
      name: str(formData, "name"),
      relation: str(formData, "relation"),
      handle: str(formData, "handle"),
      notes: str(formData, "notes"),
      reminderDays: reminderFrom(formData),
    },
  });
  refresh(id);
}

export async function setReminder(id: string, days: number | null) {
  await prisma.person.update({ where: { id }, data: { reminderDays: days && days > 0 ? days : null } });
  refresh(id);
}

export async function deletePerson(id: string) {
  await prisma.person.delete({ where: { id } });
  await prisma.mention.deleteMany({
    where: { OR: [{ sourceType: "person", sourceId: id }, { targetType: "person", targetId: id }] },
  });
  refresh();
}

export type ConnectResult = { name: string; firstToday: boolean };

export async function logInteraction(personId: string, kind = "", note = "", date?: string): Promise<ConnectResult | null> {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true, name: true } });
  if (!person) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const existingToday = await prisma.interaction.count({ where: { personId, date: { gte: start } } });

  await prisma.interaction.create({
    data: { personId, kind: kind.trim(), note: note.trim(), date: date ? new Date(date) : new Date() },
  });
  // bump person so "recently connected" sorting works
  await prisma.person.update({ where: { id: personId }, data: { updatedAt: new Date() } });
  refresh(personId);
  return { name: person.name, firstToday: existingToday === 0 };
}

export async function updateInteraction(id: string, personId: string, patch: { kind?: string; note?: string; date?: string }) {
  const data: { kind?: string; note?: string; date?: Date } = {};
  if (patch.kind !== undefined) data.kind = patch.kind.trim();
  if (patch.note !== undefined) data.note = patch.note.trim();
  if (patch.date) data.date = new Date(patch.date);
  await prisma.interaction.update({ where: { id }, data }).catch(() => null);
  refresh(personId);
}

export async function deleteInteraction(id: string, personId: string) {
  await prisma.interaction.delete({ where: { id } });
  refresh(personId);
}

// fold a duplicate person into another: move all touchpoints + tags, merge notes,
// then delete the duplicate. no data is lost.
export async function mergePerson(fromId: string, intoId: string): Promise<string | null> {
  if (!fromId || !intoId || fromId === intoId) return null;
  const [from, into] = await Promise.all([
    prisma.person.findUnique({ where: { id: fromId } }),
    prisma.person.findUnique({ where: { id: intoId } }),
  ]);
  if (!from || !into) return null;

  await prisma.interaction.updateMany({ where: { personId: fromId }, data: { personId: intoId } });

  // re-point mention rows on either side, skipping ones that would collide
  const repoint = async (side: "source" | "target") => {
    const where = side === "source" ? { sourceType: "person", sourceId: fromId } : { targetType: "person", targetId: fromId };
    const rows = await prisma.mention.findMany({ where });
    for (const m of rows) {
      const nt = { sourceType: m.sourceType, sourceId: m.sourceId, targetType: m.targetType, targetId: m.targetId, via: m.via };
      if (side === "source") nt.sourceId = intoId;
      else nt.targetId = intoId;
      if (nt.sourceType === nt.targetType && nt.sourceId === nt.targetId) continue; // would self-link
      await prisma.mention.upsert({
        where: { sourceType_sourceId_targetType_targetId: { sourceType: nt.sourceType, sourceId: nt.sourceId, targetType: nt.targetType, targetId: nt.targetId } },
        create: nt,
        update: {},
      });
    }
    await prisma.mention.deleteMany({ where });
  };
  await repoint("source");
  await repoint("target");

  await prisma.person.update({
    where: { id: intoId },
    data: {
      notes: [into.notes, from.notes].filter((s) => s.trim()).join("\n\n"),
      relation: into.relation || from.relation,
      handle: into.handle || from.handle,
    },
  });
  await prisma.person.delete({ where: { id: fromId } });

  refresh(intoId);
  return intoId;
}
