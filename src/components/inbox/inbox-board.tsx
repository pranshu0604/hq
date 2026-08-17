"use client";

// The inbox — process open loops. Everything captured (from here or the desktop
// ⌥⌘A hotkey) lands as OPEN; you park it, drop it, retype its kind, or promote a
// task into a real Todo. The point is to empty your head, not to file forever.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CaptureKind, CaptureRow } from "@/lib/capture";

const KINDS: CaptureKind[] = ["TASK", "IDEA", "WORRY", "RABBIT_HOLE", "COMMITMENT"];
const KIND_LABEL: Record<CaptureKind, string> = {
  TASK: "Task",
  IDEA: "Idea",
  WORRY: "Worry",
  RABBIT_HOLE: "Rabbit hole",
  COMMITMENT: "Commitment",
};
const KIND_TONE: Record<CaptureKind, string> = {
  TASK: "var(--accent)",
  IDEA: "var(--info)",
  WORRY: "var(--warn)",
  RABBIT_HOLE: "var(--violet)",
  COMMITMENT: "var(--good)",
};

export default function InboxBoard({ initial }: { initial: CaptureRow[] }) {
  const [rows, setRows] = useState<CaptureRow[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const pull = useCallback(async () => {
    try {
      const res = await fetch("/api/capture", { cache: "no-store" });
      const data = await res.json();
      setRows(data.captures ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  // stay in sync with captures dropped in from the desktop hotkey
  useEffect(() => {
    const t = setInterval(pull, 5000);
    return () => clearInterval(t);
  }, [pull]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setText("");
    try {
      await fetch("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
      await pull();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    // optimistic removal for park/drop/todo
    if (action === "drop" || action === "todo" || action === "park") setRows((r) => r.filter((x) => x.id !== id));
    try {
      await fetch("/api/capture", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action, ...extra }) });
      await pull();
    } finally {
      setBusy(false);
    }
  };

  // permanently remove a capture (hard delete)
  const remove = async (id: string) => {
    setBusy(true);
    setRows((r) => r.filter((x) => x.id !== id)); // optimistic
    try {
      await fetch("/api/capture", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      await pull();
    } finally {
      setBusy(false);
    }
  };

  // edit a capture's text in place
  const saveText = async (id: string, next: string) => {
    const t = next.trim();
    if (!t) return;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, text: t } : x))); // optimistic
    try {
      await fetch("/api/capture", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "text", text: t }) });
      await pull();
    } catch {
      /* ignore */
    }
  };

  const cycleKind = (row: CaptureRow) => {
    const i = KINDS.indexOf(row.kind);
    const next = KINDS[(i + 1) % KINDS.length];
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, kind: next } : x)));
    patch(row.id, "kind", { kind: next });
  };

  const open = rows.filter((r) => r.status === "OPEN");
  const parked = rows.filter((r) => r.status === "PARKED");

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Dump anything — a task, worry, idea, rabbit hole…"
            className="field-input flex-1"
            autoFocus
          />
          <button disabled={busy || !text.trim()} onClick={add} className="btn btn-primary text-[13px]">
            Capture
          </button>
        </div>
        <p className="label mt-2.5 text-ink-faint">It auto-sorts by kind — fix it with the tag if it guesses wrong. ⌥⌘A captures from anywhere.</p>
      </div>

      <Section title="Open" count={open.length} empty="Inbox zero. Nothing waiting on your attention.">
        {open.map((r) => (
          <Row key={r.id} row={r} busy={busy} onKind={() => cycleKind(r)} onPatch={patch} onDelete={remove} onSaveText={saveText} />
        ))}
      </Section>

      {parked.length > 0 && (
        <Section title="Parked" count={parked.length} empty="">
          {parked.map((r) => (
            <Row key={r.id} row={r} busy={busy} parked onKind={() => cycleKind(r)} onPatch={patch} onDelete={remove} onSaveText={saveText} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="section-title">{title}</div>
        <span className="label">{count}</span>
      </div>
      {count === 0 ? empty ? <p className="text-sm text-ink-faint">{empty}</p> : null : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function Row({
  row,
  busy,
  parked,
  onKind,
  onPatch,
  onDelete,
  onSaveText,
}: {
  row: CaptureRow;
  busy: boolean;
  parked?: boolean;
  onKind: () => void;
  onPatch: (id: string, action: string, extra?: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onSaveText: (id: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.text);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== row.text) onSaveText(row.id, draft);
    else setDraft(row.text);
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={onKind}
          title="tap to change kind"
          className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border transition-colors"
          style={{ color: KIND_TONE[row.kind], borderColor: KIND_TONE[row.kind] + "55" }}
        >
          {KIND_LABEL[row.kind]}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              value={draft}
              autoFocus
              rows={Math.min(6, Math.max(1, Math.ceil(draft.length / 40)))}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setDraft(row.text);
                  setEditing(false);
                }
              }}
              className="field-input w-full text-sm resize-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(row.text);
                setEditing(true);
              }}
              className="text-left w-full text-sm text-ink leading-snug hover:text-accent transition-colors"
              title="tap to edit"
            >
              {row.text}
            </button>
          )}
          {row.who ? <div className="text-xs text-ink-faint mt-0.5">for {row.who}</div> : null}
        </div>
      </div>

      {/* action bar — touch-friendly, wraps on narrow screens */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
        {row.kind === "TASK" && (
          <button disabled={busy} onClick={() => onPatch(row.id, "todo")} className="btn btn-ghost text-xs text-accent" title="make it a todo">
            → Todo
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => {
            setDraft(row.text);
            setEditing(true);
          }}
          className="btn btn-ghost text-xs"
        >
          Edit
        </button>
        {parked ? (
          <button disabled={busy} onClick={() => onPatch(row.id, "reopen")} className="btn btn-ghost text-xs">
            Unpark
          </button>
        ) : (
          <button disabled={busy} onClick={() => onPatch(row.id, "park")} className="btn btn-ghost text-xs">
            Park
          </button>
        )}
        <button disabled={busy} onClick={() => onDelete(row.id)} className="btn btn-ghost text-xs text-bad ml-auto" title="delete permanently">
          Delete
        </button>
      </div>
    </div>
  );
}

export function InboxLink() {
  return (
    <Link href="/inbox" className="btn text-[13px]">
      Open inbox
    </Link>
  );
}
