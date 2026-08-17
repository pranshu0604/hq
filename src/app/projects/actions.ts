"use server";

import { prisma } from "@/lib/prisma";
import { ProjectStatus, ProjectPriority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function createProject(formData: FormData) {
  const title = str(formData, "title");
  if (!title) throw new Error("Title is required");

  const project = await prisma.project.create({
    data: {
      title,
      description: str(formData, "description"),
      status: (str(formData, "status") || "IDEA") as ProjectStatus,
      priority: (str(formData, "priority") || "MEDIUM") as ProjectPriority,
      notes: str(formData, "notes"),
    },
  });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const targetRaw = str(formData, "targetDate");
  await prisma.project.update({
    where: { id },
    data: {
      title: str(formData, "title"),
      description: str(formData, "description"),
      status: str(formData, "status") as ProjectStatus,
      priority: str(formData, "priority") as ProjectPriority,
      link: str(formData, "link") || null,
      targetDate: targetRaw ? new Date(targetRaw) : null,
      notes: str(formData, "notes"),
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addTask(projectId: string, formData: FormData) {
  const title = str(formData, "title");
  if (!title) return;
  const count = await prisma.projectTask.count({ where: { projectId } });
  await prisma.projectTask.create({
    data: { projectId, title, order: count },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleTask(taskId: string, projectId: string, done: boolean) {
  await prisma.projectTask.update({ where: { id: taskId }, data: { done } });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateTask(taskId: string, projectId: string, title: string) {
  if (!title.trim()) return;
  await prisma.projectTask.update({ where: { id: taskId }, data: { title: title.trim() } }).catch(() => null);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(taskId: string, projectId: string) {
  await prisma.projectTask.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${projectId}`);
}

// the "resume" context — goal / state / blocker / next action, so returning to a
// project after days is a 30-second reconstruction instead of a cold restart.
export async function updateProjectResume(
  id: string,
  patch: { goal?: string; state?: string; blocker?: string; nextAction?: string },
) {
  const data: { goal?: string; state?: string; blocker?: string; nextAction?: string } = {};
  if (patch.goal !== undefined) data.goal = patch.goal.trim();
  if (patch.state !== undefined) data.state = patch.state.trim();
  if (patch.blocker !== undefined) data.blocker = patch.blocker.trim();
  if (patch.nextAction !== undefined) data.nextAction = patch.nextAction.trim();
  await prisma.project.update({ where: { id }, data }).catch(() => null);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}
