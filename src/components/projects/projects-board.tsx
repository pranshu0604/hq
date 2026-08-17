"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createProject } from "@/app/projects/actions";
import { Tag } from "@/components/tag";
import { Select } from "@/components/ui/select";
import { IconArrow } from "@/components/icons";

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tasksTotal: number;
  tasksDone: number;
  updatedAt: string;
};

const STATUS_FILTER = [
  { value: "ALL", label: "All statuses" },
  { value: "IDEA", label: "Idea" },
  { value: "PLANNING", label: "Planning" },
  { value: "BUILDING", label: "Building" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "ABANDONED", label: "Abandoned" },
];
const STATUS_OPTS = STATUS_FILTER.slice(1);
const PRIORITY_OPTS = [
  { value: "HIGH", label: "High priority" },
  { value: "MEDIUM", label: "Medium priority" },
  { value: "LOW", label: "Low priority" },
];

export default function ProjectsBoard({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    let out = projects;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (status !== "ALL") out = out.filter((p) => p.status === status);
    const weight: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return [...out].sort((a, b) => weight[a.priority] - weight[b.priority]);
  }, [projects, query, status]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input className="field-input max-w-xs" placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select className="w-40" options={STATUS_FILTER} value={status} onChange={setStatus} ariaLabel="Filter by status" />
        <button onClick={() => setShowForm((v) => !v)} className={`ml-auto btn ${showForm ? "" : "btn-primary"}`}>
          {showForm ? "cancel" : "+ New Project"}
        </button>
      </div>

      {showForm && (
        <form action={createProject} className="card p-5 mb-6 space-y-3 reveal">
          <input name="title" required placeholder="Project title" className="field-input" />
          <textarea name="description" rows={2} placeholder="What is it?" className="field-input" />
          <div className="grid grid-cols-2 gap-3">
            <Select name="status" options={STATUS_OPTS} defaultValue="IDEA" />
            <Select name="priority" options={PRIORITY_OPTS} defaultValue="MEDIUM" />
          </div>
          <textarea name="notes" rows={2} placeholder="Notes" className="field-input" />
          <button className="btn btn-primary">Create &amp; open</button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="text-ink-dim text-sm border-t border-line pt-8">Nothing here yet.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, i) => {
            const pct = p.tasksTotal ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                className="reveal-row card card-interactive block p-5 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm flex items-center gap-2">
                      {p.title}
                      <IconArrow className="text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {p.description && <div className="text-xs text-ink-dim mt-1 line-clamp-2">{p.description}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Tag value={p.priority} />
                    <Tag value={p.status} />
                  </div>
                </div>
                {p.tasksTotal > 0 && (
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex-1 track">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="label">
                      {p.tasksDone}/{p.tasksTotal} done
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
