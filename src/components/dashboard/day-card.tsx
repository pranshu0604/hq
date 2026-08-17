"use client";

// The day strip — morning intent + evening shutdown, the two ends of the loop.
//  • surfaces the first action you parked at last shutdown ("start where you left off")
//  • "how's your brain?" sets an operating mode HQ suggests against
//  • maintenance mode = a guilt-free minimum day
//  • shutdown records finished / remaining / tomorrow's first action
import { useState } from "react";
import type { DayState, Energy, MorningBrief } from "@/lib/day";

const GUIDE: Record<"LOW" | "NORMAL" | "HIGH", string> = {
  LOW: "Protect yourself — emails, applications, errands, simple fixes.",
  NORMAL: "Steady work — DSA, normal dev, follow-ups.",
  HIGH: "Spend it on the hard thing. Pick ONE: architecture, deep coding, a big decision.",
};
const LEVELS: Exclude<Energy, "">[] = ["LOW", "NORMAL", "HIGH"];

export default function DayCard({ initialToday, initialBrief }: { initialToday: DayState | null; initialBrief: MorningBrief }) {
  const [today, setToday] = useState<DayState | null>(initialToday);
  const [brief, setBrief] = useState<MorningBrief>(initialBrief);
  const [shutOpen, setShutOpen] = useState(false);
  const [finished, setFinished] = useState("");
  const [remaining, setRemaining] = useState("");
  const [firstAction, setFirstAction] = useState("");
  const [busy, setBusy] = useState(false);

  const energy = today?.energy ?? "";
  const maintenance = today?.maintenance ?? false;

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/day", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      setToday(data.today ?? null);
    } finally {
      setBusy(false);
    }
  };

  const startBrief = async () => {
    if (!brief) return;
    await fetch("/api/now", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", label: brief.firstAction, minutes: 25 }) });
    setBrief(null);
  };

  const doShutdown = async () => {
    await post({ action: "shutdown", finished, remaining, firstAction });
    setShutOpen(false);
    setFinished("");
    setRemaining("");
    setFirstAction("");
  };

  return (
    <section className="card p-5">
      {brief && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-line-soft">
          <div className="min-w-0">
            <div className="label text-accent">Pick up where you left off</div>
            <div className="text-sm text-ink mt-1 truncate">{brief.firstAction}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button disabled={busy} onClick={startBrief} className="btn btn-primary text-[13px]">
              Start this
            </button>
            <button onClick={() => setBrief(null)} className="label hover:text-ink transition-colors">
              later
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="label">How&apos;s your brain?</span>
          <div className="flex gap-1.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                disabled={busy}
                onClick={() => post({ action: "energy", energy: l })}
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                  energy === l ? "border-accent text-accent bg-accent/10" : "border-line-soft text-ink-dim hover:text-ink hover:border-line-strong"
                }`}
              >
                {l === "LOW" ? "Low" : l === "NORMAL" ? "Normal" : "High"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            onClick={() => post({ action: "maintenance", on: !maintenance })}
            className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
              maintenance ? "border-warn text-warn bg-warn/10" : "border-line-soft text-ink-dim hover:text-ink hover:border-line-strong"
            }`}
            title="A guilt-free minimum day"
          >
            {maintenance ? "Maintenance mode on" : "Rough day?"}
          </button>
          <button onClick={() => setShutOpen((v) => !v)} className="label hover:text-accent transition-colors">
            {shutOpen ? "close" : "shut down →"}
          </button>
        </div>
      </div>

      {energy && <p className="text-[12.5px] text-ink-dim mt-3">{GUIDE[energy as "LOW" | "NORMAL" | "HIGH"]}</p>}
      {maintenance && (
        <p className="text-[12.5px] text-warn/90 mt-2">
          Minimum day: one college obligation, one career action, one small win, movement, basic upkeep. That&apos;s a full day today.
        </p>
      )}

      {shutOpen && (
        <div className="mt-4 pt-4 border-t border-line-soft space-y-2.5">
          <div className="label">Shutdown — hand tomorrow-you the context</div>
          <input value={finished} onChange={(e) => setFinished(e.target.value)} placeholder="what did you finish?" className="field-input w-full" />
          <input value={remaining} onChange={(e) => setRemaining(e.target.value)} placeholder="what's still open?" className="field-input w-full" />
          <input
            value={firstAction}
            onChange={(e) => setFirstAction(e.target.value)}
            placeholder="tomorrow's FIRST action (be specific)"
            className="field-input w-full"
          />
          <div className="flex justify-end">
            <button disabled={busy || !firstAction.trim()} onClick={doShutdown} className="btn btn-primary text-[13px]">
              Save &amp; shut down
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
