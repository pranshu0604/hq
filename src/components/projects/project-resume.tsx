"use client";

// Project "resume" context — the four lines that let you drop back into a project
// after days without a cold restart. Each saves on blur. Deliberately plain
// textareas, not a form to submit — low friction, per the "don't make me manage
// HQ" rule.
import { useState, useTransition } from "react";
import { updateProjectResume } from "@/app/projects/actions";

type Fields = { goal: string; state: string; blocker: string; nextAction: string };

const ROWS: { key: keyof Fields; label: string; placeholder: string; accent?: boolean }[] = [
  { key: "goal", label: "Goal", placeholder: "what does done look like?" },
  { key: "state", label: "Current state", placeholder: "where is it right now?" },
  { key: "blocker", label: "Blocker", placeholder: "what's stuck, if anything?" },
  { key: "nextAction", label: "Next action", placeholder: "the immediate next physical step", accent: true },
];

export default function ProjectResume({ projectId, initial }: { projectId: string; initial: Fields }) {
  const [fields, setFields] = useState<Fields>(initial);
  const [, start] = useTransition();

  const save = (key: keyof Fields, value: string) => {
    if (value === initial[key]) return;
    start(() => void updateProjectResume(projectId, { [key]: value }));
  };

  const hasAny = ROWS.some((r) => fields[r.key].trim());

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title">Resume — where you left off</div>
        {!hasAny && <span className="label text-ink-faint">fill this before you stop, thank tomorrow-you</span>}
      </div>
      <div className="space-y-4">
        {ROWS.map((r) => (
          <div key={r.key} className={r.accent ? "pl-3 border-l-2 border-accent" : ""}>
            <div className={`label mb-1.5 ${r.accent ? "text-accent" : ""}`}>{r.label}</div>
            <textarea
              value={fields[r.key]}
              onChange={(e) => setFields((f) => ({ ...f, [r.key]: e.target.value }))}
              onBlur={(e) => save(r.key, e.target.value)}
              placeholder={r.placeholder}
              rows={r.key === "nextAction" || r.key === "goal" ? 1 : 2}
              className="field-input w-full resize-none text-sm"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
