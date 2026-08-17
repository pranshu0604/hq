"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteWorkout, logWorkout, updateWorkout } from "@/app/gym/actions";
import { Select } from "@/components/ui/select";
import FilterBar from "@/components/ui/filter-bar";
import { MUSCLE_GROUPS } from "@/lib/gym";
import { formatDate, todayInputValue } from "@/lib/format";

export type WorkoutRow = {
  id: string;
  date: string;
  groups: string[];
  notes: string;
  durationMin: number | null;
};

const GROUP_FILTER = [{ value: "ALL", label: "All groups" }, ...MUSCLE_GROUPS.map((g) => ({ value: g, label: g }))];

export default function GymLog({ rows }: { rows: WorkoutRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => todayInputValue());
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("ALL");

  const toggle = (g: string) => setSelected((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const submit = () => {
    if (selected.length === 0) return;
    start(() => logWorkout({ groups: selected, date, durationMin: Number(duration) || null, notes }));
    setSelected([]);
    setDuration("");
    setNotes("");
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) => r.notes.toLowerCase().includes(q) || r.groups.some((g) => g.toLowerCase().includes(q)));
    }
    if (group !== "ALL") out = out.filter((r) => r.groups.includes(group));
    return out;
  }, [rows, query, group]);

  return (
    <div>
      {/* logger */}
      <div className="card p-5 mb-8">
        <div className="section-title mb-4">Log a session</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {MUSCLE_GROUPS.map((g) => {
            const on = selected.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggle(g)}
                className={`px-3 py-1.5 rounded-lg text-[13px] border transition-all ${
                  on ? "bg-accent text-[color:var(--accent-ink)] border-accent font-medium" : "border-line text-ink-dim hover:text-ink hover:border-line-strong"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input w-auto" />
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="mins"
            className="field-input w-20"
          />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes — PRs, how it felt…" className="field-input flex-1 min-w-[160px]" />
          <button onClick={submit} disabled={pending || selected.length === 0} className="btn btn-primary">
            {pending ? "Logging…" : "Log workout"}
          </button>
        </div>
        {selected.length === 0 && <div className="label mt-2.5">Pick at least one muscle group.</div>}
      </div>

      {/* history */}
      <div className="section-title mb-4">History</div>
      {rows.length === 0 ? (
        <div className="text-ink-dim text-sm border-t border-line pt-8">No sessions yet. Your first one starts the streak.</div>
      ) : (
        <>
          <FilterBar query={query} onQuery={setQuery} placeholder="Search sessions…" count={filtered.length} total={rows.length} noun="sessions">
            <Select className="w-40" options={GROUP_FILTER} value={group} onChange={setGroup} ariaLabel="Filter by group" />
          </FilterBar>
          <div className="border-t border-line">
            {filtered.map((w, i) => (
              <WorkoutItem key={w.id} w={w} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function WorkoutItem({ w, index }: { w: WorkoutRow; index: number }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [groups, setGroups] = useState<string[]>(w.groups);
  const [date, setDate] = useState(() => w.date.slice(0, 10));
  const [duration, setDuration] = useState(w.durationMin?.toString() ?? "");
  const [notes, setNotes] = useState(w.notes);

  const toggle = (g: string) => setGroups((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const save = () => {
    if (groups.length === 0) return;
    start(() => updateWorkout(w.id, { groups, date, durationMin: Number(duration) || null, notes }));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-3.5 border-b border-line-soft">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MUSCLE_GROUPS.map((g) => {
            const on = groups.includes(g);
            return (
              <button
                key={g}
                onClick={() => toggle(g)}
                className={`px-2.5 py-1 rounded-md text-[12px] border transition-all ${
                  on ? "bg-accent text-[color:var(--accent-ink)] border-accent font-medium" : "border-line text-ink-dim hover:text-ink hover:border-line-strong"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input w-auto" />
          <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="mins" className="field-input w-20" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="field-input flex-1 min-w-[140px]" />
          <button onClick={save} disabled={pending || groups.length === 0} className="btn btn-primary text-[13px]">
            {pending ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn text-[13px]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 30, 260)}ms` }}
      className="reveal-row group flex items-center gap-4 py-3.5 border-b border-line-soft text-sm"
    >
      <div className="w-24 shrink-0 font-mono text-xs text-ink-dim">{formatDate(w.date)}</div>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {w.groups.map((g) => (
          <span key={g} className="text-[11px] font-mono uppercase tracking-wide text-good bg-good/12 border border-good/25 rounded px-1.5 py-0.5">
            {g}
          </span>
        ))}
      </div>
      {w.notes && <span className="text-ink-dim text-xs truncate max-w-[40%] hidden sm:block">{w.notes}</span>}
      {w.durationMin && <span className="label shrink-0">{w.durationMin}m</span>}
      <button
        onClick={() => setEditing(true)}
        aria-label="Edit"
        className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        edit
      </button>
      <button
        onClick={() => start(() => deleteWorkout(w.id))}
        disabled={pending}
        aria-label="Delete"
        className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        ×
      </button>
    </div>
  );
}
