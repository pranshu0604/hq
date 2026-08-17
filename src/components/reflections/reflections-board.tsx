"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReflection } from "@/app/reflections/actions";
import { Select } from "@/components/ui/select";
import FilterBar from "@/components/ui/filter-bar";
import { formatDate } from "@/lib/format";
import { LeanBar, leanWord } from "./lean-bar";

export type ReflectionRow = {
  id: string;
  title: string;
  thesisLabel: string;
  antithesisLabel: string;
  lean: number;
  thesisCount: number;
  antithesisCount: number;
  hasSynthesis: boolean;
  updatedAt: string;
};

const LEAN_OPTS = [
  { value: "ALL", label: "All leanings" },
  { value: "thesis", label: "Leans thesis" },
  { value: "balanced", label: "Balanced" },
  { value: "antithesis", label: "Leans antithesis" },
];

const SORTS = [
  { value: "updated", label: "Sort: recent" },
  { value: "title", label: "Sort: title A–Z" },
  { value: "thoughts", label: "Sort: most thoughts" },
  { value: "conviction", label: "Sort: strongest lean" },
];

export default function ReflectionsBoard({ rows }: { rows: ReflectionRow[] }) {
  const [query, setQuery] = useState("");
  const [lean, setLean] = useState("ALL");
  const [sort, setSort] = useState("updated");
  const [pending, start] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.thesisLabel.toLowerCase().includes(q) ||
          r.antithesisLabel.toLowerCase().includes(q)
      );
    }
    if (lean !== "ALL") out = out.filter((r) => leanWord(r.lean) === lean);

    out = [...out];
    if (sort === "title") out.sort((a, b) => (a.title || "~").localeCompare(b.title || "~"));
    else if (sort === "thoughts") out.sort((a, b) => b.thesisCount + b.antithesisCount - (a.thesisCount + a.antithesisCount));
    else if (sort === "conviction") out.sort((a, b) => Math.abs(b.lean - 50) - Math.abs(a.lean - 50));
    return out;
  }, [rows, query, lean, sort]);

  const create = () =>
    start(async () => {
      const id = await createReflection();
      router.push(`/reflections/${id}`);
    });

  return (
    <div>
      <FilterBar query={query} onQuery={setQuery} placeholder="Search reflections…" count={filtered.length} total={rows.length}>
        <Select className="w-40" options={LEAN_OPTS} value={lean} onChange={setLean} ariaLabel="Filter by leaning" />
        <Select className="w-48" options={SORTS} value={sort} onChange={setSort} ariaLabel="Sort" />
        <button onClick={create} disabled={pending} className="btn btn-primary ml-auto shrink-0">
          {pending ? "Creating…" : "+ New reflection"}
        </button>
      </FilterBar>

      {rows.length === 0 ? (
        <div className="card-hero p-8 text-center">
          <div className="display text-2xl mb-2">Start your first dialectic.</div>
          <p className="text-ink-dim text-sm max-w-md mx-auto mb-5">
            Name a tension you keep circling — &ldquo;Empathy vs Selfishness&rdquo;, &ldquo;Ambition vs Contentment&rdquo; — and start throwing thoughts at each side.
          </p>
          <button onClick={create} disabled={pending} className="btn btn-accent">
            {pending ? "Creating…" : "+ New reflection"}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-ink-dim text-sm border-t border-line pt-8">No reflections match.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r, i) => (
            <Link
              key={r.id}
              href={`/reflections/${r.id}`}
              style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              className="reveal-row card card-interactive p-5 flex flex-col gap-4"
            >
              <div>
                <div className="display text-lg leading-snug">{r.title || "Untitled reflection"}</div>
                <div className="text-xs text-ink-faint mt-1 font-mono">
                  {r.antithesisLabel} <span className="text-ink-faint/60">·vs·</span> {r.thesisLabel}
                </div>
              </div>
              <LeanBar lean={r.lean} size="sm" />
              <div className="flex items-center justify-between text-[11px] text-ink-faint mt-auto pt-1">
                <span>
                  {r.thesisCount + r.antithesisCount} thought{r.thesisCount + r.antithesisCount === 1 ? "" : "s"}
                  {r.hasSynthesis && <span className="text-accent"> · synthesized</span>}
                </span>
                <span className="font-mono">{formatDate(r.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
