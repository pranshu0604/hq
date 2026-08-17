"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tag } from "@/components/tag";
import { Select } from "@/components/ui/select";
import { compTitle, formatComp } from "@/lib/format";

type Row = {
  id: string;
  company: string;
  role: string;
  category: string;
  status: string;
  workMode: string | null;
  city: string | null;
  offerAmount: number | null;
  offerMax: number | null;
  offerNote: string;
  offerCurrency: string | null;
  createdAt: string;
  platformsCount: number;
  emailsCount: number;
  anyResponse: boolean;
  interviewsCount: number;
};

const SORTS = [
  { value: "updated", label: "Sort: recent" },
  { value: "company", label: "Sort: company A–Z" },
  { value: "offer", label: "Sort: compensation" },
];

const STATUS_OPTS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending — parked" },
  { value: "APPLIED", label: "Applied" },
  { value: "RESPONSE", label: "Response" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const CATEGORY_OPTS = [
  { value: "ALL", label: "All categories" },
  { value: "DREAM", label: "Dream" },
  { value: "STRONG", label: "Strong" },
  { value: "BACKUP", label: "Backup" },
  { value: "IGNORE_IF_BETTER", label: "Ignore if better" },
];

export default function ApplicationsTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [sort, setSort] = useState("updated");

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) => r.company.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
      );
    }
    if (status !== "ALL") out = out.filter((r) => r.status === status);
    if (category !== "ALL") out = out.filter((r) => r.category === category);

    out = [...out];
    if (sort === "company") out.sort((a, b) => a.company.localeCompare(b.company));
    else if (sort === "offer") out.sort((a, b) => (b.offerMax ?? b.offerAmount ?? -1) - (a.offerMax ?? a.offerAmount ?? -1));
    return out;
  }, [rows, query, status, category, sort]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          className="field-input max-w-xs"
          placeholder="Search company or role…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select className="w-40" options={STATUS_OPTS} value={status} onChange={setStatus} ariaLabel="Filter by status" />
        <Select className="w-44" options={CATEGORY_OPTS} value={category} onChange={setCategory} ariaLabel="Filter by category" />
        <Select className="w-52 ml-auto" options={SORTS} value={sort} onChange={setSort} align="right" ariaLabel="Sort" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-ink-dim text-sm border-t border-line pt-8 pb-4">
          No applications match. {rows.length === 0 && "Add your first one above."}
        </div>
      ) : (
        <div className="border-t border-line">
          {filtered.map((r, i) => (
            <Link
              key={r.id}
              href={`/applications/${r.id}`}
              style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}
              className="reveal-row hover-row grid grid-cols-[1.5fr_1.1fr_0.9fr_1fr_1.1fr_0.8fr] gap-4 items-center py-4 border-b border-line-soft text-sm"
            >
              <div>
                <div className="text-ink">{r.company}</div>
                <div className="text-ink-dim text-xs mt-0.5">{r.role}</div>
              </div>
              <div><Tag value={r.status} /></div>
              <div><Tag value={r.category} /></div>
              <div className="text-ink-dim text-xs">
                {r.workMode === "ONSITE" || r.workMode === "HYBRID"
                  ? r.city || r.workMode
                  : r.workMode
                  ? "Remote"
                  : "—"}
              </div>
              <div className="font-mono text-xs text-ink-dim">
                {r.platformsCount} platform{r.platformsCount === 1 ? "" : "s"} · {r.emailsCount} mail
                {r.emailsCount === 1 ? "" : "s"}
                {r.anyResponse && <span className="text-good"> · replied</span>}
              </div>
              <div className="font-mono text-xs text-ink-dim text-right" title={r.offerNote ? `${compTitle(r)} — ${r.offerNote}` : compTitle(r)}>
                {formatComp(r, true)}
                {r.offerNote && <div className="text-[10px] text-ink-faint truncate">{r.offerNote}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="label mt-4">
        {filtered.length} of {rows.length} shown
      </div>
    </div>
  );
}
