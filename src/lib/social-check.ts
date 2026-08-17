// Social reality-check store — separates event from interpretation so a
// three-hour rumination becomes a two-minute weigh-up.
import { prisma } from "@/lib/prisma";
import type { SocialCheck } from "@prisma/client";

export type SocialCheckRow = {
  id: string;
  event: string;
  interpretation: string;
  evidenceFor: string;
  evidenceAgainst: string;
  verdict: string;
  createdAt: string;
};

const toRow = (s: SocialCheck): SocialCheckRow => ({
  id: s.id,
  event: s.event,
  interpretation: s.interpretation,
  evidenceFor: s.evidenceFor,
  evidenceAgainst: s.evidenceAgainst,
  verdict: s.verdict,
  createdAt: s.createdAt.toISOString(),
});

export async function addSocialCheck(input: {
  event: string;
  interpretation?: string;
  evidenceFor?: string;
  evidenceAgainst?: string;
  verdict?: string;
}): Promise<SocialCheckRow | null> {
  const event = input.event.trim().slice(0, 400);
  if (!event) return null;
  const s = await prisma.socialCheck.create({
    data: {
      event,
      interpretation: (input.interpretation ?? "").trim(),
      evidenceFor: (input.evidenceFor ?? "").trim(),
      evidenceAgainst: (input.evidenceAgainst ?? "").trim(),
      verdict: ["PARK", "ACT", "LETGO"].includes(String(input.verdict)) ? String(input.verdict) : "",
    },
  });
  return toRow(s);
}

export async function listSocialChecks(): Promise<SocialCheckRow[]> {
  return (await prisma.socialCheck.findMany({ orderBy: { createdAt: "desc" }, take: 100 })).map(toRow);
}

export async function deleteSocialCheck(id: string): Promise<void> {
  await prisma.socialCheck.delete({ where: { id } }).catch(() => null);
}
