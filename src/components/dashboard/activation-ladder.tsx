"use client";

// The activation ladder — for when knowing what to do isn't the problem, starting
// is. Each rung reduces the demand until it's too small to refuse. The task never
// changes; only how much you're asking of yourself right now.
import { useState } from "react";

const RUNGS = [
  { ask: "Forget the whole thing. Just open it — the file, the page, the doc.", done: "Opened it" },
  { ask: "Don't do anything yet. Just read the first line, or the problem.", done: "Read it" },
  { ask: "Now the smallest possible piece. Two minutes. One example, one line.", done: "Did that" },
];

export default function ActivationLadder({ label }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [rung, setRung] = useState(0);
  const [busy, setBusy] = useState(false);

  const target = (label || "this").trim();

  const reset = () => {
    setOpen(false);
    setRung(0);
  };

  const startSession = async () => {
    setBusy(true);
    try {
      await fetch("/api/now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", label: label || "Focus", minutes: 15 }),
      });
    } finally {
      setBusy(false);
      reset();
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="label text-ink-faint hover:text-accent transition-colors">
        can&apos;t start? →
      </button>
    );
  }

  const started = rung >= RUNGS.length;

  return (
    <div className="mt-2 rounded-lg border border-line-soft bg-surface-2 p-4">
      {!started ? (
        <>
          <div className="label text-accent mb-1.5">just this much</div>
          <div className="text-[15px] text-ink leading-snug">{RUNGS[rung].ask}</div>
          <div className="flex items-center gap-3 mt-3">
            <button disabled={busy} onClick={() => setRung((r) => r + 1)} className="btn btn-primary text-[13px]">
              {RUNGS[rung].done}
            </button>
            <button onClick={reset} className="label hover:text-ink transition-colors">
              stop
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-[15px] text-ink leading-snug">You started. That was the hard part.</div>
          <div className="text-[13px] text-ink-dim mt-1">Ride the momentum, or leave it here — either is a win.</div>
          <div className="flex items-center gap-3 mt-3">
            <button disabled={busy} onClick={startSession} className="btn btn-primary text-[13px]">
              Keep going — 15 min{target !== "this" ? ` on ${target}` : ""}
            </button>
            <button onClick={reset} className="label hover:text-ink transition-colors">
              that&apos;s enough
            </button>
          </div>
        </>
      )}
    </div>
  );
}
