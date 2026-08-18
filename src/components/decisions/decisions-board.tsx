"use client";

// Decision log — one card per SITUATION. The big line is your current stance;
// "Revise" logs a new stance without erasing the old, and "History" shows every
// past call + the reasoning, so a recurring situation reminds you what you already
// worked out (and why) instead of re-litigating it from scratch.
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="the situation — e.g. How do I handle a recruiter ghosting me?" className="field-input w-full" />
        <input value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="what you decided — e.g. one follow-up, then move on" className="field-input w-full" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="why (the reasoning future-you will want)" className="field-input w-full" />
        <div className="flex justify-end">
          <button disabled={busy || !title.trim() || !choice.trim()} onClick={add} className="btn btn-primary text-[13px]">
            Log decision
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">No decisions logged yet. Next time you settle something you know you&apos;ll second-guess, record the situation and what you chose.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <DecisionCard key={d.id} d={d} busy={busy} onPost={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ d, busy, onPost }: { d: DecisionRow; busy: boolean; onPost: (p: Record<string, unknown>) => Promise<void> }) {
  const [revising, setRevising] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const past = d.revisions.length; // total stances taken, incl. current

  const saveRevision = async () => {
    if (!choice.trim()) return;
    await onPost({ action: "revise", id: d.id, choice, reason, note });
    setChoice("");
    setReason("");
    setNote("");
    setRevising(false);
    setShowHistory(true);
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink-faint">{d.title}</div>
          <div className="text-lg text-ink mt-0.5">{d.choice}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="label">{fmtDate(d.createdAt)}</div>
          {past > 1 && <div className="label text-accent mt-1">{past} revisions</div>}
        </div>
      </div>
      {d.reason && <div className="text-sm text-ink-dim mt-2 pt-2 border-t border-line-soft">{d.reason}</div>}

      <div className="flex flex-wrap justify-end gap-2 mt-3">
        <button
          disabled={busy}
          onClick={() => {
            setRevising((v) => !v);
            setChoice(d.choice);
            setReason("");
            setNote("");
          }}
          className="btn btn-ghost text-xs text-accent"
          title="log a new stance without losing the old one"
        >
          {revising ? "Cancel" : "Revise"}
        </button>
        {past > 1 && (
          <button disabled={busy} onClick={() => setShowHistory((v) => !v)} className="btn btn-ghost text-xs">
            {showHistory ? "Hide history" : `History (${past})`}
          </button>
        )}
        <button disabled={busy} onClick={() => onPost({ action: "delete", id: d.id })} className="btn btn-ghost text-xs text-bad">
          Delete
        </button>
      </div>

      {revising && (
        <div className="mt-3 pt-3 border-t border-line-soft space-y-2.5">
          <div className="label text-ink-faint">You&apos;re revisiting this — what&apos;s the new call?</div>
          <input value={choice} onChange={(e) => setChoice(e.target.value)} placeholder="what you're deciding now" className="field-input w-full" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="why now" className="field-input w-full" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="what changed since last time? (optional)" className="field-input w-full" />
          <div className="flex justify-end">
            <button disabled={busy || !choice.trim()} onClick={saveRevision} className="btn btn-primary text-xs">
              Save new stance
            </button>
          </div>
        </div>
      )}

      {showHistory && past > 1 && (
        <div className="mt-3 pt-3 border-t border-line-soft">
          <div className="label text-ink-faint mb-3">History — newest first</div>
          <ol className="space-y-3">
            {d.revisions.map((r, i) => (
              <li key={r.id} className="relative pl-4">
                <span className={`absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-accent" : "bg-line-strong"}`} />
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm text-ink">
                    {r.choice}
                    {i === 0 && <span className="label text-accent ml-2">current</span>}
                  </div>
                  <div className="label shrink-0">{fmtDate(r.createdAt)}</div>
                </div>
                {r.reason && <div className="text-[13px] text-ink-dim mt-0.5">{r.reason}</div>}
                {r.note && <div className="text-[12px] text-ink-faint mt-0.5 italic">changed: {r.note}</div>}
                {d.revisions.length > 1 && (
                  <button disabled={busy} onClick={() => onPost({ action: "delRevision", revisionId: r.id })} className="label text-ink-faint hover:text-bad transition-colors mt-1">
                    remove
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
