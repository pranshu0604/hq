"use client";

import { useState, useTransition } from "react";
import {
  addPlatform,
  addEmail,
  deleteEmail,
  deletePlatform,
  toggleEmailReply,
  updateEmail,
  updatePlatform,
  updatePlatformResponse,
} from "@/app/applications/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import type { ApplicationPlatform, EmailSent } from "@prisma/client";

type Platform = ApplicationPlatform & { emails: EmailSent[] };

export default function PlatformsSection({
  applicationId,
  platforms,
}: {
  applicationId: string;
  platforms: Platform[];
}) {
  return (
    <div className="space-y-4">
      {platforms.map((p, i) => (
        <div key={p.id} className="reveal-row" style={{ animationDelay: `${i * 50}ms` }}>
          <PlatformCard applicationId={applicationId} platform={p} />
        </div>
      ))}

      <form action={addPlatform.bind(null, applicationId)} className="card flex gap-2 p-3">
        <input name="platform" required placeholder="Platform, e.g. LinkedIn / company site" className="field-input" />
        <input name="link" placeholder="Link (optional)" className="field-input" />
        <button className="btn shrink-0">+ Add</button>
      </form>
    </div>
  );
}

function PlatformCard({ applicationId, platform }: { applicationId: string; platform: Platform }) {
  const [pending, startTransition] = useTransition();
  const [addingEmail, setAddingEmail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(platform.platform);
  const [link, setLink] = useState(platform.link ?? "");

  const savePlatform = () => {
    startTransition(() => updatePlatform(platform.id, applicationId, { platform: name, link }));
    setEditing(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Platform" className="field-input max-w-[220px]" />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (optional)" className="field-input flex-1 min-w-[160px]" />
            <button onClick={savePlatform} disabled={pending} className="btn btn-primary text-xs">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="text-sm">{platform.platform}</div>
              {platform.link && (
                <a href={platform.link} target="_blank" className="text-xs text-ink-faint hover:text-accent break-all transition-colors">
                  {platform.link}
                </a>
              )}
              <div className="label mt-1.5">applied {formatDate(platform.appliedOn)}</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditing(true)} className="label hover:text-accent transition-colors">
                edit
              </button>
              <button
                onClick={() => startTransition(() => deletePlatform(platform.id, applicationId))}
                disabled={pending}
                className="label hover:text-bad transition-colors"
              >
                remove
              </button>
            </div>
          </>
        )}
      </div>

      <form
        action={updatePlatformResponse.bind(null, platform.id, applicationId)}
        className="flex flex-wrap items-center gap-3 mb-4 text-sm"
      >
        <Checkbox
          name="responseReceived"
          defaultChecked={platform.responseReceived}
          label={<span className="label">response received</span>}
        />
        <input name="responseSource" defaultValue={platform.responseSource ?? ""} placeholder="via (email / call / portal…)" className="field-input max-w-[220px]" />
        <input name="responseNotes" defaultValue={platform.responseNotes} placeholder="response notes" className="field-input flex-1 min-w-[160px]" />
        <button className="btn btn-ghost text-xs">save</button>
      </form>

      <div className="label mb-2.5">emails sent ({platform.emails.length})</div>
      <div className="space-y-1.5 mb-3">
        {platform.emails.map((e) => (
          <EmailRow key={e.id} email={e} applicationId={applicationId} />
        ))}
      </div>

      {addingEmail ? (
        <form
          action={(fd) => {
            addEmail(platform.id, applicationId, fd);
            setAddingEmail(false);
          }}
          className="flex flex-wrap gap-2"
        >
          <input name="recipientName" placeholder="Recipient name" className="field-input max-w-[160px]" />
          <input name="recipientEmail" placeholder="Recipient email" className="field-input max-w-[200px]" />
          <input name="subject" placeholder="Subject" className="field-input flex-1 min-w-[140px]" />
          <button className="btn btn-ghost text-xs">add</button>
        </form>
      ) : (
        <button onClick={() => setAddingEmail(true)} className="text-xs text-ink-dim hover:text-ink transition-colors underline">
          + log an email
        </button>
      )}
    </div>
  );
}

function EmailRow({ email: e, applicationId }: { email: EmailSent; applicationId: string }) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={(fd) => {
          startTransition(() => updateEmail(e.id, applicationId, fd));
          setEditing(false);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input name="recipientName" defaultValue={e.recipientName ?? ""} placeholder="Recipient name" className="field-input max-w-[150px] text-xs py-1" />
        <input name="recipientEmail" defaultValue={e.recipientEmail ?? ""} placeholder="Recipient email" className="field-input max-w-[180px] text-xs py-1" />
        <input name="subject" defaultValue={e.subject ?? ""} placeholder="Subject" className="field-input flex-1 min-w-[120px] text-xs py-1" />
        <button className="btn btn-ghost text-xs">save</button>
        <button type="button" onClick={() => setEditing(false)} className="label hover:text-ink transition-colors">
          cancel
        </button>
      </form>
    );
  }

  return (
    <div className="group flex items-center gap-2 text-xs text-ink-dim">
      <span className="flex-1">
        {e.recipientName || e.recipientEmail || "unnamed"}
        {e.subject && <span className="text-ink-faint"> — {e.subject}</span>}
        <span className="text-ink-faint"> · {formatDate(e.sentOn)}</span>
        {e.gotReply && <span className="text-good"> · replied</span>}
      </span>
      <button onClick={() => setEditing(true)} className="hover:text-accent transition-colors underline opacity-0 group-hover:opacity-100">
        edit
      </button>
      <button
        onClick={() => startTransition(() => toggleEmailReply(e.id, applicationId, !e.gotReply))}
        className="hover:text-ink transition-colors underline"
      >
        {e.gotReply ? "mark unreplied" : "mark replied"}
      </button>
      <button onClick={() => startTransition(() => deleteEmail(e.id, applicationId))} className="hover:text-bad transition-colors">
        ×
      </button>
    </div>
  );
}
