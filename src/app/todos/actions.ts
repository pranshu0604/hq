"use server";

import { prisma } from "@/lib/prisma";
import { TodoKind, TodoPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function refresh() {
  revalidatePath("/todos");
  revalidatePath("/");
}

export async function createTodo(formData: FormData) {
  const title = str(formData, "title");
  if (!title) return;
  const dueDateRaw = str(formData, "dueDate");
  const kind = (str(formData, "kind") || "QUICK") as TodoKind;

  await prisma.todo.create({
    data: {
      title,
      priority: (str(formData, "priority") || "MEDIUM") as TodoPriority,
      kind,
      status: kind === "ONGOING" ? str(formData, "status") : "",
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });
  refresh();
}

export async function toggleTodo(id: string, done: boolean) {
  await prisma.todo.update({ where: { id }, data: { done } });
  refresh();
}

export async function updateTodoStatus(id: string, status: string) {
  await prisma.todo.update({ where: { id }, data: { status: status.trim() } });
  refresh();
}

export async function updateTodo(id: string, patch: { title?: string; priority?: string; kind?: string; dueDate?: string | null }) {
  const data: { title?: string; priority?: TodoPriority; kind?: TodoKind; status?: string; dueDate?: Date | null } = {};
  if (patch.title !== undefined && patch.title.trim()) data.title = patch.title.trim();
  if (patch.priority && ["HIGH", "MEDIUM", "LOW"].includes(patch.priority)) data.priority = patch.priority as TodoPriority;
  if (patch.kind && ["QUICK", "ONGOING"].includes(patch.kind)) {
    data.kind = patch.kind as TodoKind;
    if (patch.kind === "QUICK") data.status = ""; // a quick todo carries no running status
  }
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  await prisma.todo.update({ where: { id }, data }).catch(() => null);
  refresh();
}

export async function deleteTodo(id: string) {
  await prisma.todo.delete({ where: { id } });
  refresh();
}
