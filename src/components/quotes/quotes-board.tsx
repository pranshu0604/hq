"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createQuote, deleteQuote, toggleFavorite } from "@/app/quotes/actions";
import { Select } from "@/components/ui/select";
import FilterBar from "@/components/ui/filter-bar";
import MentionBar from "@/components/entity/mention-bar";
import type { EntityCard } from "@/lib/entities";
import { formatDate } from "@/lib/format";

export type QuoteRow = {
  id: string;
  text: string;
  author: string;
  source: string;
  kind: string;
  labels: string[];
  favorite: boolean;
  createdAt: string;
  tagged: EntityCard[];
  backlinks: EntityCard[];
};

const KIND_OPTS = [
  { value: "QUOTE", label: "Quote" },
  { value: "POEM", label: "Poem" },
  { value: "PROVERB", label: "Proverb" },
  { value: "LYRIC", label: "Lyric" },
];
const KIND_FILTER = [{ value: "ALL", label: "All kinds" }, ...KIND_OPTS.map((k) => ({ ...k, label: k.label + "s" }))];
const SORTS = [
  { value: "recent", label: "Sort: recent" },
  { value: "author", label: "Sort: author A–Z" },
  { value: "favorites", label: "Sort: favorites first" },
];

export default function QuotesBoard({ rows, allLabels }: { rows: QuoteRow[]; allLabels: string[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("ALL");
  const [label, setLabel] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const labelOpts = useMemo(
    () => [{ value: "ALL", label: "All labels" }, ...allLabels.map((l) => ({ value: l, label: l }))],
    [allLabels]
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) => r.text.toLowerCase().includes(q) || r.author.toLowerCase().includes(q) || r.source.toLowerCase().includes(q) || r.labels.some((l) => l.includes(q))
      );
    }
    if (kind !== "ALL") out = out.filter((r) => r.kind === kind);
    if (label !== "ALL") out = out.filter((r) => r.labels.includes(label));
    if (favOnly) out = out.filter((r) => r.favorite);

    out = [...out];
    if (sort === "author") out.sort((a, b) => (a.author || "~").localeCompare(b.author || "~"));
    else if (sort === "favorites") out.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return out;
  }, [rows, query, kind, label, favOnly, sort]);

  return (
    <div>
      <div className="mb-6">
        {adding ? (
          <form
            ref={formRef}
            action={(fd) => {
              start(() => createQuote(fd));
              formRef.current?.reset();
            }}
            className="card p-4 space-y-2.5 reveal"
          >
            <textarea
              name="text"
              required
              autoFocus
              rows={3}
              placeholder="The line itself — paste a quote, a stanza, a proverb…"
              className="field-input w-full resize-y leading-relaxed"
            />
            <div className="flex flex-wrap gap-2">
              <input name="author" placeholder="Author" className="field-input flex-1 min-w-[140px]" />
              <input name="source" placeholder="Source (book, film…)" className="field-input flex-1 min-w-[140px]" />
              <Select name="kind" className="w-32" options={KIND_OPTS} defaultValue="QUOTE" ariaLabel="Kind" />
            </div>
            <input name="labels" placeholder="Labels, comma separated — e.g. stoicism, grief, resolve" className="field-input w-full" />
            <div className="flex items-center gap-2">
              <button disabled={pending} className="btn btn-primary text-sm">
                {pending ? "Saving…" : "Add to collection"}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-accent">
            + Add a quote or poem
          </button>
        )}
      </div>

      <FilterBar query={query} onQuery={setQuery} placeholder="Search text, author, label…" count={filtered.length} total={rows.length} noun="kept">
        <Select className="w-36" options={KIND_FILTER} value={kind} onChange={setKind} ariaLabel="Filter by kind" />
        {allLabels.length > 0 && <Select className="w-40" options={labelOpts} value={label} onChange={setLabel} ariaLabel="Filter by label" />}
        <button
          onClick={() => setFavOnly((v) => !v)}
          className={`btn text-sm ${favOnly ? "btn-accent" : "btn-ghost"}`}
          title="Show favorites only"
        >
          ★ {favOnly ? "favorites" : "all"}
        </button>
        <Select className="w-48 ml-auto" options={SORTS} value={sort} onChange={setSort} align="right" ariaLabel="Sort" />
      </FilterBar>

      {rows.length === 0 ? (
        <div className="card-hero p-8 text-center">
          <div className="display text-2xl mb-2">Start your commonplace book.</div>
          <p className="text-ink-dim text-sm max-w-sm mx-auto">
            Every quote and poem that ever moved you, in one place — labelled so it never gets lost again.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-ink-dim text-sm border-t border-line pt-8">Nothing matches.</div>
      ) : (
        <div className="columns-1 sm:columns-2 gap-4 [column-fill:_balance]">
          {filtered.map((q, i) => (
            <article
              key={q.id}
              style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              className="reveal-row group mb-4 break-inside-avoid card p-5"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="label text-[9px] text-ink-faint">{q.kind.toLowerCase()}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => start(() => toggleFavorite(q.id, !q.favorite))}
                    disabled={pending}
                    aria-label="Toggle favorite"
                    className={`text-sm transition-colors ${q.favorite ? "text-accent" : "text-ink-faint hover:text-accent opacity-0 group-hover:opacity-100"}`}
                  >
                    {q.favorite ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() => start(() => deleteQuote(q.id))}
                    disabled={pending}
                    aria-label="Delete"
                    className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              </div>

              <blockquote className="border-l-2 border-accent/60 pl-3.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
                {q.text}
              </blockquote>

              {(q.author || q.source) && (
                <div className="mt-3 text-xs text-ink-dim font-mono">
                  {q.author && <span>— {q.author}</span>}
                  {q.source && <span className="text-ink-faint">{q.author ? ", " : "— "}{q.source}</span>}
                </div>
              )}

              {q.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {q.labels.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLabel(l)}
                      className="text-[10px] font-mono uppercase tracking-wide text-ink-dim bg-[color:var(--neutral-tint)] border border-line rounded px-1.5 py-0.5 hover:text-accent hover:border-accent/40 transition-colors"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-line-soft">
                <MentionBar sourceType="quote" sourceId={q.id} tagged={q.tagged} backlinks={q.backlinks} />
              </div>

              <div className="label text-[9px] mt-3">{formatDate(q.createdAt)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
