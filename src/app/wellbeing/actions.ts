"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { dayStart, NUTRIENTS } from "@/lib/wellbeing";
import { ACTIVITY, GOALS, SEXES } from "@/lib/nutrition";
import { syncInlineMentions } from "@/app/mentions/actions";
import { parseInlineMentions } from "@/lib/entities";

function refresh() {
  revalidatePath("/wellbeing");
  revalidatePath("/");
  revalidatePath("/insights");
}

export type DayPatch = {
  brushed?: number;
  bathed?: boolean;
  roomCleaned?: boolean;
  beardTrimmed?: boolean;
  smokes?: number;
  waterMl?: number;
  sleepHours?: number | null;
  posture?: number | null;
  mood?: number | null;
  nutrients?: string[];
  notes?: string;
};

type DayData = {
  brushed?: number;
  bathed?: boolean;
  roomCleaned?: boolean;
  beardTrimmed?: boolean;
  smokes?: number;
  waterMl?: number;
  sleepHours?: number | null;
  posture?: number | null;
  mood?: number | null;
  nutrients?: string;
  notes?: string;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clampInt = (n: number, lo: number, hi: number) => clamp(Math.round(n), lo, hi);

function toData(patch: DayPatch): DayData {
  const d: DayData = {};
  if (patch.brushed !== undefined) d.brushed = clampInt(patch.brushed, 0, 2);
  if (patch.bathed !== undefined) d.bathed = patch.bathed;
  if (patch.roomCleaned !== undefined) d.roomCleaned = patch.roomCleaned;
  if (patch.beardTrimmed !== undefined) d.beardTrimmed = patch.beardTrimmed;
  if (patch.smokes !== undefined) d.smokes = clampInt(patch.smokes, 0, 99);
  if (patch.waterMl !== undefined) d.waterMl = clampInt(patch.waterMl, 0, 15000);
  if (patch.sleepHours !== undefined) d.sleepHours = patch.sleepHours === null ? null : clamp(patch.sleepHours, 0, 24);
  if (patch.posture !== undefined) d.posture = patch.posture === null ? null : clampInt(patch.posture, 1, 5);
  if (patch.mood !== undefined) d.mood = patch.mood === null ? null : clampInt(patch.mood, 1, 100);
  if (patch.nutrients !== undefined)
    d.nutrients = patch.nutrients
      .map((n) => n.trim().toUpperCase())
      .filter((n, i, a) => NUTRIENTS.some((x) => x.key === n) && a.indexOf(n) === i)
      .join(",");
  if (patch.notes !== undefined) d.notes = patch.notes;
  return d;
}

/** upsert the row for a calendar day — the date is the key, so re-saving just patches it */
export async function saveDay(dateISO: string, patch: DayPatch) {
  const date = dayStart(new Date(dateISO));
  const data = toData(patch);
  const day = await prisma.healthDay.upsert({ where: { date }, create: { date, ...data }, update: data });
  if (patch.notes !== undefined) await syncInlineMentions({ type: "health", id: day.id }, parseInlineMentions(patch.notes));
  refresh();
  return day.id;
}

const clampTime = (n: number | null | undefined) => (n === null || n === undefined ? null : clampInt(n, 0, 1439));

export type MealInput = {
  label: string;
  junkLevel: number;
  calories?: number | null;
  proteinG?: number | null;
  sodiumMg?: number | null;
  sugarG?: number | null;
  timeMin?: number | null;
};

export type MealSuggestion = {
  label: string;
  junkLevel: number;
  calories: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
  sugarG: number | null;
};

// foods you've logged before, matching what you're typing — most recent values per name.
// selecting one pre-fills the macros so you don't re-enter a meal you eat often.
export async function suggestMeals(query: string): Promise<MealSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const meals = await prisma.meal.findMany({
    where: { label: { contains: q } },
    orderBy: { createdAt: "desc" },
    distinct: ["label"],
    take: 8,
    select: { label: true, junkLevel: true, calories: true, proteinG: true, sodiumMg: true, sugarG: true },
  });
  const seen = new Set<string>();
  const out: MealSuggestion[] = [];
  for (const m of meals) {
    const key = m.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue; // fold case-variant duplicates
    seen.add(key);
    out.push(m);
  }
  // names that start with the query first, then the rest
  const lower = q.toLowerCase();
  return out.sort((a, b) => Number(b.label.toLowerCase().startsWith(lower)) - Number(a.label.toLowerCase().startsWith(lower)));
}

export async function addMeal(dateISO: string, meal: MealInput) {
  const date = dayStart(new Date(dateISO));
  const day = await prisma.healthDay.upsert({ where: { date }, create: { date }, update: {} });
  await prisma.meal.create({
    data: {
      dayId: day.id,
      label: meal.label.trim(),
      junkLevel: clampInt(meal.junkLevel, 0, 5),
      calories: meal.calories ? clampInt(meal.calories, 0, 10000) : null,
      proteinG: meal.proteinG ? clamp(meal.proteinG, 0, 500) : null,
      sodiumMg: meal.sodiumMg ? clampInt(meal.sodiumMg, 0, 20000) : null,
      sugarG: meal.sugarG ? clamp(meal.sugarG, 0, 1000) : null,
      timeMin: clampTime(meal.timeMin),
    },
  });
  refresh();
}

type MealPatch = { label?: string; junkLevel?: number; calories?: number | null; proteinG?: number | null; sodiumMg?: number | null; sugarG?: number | null; timeMin?: number | null };

export async function updateMeal(id: string, patch: MealPatch) {
  const data: MealPatch = {};
  if (patch.label !== undefined && patch.label.trim()) data.label = patch.label.trim();
  if (patch.junkLevel !== undefined) data.junkLevel = clampInt(patch.junkLevel, 0, 5);
  if (patch.calories !== undefined) data.calories = patch.calories === null ? null : clampInt(patch.calories, 0, 10000);
  if (patch.proteinG !== undefined) data.proteinG = patch.proteinG === null ? null : clamp(patch.proteinG, 0, 500);
  if (patch.sodiumMg !== undefined) data.sodiumMg = patch.sodiumMg === null ? null : clampInt(patch.sodiumMg, 0, 20000);
  if (patch.sugarG !== undefined) data.sugarG = patch.sugarG === null ? null : clamp(patch.sugarG, 0, 1000);
  if (patch.timeMin !== undefined) data.timeMin = clampTime(patch.timeMin);
  await prisma.meal.update({ where: { id }, data }).catch(() => null);
  refresh();
}

// ---------- sleep segments ----------
// the check-in holds the whole night's segments client-side and writes them through
// wholesale — simpler than per-row CRUD, and it's only ever a handful of rows.

export type SegInput = { kind: string; startMin: number; endMin: number };

export async function saveSleepSegments(dateISO: string, segs: SegInput[]) {
  const date = dayStart(new Date(dateISO));
  const day = await prisma.healthDay.upsert({ where: { date }, create: { date }, update: {} });
  const clean = segs
    .filter((s) => Number.isFinite(s.startMin) && Number.isFinite(s.endMin) && s.startMin !== s.endMin)
    .map((s) => ({
      dayId: day.id,
      kind: s.kind === "NAP" ? "NAP" : "NIGHT",
      startMin: clampInt(s.startMin, 0, 1439),
      endMin: clampInt(s.endMin, 0, 1439),
    }));
  await prisma.$transaction([
    prisma.sleepSegment.deleteMany({ where: { dayId: day.id } }),
    ...(clean.length ? [prisma.sleepSegment.createMany({ data: clean })] : []),
  ]);
  refresh();
}

export async function deleteMeal(id: string) {
  await prisma.meal.delete({ where: { id } }).catch(() => null);
  refresh();
}

export async function deleteDay(id: string) {
  await prisma.healthDay.delete({ where: { id } }).catch(() => null);
  refresh();
}

// ---------- body weight ----------

export async function logWeight(dateISO: string, kg: number, note = "") {
  const date = dayStart(new Date(dateISO));
  const value = clamp(kg, 20, 400);
  await prisma.bodyWeight.upsert({
    where: { date },
    create: { date, kg: value, note: note.trim() },
    update: { kg: value, note: note.trim() },
  });
  refresh();
}

export async function deleteWeight(id: string) {
  await prisma.bodyWeight.delete({ where: { id } }).catch(() => null);
  refresh();
}

// ---------- profile ----------

export type ProfilePatch = {
  sex?: string;
  birthYear?: number;
  heightCm?: number;
  activity?: string;
  goal?: string;
  startWeightKg?: number;
  sleepTargetMin?: number;
  wakeTargetMin?: number;
};

export async function saveProfile(patch: ProfilePatch) {
  const data: ProfilePatch = {};
  if (patch.sex && SEXES.some((s) => s.key === patch.sex)) data.sex = patch.sex;
  if (patch.birthYear !== undefined) data.birthYear = clampInt(patch.birthYear, 1900, new Date().getFullYear() - 5);
  if (patch.heightCm !== undefined) data.heightCm = clamp(patch.heightCm, 100, 250);
  if (patch.activity && ACTIVITY.some((a) => a.key === patch.activity)) data.activity = patch.activity;
  if (patch.goal && GOALS.some((g) => g.key === patch.goal)) data.goal = patch.goal;
  if (patch.startWeightKg !== undefined) data.startWeightKg = clamp(patch.startWeightKg, 20, 400);
  if (patch.sleepTargetMin !== undefined) data.sleepTargetMin = clampInt(patch.sleepTargetMin, 0, 1439);
  if (patch.wakeTargetMin !== undefined) data.wakeTargetMin = clampInt(patch.wakeTargetMin, 0, 1439);
  await prisma.profile.upsert({ where: { id: "me" }, create: { id: "me", ...data }, update: data });
  refresh();
}
