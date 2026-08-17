"use client";

import { useTransition } from "react";
import { addInterview, deleteInterview, updateInterview } from "@/app/applications/actions";
import { formatDate } from "@/lib/format";
import type { Interview } from "@prisma/client";

export default function InterviewsSection({
  applicationId,
  interviews,
}: {
  applicationId: string;
  interviews: Interview[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      {interviews.map((iv, i) => (
        <form
          key={iv.id}
          action={updateInterview.bind(null, iv.id, applicationId)}
          style={{ animationDelay: `${i * 50}ms` }}
          className="reveal-row card p-5 flex flex-wrap gap-3 items-end"
        >
          <div>
            <label className="label block mb-1.5">Round</label>
            <input name="round" type="number" defaultValue={iv.round} className="field-input w-20" />
          </div>
          <div>
            <label className="label block mb-1.5">Type</label>
            <input name="type" defaultValue={iv.type} placeholder="Screening / DSA / System design…" className="field-input" />
          </div>
          <div>
            <label className="label block mb-1.5">Date</label>
            <input
              name="scheduledOn"
              type="date"
              defaultValue={iv.scheduledOn ? new Date(iv.scheduledOn).toISOString().slice(0, 10) : ""}
              className="field-input"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="label block mb-1.5">Outcome</label>
            <input name="outcome" defaultValue={iv.outcome} placeholder="Passed / pending / rejected" className="field-input" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="label block mb-1.5">Notes</label>
            <input name="notes" defaultValue={iv.notes} className="field-input" />
          </div>
          <button className="btn btn-ghost text-xs">save</button>
          <button
            type="button"
            onClick={() => startTransition(() => deleteInterview(iv.id, applicationId))}
            disabled={pending}
            className="text-xs text-ink-faint hover:text-bad transition-colors"
          >
            remove
          </button>
          <div className="label w-full">scheduled {formatDate(iv.scheduledOn)}</div>
        </form>
      ))}

      <form action={addInterview.bind(null, applicationId)} className="card p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label block mb-1.5">Round</label>
          <input name="round" type="number" defaultValue={interviews.length + 1} className="field-input w-20" />
        </div>
        <div>
          <label className="label block mb-1.5">Type</label>
          <input name="type" placeholder="Screening / DSA / System design…" className="field-input" />
        </div>
        <div>
          <label className="label block mb-1.5">Date</label>
          <input name="scheduledOn" type="date" className="field-input" />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="label block mb-1.5">Outcome</label>
          <input name="outcome" placeholder="Passed / pending / rejected" className="field-input" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label block mb-1.5">Notes</label>
          <input name="notes" className="field-input" />
        </div>
        <button className="btn text-xs">+ add interview</button>
      </form>
    </div>
  );
}
