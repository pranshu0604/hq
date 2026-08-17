"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addNoteIncident, addThought, deleteReflection, deleteThought, updateReflection, updateThought } from "@/app/reflections/actions";
import { searchEntitiesAction } from "@/app/mentions/actions";
import MentionBar from "@/components/entity/mention-bar";
import RichEditor from "@/components/notes/rich-editor";
import type { EntityCard } from "@/lib/entities";
import { formatDate, stripHtml } from "@/lib/format";
import { LeanBar } from "./lean-bar";

type Reflection = {
  id: string;
  title: string;
  thesisLabel: string;
  antithesisLabel: string;
  thesisBody: string;
  antithesisBody: string;
  synthesis: string;
  lean: number;
  updatedAt: string;
};
type Thought = { id: string; side: "THESIS" | "ANTITHESIS"; body: string; noteId: string | null };

export default function ReflectionDetail({
  reflection: r,
  thoughts,
  noteTitles,
  tagged,
  backlinks,
}: {
  reflection: Reflection;
  thoughts: Thought[];
  noteTitles: Record<string, string>;
  tagged: EntityCard[];
  backlinks: EntityCard[];
}) {
  const [editing, setEditing] = useState(r.title.trim() === "");
  const [lean, setLean] = useState(r.lean);
  const [synthHtml, setSynthHtml] = useState(r.synthesis);
  const [pending, start] = useTransition();
  const router = useRouter();
  const hasSynthesis = stripHtml(r.synthesis).trim().length > 0;

  const thesis = thoughts.filter((t) => t.side === "THESIS");
  const antithesis = thoughts.filter((t) => t.side === "ANTITHESIS");

  const save = (fd: FormData) =>
    start(() => {
      updateReflection(r.id, fd);
      setEditing(false);
    });

  const remove = () =>
    start(async () => {
      await deleteReflection(r.id);
      router.push("/reflections");
    });

  if (editing) {
    return (
      <form action={save} className="mt-6 space-y-6 reveal">
        <input
          name="title"
          defaultValue={r.title}
          autoFocus
          placeholder="Name the tension — e.g. Empathy vs Selfishness"
          className="w-full bg-transparent border-none text-4xl display focus:outline-none placeholder:text-ink-faint"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <PoleEdit side="antithesis" labelName="antithesisLabel" bodyName="antithesisBody" label={r.antithesisLabel} body={r.antithesisBody} />
          <PoleEdit side="thesis" labelName="thesisLabel" bodyName="thesisBody" label={r.thesisLabel} body={r.thesisBody} />
        </div>

        <div className="card p-5">
          <div className="label mb-3">Where do you actually lean?</div>
          <LeanBar lean={lean} thesisLabel={r.thesisLabel || "Thesis"} antithesisLabel={r.antithesisLabel || "Antithesis"} />
          <input type="range" name="lean" min={0} max={100} value={lean} onChange={(e) => setLean(Number(e.target.value))} className="hq-range w-full mt-4" />
        </div>

        <div className="card p-5">
          <div className="label mb-2">Synthesis</div>
          <RichEditor initialHTML={r.synthesis} onChange={setSynthHtml} />
          <input type="hidden" name="synthesis" value={synthHtml} />
        </div>

        <div className="flex items-center gap-3">
          <button disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
          {r.title.trim() !== "" && (
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
              Cancel
            </button>
          )}
          <button type="button" onClick={remove} disabled={pending} className="label hover:text-bad transition-colors ml-auto">
            delete
          </button>
        </div>
      </form>
    );
  }

  // ---- view mode ----
  return (
    <div className="mt-6 space-y-6 reveal">
      <div className="flex items-start justify-between gap-4">
        <h1 className="display text-4xl">{r.title || "Untitled reflection"}</h1>
        <button onClick={() => setEditing(true)} className="btn btn-ghost shrink-0 mt-1">
          Edit
        </button>
      </div>

      <div className="card p-5">
        <LeanBar lean={r.lean} thesisLabel={r.thesisLabel} antithesisLabel={r.antithesisLabel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Pole
          reflectionId={r.id}
          side="ANTITHESIS"
          label={r.antithesisLabel}
          body={r.antithesisBody}
          thoughts={antithesis}
          noteTitles={noteTitles}
          pending={pending}
          start={start}
        />
        <Pole
          reflectionId={r.id}
          side="THESIS"
          label={r.thesisLabel}
          body={r.thesisBody}
          thoughts={thesis}
          noteTitles={noteTitles}
          pending={pending}
          start={start}
        />
      </div>

      {hasSynthesis ? (
        <div className="card-hero p-6">
          <div className="label text-accent mb-2.5">Synthesis</div>
          <div className="rte-surface text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: r.synthesis }} />
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="w-full card p-6 text-left text-ink-faint text-sm hover:text-ink-dim hover:border-line-strong transition-colors border-dashed">
          + Add a synthesis — reconcile the two sides once you&apos;ve sat with them.
        </button>
      )}

      <div className="border-t border-line-soft pt-5">
        <MentionBar sourceType="reflection" sourceId={r.id} tagged={tagged} backlinks={backlinks} />
      </div>

      <div className="label">updated {formatDate(r.updatedAt)}</div>
    </div>
  );
}

function PoleEdit({
  side,
  labelName,
  bodyName,
  label,
  body,
}: {
  side: "thesis" | "antithesis";
  labelName: string;
  bodyName: string;
  label: string;
  body: string;
}) {
  const accent = side === "thesis";
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-2 w-2 rounded-full" style={{ background: accent ? "var(--accent)" : "var(--info)" }} />
        <span className="label">{side}</span>
      </div>
      <input
        name={labelName}
        defaultValue={label}
        placeholder={accent ? "Thesis — e.g. Empathy" : "Antithesis — e.g. Selfishness"}
        className="field-input w-full mb-2 font-medium"
      />
      <textarea
        name={bodyName}
        defaultValue={body}
        rows={3}
        placeholder="The case for this side…"
        className="field-input w-full resize-y text-sm leading-relaxed"
      />
    </div>
  );
}

function Pole({
  reflectionId,
  side,
  label,
  body,
  thoughts,
  noteTitles,
  pending,
  start,
}: {
  reflectionId: string;
  side: "THESIS" | "ANTITHESIS";
  label: string;
  body: string;
  thoughts: Thought[];
  noteTitles: Record<string, string>;
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const [draft, setDraft] = useState("");
  const accent = side === "THESIS";

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    start(() => addThought(reflectionId, side, text));
  };

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent ? "var(--accent)" : "var(--info)" }} />
          <span className="section-title truncate">{label || side.toLowerCase()}</span>
        </div>
        <span className="label shrink-0">
          {thoughts.length} incident{thoughts.length === 1 ? "" : "s"}
        </span>
      </div>

      {body.trim() && <p className="text-sm text-ink-dim leading-relaxed whitespace-pre-wrap mb-4">{body}</p>}

      <div className="space-y-2 mb-3">
        {thoughts.length === 0 && (
          <p className="text-xs text-ink-faint italic">No incidents yet. Every observation that supports this side goes here.</p>
        )}
        {thoughts.map((t) => (
          <ThoughtItem key={t.id} thought={t} reflectionId={reflectionId} noteTitles={noteTitles} />
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
            }}
            rows={1}
            placeholder="Throw an incident at this side…"
            className="field-input flex-1 resize-none text-[13px] py-2"
          />
          <button onClick={add} disabled={pending || !draft.trim()} className="btn btn-primary text-xs shrink-0 self-stretch">
            Add
          </button>
        </div>
        <NoteDrop reflectionId={reflectionId} side={side} pending={pending} start={start} />
      </div>
    </div>
  );
}

function ThoughtItem({
  thought: t,
  reflectionId,
  noteTitles,
}: {
  thought: Thought;
  reflectionId: string;
  noteTitles: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body);
  const [pending, start] = useTransition();
  const fromNote = t.noteId !== null; // note snapshots stay read-only

  const save = () => {
    if (draft.trim()) start(() => updateThought(t.id, reflectionId, draft));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg bg-surface-2 px-3 py-2.5">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            else if (e.key === "Escape") setEditing(false);
          }}
          rows={2}
          className="field-input w-full resize-none text-[13px] py-1.5"
        />
        <div className="flex gap-2 mt-1.5">
          <button onClick={save} disabled={pending || !draft.trim()} className="btn btn-primary text-xs">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="btn text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed">
      <p className="whitespace-pre-wrap pr-10">{t.body}</p>
      {t.noteId && (
        <Link
          href={`/notes?note=${t.noteId}`}
          className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-accent/90 hover:text-accent transition-colors"
        >
          ↳ from note · {noteTitles[t.noteId] ?? "note"}
        </Link>
      )}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
        {!fromNote && (
          <button onClick={() => setEditing(true)} aria-label="Edit incident" className="label text-ink-faint hover:text-accent transition-colors">
            edit
          </button>
        )}
        <button
          onClick={() => start(() => deleteThought(t.id, reflectionId))}
          disabled={pending}
          aria-label="Remove incident"
          className="text-ink-faint hover:text-bad transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// pull an existing note in as a supporting incident
function NoteDrop({
  reflectionId,
  side,
  pending,
  start,
}: {
  reflectionId: string;
  side: "THESIS" | "ANTITHESIS";
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntityCard[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    searchEntitiesAction(query, [], ["note"]).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, [query, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const drop = (noteId: string) => {
    setOpen(false);
    setQuery("");
    start(() => addNoteIncident(reflectionId, side, noteId));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="text-[11px] text-ink-faint hover:text-accent transition-colors"
      >
        ↳ or drop in an existing note
      </button>
      {open && (
        <div className="elevated absolute left-0 bottom-full mb-1.5 w-72 rounded-lg border border-line bg-card p-1.5 z-30">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes…"
            className="field-input w-full mb-1.5 text-sm"
          />
          <div className="max-h-56 overflow-y-auto">
            {results.length === 0 && <div className="text-ink-faint text-xs px-2 py-3">No notes found.</div>}
            {results.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => drop(c.id)}
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
