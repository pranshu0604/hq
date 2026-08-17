"use client";

// Decision log — "I decided X because Y, on this date." When you catch yourself
// re-opening a settled question, this is the receipt. Reopen only with new info.
import { useState } from "react";
import type { DecisionRow } from "@/lib/decisions";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function DecisionsBoard({ initial }: { initial: DecisionRow[] }) {
  const [rows, setRows] = useState<DecisionRow[]>(initial);
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/decisions", { cache: "no-store" });
    const data = await res.json();
    setRows(data.decisions ?? []);
  };

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/decisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!title.trim() || !choice.trim()) return;
    await post({ action: "add", title, choice, reason });
    setTitle("");
    setChoice("");
    setReason("");
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-2.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="the question — e.g. Postgres or Mongo for HQ?" className="field-input w-full" />
        <input value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="what you chose — e.g. Postgres" className="field-input w-full" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="why (the reason future-you will want)" className="field-input w-full" />
        <div className="flex justify-end">
          <button disabled={busy || !title.trim() || !choice.trim()} onClick={add} className="btn btn-primary text-[13px]">
            Log decision
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">No decisions logged yet. Next time you settle something you know you&apos;ll second-guess, record it here.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13px] text-ink-faint">{d.title}</div>
                  <div className="text-lg text-ink mt-0.5">{d.choice}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="label">{fmtDate(d.createdAt)}</div>
                  {d.reopenedAt && <div className="label text-warn mt-1">reopened</div>}
                </div>
              </div>
              {d.reason && <div className="text-sm text-ink-dim mt-2 pt-2 border-t border-line-soft">{d.reason}</div>}
              <div className="flex justify-end gap-3 mt-3">
                <button disabled={busy} onClick={() => post({ action: "reopen", id: d.id })} className="label hover:text-warn transition-colors" title="only with genuinely new information">
                  reopen
                </button>
                <button disabled={busy} onClick={() => post({ action: "delete", id: d.id })} className="label hover:text-ink transition-colors">
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
