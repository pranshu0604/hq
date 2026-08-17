"use client";

import { useState, useTransition } from "react";
import { deleteProject, updateProject } from "@/app/projects/actions";
import { Tag } from "@/components/tag";
import RichEditor from "@/components/notes/rich-editor";
import { Select } from "@/components/ui/select";
import { IconArrow } from "@/components/icons";
import { formatDate, stripHtml } from "@/lib/format";

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  link: string | null;
  targetDate: string | null;
  notes: string;
  updatedAt: string;
};

const STATUS_OPTS = [
  { value: "IDEA", label: "Idea" },
  { value: "PLANNING", label: "Planning" },
  { value: "BUILDING", label: "Building" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "ABANDONED", label: "Abandoned" },
];
const PRIORITY_OPTS = [
  { value: "HIGH", label: "High priority" },
  { value: "MEDIUM", label: "Medium priority" },
  { value: "LOW", label: "Low priority" },
];

export default function ProjectDetail({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notesHtml, setNotesHtml] = useState(project.notes);
  const [pending, startTransition] = useTransition();
  const update = updateProject.bind(null, project.id);

  if (editing) {
    return (
      <form
        action={(fd) =>
          startTransition(async () => {
            await update(fd);
            setEditing(false);
          })
        }
        className="space-y-5"
      >
        <input name="title" defaultValue={project.title} required className="field-input text-lg" />
        <textarea name="description" rows={3} defaultValue={project.description} placeholder="What is it?" className="field-input" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Status</label>
            <Select name="status" options={STATUS_OPTS} defaultValue={project.status} />
          </div>
          <div>
            <label className="label block mb-1.5">Priority</label>
            <Select name="priority" options={PRIORITY_OPTS} defaultValue={project.priority} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Link (repo / demo)</label>
            <input name="link" defaultValue={project.link ?? ""} placeholder="https://…" className="field-input" />
          </div>
          <div>
            <label className="label block mb-1.5">Target date</label>
            <input
              name="targetDate"
              type="date"
              defaultValue={project.targetDate ? new Date(project.targetDate).toISOString().slice(0, 10) : ""}
              className="field-input"
            />
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Notes</label>
          <RichEditor initialHTML={project.notes} onChange={setNotesHtml} placeholder="Ideas, decisions, todos… paste images or links too." />
          <input type="hidden" name="notes" value={notesHtml} />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag value={project.status} />
            <Tag value={project.priority} />
          </div>
          <h1 className="display text-4xl">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditing(true)} className="btn">
            Edit
          </button>
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="btn-ghost label hover:text-bad px-2">
              delete
            </button>
          ) : (
            <span className="flex items-center gap-2 label">
              <button onClick={() => startTransition(() => deleteProject(project.id))} disabled={pending} className="text-bad hover:underline">
                {pending ? "…" : "confirm"}
              </button>
              <button onClick={() => setConfirming(false)} className="hover:text-ink">
                cancel
              </button>
            </span>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-[15px] leading-relaxed text-ink-dim max-w-2xl mb-6 whitespace-pre-wrap">{project.description}</p>
      )}

      <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line-soft pt-4">
        {project.targetDate && (
          <Meta label="Target">{formatDate(project.targetDate)}</Meta>
        )}
        {project.link && (
          <Meta label="Link">
            <a href={project.link} target="_blank" className="text-accent hover:underline inline-flex items-center gap-1 break-all">
              {project.link.replace(/^https?:\/\//, "")} <IconArrow className="w-3 h-3" />
            </a>
          </Meta>
        )}
        <Meta label="Updated">{formatDate(project.updatedAt)}</Meta>
      </div>

      {stripHtml(project.notes).trim() && (
        <div className="mt-6">
          <div className="section-title mb-2">Notes</div>
          <div className="rte-surface text-sm text-ink-dim" dangerouslySetInnerHTML={{ __html: project.notes }} />
        </div>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-0.5">{label}</div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}
