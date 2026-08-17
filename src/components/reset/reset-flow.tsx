"use client";

// RESET — when you're spiralling. A short operational protocol, then exactly one
// next action. No inspirational quotes, no "you got this" — just steps and a door
// back in.
import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = ["Leave the current task. Actually stop.", "Stand up.", "Water.", "Walk for three minutes — away from the screen.", "Come back."];

export default function ResetFlow() {
  const [checked, setChecked] = useState<boolean[]>(STEPS.map(() => false));
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const allDone = checked.every(Boolean);

  const start = async () => {
    if (!action.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/now", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", label: action.trim(), minutes: 10 }) });
      router.push("/");
    } finally {
      setBusy(false);
    }
  };

  const park = async () => {
    if (!action.trim()) return;
    await fetch("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: action.trim() }) });
    router.push("/");
  };

  return (
    <div className="space-y-8">
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={i}>
            <button
              onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              className="flex items-center gap-3 text-left w-full group"
            >
              <span
                className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked[i] ? "bg-accent border-accent text-bg" : "border-line-strong text-transparent group-hover:border-accent"}`}
              >
                ✓
              </span>
              <span className={`text-[15px] transition-colors ${checked[i] ? "text-ink-faint line-through" : "text-ink"}`}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={`pt-6 border-t border-line-soft transition-opacity ${allDone ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
        <div className="label mb-2">One next action — small and concrete</div>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder="e.g. open the file and read where I stopped"
          className="field-input w-full"
        />
        <div className="flex items-center gap-3 mt-3">
          <button disabled={busy || !action.trim()} onClick={start} className="btn btn-primary text-[13px]">
            Start it — 10 min
          </button>
          <button disabled={busy || !action.trim()} onClick={park} className="label hover:text-ink transition-colors">
            not yet — park it
          </button>
        </div>
      </div>
    </div>
  );
}
