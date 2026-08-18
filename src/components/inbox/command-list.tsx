"use client";

// The single list for everything: capture anything, then triage it into a
// committed task, a scheduled transition, park it, or drop it. Backed by three
// tables (capture / todo / reminder) but presented as one filterable list.
import { useCallback, useEffect, useRef, useState } from "react";
import type { UnifiedList, ListItem, Bucket } from "@/lib/list";

const KINDS = ["TASK", "IDEA", "WORRY", "RABBIT_HOLE", "COMMITMENT"] as const;
const KIND_LABEL: Record<string, string> = { TASK: "Task", IDEA: "Idea", WORRY: "Worry", RABBIT_HOLE: "Rabbit hole", COMMITMENT: "Commitment" };
const KIND_TONE: Record<string, string> = { TASK: "var(--accent)", IDEA: "var(--info)", WORRY: "var(--warn)", RABBIT_HOLE: "var(--violet)", COMMITMENT: "var(--good)" };
const PRIO_TONE: Record<string, string> = { HIGH: "var(--bad)", MEDIUM: "var(--warn)", LOW: "var(--ink-faint)" };

const TABS: { key: Bucket; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "committed", label: "Committed" },
  { key: "scheduled", label: "Scheduled" },
  { key: "done", label: "Done" },
];

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today ${t}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${t}`;
}

// date-only formatter (todo due dates land at midnight)
function fmtDay(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(d);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${-diff}d overdue`;
  if (diff < 7) return `in ${diff}d`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// repeat presets offered in the UI
const RECUR_OPTS: { v: number; label: string }[] = [
  { v: 0, label: "Don't repeat" },
  { v: 1, label: "Every day" },
  { v: 2, label: "Every 2 days" },
  { v: 3, label: "Every 3 days" },
  { v: 7, label: "Weekly" },
  { v: 14, label: "Every 2 weeks" },
  { v: 30, label: "Monthly" },
];
function recurLabel(n?: number | null): string {
  if (!n) return "";
  if (n === 1) return "every day";
  if (n === 7) return "weekly";
  if (n === 14) return "every 2 weeks";
  if (n === 30) return "monthly";
  return `every ${n} days`;
}

export default function CommandList({ initial }: { initial: UnifiedList }) {
  const [data, setData] = useState<UnifiedList>(initial);
  const [tab, setTab] = useState<Bucket>("open");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [schedId, setSchedId] = useState<string | null>(null);
  const [schedAt, setSchedAt] = useState("");
  const [taskText, setTaskText] = useState("");
  const [taskRecur, setTaskRecur] = useState("0");
  const [repeatFor, setRepeatFor] = useState<string | null>(null);
  const [repeatVal, setRepeatVal] = useState("0");
  const inFlight = useRef(false);

  const pull = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (!inFlight.current && !editingId && !schedId && !repeatFor) pull();
    }, 5000);
    return () => clearInterval(t);
  }, [pull, editingId, schedId, repeatFor]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    inFlight.current = true;
    try {
      await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      await pull();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const capture = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await post({ source: "capture", action: "add", text: t });
    setTab("open");
  };

  const startEdit = (item: ListItem) => {
    setEditingId(item.id);
    setDraft(item.text);
  };
  const commitEdit = async (item: ListItem) => {
    const t = draft.trim();
    setEditingId(null);
    if (t && t !== item.text) await post({ source: item.source, action: "edit", id: item.id, text: t });
  };

  const cycleKind = (item: ListItem) => {
    const i = KINDS.indexOf((item.tag ?? "IDEA") as (typeof KINDS)[number]);
    const next = KINDS[(i + 1) % KINDS.length];
    post({ source: "capture", action: "kind", id: item.id, kind: next });
  };

  const doSchedule = async (item: ListItem) => {
    if (!schedAt) return;
    setSchedId(null);
    const at = new Date(schedAt).toISOString();
    setSchedAt("");
    await post({ source: "capture", action: "schedule", id: item.id, at });
    setTab("scheduled");
  };

  const addTask = async () => {
    const t = taskText.trim();
    if (!t) return;
    setTaskText("");
    const recur = Number(taskRecur) || 0;
    setTaskRecur("0");
    await post({ source: "todo", action: "add", text: t, recurEveryDays: recur });
  };

  const saveRepeat = async (item: ListItem) => {
    const v = Number(repeatVal) || 0;
    setRepeatFor(null);
    await post({ source: "todo", action: "repeat", id: item.id, recurEveryDays: v });
  };

  const counts: Record<Bucket, number> = {
    open: data.open.length,
    committed: data.committed.length,
    scheduled: data.scheduled.length,
    done: data.done.length,
  };
  const items = data[tab];

  return (
    <div className="space-y-6">
      {/* one capture bar for everything */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="Dump anything — a task, worry, idea, thing to do…"
            className="field-input flex-1"
            autoFocus
          />
          <button disabled={busy || !text.trim()} onClick={capture} className="btn btn-primary text-[13px] shrink-0">
            Capture
          </button>
        </div>
        <p className="label mt-2.5 text-ink-faint">Everything lands in Open. Commit it to a task, schedule it, park it, or let it go. ⌥⌘A captures from anywhere.</p>
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
                active ? "bg-accent text-[color:var(--accent-ink)] border-transparent" : "border-line text-ink-dim hover:text-ink hover:bg-card-2"
              }`}
            >
              {t.label} <span className={`font-mono text-[11px] ${active ? "opacity-80" : "text-ink-faint"}`}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {/* add a task directly (with an optional repeat interval) — Committed tab */}
      {tab === "committed" && (
        <div className="card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a task…"
              className="field-input flex-1"
            />
            <select value={taskRecur} onChange={(e) => setTaskRecur(e.target.value)} className="field-input sm:w-48" title="repeat interval">
              {RECUR_OPTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.v === 0 ? "One-off" : `Repeat: ${o.label.toLowerCase()}`}
                </option>
              ))}
            </select>
            <button disabled={busy || !taskText.trim()} onClick={addTask} className="btn btn-primary text-[13px] shrink-0">
              Add
            </button>
          </div>
          <p className="label mt-2.5 text-ink-faint">Recurring tasks re-arm when you check them off — they come back on the next interval instead of finishing.</p>
        </div>
      )}

      {/* the list */}
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint px-1">
          {tab === "open" ? "Inbox zero. Nothing waiting on your attention." : tab === "committed" ? "No committed tasks. Commit something from Open." : tab === "scheduled" ? "Nothing scheduled." : "Nothing done yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.source}-${item.id}`} className="card p-4">
              <div className="flex items-start gap-3">
                {/* left affordance: kind badge / checkbox / time */}
                {item.source === "capture" && (
                  <button
                    onClick={() => cycleKind(item)}
                    title="tap to change kind"
                    className="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded border transition-colors"
                    style={{ color: KIND_TONE[item.tag ?? "IDEA"], borderColor: (KIND_TONE[item.tag ?? "IDEA"] ?? "") + "55" }}
                  >
                    {KIND_LABEL[item.tag ?? "IDEA"]}
                  </button>
                )}
                {item.source === "todo" && (
                  <button
                    onClick={() => post({ source: "todo", action: "toggle", id: item.id, done: !item.done })}
                    className="shrink-0 mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-colors"
                    style={{ borderColor: item.done ? "var(--good)" : "var(--line-strong)", background: item.done ? "var(--good)" : "transparent" }}
                    title={item.recurEveryDays ? `did it — back ${recurLabel(item.recurEveryDays)}` : item.done ? "reopen" : "mark done"}
                  >
                    {item.done && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )}
                {item.source === "reminder" && (
                  <div className="shrink-0 mt-0.5 text-[10px] font-mono uppercase tracking-wider px-2 py-1.5 rounded border" style={{ color: "var(--accent)", borderColor: "var(--accent)55" }}>
                    {fmtWhen(item.when) || "soon"}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {editingId === item.id ? (
                    <textarea
                      value={draft}
                      autoFocus
                      rows={Math.min(6, Math.max(1, Math.ceil(draft.length / 40)))}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitEdit(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          commitEdit(item);
                        } else if (e.key === "Escape") setEditingId(null);
                      }}
                      className="field-input w-full text-sm resize-none"
                    />
                  ) : (
                    <button type="button" onClick={() => startEdit(item)} className={`text-left w-full text-sm leading-snug transition-colors ${item.done ? "text-ink-faint line-through" : "text-ink hover:text-accent"}`} title="tap to edit">
                      {item.text}
                    </button>
                  )}
                  {item.source === "todo" && (item.recurEveryDays || item.when) && !item.done ? (
                    <div className="text-xs mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {item.recurEveryDays ? <span className="text-accent">↻ {recurLabel(item.recurEveryDays)}</span> : null}
                      {item.when ? (
                        <span className="text-ink-faint">
                          {item.recurEveryDays && new Date(item.when).getTime() > Date.now() ? "next " : "due "}
                          {fmtDay(item.when)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {item.parked ? <div className="text-xs text-ink-faint mt-0.5">parked</div> : null}
                </div>
              </div>

              {/* schedule picker */}
              {schedId === item.id && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                  <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="field-input text-xs flex-1 min-w-[180px]" />
                  <button disabled={busy || !schedAt} onClick={() => doSchedule(item)} className="btn btn-primary text-xs">
                    Set
                  </button>
                  <button onClick={() => setSchedId(null)} className="btn btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              )}

              {/* actions */}
              {schedId !== item.id && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                  {item.source === "capture" && (
                    <>
                      <button disabled={busy} onClick={() => post({ source: "capture", action: "commit", id: item.id })} className="btn btn-ghost text-xs text-accent" title="commit as a task">
                        → Commit
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSchedId(item.id);
                          setSchedAt("");
                        }}
                        className="btn btn-ghost text-xs"
                      >
                        Schedule
                      </button>
                      <button disabled={busy} onClick={() => post({ source: "capture", action: item.parked ? "unpark" : "park", id: item.id })} className="btn btn-ghost text-xs">
                        {item.parked ? "Unpark" : "Park"}
                      </button>
                      <button disabled={busy} onClick={() => post({ source: "capture", action: "delete", id: item.id })} className="btn btn-ghost text-xs text-bad ml-auto">
                        Delete
                      </button>
                    </>
                  )}
                  {item.source === "todo" && (
                    <>
                      <button disabled={busy} onClick={() => startEdit(item)} className="btn btn-ghost text-xs">
                        Edit
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setRepeatFor(repeatFor === item.id ? null : item.id);
                          setRepeatVal(String(item.recurEveryDays ?? 0));
                        }}
                        className={`btn btn-ghost text-xs ${item.recurEveryDays ? "text-accent" : ""}`}
                        title="repeat this task on an interval"
                      >
                        {item.recurEveryDays ? "Repeat ✓" : "Repeat"}
                      </button>
                      <button disabled={busy} onClick={() => post({ source: "todo", action: "delete", id: item.id })} className="btn btn-ghost text-xs text-bad ml-auto">
                        Delete
                      </button>
                    </>
                  )}
                  {item.source === "reminder" && (
                    <>
                      <button disabled={busy} onClick={() => post({ source: "reminder", action: "done", id: item.id })} className="btn btn-ghost text-xs text-accent">
                        Done
                      </button>
                      <button disabled={busy} onClick={() => post({ source: "reminder", action: "snooze", id: item.id, minutes: 10 })} className="btn btn-ghost text-xs">
                        Snooze 10m
                      </button>
                      <button disabled={busy} onClick={() => post({ source: "reminder", action: "delete", id: item.id })} className="btn btn-ghost text-xs text-bad ml-auto">
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* repeat-interval picker (todos) */}
              {repeatFor === item.id && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                  <select value={repeatVal} onChange={(e) => setRepeatVal(e.target.value)} className="field-input text-xs flex-1 min-w-[160px]">
                    {RECUR_OPTS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button disabled={busy} onClick={() => saveRepeat(item)} className="btn btn-primary text-xs">
                    Set
                  </button>
                  <button onClick={() => setRepeatFor(null)} className="btn btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
