"use client";

import Link from "next/link";
import { useTransition } from "react";
import { logInteraction } from "@/app/people/actions";
import { burst } from "@/components/game/confetti";
import { addToast } from "@/components/game/toast-store";
import { cadenceLabel, type ReachOutPerson } from "@/lib/people";

function ago(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export default function ReachOutCard({ reachOut, trackedCount }: { reachOut: ReachOutPerson[]; trackedCount: number }) {
  const [pending, start] = useTransition();

  const connect = (id: string, name: string) =>
    start(async () => {
      const r = await logInteraction(id);
      if (r) {
        burst("small");
        addToast({ emoji: "🤝", title: "Caught up", body: `Logged a touchpoint with ${name}` });
      }
    });

  if (reachOut.length === 0) {
    return (
      <div className="card p-5 mb-4 flex items-center gap-3">
        <span className="text-lg">✅</span>
        <div>
          <div className="text-sm text-ink">You&apos;re in touch with everyone.</div>
          <div className="label mt-0.5">
            {trackedCount} {trackedCount === 1 ? "person" : "people"} on a keep-in-touch cadence — all current.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-hero p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🔔</span>
          <div>
            <div className="section-title">Time to reach out</div>
            <div className="label mt-0.5">
              {reachOut.length} {reachOut.length === 1 ? "person is" : "people are"} overdue for a catch-up
            </div>
          </div>
        </div>
      </div>

      <div className="-mx-2">
        {reachOut.map((p) => (
          <div key={p.id} className="hover-row flex items-center gap-3 px-2 py-2.5 text-sm">
            <Link href={`/people/${p.id}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-ink truncate">{p.name}</span>
                {p.relation && <span className="text-ink-faint text-xs">{p.relation}</span>}
              </div>
              <div className="text-ink-faint text-xs mt-0.5">
                {cadenceLabel(p.reminderDays)} · {p.lastMs === null ? "never logged" : `last talked ${ago(p.daysSince)}`}
              </div>
            </Link>
            <span className={`label shrink-0 ${p.overdueDays >= p.reminderDays ? "text-warn" : ""}`}>
              {p.overdueDays === 0 ? "due" : `${p.overdueDays}d over`}
            </span>
            <button
              onClick={() => connect(p.id, p.name)}
              disabled={pending}
              className="btn btn-primary text-xs shrink-0 py-1.5"
            >
              Caught up
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
