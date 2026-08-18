// Handbooks — self-contained HTML documents uploaded into HQ so your distilled
// research is always at hand. Metadata is listed cheaply; the (potentially large)
// HTML `content` is only loaded when you actually open one.
import { prisma } from "@/lib/prisma";

export type HandbookMeta = {
  id: string;
  title: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per handbook — generous for a single HTML file

export async function listHandbooks(): Promise<HandbookMeta[]> {
  const rows = await prisma.handbook.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, sizeBytes: true, createdAt: true, updatedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getHandbook(id: string): Promise<{ title: string; content: string } | null> {
  const r = await prisma.handbook.findUnique({ where: { id }, select: { title: true, content: true } });
  return r ?? null;
}

export async function addHandbook(input: { title: string; content: string }): Promise<HandbookMeta | null> {
  const title = input.title.trim().slice(0, 200) || "Untitled handbook";
  const content = input.content ?? "";
  if (!content.trim()) return null;
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > MAX_BYTES) return null;
  const r = await prisma.handbook.create({ data: { title, content, sizeBytes } });
  return { id: r.id, title: r.title, sizeBytes: r.sizeBytes, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() };
}

export async function renameHandbook(id: string, title: string): Promise<void> {
  const t = title.trim().slice(0, 200);
  if (!t) return;
  await prisma.handbook.update({ where: { id }, data: { title: t } }).catch(() => null);
}

export async function replaceHandbookContent(id: string, content: string): Promise<void> {
  if (!content.trim()) return;
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > MAX_BYTES) return;
  await prisma.handbook.update({ where: { id }, data: { content, sizeBytes } }).catch(() => null);
}

export async function deleteHandbook(id: string): Promise<void> {
  await prisma.handbook.delete({ where: { id } }).catch(() => null);
}

export const HANDBOOK_MAX_BYTES = MAX_BYTES;
