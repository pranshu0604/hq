"use client";

import { useMemo, useState, useTransition } from "react";
import { createNote, deleteNote, togglePin, updateNote } from "@/app/notes/actions";
import { formatDate, notePreview, stripHtml } from "@/lib/format";
import RichEditor from "@/components/notes/rich-editor";
import MentionBar from "@/components/entity/mention-bar";
import type { EntityCard } from "@/lib/entities";

type Note = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type NoteMentions = Record<string, { tagged: EntityCard[]; backlinks: EntityCard[] }>;

export default function NotesApp({ notes, mentions = {} }: { notes: Note[]; mentions?: NoteMentions }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  // mobile master-detail: false = show the list, true = show the open note (desktop shows both)
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q)
    );
  }, [notes, query]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  function handleNew() {
    startTransition(async () => {
      const id = await createNote();
      setSelectedId(id);
      setMobileOpen(true);
    });
  }

  function openNote(id: string) {
    setSelectedId(id);
    setMobileOpen(true);
  }

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 border-t border-line pt-6 lg:pt-8">
      <div className={`${mobileOpen ? "hidden lg:block" : "block"}`}>
        <div className="flex gap-2 mb-4">
          <input className="field-input" placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button onClick={handleNew} className="btn shrink-0 px-3" aria-label="New note">
            +
          </button>
        </div>
        <div className="space-y-1">
          {filtered.map((n) => {
            const { text, image } = notePreview(n.content);
            return (
              <button
                key={n.id}
                onClick={() => openNote(n.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  n.id === selectedId ? "bg-selected text-ink" : "text-ink-dim hover:bg-card hover:text-ink"
                }`}
              >
                <div className="truncate flex items-center gap-1.5">
                  {n.pinned && <span className="text-accent text-xs">●</span>}
                  {n.title || "Untitled note"}
                </div>
                {text && <div className="text-ink-faint text-xs mt-0.5 line-clamp-2">{text}</div>}
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" loading="lazy" className="mt-2 w-full h-20 object-cover rounded-md border border-line-soft" />
                )}
                <div className="text-ink-faint text-[10px] mt-1.5 font-mono">{formatDate(n.updatedAt)}</div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="text-ink-dim text-sm px-3">No notes found.</div>}
        </div>
      </div>

      <div className={`${mobileOpen ? "block" : "hidden lg:block"} mt-2 lg:mt-0`}>
        {/* mobile-only: back to the note list */}
        <button onClick={() => setMobileOpen(false)} className="btn btn-ghost text-xs mb-4 lg:hidden" aria-label="Back to notes">
          ← Notes
        </button>
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            mentions={mentions[selected.id]}
            pending={pending}
            onSave={(fd) => startTransition(() => updateNote(selected.id, fd))}
            onPin={() => startTransition(() => togglePin(selected.id, !selected.pinned))}
            onDelete={() => {
              startTransition(() => deleteNote(selected.id));
              setSelectedId(null);
              setMobileOpen(false);
            }}
          />
        ) : (
          <div className="text-ink-dim text-sm">Select or create a note.</div>
        )}
      </div>
    </div>
  );
}

function NoteEditor({
  note,
  mentions,
  pending,
  onSave,
  onPin,
  onDelete,
}: {
  note: Note;
  mentions?: { tagged: EntityCard[]; backlinks: EntityCard[] };
  pending: boolean;
  onSave: (fd: FormData) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [html, setHtml] = useState(note.content);
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={(fd) => {
        onSave(fd);
        setDirty(false);
      }}
      className="space-y-4 reveal"
    >
      <div className="flex items-center gap-3">
        <input
          name="title"
          defaultValue={note.title}
          className="flex-1 bg-transparent border-none text-3xl display focus:outline-none"
          placeholder="Untitled note"
          onChange={() => setDirty(true)}
        />
        <button type="button" onClick={onPin} className={`label transition-colors ${note.pinned ? "text-accent" : "hover:text-ink"}`}>
          {note.pinned ? "pinned" : "pin"}
        </button>
        <button type="button" onClick={onDelete} className="label hover:text-bad transition-colors">
          delete
        </button>
      </div>

      <RichEditor
        initialHTML={note.content}
        onChange={(h) => {
          setHtml(h);
          setDirty(true);
        }}
      />
      <input type="hidden" name="content" value={html} />

      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary text-xs">
          {pending ? "Saving…" : "Save"}
        </button>
        {!dirty && !pending && <span className="label text-good">saved ✓</span>}
      </div>

      <div className="border-t border-line-soft pt-4">
        <MentionBar
          sourceType="note"
          sourceId={note.id}
          tagged={mentions?.tagged ?? []}
          backlinks={mentions?.backlinks ?? []}
        />
      </div>
    </form>
  );
}
