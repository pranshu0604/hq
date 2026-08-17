// subtle tint bg + luminous text = vibrant without shouting
const COLORS: Record<string, string> = {
  DREAM: "text-accent bg-accent/12 border-accent/25",
  STRONG: "text-good bg-good/12 border-good/25",
  BACKUP: "text-ink-dim bg-[color:var(--neutral-tint)] border-line",
  IGNORE_IF_BETTER: "text-ink-faint bg-[color:var(--neutral-tint)] border-line line-through",
  PENDING: "text-accent bg-accent/10 border-accent/40 border-dashed",
  APPLIED: "text-info bg-info/12 border-info/25",
  RESPONSE: "text-warn bg-warn/12 border-warn/25",
  INTERVIEWING: "text-violet bg-violet/12 border-violet/25",
  OFFER: "text-good bg-good/12 border-good/25",
  REJECTED: "text-bad bg-bad/12 border-bad/25",
  WITHDRAWN: "text-ink-faint bg-[color:var(--neutral-tint)] border-line",
  IDEA: "text-info bg-info/12 border-info/25",
  PLANNING: "text-warn bg-warn/12 border-warn/25",
  BUILDING: "text-accent bg-accent/12 border-accent/25",
  SHIPPED: "text-good bg-good/12 border-good/25",
  ABANDONED: "text-ink-faint bg-[color:var(--neutral-tint)] border-line line-through",
  HIGH: "text-bad bg-bad/12 border-bad/25",
  MEDIUM: "text-warn bg-warn/12 border-warn/25",
  LOW: "text-ink-faint bg-[color:var(--neutral-tint)] border-line",
};

export function Tag({ value, label }: { value: string; label?: string }) {
  const cls = COLORS[value] ?? "text-ink-dim bg-[color:var(--neutral-tint)] border-line";
  return (
    <span className={`inline-block border rounded-md px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide ${cls}`}>
      {label ?? value.replace(/_/g, " ")}
    </span>
  );
}
