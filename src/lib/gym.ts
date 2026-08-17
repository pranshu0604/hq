// muscle groups offered in the logger — order is the display order
export const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full body"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export function parseGroups(s: string): string[] {
  return s
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}
