// Every benchmark on the wellbeing page derives from one place: your profile.
// Change the weight or the goal and the calorie, protein and water targets move with it.
// Mifflin–St Jeor for BMR (the standard clinical estimate), activity factor for TDEE.

export const ACTIVITY = [
  { key: "SEDENTARY", label: "Sedentary", factor: 1.2, hint: "desk-bound, barely move" },
  { key: "LIGHT", label: "Lightly active", factor: 1.375, hint: "1–3 sessions a week" },
  { key: "MODERATE", label: "Moderately active", factor: 1.55, hint: "3–5 sessions a week" },
  { key: "ACTIVE", label: "Very active", factor: 1.725, hint: "6–7 sessions a week" },
  { key: "ATHLETE", label: "Athlete", factor: 1.9, hint: "twice a day, or a physical job" },
] as const;

export const GOALS = [
  { key: "CUT", label: "Lose fat", kcal: -400, proteinPerKg: 2.0, hint: "~400 kcal deficit" },
  { key: "MAINTAIN", label: "Maintain", kcal: 0, proteinPerKg: 1.6, hint: "hold your weight" },
  { key: "BULK", label: "Build muscle", kcal: 300, proteinPerKg: 1.8, hint: "~300 kcal surplus" },
] as const;

export const SEXES = [
  { key: "MALE", label: "Male" },
  { key: "FEMALE", label: "Female" },
] as const;

export type ProfileRow = {
  sex: string;
  birthYear: number;
  heightCm: number;
  activity: string;
  goal: string;
  weightKg: number; // latest weigh-in, or the profile fallback
  bedMin: number; // usual bedtime (minutes from midnight)
  wakeMin: number; // usual wake time
};

export type Targets = {
  age: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  activity: (typeof ACTIVITY)[number];
  goal: (typeof GOALS)[number];
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  proteinRange: [number, number];
  waterMl: number;
  fibreG: number;
  sodiumMg: number; // daily ceiling (WHO)
  sugarG: number; // added/free-sugar ceiling (AHA)
  bmi: number;
  bmiLabel: string;
  bmiTone: string;
  healthyRange: [number, number]; // kg, for this height
  bedMin: number; // your usual bedtime
  wakeMin: number; // your usual wake time
};

const round = (n: number, to = 1) => Math.round(n / to) * to;

export function computeTargets(p: ProfileRow, nowMs: number): Targets {
  const age = Math.max(1, new Date(nowMs).getFullYear() - p.birthYear);
  const activity = ACTIVITY.find((a) => a.key === p.activity) ?? ACTIVITY[1];
  const goal = GOALS.find((g) => g.key === p.goal) ?? GOALS[1];

  // Mifflin–St Jeor
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  const bmr = round(base + (p.sex === "FEMALE" ? -161 : 5));
  const tdee = round(bmr * activity.factor);
  const calories = round(tdee + goal.kcal, 10);

  const proteinG = round(p.weightKg * goal.proteinPerKg);
  const proteinRange: [number, number] = [round(p.weightKg * 1.6), round(p.weightKg * 2.2)];

  // ~35 ml per kg of bodyweight — the common clinical rule of thumb
  const waterMl = round(p.weightKg * 35, 100);
  // ~14 g of fibre per 1000 kcal
  const fibreG = round((calories / 1000) * 14);
  // ceilings, not targets: WHO caps sodium at 2000 mg; AHA caps added sugar at 36 g (men) / 25 g (women)
  const sodiumMg = 2000;
  const sugarG = p.sex === "FEMALE" ? 25 : 36;

  const m = p.heightCm / 100;
  const bmi = Math.round((p.weightKg / (m * m)) * 10) / 10;
  const bmiLabel = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  const bmiTone = bmi < 18.5 ? "var(--warn)" : bmi < 25 ? "var(--good)" : bmi < 30 ? "var(--warn)" : "var(--bad)";
  const healthyRange: [number, number] = [round(18.5 * m * m), round(24.9 * m * m)];

  return {
    age,
    sex: p.sex,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    activity,
    goal,
    bmr,
    tdee,
    calories,
    proteinG,
    proteinRange,
    waterMl,
    fibreG,
    sodiumMg,
    sugarG,
    bmi,
    bmiLabel,
    bmiTone,
    healthyRange,
    bedMin: p.bedMin,
    wakeMin: p.wakeMin,
  };
}

// a glass is 250 ml — the unit you actually think in
export const GLASS_ML = 250;

export function glasses(ml: number) {
  return Math.round((ml / GLASS_ML) * 10) / 10;
}

export function litres(ml: number) {
  return Math.round(ml / 100) / 10;
}

/** how a day's calories land against target: eating 20% over or under both count as off */
export function calorieTone(kcal: number, target: number) {
  if (!kcal) return "var(--ink-faint)";
  const off = Math.abs(kcal - target) / target;
  if (off <= 0.1) return "var(--good)";
  if (off <= 0.25) return "var(--warn)";
  return "var(--bad)";
}

export function feetInches(cm: number) {
  const total = cm / 2.54;
  const ft = Math.floor(total / 12);
  const inch = Math.round(total - ft * 12);
  return `${ft}'${inch}"`;
}
