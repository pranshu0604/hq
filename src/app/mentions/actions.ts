"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ENTITY_META, pathFor, searchEntities, type EntityCard, type EntityRef, type EntityType } from "@/lib/entities";

function valid(type: string): type is EntityType {
  return type in ENTITY_META;
}

// mentions surface on both ends and on the dashboards — revalidate broadly but cheaply
function revalidateAround(source: EntityRef, target: EntityRef) {
  const paths = new Set<string>([
    pathFor(source.type, source.id).split("?")[0],
    pathFor(target.type, target.id).split("?")[0],
    "/",
  ]);
  for (const p of paths) revalidatePath(p);
}

export async function searchEntitiesAction(query: string, exclude: EntityRef[] = [], types?: EntityType[]): Promise<EntityCard[]> {
  return searchEntities(query, 8, exclude, types);
}

export async function addMention(source: EntityRef, target: EntityRef) {
  if (!valid(source.type) || !valid(target.type)) return;
  if (source.type === target.type && source.id === target.id) return; // no self-link
  await prisma.mention.upsert({
    where: {
      sourceType_sourceId_targetType_targetId: {
        sourceType: source.type,
        sourceId: source.id,
        targetType: target.type,
        targetId: target.id,
      },
    },
    create: { sourceType: source.type, sourceId: source.id, targetType: target.type, targetId: target.id },
    update: {},
  });
  revalidateAround(source, target);
}

export async function removeMention(source: EntityRef, target: EntityRef) {
  await prisma.mention.deleteMany({
    where: { sourceType: source.type, sourceId: source.id, targetType: target.type, targetId: target.id },
  });
  revalidateAround(source, target);
}

// reconcile the inline (@-mention) links for one source against what its prose
// currently contains — without disturbing manually-attached links.
export async function syncInlineMentions(source: EntityRef, targets: EntityRef[]) {
  if (!valid(source.type)) return;
  const want = new Set(targets.filter((t) => valid(t.type) && !(t.type === source.type && t.id === source.id)).map((t) => `${t.type}:${t.id}`));

  const existingInline = await prisma.mention.findMany({
    where: { sourceType: source.type, sourceId: source.id, via: "inline" },
  });

  // drop inline links no longer present in the prose
  const toDelete = existingInline.filter((m) => !want.has(`${m.targetType}:${m.targetId}`));
  if (toDelete.length) await prisma.mention.deleteMany({ where: { id: { in: toDelete.map((m) => m.id) } } });

  // add newly-mentioned links (keep an existing manual row's `via` as-is)
  for (const t of targets) {
    if (source.type === t.type && source.id === t.id) continue;
    if (!valid(t.type)) continue;
    await prisma.mention.upsert({
      where: {
        sourceType_sourceId_targetType_targetId: { sourceType: source.type, sourceId: source.id, targetType: t.type, targetId: t.id },
      },
      create: { sourceType: source.type, sourceId: source.id, targetType: t.type, targetId: t.id, via: "inline" },
      update: {},
    });
  }

  revalidatePath(pathFor(source.type, source.id).split("?")[0]);
  revalidatePath("/");
}
