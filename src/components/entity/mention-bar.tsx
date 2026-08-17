"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addMention, removeMention, searchEntitiesAction } from "@/app/mentions/actions";
import { ENTITY_META, type EntityCard, type EntityRef, type EntityType } from "@/lib/entities";
import { EntityChip } from "./entity-chip";

// the attach half of tagging: link this item to any other item across sections,
// and show what links back. inline @-mentions (next) write to the same graph.
export default function MentionBar({
  sourceType,
  sourceId,
  tagged,
  backlinks = [],
  label = "Tagged",
}: {
  sourceType: EntityType;
  sourceId: string;
  tagged: EntityCard[];
  backlinks?: EntityCard[];
  label?: string;
}) {
  const source: EntityRef = { type: sourceType, id: sourceId };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityCard[]>([]);
  const [pending, start] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const exclude: EntityRef[] = [source, ...tagged.map((t) => ({ type: t.type, id: t.id }))];

  useEffect(() => {
    if (!open) return;
    let live = true;
    searchEntitiesAction(query, exclude).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, tagged.length]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const attach = (card: EntityCard) => {
    setOpen(false);
    setQuery("");
    start(() => addMention(source, { type: card.type, id: card.id }));
  };
  const detach = (card: EntityCard) => start(() => removeMention(source, { type: card.type, id: card.id }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">{label}</span>
        {tagged.map((c) => (
          <span key={`${c.type}:${c.id}`} className="inline-flex items-center">
            <EntityChip card={c} />
            <button
              type="button"
              onClick={() => detach(c)}
              disabled={pending}
              aria-label="Remove tag"
              className="ml-0.5 text-ink-faint hover:text-bad transition-colors text-xs px-0.5"
            >
              ×
            </button>
          </span>
        ))}

        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 border border-dashed border-line-strong rounded-md px-2 py-[3px] text-xs text-ink-dim hover:text-accent hover:border-accent transition-colors"
          >
            + tag
          </button>

          {open && (
            <div className="elevated absolute left-0 top-full mt-1.5 w-72 rounded-lg border border-line bg-card p-1.5 z-30">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (results[0]) attach(results[0]);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Search anything to link…"
                className="field-input w-full mb-1.5 text-sm"
              />
              <div className="max-h-64 overflow-y-auto">
                {results.length === 0 && <div className="text-ink-faint text-xs px-2 py-3">Nothing to link.</div>}
                {results.map((c) => (
                  <button
                    type="button"
                    key={`${c.type}:${c.id}`}
                    onClick={() => attach(c)}
                    className="w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2 transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: ENTITY_META[c.type].color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{c.title}</span>
                      {c.subtitle && <span className="block truncate text-[11px] text-ink-faint">{c.subtitle}</span>}
                    </span>
                    <span className="label text-[9px] shrink-0">{ENTITY_META[c.type].label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {backlinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">Referenced by</span>
          {backlinks.map((c) => (
            <EntityChip key={`${c.type}:${c.id}`} card={c} muted />
          ))}
        </div>
      )}
    </div>
  );
}
