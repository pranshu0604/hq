"use server";

import { prisma } from "@/lib/prisma";
import { SocialAction, SocialPlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getNow } from "@/lib/format";
import { summarize } from "@/lib/social";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function refresh() {
  revalidatePath("/social");
  revalidatePath("/");
  revalidatePath("/insights");
}

export type LogResult = {
  today: number;
  platformsToday: number;
  sweep: boolean;
  streak: number;
  firstToday: boolean;
  firstOnPlatform: boolean;
};

/** shared by the one-tap tiles and the detailed form — returns what the client should celebrate */
async function record(platform: string, action: string, note = "", link = "") {
  const before = summarize(await prisma.socialLog.findMany({ select: { platform: true, createdAt: true } }), getNow());

  await prisma.socialLog.create({
    data: {
      platform: platform as SocialPlatform,
      action: (action || "POST") as SocialAction,
      note,
      link: link || null,
    },
  });

  const after = summarize(await prisma.socialLog.findMany({ select: { platform: true, createdAt: true } }), getNow());
  refresh();

  return {
    today: after.today,
    platformsToday: after.platformsToday,
    sweep: after.sweep && !before.sweep,
    streak: after.streak,
    firstToday: before.today === 0,
    firstOnPlatform: (before.todayByPlatform[platform] ?? 0) === 0,
  } satisfies LogResult;
}

export async function logSocial(platform: string): Promise<LogResult | null> {
  if (!["X", "LINKEDIN", "INSTAGRAM"].includes(platform)) return null;
  return record(platform, "POST");
}

export async function createSocialLog(formData: FormData): Promise<LogResult | null> {
  const platform = str(formData, "platform");
  if (!["X", "LINKEDIN", "INSTAGRAM"].includes(platform)) return null;
  return record(platform, str(formData, "action"), str(formData, "note"), str(formData, "link"));
}

export async function updateSocialLog(id: string, patch: { platform?: string; action?: string; note?: string; link?: string }) {
  const data: { platform?: SocialPlatform; action?: SocialAction; note?: string; link?: string | null } = {};
  if (patch.platform && ["X", "LINKEDIN", "INSTAGRAM"].includes(patch.platform)) data.platform = patch.platform as SocialPlatform;
  if (patch.action) data.action = patch.action as SocialAction;
  if (patch.note !== undefined) data.note = patch.note.trim();
  if (patch.link !== undefined) data.link = patch.link.trim() || null;
  await prisma.socialLog.update({ where: { id }, data }).catch(() => null);
  refresh();
}

export async function deleteSocialLog(id: string) {
  await prisma.socialLog.delete({ where: { id } });
  refresh();
}
