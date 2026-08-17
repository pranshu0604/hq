import Link from "next/link";
import { ENTITY_META, type EntityCard } from "@/lib/entities";

export function EntityChip({ card, muted = false }: { card: EntityCard; muted?: boolean }) {
  const meta = ENTITY_META[card.type];
  return (
    <Link
      href={card.href}
      title={`${meta.label}: ${card.title}${card.subtitle ? ` — ${card.subtitle}` : ""}`}
      className={`inline-flex items-center gap-1.5 border rounded-md pl-1.5 pr-2 py-[3px] text-xs max-w-[220px] transition-colors ${
        muted ? "border-line-soft text-ink-dim hover:text-ink hover:border-line" : "border-line text-ink hover:border-line-strong hover:bg-surface-2"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="truncate">{card.title}</span>
    </Link>
  );
}
