"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCompany } from "@/app/work/actions";
import { Select } from "@/components/ui/select";
import FilterBar from "@/components/ui/filter-bar";
import { COMPANY_KINDS, WORK_BUCKETS, type BucketKey } from "@/lib/work";

export type CompanyRow = {
  id: string;
  name: string;
  role: string;
  kind: string;
  active: boolean;
  counts: Record<BucketKey, number>;
};

const KIND_FILTER = [{ value: "ALL", label: "All kinds" }, ...COMPANY_KINDS];
const STATE_FILTER = [
  { value: "ALL", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function WorkBoard({ rows }: { rows: CompanyRow[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) => r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));
    }
    if (kind !== "ALL") out = out.filter((r) => r.kind === kind);
    if (state === "active") out = out.filter((r) => r.active);
    else if (state === "archived") out = out.filter((r) => !r.active);
    return out;
  }, [rows, query, kind, state]);

  return (
    <div>
      <div className="mb-6">
        {adding ? (
          <form
            ref={formRef}
            action={(fd) => {
              start(async () => {
                const id = await createCompany(fd);
                if (id) router.push(`/work/${id}`);
              });
            }}
            className="card p-4 flex flex-wrap gap-2 reveal"
          >
            <input name="name" required autoFocus placeholder="Company / client" className="field-input flex-1 min-w-[160px]" />
            <input name="role" placeholder="Your role" className="field-input flex-1 min-w-[140px]" />
            <Select name="kind" className="w-36" options={COMPANY_KINDS} defaultValue="freelance" ariaLabel="Kind" />
            <button disabled={pending} className="btn btn-primary">{pending ? "Adding…" : "Add"}</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost">Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="btn btn-accent">+ Add a company</button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card-hero p-8 text-center">
          <div className="display text-2xl mb-2">No engagements yet.</div>
          <p className="text-ink-dim text-sm max-w-sm mx-auto">Add a company to start tracking your tasks, bugs, and parked work per client.</p>
        </div>
      ) : (
        <>
          <FilterBar query={query} onQuery={setQuery} placeholder="Search companies…" count={filtered.length} total={rows.length} noun="companies">
            <Select className="w-36" options={KIND_FILTER} value={kind} onChange={setKind} ariaLabel="Filter by kind" />
            <Select className="w-32" options={STATE_FILTER} value={state} onChange={setState} ariaLabel="Filter by state" />
          </FilterBar>

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((c, i) => (
              <Link
                key={c.id}
                href={`/work/${c.id}`}
                style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
                className="reveal-row card card-interactive p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="display text-lg leading-snug truncate">{c.name}</div>
                    <div className="text-xs text-ink-faint mt-0.5">
                      {c.role || "—"}
                      {c.kind && <span> · {c.kind}</span>}
                    </div>
                  </div>
                  {!c.active && <span className="label text-[9px] shrink-0">archived</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
                  {WORK_BUCKETS.map((b) => (
                    <span key={b.key} className="inline-flex items-center gap-1.5 text-xs text-ink-dim">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
                      {b.label} <span className="metric text-ink">{c.counts[b.key]}</span>
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
