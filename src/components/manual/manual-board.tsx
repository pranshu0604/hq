"use client";

import { useState } from "react";
import type { ObservationRow } from "@/lib/observations";

export default function ManualBoard({ initial, prompts }: { initial: ObservationRow[]; prompts: string[] }) {
  const [rows, setRows] = useState<ObservationRow[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/observations", { cache: "no-store" });
    setRows((await res.json()).observations ?? []);
  };

  const add = async (t: string) => {
    const v = t.trim();
    if (!v) return;
    setBusy(true);
    setText("");
    try {
      await fetch("/api/observations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", text: v }) });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    await fetch("/api/observations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add(text)} placeholder="something true about how you work…" className="field-input flex-1" />
          <button disabled={busy || !text.trim()} onClick={() => add(text)} className="btn btn-primary text-[13px]">
            Note it
          </button>
        </div>
        {rows.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button key={p} disabled={busy} onClick={() => add(p)} className="text-[12px] text-ink-faint border border-line-soft rounded-lg px-2.5 py-1 hover:text-ink hover:border-line-strong transition-colors">
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((o) => (
            <div key={o.id} className="card p-4 flex items-start gap-3">
              <span className="text-accent mt-0.5">·</span>
              <span className="flex-1 text-sm text-ink-dim">{o.text}</span>
              <button onClick={() => del(o.id)} className="label hover:text-warn transition-colors shrink-0">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
