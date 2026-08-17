"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function refresh() {
  revalidatePath("/gym");
  revalidatePath("/");
  revalidatePath("/insights");
}

export type WorkoutInput = { groups: string[]; date?: string; durationMin?: number | null; notes?: string };

export async function logWorkout(input: WorkoutInput) {
  const groups = (input.groups ?? []).map((g) => g.trim()).filter(Boolean);
  if (groups.length === 0) return;
  const date = input.date ? new Date(input.date) : new Date();
  await prisma.workout.create({
    data: {
      date,
      groups: groups.join(", "),
      notes: (input.notes ?? "").trim(),
      durationMin: input.durationMin && input.durationMin > 0 ? Math.round(input.durationMin) : null,
    },
  });
  refresh();
}

export async function updateWorkout(id: string, input: WorkoutInput) {
  const groups = (input.groups ?? []).map((g) => g.trim()).filter(Boolean);
  if (groups.length === 0) return;
  await prisma.workout.update({
    where: { id },
    data: {
      date: input.date ? new Date(input.date) : undefined,
      groups: groups.join(", "),
      notes: (input.notes ?? "").trim(),
      durationMin: input.durationMin && input.durationMin > 0 ? Math.round(input.durationMin) : null,
    },
  }).catch(() => null);
  refresh();
}

export async function deleteWorkout(id: string) {
  await prisma.workout.delete({ where: { id } });
  refresh();
}
