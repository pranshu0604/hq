"use server";

import { prisma } from "@/lib/prisma";
import { WorkBucket } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseScopes } from "@/lib/work";

// store multiple scopes normalized as a comma-separated list
function normScope(scope: string) {
  return parseScopes(scope).join(", ");
}

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function refresh(id?: string) {
  revalidatePath("/work");
  if (id) revalidatePath(`/work/${id}`);
  revalidatePath("/");
}

const BUCKETS = ["DOING", "BUG", "PARKED", "DONE"];
function asBucket(v: string): WorkBucket {
  return (BUCKETS.includes(v) ? v : "DOING") as WorkBucket;
}

export async function createCompany(formData: FormData): Promise<string | null> {
  const name = str(formData, "name");
  if (!name) return null;
  const c = await prisma.company.create({
    data: { name, role: str(formData, "role"), kind: str(formData, "kind") || "freelance" },
  });
  refresh(c.id);
  return c.id;
}

export async function updateCompany(id: string, formData: FormData) {
  await prisma.company.update({
    where: { id },
    data: { name: str(formData, "name"), role: str(formData, "role"), kind: str(formData, "kind"), notes: str(formData, "notes") },
  });
  refresh(id);
}

export async function toggleActive(id: string, active: boolean) {
  await prisma.company.update({ where: { id }, data: { active } });
  refresh(id);
}

export async function deleteCompany(id: string) {
  await prisma.company.delete({ where: { id } });
  await prisma.mention.deleteMany({
    where: { OR: [{ sourceType: "company", sourceId: id }, { targetType: "company", targetId: id }] },
  });
  refresh();
}

export async function addWorkItem(companyId: string, title: string, bucket: string, scope = "") {
  const t = title.trim();
  if (!t) return;
  const max = await prisma.workItem.aggregate({ where: { companyId, bucket: asBucket(bucket) }, _max: { order: true } });
  await prisma.workItem.create({ data: { companyId, title: t, bucket: asBucket(bucket), scope: normScope(scope), order: (max._max.order ?? -1) + 1 } });
  refresh(companyId);
}

export async function moveWorkItem(id: string, bucket: string, companyId: string) {
  await prisma.workItem.update({ where: { id }, data: { bucket: asBucket(bucket) } });
  refresh(companyId);
}

export async function setWorkItemScope(id: string, scope: string, companyId: string) {
  await prisma.workItem.update({ where: { id }, data: { scope: normScope(scope) } });
  refresh(companyId);
}

export async function updateWorkItemTitle(id: string, title: string, companyId: string) {
  const t = title.trim();
  if (!t) return;
  await prisma.workItem.update({ where: { id }, data: { title: t } });
  refresh(companyId);
}

export async function deleteWorkItem(id: string, companyId: string) {
  await prisma.workItem.delete({ where: { id } });
  refresh(companyId);
}
