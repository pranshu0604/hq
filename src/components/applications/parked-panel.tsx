"use client";

import Link from "next/link";
import { useTransition } from "react";
import { submitApplication } from "@/app/applications/actions";
import { relativeTime } from "@/lib/format";

export type ParkedRow = { id: string; company: string; role: string; link: string | null; updatedAt: string; days: number };

// half-filled forms you walked away from. the whole point is to make them easy to
// walk back into — so this leads with the resume link, not the metadata.
export default function ParkedPanel({ rows }: { rows: ParkedRow[] }) {
  const [pending, start] = useTransition();
  if (rows.length === 0) return null;

  return (
    <section className="mb-8 border-l-2 pl-5" style={{ borderLeftColor: "var(--accent)" }}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium text-ink">
          {rows.length} form{rows.length === 1 ? "" : "s"} parked half-done
        </h2>
        <span className="label">not out the door yet</span>
      </div>

      <div className="divide-y divide-line-soft">
        {rows.map((r) => (
          <div key={r.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
            <Link href={`/applications/${r.id}`} className="min-w-0 flex-1">
              <span className="text-sm text-ink hover:text-accent transition-colors">{r.company}</span>
              <span className="text-ink-faint text-xs"> · {r.role}</span>
            </Link>

            <span className={`label shrink-0 ${r.days >= 7 ? "text-warn" : ""}`}>
              parked {relativeTime(r.updatedAt)}
            </span>

            {r.link && (
              <a
                href={r.link}
                target="_blank"
                rel="noreferrer"
                className="label shrink-0 text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                resume form ↗
              </a>
            )}

            <button
              onClick={() => start(() => void submitApplication(r.id))}
              disabled={pending}
              className="label shrink-0 text-ink-faint hover:text-good transition-colors"
              title="Mark as submitted — it'll count as applied today"
            >
              ✓ sent it
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
