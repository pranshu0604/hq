"use server";

import { prisma } from "@/lib/prisma";
import { ReflectionSide } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { stripHtml } from "@/lib/format";
import { parseInlineMentions } from "@/lib/entities";
import { syncInlineMentions } from "@/app/mentions/actions";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function refresh(id?: string) {
  revalidatePath("/reflections");
  if (id) revalidatePath(`/reflections/${id}`);
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function createReflection(): Promise<string> {
  const r = await prisma.reflection.create({
    data: { title: "", thesisLabel: "Thesis", antithesisLabel: "Antithesis" },
  });
  refresh(r.id);
  return r.id;
}

export async function updateReflection(id: string, fd: FormData) {
  const leanRaw = Number(fd.get("lean"));
  const synthesis = str(fd, "synthesis");
  await prisma.reflection.update({
    where: { id },
    data: {
      title: str(fd, "title"),
      thesisLabel: str(fd, "thesisLabel") || "Thesis",
      antithesisLabel: str(fd, "antithesisLabel") || "Antithesis",
      thesisBody: str(fd, "thesisBody"),
      antithesisBody: str(fd, "antithesisBody"),
      synthesis,
      lean: Number.isFinite(leanRaw) ? Math.min(100, Math.max(0, Math.round(leanRaw))) : 50,
    },
  });
  await syncInlineMentions({ type: "reflection", id }, parseInlineMentions(synthesis));
  refresh(id);
}

export async function deleteReflection(id: string) {
  await prisma.reflection.delete({ where: { id } });
  await prisma.mention.deleteMany({
    where: { OR: [{ sourceType: "reflection", sourceId: id }, { targetType: "reflection", targetId: id }] },
  });
  refresh();
}

export async function addThought(reflectionId: string, side: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const s = side === "ANTITHESIS" ? "ANTITHESIS" : "THESIS";
  const max = await prisma.reflectionThought.aggregate({
    where: { reflectionId, side: s as ReflectionSide },
    _max: { order: true },
  });
  await prisma.reflectionThought.create({
    data: { reflectionId, side: s as ReflectionSide, body: text, order: (max._max.order ?? -1) + 1 },
  });
  refresh(reflectionId);
}

// drop an existing note onto a side as a supporting incident — snapshot its text
// (so it survives note deletion) and link it, and mirror into the mention graph.
export async function addNoteIncident(reflectionId: string, side: string, noteId: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { id: true, title: true, content: true } });
  if (!note) return;
  const s = side === "ANTITHESIS" ? "ANTITHESIS" : "THESIS";
  const snapshot = [note.title.trim(), stripHtml(note.content)].filter(Boolean).join(" — ") || "Untitled note";
  const max = await prisma.reflectionThought.aggregate({
    where: { reflectionId, side: s as ReflectionSide },
    _max: { order: true },
  });
  await prisma.reflectionThought.create({
    data: { reflectionId, side: s as ReflectionSide, body: snapshot, noteId: note.id, order: (max._max.order ?? -1) + 1 },
  });
  await prisma.mention.upsert({
    where: { sourceType_sourceId_targetType_targetId: { sourceType: "reflection", sourceId: reflectionId, targetType: "note", targetId: note.id } },
    create: { sourceType: "reflection", sourceId: reflectionId, targetType: "note", targetId: note.id },
    update: {},
  });
  refresh(reflectionId);
  revalidatePath("/notes");
}

// edit a free thought's text. incidents dropped from a note (noteId set) are snapshots —
// leave those read-only so the record of what the note said stays honest.
export async function updateThought(id: string, reflectionId: string, body: string) {
  const text = body.trim();
  if (!text) return;
  const thought = await prisma.reflectionThought.findUnique({ where: { id }, select: { noteId: true } });
  if (!thought || thought.noteId) return;
  await prisma.reflectionThought.update({ where: { id }, data: { body: text } });
  refresh(reflectionId);
}

export async function deleteThought(id: string, reflectionId: string) {
  await prisma.reflectionThought.delete({ where: { id } });
  refresh(reflectionId);
}
