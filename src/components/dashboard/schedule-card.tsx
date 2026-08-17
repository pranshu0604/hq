"use client";

// Today's schedule — behavioral transitions, not just clock reminders. You set a
// time; the desktop nudges you before, at, and after (if you haven't started).
// The point is the *transition*, which is the hard part.
import { useCallback, useEffect, useState } from "react";
import type { ReminderRow } from "@/lib/schedule";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// module scope so the clock read isn't a render-time impurity
function isLate(r: ReminderRow) {
  return new Date(r.at).getTime() < Date.now() && r.status === "PENDING";
}

export default function ScheduleCard({ initial }: { initial: ReminderRow[] }) {
  const [rows, setRows] = useState<ReminderRow[]>(initial);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const pull = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      const data = await res.json();
      setRows(data.reminders ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(pull, 10000);
    return () => clearInterval(t);
  }, [pull]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      await pull();
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const l = label.trim();
    if (!l || !time) return;
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    post({ action: "add", label: l, at: d.toISOString(), leadMin: 5 });
    setLabel("");
    setTime("");
  };

  return (
    <div className="card p-6">
      <div className="section-title mb-4">Today&apos;s schedule</div>

      <div className="mb-4 space-y-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="what & when — e.g. DSA"
          className="field-input w-full"
        />
        <div className="flex items-center gap-2">
          <input value={time} onChange={(e) => setTime(e.target.value)} type="time" className="field-input flex-1 min-w-0" aria-label="time" />
          <button disabled={busy || !label.trim() || !time} onClick={add} className="btn btn-primary text-[13px] shrink-0">
            Set
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing scheduled. Set a time and HQ handles the transition for you.</p>
      ) : (
        <div className="-mx-2">
          {rows.map((r) => {
            const late = isLate(r);
            return (
              <div key={r.id} className="hover-row flex items-center gap-3 px-2 py-2 text-sm">
                <span className={`font-mono text-xs w-14 ${late ? "text-warn" : "text-ink-faint"}`}>{fmt(r.at)}</span>
                <span className={`flex-1 min-w-0 truncate ${r.status === "DONE" ? "line-through text-ink-faint" : r.status === "STARTED" ? "text-accent" : "text-ink-dim"}`}>
                  {r.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === "PENDING" && (
                    <button disabled={busy} onClick={() => post({ action: "status", id: r.id, status: "STARTED" })} className="label hover:text-accent transition-colors">
                      start
                    </button>
                  )}
                  {r.status !== "DONE" && (
                    <button disabled={busy} onClick={() => post({ action: "status", id: r.id, status: "DONE" })} className="label hover:text-good transition-colors">
                      done
                    </button>
                  )}
                  <button disabled={busy} onClick={() => post({ action: "delete", id: r.id })} className="label hover:text-warn transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
