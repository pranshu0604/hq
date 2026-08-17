"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInteraction, deletePerson, logInteraction, mergePerson, setReminder, updateInteraction, updatePerson } from "@/app/people/actions";
import { searchEntitiesAction } from "@/app/mentions/actions";
import MentionBar from "@/components/entity/mention-bar";
import RichEditor from "@/components/notes/rich-editor";
import { Select } from "@/components/ui/select";
import type { EntityCard } from "@/lib/entities";
import { formatDate, relativeTime, stripHtml, todayInputValue } from "@/lib/format";
import { CADENCES, INTERACTION_KINDS, INTERACTION_LABEL, cadenceLabel } from "@/lib/people";
import ActivityGraph from "@/components/insights/activity-graph";

type Person = { id: string; name: string; relation: string; handle: string; notes: string; reminderDays: number | null };
type Interaction = { id: string; kind: string; note: string; date: string };
type Bucket = { label: string; count: number };
type Series = { daily: Bucket[]; weekly: Bucket[]; monthly: Bucket[] };

export default function PersonDetail({
  person: p,
  interactions,
  series,
  tagged,
  backlinks,
}: {
  person: Person;
  interactions: Interaction[];
  series: Series;
  tagged: EntityCard[];
  backlinks: EntityCard[];
}) {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState("met");
  const [date, setDate] = useState(() => todayInputValue());
  const [note, setNote] = useState("");
  const [notesHtml, setNotesHtml] = useState(p.notes);
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = (fd: FormData) => start(() => { updatePerson(p.id, fd); setEditing(false); });
  const remove = () => start(async () => { await deletePerson(p.id); router.push("/people"); });
  const log = () => {
    start(() => {
      logInteraction(p.id, kind, note, date);
    });
    setNote("");
  };

  return (
    <div className="mt-6 space-y-6 reveal">
      {editing ? (
        <form action={save} className="card p-5 space-y-2.5">
          <input name="name" defaultValue={p.name} required className="field-input w-full text-lg font-medium" placeholder="Name" />
          <div className="flex flex-wrap gap-2">
            <input name="relation" defaultValue={p.relation} placeholder="Relation" className="field-input flex-1 min-w-[140px]" />
            <input name="handle" defaultValue={p.handle} placeholder="@handle / contact" className="field-input flex-1 min-w-[140px]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="label shrink-0">🔔 Remind me to reach out</span>
            <Select name="reminderDays" className="w-44" options={CADENCES} defaultValue={String(p.reminderDays ?? 0)} ariaLabel="Reminder cadence" />
          </div>
          <div>
            <div className="label mb-1.5">Notes</div>
            <RichEditor initialHTML={p.notes} onChange={setNotesHtml} placeholder="How you met, what matters to them… paste images or links too." />
            <input type="hidden" name="notes" value={notesHtml} />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
            <button type="button" onClick={remove} disabled={pending} className="label hover:text-bad transition-colors ml-auto">delete</button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="display text-4xl">{p.name}</h1>
            <div className="flex items-center gap-2.5 mt-1.5 text-sm text-ink-dim">
              {p.relation && <span>{p.relation}</span>}
              {p.relation && p.handle && <span className="text-ink-faint">·</span>}
              {p.handle && <span className="font-mono text-ink-faint">{p.handle}</span>}
            </div>
            {stripHtml(p.notes).trim() && <div className="rte-surface mt-3 text-sm text-ink-dim max-w-xl" dangerouslySetInnerHTML={{ __html: p.notes }} />}
            <div className="mt-3.5 flex items-center gap-2">
              <span className="label shrink-0" title={p.reminderDays ? `Reminding you ${cadenceLabel(p.reminderDays).toLowerCase()}` : "Turn on a keep-in-touch reminder"}>
                🔔 Keep in touch
              </span>
              <Select
                className="w-40"
                options={CADENCES}
                value={String(p.reminderDays ?? 0)}
                onChange={(v) => start(() => setReminder(p.id, Number(v) || null))}
                ariaLabel="Reminder cadence"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <MergeControl personId={p.id} personName={p.name} pending={pending} start={start} />
            <button onClick={() => setEditing(true)} className="btn btn-ghost">Edit</button>
          </div>
        </div>
      )}

      {/* log a touchpoint */}
      <div className="card p-5">
        <div className="section-title mb-3">Log a touchpoint</div>
        <div className="flex flex-wrap items-center gap-2">
          <Select name="kind" className="w-32" options={INTERACTION_KINDS} value={kind} onChange={setKind} ariaLabel="Kind" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input w-auto" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What about? (optional)" className="field-input flex-1 min-w-[160px]" />
          <button onClick={log} disabled={pending} className="btn btn-primary">Log</button>
        </div>
      </div>

      {interactions.length > 0 && (
        <div className="card p-6">
          <ActivityGraph series={series} title="Your history together" unit="touchpoint" />
        </div>
      )}

      {/* history */}
      <div>
        <div className="section-title mb-3">
          {interactions.length} touchpoint{interactions.length === 1 ? "" : "s"}
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm text-ink-faint">No history yet. Log the last time you spoke.</p>
        ) : (
          <div className="border-t border-line">
            {interactions.map((it) => (
              <InteractionItem key={it.id} it={it} personId={p.id} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line-soft pt-5">
        <MentionBar sourceType="person" sourceId={p.id} tagged={tagged} backlinks={backlinks} />
      </div>
    </div>
  );
}

function InteractionItem({ it, personId }: { it: Interaction; personId: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [kind, setKind] = useState(it.kind || "");
  const [note, setNote] = useState(it.note);
  const [date, setDate] = useState(it.date.slice(0, 10));

  const save = () => {
    start(() => updateInteraction(it.id, personId, { kind, note, date }));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="py-3 border-b border-line-soft flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field-input w-auto" />
        <Select className="w-32" options={INTERACTION_KINDS} value={kind} onChange={setKind} ariaLabel="Kind" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="field-input flex-1 min-w-[140px]" />
        <button onClick={save} disabled={pending} className="btn btn-primary text-[13px]">
          {pending ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="btn text-[13px]">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-4 py-3 border-b border-line-soft text-sm">
      <div className="w-24 shrink-0 font-mono text-xs text-ink-dim">{formatDate(it.date)}</div>
      {it.kind && (
        <span className="text-[11px] font-mono uppercase tracking-wide text-info bg-info/12 border border-info/25 rounded px-1.5 py-0.5">
          {INTERACTION_LABEL[it.kind] ?? it.kind}
        </span>
      )}
      <span className="flex-1 text-ink-dim truncate">{it.note || <span className="text-ink-faint">—</span>}</span>
      <span className="label shrink-0">{relativeTime(it.date)}</span>
      <button onClick={() => setEditing(true)} aria-label="Edit" className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        edit
      </button>
      <button
        onClick={() => start(() => deleteInteraction(it.id, personId))}
        disabled={pending}
        aria-label="Delete"
        className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100 shrink-0"
      >
        ×
      </button>
    </div>
  );
}

// fold this person into another (fixes accidental duplicates)
function MergeControl({
  personId,
  personName,
  pending,
  start,
}: {
  personId: string;
  personName: string;
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityCard[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let live = true;
    searchEntitiesAction(query, [{ type: "person", id: personId }], ["person"]).then((r) => live && setResults(r));
    return () => { live = false; };
  }, [query, open, personId]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const merge = (target: EntityCard) => {
    if (!window.confirm(`Merge "${personName}" into "${target.title}"? All touchpoints and tags move over, and this duplicate is removed.`)) return;
    setOpen(false);
    start(async () => {
      const into = await mergePerson(personId, target.id);
      if (into) router.push(`/people/${into}`);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} disabled={pending} className="btn btn-ghost">Merge</button>
      {open && (
        <div className="elevated absolute right-0 top-full mt-1.5 w-72 rounded-lg border border-line bg-card p-1.5 z-30">
          <div className="label px-1.5 pt-1 pb-1.5">Merge this person into…</div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="field-input w-full mb-1.5 text-sm"
          />
          <div className="max-h-56 overflow-y-auto">
            {results.length === 0 && <div className="text-ink-faint text-xs px-2 py-3">No other people.</div>}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => merge(c)}
                className="w-full text-left rounded-md px-2 py-1.5 hover:bg-surface-2 transition-colors"
              >
                <span className="block truncate text-[13px] text-ink">{c.title}</span>
                {c.subtitle && <span className="block truncate text-[11px] text-ink-faint">{c.subtitle}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
