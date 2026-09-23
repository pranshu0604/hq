// Career profile — the singleton (id = "me") the job-application autofill draws
// from. Every field is a string, so the editor and the filler never have to care
// about types, and new fields are additive. Read creates the row on first use.
import { prisma } from "@/lib/prisma";

export const CAREER_FIELDS = [
  "fullName",
  "headline",
  "email",
  "phone",
  "location",
  "linkedin",
  "github",
  "portfolio",
  "twitter",
  "currentTitle",
  "currentCompany",
  "yearsExp",
  "workAuth",
  "noticePeriod",
  "expectedSalary",
  "currentSalary",
  "education",
  "skills",
  "experience",
  "projects",
  "pitch",
  "extras",
] as const;

export type CareerField = (typeof CAREER_FIELDS)[number];
export type CareerProfileData = Record<CareerField, string> & { updatedAt: string };

const empty = (): Record<CareerField, string> =>
  Object.fromEntries(CAREER_FIELDS.map((k) => [k, ""])) as Record<CareerField, string>;

export async function getCareerProfile(): Promise<CareerProfileData> {
  const row =
    (await prisma.careerProfile.findUnique({ where: { id: "me" } })) ??
    (await prisma.careerProfile.create({ data: { id: "me" } }));
  const out = empty() as CareerProfileData;
  for (const k of CAREER_FIELDS) out[k] = (row as Record<string, unknown>)[k] as string ?? "";
  out.updatedAt = row.updatedAt.toISOString();
  return out;
}

/** patch any subset of the string fields — unknown keys are ignored */
export async function updateCareerProfile(patch: Record<string, unknown>): Promise<CareerProfileData> {
  const data: Record<string, string> = {};
  for (const k of CAREER_FIELDS) {
    if (patch[k] != null) data[k] = String(patch[k]).slice(0, 20000);
  }
  await prisma.careerProfile.upsert({
    where: { id: "me" },
    create: { id: "me", ...data },
    update: data,
  });
  return getCareerProfile();
}
