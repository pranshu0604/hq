"use client";

import { useState, useTransition } from "react";
import { deleteSocialLog, updateSocialLog } from "@/app/social/actions";
import { Select } from "@/components/ui/select";
import { IconInstagram, IconLinkedIn, IconX } from "@/components/icons";
import { ACTION_LABEL, ACTIONS, PLATFORMS, type PlatformKey } from "@/lib/social";

const GLYPH: Record<string, React.ComponentType<{ className?: string }>> = {
  X: IconX,
  LINKEDIN: IconLinkedIn,
  INSTAGRAM: IconInstagram,
};

export type LogRow = {
  id: string;
  platform: PlatformKey;
  action: string;
  note: string;
  link: string | null;
  createdAt: string;
  time: string;
};

export type LogDay = { label: string; sweep: boolean; rows: LogRow[] };

const PLATFORM_OPTS = PLATFORMS.map((p) => ({ value: p.key, label: p.label }));
const ACTION_OPTS = ACTIONS.map((a) => ({ value: a.value, label: a.label }));

export default function SocialLogList({ days }: { days: LogDay[] }) {
  if (days.length === 0) {
    return <p className="text-sm text-ink-faint py-8">Nothing logged yet. Tap a platform above the moment you post, reply or comment.</p>;
  }

  return (
    <div className="space-y-7">
      {days.map((d) => (
        <div key={d.label}>
          <div className="flex items-center gap-3 mb-2.5">
            <span className="label">{d.label}</span>
            {d.sweep && <span className="label text-accent normal-case tracking-normal">🎭 full sweep</span>}
            <span className="h-px flex-1 bg-line-soft" />
            <span className="label">{d.rows.length}</span>
          </div>

          <div className="-mx-2">
            {d.rows.map((r) => (
              <SocialItem key={r.id} r={r} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SocialItem({ r }: { r: LogRow }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [platform, setPlatform] = useState<string>(r.platform);
  const [action, setAction] = useState(r.action);
  const [note, setNote] = useState(r.note);
  const [link, setLink] = useState(r.link ?? "");

  const save = () => {
    start(() => updateSocialLog(r.id, { platform, action, note, link }));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-2 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="w-32" options={PLATFORM_OPTS} value={platform} onChange={setPlatform} ariaLabel="Platform" />
          <Select className="w-28" options={ACTION_OPTS} value={action} onChange={setAction} ariaLabel="Action" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="field-input flex-1 min-w-[140px]" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link" className="field-input w-40" />
          <button onClick={save} disabled={pending} className="btn btn-primary text-[13px]">
            {pending ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn text-[13px]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const Glyph = GLYPH[r.platform];
  return (
    <div className="hover-row group flex items-center gap-3 px-2 py-2.5 text-sm">
      <Glyph className="h-[15px] w-[15px] text-ink-faint shrink-0" />
      <span className="text-ink-dim w-20 shrink-0 text-[13px]">{ACTION_LABEL[r.action] ?? r.action}</span>
      <span className="flex-1 min-w-0 truncate text-ink">
        {r.link ? (
          <a href={r.link} target="_blank" rel="noreferrer" className="hover:text-accent transition-colors">
            {r.note || r.link}
          </a>
        ) : (
          r.note || <span className="text-ink-faint">—</span>
        )}
      </span>
      <span className="label shrink-0">{r.time}</span>
      <button onClick={() => setEditing(true)} aria-label="Edit" className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100">
        edit
      </button>
      <button
        onClick={() => start(() => deleteSocialLog(r.id))}
        disabled={pending}
        aria-label="Delete"
        className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
