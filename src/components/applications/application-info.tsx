"use client";

import { useState, useTransition } from "react";
import { deleteApplication, submitApplication, updateApplication } from "@/app/applications/actions";
import { Tag } from "@/components/tag";
import RichEditor from "@/components/notes/rich-editor";
import { Select } from "@/components/ui/select";
import CompFields from "@/components/applications/comp-fields";
import { compTitle, formatComp, formatDate, stripHtml } from "@/lib/format";

type App = {
  id: string;
  company: string;
  role: string;
  description: string;
  status: string;
  category: string;
  workMode: string | null;
  city: string | null;
  link: string | null;
  submittedAt: string | null;
  offerAmount: number | null;
  offerMax: number | null;
  offerNote: string;
  offerCurrency: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_OPTS = [
  { value: "PENDING", label: "Pending — form parked half-done" },
  { value: "APPLIED", label: "Applied" },
  { value: "RESPONSE", label: "Response" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];
const CATEGORY_OPTS = [
  { value: "DREAM", label: "Dream — would drop everything" },
  { value: "STRONG", label: "Strong — genuinely interested" },
  { value: "BACKUP", label: "Backup — worth keeping open" },
  { value: "IGNORE_IF_BETTER", label: "Ignore if better offer comes" },
];
const WORKMODE_OPTS = [
  { value: "", label: "Unknown yet" },
  { value: "REMOTE", label: "Remote" },
  { value: "ONSITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
];

function workModeText(a: App) {
  if (!a.workMode) return "—";
  if (a.workMode === "REMOTE") return "Remote";
  const label = a.workMode === "ONSITE" ? "On-site" : "Hybrid";
  return a.city ? `${label} · ${a.city}` : label;
}

export default function ApplicationInfo({ application }: { application: App }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notesHtml, setNotesHtml] = useState(application.notes);
  const [pending, startTransition] = useTransition();
  const update = updateApplication.bind(null, application.id);

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Company</label>
            <input name="company" defaultValue={application.company} required className="field-input" />
          </div>
          <div>
            <label className="label block mb-1.5">Role</label>
            <input name="role" defaultValue={application.role} required className="field-input" />
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Description</label>
          <textarea name="description" rows={3} defaultValue={application.description} className="field-input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Status</label>
            <Select name="status" options={STATUS_OPTS} defaultValue={application.status} />
          </div>
          <div>
            <label className="label block mb-1.5">Category</label>
            <Select name="category" options={CATEGORY_OPTS} defaultValue={application.category} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1.5">Work mode</label>
            <Select name="workMode" options={WORKMODE_OPTS} defaultValue={application.workMode ?? ""} placeholder="Unknown yet" />
          </div>
          <div>
            <label className="label block mb-1.5">City</label>
            <input name="city" defaultValue={application.city ?? ""} className="field-input" />
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Link — the posting, or where to resume the form</label>
          <input name="link" type="url" defaultValue={application.link ?? ""} className="field-input" placeholder="https://…" />
        </div>
        <CompFields
          currency={application.offerCurrency}
          min={application.offerAmount}
          max={application.offerMax}
          note={application.offerNote}
        />
        <div>
          <label className="label block mb-1.5">Notes</label>
          <RichEditor initialHTML={application.notes} onChange={setNotesHtml} placeholder="Anything worth remembering… paste images or links too." />
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
            <Tag value={application.status} />
            <Tag value={application.category} />
          </div>
          <h1 className="display text-4xl">{application.company}</h1>
          <div className="text-ink-dim mt-1.5">{application.role}</div>
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
              <button onClick={() => startTransition(() => deleteApplication(application.id))} disabled={pending} className="text-bad hover:underline">
                {pending ? "…" : "confirm"}
              </button>
              <button onClick={() => setConfirming(false)} className="hover:text-ink">
                cancel
              </button>
            </span>
          )}
        </div>
      </div>

      {application.status === "PENDING" && (
        <div className="card p-5 mb-6 flex flex-wrap items-center gap-3 border-l-2" style={{ borderLeftColor: "var(--accent)" }}>
          <span className="text-lg">📝</span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm text-ink">This form is parked half-done.</div>
            <div className="label mt-0.5">It isn&apos;t counted as an application until you send it.</div>
          </div>
          {application.link && (
            <a href={application.link} target="_blank" rel="noreferrer" className="btn text-[13px]">
              Resume form ↗
            </a>
          )}
          <button onClick={() => startTransition(() => submitApplication(application.id))} disabled={pending} className="btn btn-primary text-[13px]">
            {pending ? "…" : "✓ I sent it"}
          </button>
        </div>
      )}

      {application.description && (
        <p className="text-[15px] leading-relaxed text-ink-dim max-w-2xl mb-6 whitespace-pre-wrap">{application.description}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-t border-line-soft pt-5">
        <Meta label="Work mode">{workModeText(application)}</Meta>
        <Meta label="Compensation">
          <span title={compTitle(application)}>{formatComp(application, true)}</span>
          {application.offerNote && <div className="text-xs text-ink-faint mt-1 font-normal">{application.offerNote}</div>}
        </Meta>
        <Meta label={application.status === "PENDING" ? "Started" : "Applied"}>
          {formatDate(application.submittedAt ?? application.createdAt)}
        </Meta>
        <Meta label="Updated">{formatDate(application.updatedAt)}</Meta>
      </div>

      {stripHtml(application.notes).trim() && (
        <div className="mt-6">
          <div className="section-title mb-2">Notes</div>
          <div className="rte-surface text-sm text-ink-dim" dangerouslySetInnerHTML={{ __html: application.notes }} />
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
