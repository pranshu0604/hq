"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createPerson, logInteraction } from "@/app/people/actions";
import { burst } from "@/components/game/confetti";
import { addToast } from "@/components/game/toast-store";
import { Select } from "@/components/ui/select";
import FilterBar from "@/components/ui/filter-bar";
import { relativeTime } from "@/lib/format";

export type PeopleRow = {
  id: string;
  name: string;
  relation: string;
  handle: string;
  total: number;
  lastISO: string | null;
  connectedToday: boolean;
};

const SORTS = [
  { value: "recent", label: "Sort: recent contact" },
  { value: "name", label: "Sort: name A–Z" },
  { value: "most", label: "Sort: most connected" },
  { value: "stale", label: "Sort: most neglected" },
];

export default function PeopleBoard({ rows }: { rows: PeopleRow[] }) {
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const relations = useMemo(() => [...new Set(rows.map((r) => r.relation).filter(Boolean))].sort(), [rows]);
  const relationOpts = [{ value: "ALL", label: "All relations" }, ...relations.map((r) => ({ value: r, label: r }))];

  const connect = (id: string, name: string) =>
    start(async () => {
      const r = await logInteraction(id, "");
      if (r?.firstToday) {
        burst("small");
        addToast({ emoji: "🤝", title: "Connected", body: `You reached out to ${name} today` });
      } else if (r) {
        addToast({ emoji: "＋", title: name, body: "Another touchpoint logged" });
      }
    });

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) => r.name.toLowerCase().includes(q) || r.relation.toLowerCase().includes(q) || r.handle.toLowerCase().includes(q));
    }
    if (relation !== "ALL") out = out.filter((r) => r.relation === relation);
    out = [...out];
    const lastMs = (r: PeopleRow) => (r.lastISO ? new Date(r.lastISO).getTime() : 0);
    if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "most") out.sort((a, b) => b.total - a.total);
    else if (sort === "stale") out.sort((a, b) => lastMs(a) - lastMs(b));
    else out.sort((a, b) => lastMs(b) - lastMs(a));
    return out;
  }, [rows, query, relation, sort]);

  return (
    <div>
      {/* quick connect */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="section-title">Who did you connect with today?</div>
          <button onClick={() => setAdding((v) => !v)} className="label hover:text-accent transition-colors">
            {adding ? "close" : "+ new person"}
          </button>
        </div>

        {adding && (
          <form
            ref={formRef}
            action={(fd) => {
              start(() => {
                createPerson(fd);
              });
              formRef.current?.reset();
              setAdding(false);
            }}
            className="flex flex-wrap gap-2 mb-4 reveal"
          >
            <input name="name" required autoFocus placeholder="Name" className="field-input flex-1 min-w-[140px]" />
            <input name="relation" placeholder="Relation — friend, mentor…" className="field-input flex-1 min-w-[140px]" />
            <input name="handle" placeholder="@handle / contact" className="field-input w-40" />
            <button disabled={pending} className="btn btn-primary">Add</button>
          </form>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-ink-faint">Add the people who matter, then tap them the day you connect.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rows.map((p) => (
              <button
                key={p.id}
                onClick={() => connect(p.id, p.name)}
                disabled={pending}
                title={p.connectedToday ? `Log another with ${p.name}` : `Mark that you connected with ${p.name} today`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-all disabled:opacity-60 ${
                  p.connectedToday
                    ? "border-accent bg-selected text-ink"
                    : "border-line text-ink-dim hover:text-ink hover:border-line-strong"
                }`}
              >
                {p.connectedToday && <span className="text-accent text-xs">✓</span>}
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <FilterBar query={query} onQuery={setQuery} placeholder="Search people…" count={filtered.length} total={rows.length} noun="people">
            {relations.length > 0 && <Select className="w-44" options={relationOpts} value={relation} onChange={setRelation} ariaLabel="Filter by relation" />}
            <Select className="w-52 ml-auto" options={SORTS} value={sort} onChange={setSort} align="right" ariaLabel="Sort" />
          </FilterBar>

          <div className="border-t border-line">
            {filtered.map((p, i) => (
              <Link
                key={p.id}
                href={`/people/${p.id}`}
                style={{ animationDelay: `${Math.min(i * 30, 260)}ms` }}
                className="reveal-row hover-row flex items-center gap-4 py-3.5 border-b border-line-soft text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-ink">
                    {p.connectedToday && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" title="connected today" />}
                    <span className="truncate">{p.name}</span>
                  </div>
                  {p.relation && <div className="text-ink-faint text-xs mt-0.5">{p.relation}</div>}
                </div>
                <div className="font-mono text-xs text-ink-dim">{p.total} touch{p.total === 1 ? "" : "es"}</div>
                <div className="label w-24 text-right">{p.lastISO ? relativeTime(p.lastISO) : "never"}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
