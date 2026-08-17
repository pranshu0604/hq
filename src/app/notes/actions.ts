"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseInlineMentions } from "@/lib/entities";
import { syncInlineMentions } from "@/app/mentions/actions";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createNote() {
  const note = await prisma.note.create({ data: { title: "Untitled note", content: "" } });
  revalidatePath("/notes");
  return note.id;
}

export async function updateNote(id: string, formData: FormData) {
  const content = str(formData, "content");
  await prisma.note.update({
    where: { id },
    data: {
      title: str(formData, "title") || "Untitled note",
      content,
    },
  });
  await syncInlineMentions({ type: "note", id }, parseInlineMentions(content));
  revalidatePath("/notes");
}

export async function togglePin(id: string, pinned: boolean) {
  await prisma.note.update({ where: { id }, data: { pinned } });
  revalidatePath("/notes");
}

export async function deleteNote(id: string) {
  await prisma.note.delete({ where: { id } });
  revalidatePath("/notes");
}
