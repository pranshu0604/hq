"use client";

// "Was that actually a problem?" — a guided weigh-up. The form walks event →
// interpretation → evidence both ways → verdict, so your analytical brain runs
// once, on paper, instead of looping.
import { useState } from "react";
import type { SocialCheckRow } from "@/lib/social-check";

const FIELDS = [
  { key: "event", label: "What happened, objectively?", ph: "just the facts — what was said or done" },
  { key: "interpretation", label: "What did you take it to mean?", ph: "the story your brain jumped to" },
  { key: "evidenceFor", label: "Evidence that story is true", ph: "actual evidence, not feelings" },
  { key: "evidenceAgainst", label: "Evidence it isn't", ph: "other explanations that fit" },
] as const;

const VERDICTS = [
  { key: "LETGO", label: "Let it go", tone: "var(--good)" },
  { key: "PARK", label: "Park it", tone: "var(--warn)" },
  { key: "ACT", label: "Actually act", tone: "var(--accent)" },
];

type Form = { event: string; interpretation: string; evidenceFor: string; evidenceAgainst: string };

export default function ReframeBoard({ initial }: { initial: SocialCheckRow[] }) {
  const [rows, setRows] = useState<SocialCheckRow[]>(initial);
  const [form, setForm] = useState<Form>({ event: "", interpretation: "", evidenceFor: "", evidenceAgainst: "" });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/reframe", { cache: "no-store" });
    setRows((await res.json()).checks ?? []);
  };

  const save = async (verdict: string) => {
    if (!form.event.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/reframe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", ...form, verdict }) });
      setForm({ event: "", interpretation: "", evidenceFor: "", evidenceAgainst: "" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    await fetch("/api/reframe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
  };

  return (
    <div className="space-y-8">
      <div className="card p-6 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <div className="label mb-1.5">{f.label}</div>
            <textarea
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              placeholder={f.ph}
              rows={f.key === "event" ? 2 : 1}
              className="field-input w-full resize-none text-sm"
            />
          </div>
        ))}
        <div className="pt-2">
          <div className="label mb-2">Did anything actually need doing?</div>
          <div className="flex gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v.key}
                disabled={busy || !form.event.trim()}
                onClick={() => save(v.key)}
                className="text-[13px] px-3.5 py-2 rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: v.tone + "66", color: v.tone }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="section-title">Past checks</div>
          {rows.map((r) => {
            const v = VERDICTS.find((x) => x.key === r.verdict);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-ink">{r.event}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v && <span className="label" style={{ color: v.tone }}>{v.label}</span>}
                    <button onClick={() => del(r.id)} className="label hover:text-warn transition-colors">✕</button>
                  </div>
                </div>
                {r.interpretation && <div className="text-[13px] text-ink-faint mt-1.5">read it as: {r.interpretation}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
