export const WORK_BUCKETS = [
  { key: "DOING", label: "Doing", color: "var(--info)" },
  { key: "BUG", label: "Bugs", color: "var(--bad)" },
  { key: "PARKED", label: "Parked", color: "var(--warn)" },
  { key: "DONE", label: "Done", color: "var(--good)" },
] as const;

export type BucketKey = (typeof WORK_BUCKETS)[number]["key"];

export const COMPANY_KINDS = [
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "full-time", label: "Full-time" },
  { value: "contract", label: "Contract" },
];

// common scopes offered as suggestions — any custom text is allowed too
export const SCOPE_PRESETS = ["FE", "BE", "Full-stack", "Design", "DevOps", "Infra", "Data", "QA", "Docs"];

// a task can carry several scopes — split on comma, plus, or slash so both
// "FE, BE" and legacy "FE+BE" / "SE/FE/BE" parse into independent tags.
export function parseScopes(s: string): string[] {
  return [...new Set(s.split(/[,+/]/).map((x) => x.trim()).filter(Boolean))];
}

// stable color per scope label so FE and BE always read as distinct
const SCOPE_COLORS = ["var(--info)", "var(--accent)", "var(--violet)", "var(--good)", "var(--warn)", "var(--bad)"];
export function scopeColor(scope: string): string {
  let h = 0;
  const s = scope.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SCOPE_COLORS[h % SCOPE_COLORS.length];
}
