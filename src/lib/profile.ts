import { prisma } from "@/lib/prisma";
import { swr } from "@/lib/cache";
import { computeTargets, type Targets } from "@/lib/nutrition";
import type { WeightRow } from "@/lib/wellbeing";

export type ProfileState = {
  sex: string;
  birthYear: number;
  heightCm: number;
  activity: string;
  goal: string;
  startWeightKg: number;
  weightKg: number; // latest weigh-in, else the fallback
  bedMin: number;
  wakeMin: number;
  targets: Targets;
  weights: WeightRow[];
};

/** the profile is a singleton — read it (creating the default on first run) and derive the targets */
export async function getProfileState(nowMs: number): Promise<ProfileState> {
  return swr("profile", 60_000, () => computeProfileState(nowMs));
}

async function computeProfileState(nowMs: number): Promise<ProfileState> {
  const [existing, weights] = await Promise.all([
    prisma.profile.findUnique({ where: { id: "me" } }),
    prisma.bodyWeight.findMany({ orderBy: { date: "desc" }, take: 400 }),
  ]);
  const profile = existing ?? (await prisma.profile.create({ data: { id: "me" } }));
  const weightKg = weights[0]?.kg ?? profile.startWeightKg;

  return {
    sex: profile.sex,
    birthYear: profile.birthYear,
    heightCm: profile.heightCm,
    activity: profile.activity,
    goal: profile.goal,
    startWeightKg: profile.startWeightKg,
    weightKg,
    bedMin: profile.sleepTargetMin,
    wakeMin: profile.wakeTargetMin,
    targets: computeTargets(
      { sex: profile.sex, birthYear: profile.birthYear, heightCm: profile.heightCm, activity: profile.activity, goal: profile.goal, weightKg, bedMin: profile.sleepTargetMin, wakeMin: profile.wakeTargetMin },
      nowMs
    ),
    weights: weights.map((w) => ({ id: w.id, date: w.date.toISOString(), kg: w.kg, note: w.note })),
  };
}
