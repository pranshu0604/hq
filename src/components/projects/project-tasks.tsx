"use client";

import { useState, useTransition } from "react";
import { addTask, deleteTask, toggleTask, updateTask } from "@/app/projects/actions";
import { Checkbox } from "@/components/ui/checkbox";

type Task = { id: string; title: string; done: boolean };

export default function ProjectTasks({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const done = tasks.filter((t) => (optimistic[t.id] ?? t.done)).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  function onToggle(id: string, value: boolean) {
    setOptimistic((s) => ({ ...s, [id]: value }));
    startTransition(() => toggleTask(id, projectId, value));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="section-title">Tasks · what&apos;s left</div>
        {total > 0 && (
          <span className="label">
            {done} of {total} done · {pct}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="track mb-5">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="space-y-0.5 mb-4">
        {tasks.map((t) => {
          const checked = optimistic[t.id] ?? t.done;
          if (editId === t.id) {
            const commit = () => {
              if (draft.trim()) startTransition(() => updateTask(t.id, projectId, draft));
              setEditId(null);
            };
            return (
              <div key={t.id} className="flex items-center gap-2 py-2">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    else if (e.key === "Escape") setEditId(null);
                  }}
                  className="field-input flex-1 text-sm py-1"
                />
              </div>
            );
          }
          return (
            <div key={t.id} className="flex items-center gap-3 py-2 text-sm group">
              <Checkbox checked={checked} onChange={(c) => onToggle(t.id, c)} />
              <button
                onClick={() => {
                  setDraft(t.title);
                  setEditId(t.id);
                }}
                className={`flex-1 text-left transition-all duration-200 ${checked ? "line-through text-ink-faint" : "text-ink hover:text-accent"}`}
                title="Click to rename"
              >
                {t.title}
              </button>
              <button
                onClick={() => startTransition(() => deleteTask(t.id, projectId))}
                disabled={pending}
                className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          );
        })}
        {total === 0 && <p className="text-sm text-ink-faint">No tasks yet. Break the project into steps below.</p>}
      </div>

      <form action={addTask.bind(null, projectId)} className="flex gap-2">
        <input name="title" required placeholder="Add a task…" className="field-input" />
        <button className="btn shrink-0">Add</button>
      </form>
    </div>
  );
}
