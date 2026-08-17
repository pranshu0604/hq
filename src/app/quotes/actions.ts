"use server";

import { prisma } from "@/lib/prisma";
import { QuoteKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// normalize a comma/newline separated label string
function cleanLabels(raw: string) {
  return [...new Set(raw.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean))].join(", ");
}

function refresh() {
  revalidatePath("/quotes");
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function createQuote(formData: FormData) {
  const text = str(formData, "text");
  if (!text) return;
  await prisma.quote.create({
    data: {
      text,
      author: str(formData, "author"),
      source: str(formData, "source"),
      kind: (str(formData, "kind") || "QUOTE") as QuoteKind,
      labels: cleanLabels(str(formData, "labels")),
    },
  });
  refresh();
}

export async function updateQuote(id: string, formData: FormData) {
  await prisma.quote.update({
    where: { id },
    data: {
      text: str(formData, "text"),
      author: str(formData, "author"),
      source: str(formData, "source"),
      kind: (str(formData, "kind") || "QUOTE") as QuoteKind,
      labels: cleanLabels(str(formData, "labels")),
    },
  });
  refresh();
}

export async function toggleFavorite(id: string, favorite: boolean) {
  await prisma.quote.update({ where: { id }, data: { favorite } });
  refresh();
}

export async function deleteQuote(id: string) {
  await prisma.quote.delete({ where: { id } });
  await prisma.mention.deleteMany({
    where: { OR: [{ sourceType: "quote", sourceId: id }, { targetType: "quote", targetId: id }] },
  });
  refresh();
}
