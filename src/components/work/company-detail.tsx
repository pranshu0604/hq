"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addWorkItem,
  deleteCompany,
  deleteWorkItem,
  moveWorkItem,
  setWorkItemScope,
  toggleActive,
  updateCompany,
  updateWorkItemTitle,
} from "@/app/work/actions";
import MentionBar from "@/components/entity/mention-bar";
import RichEditor from "@/components/notes/rich-editor";
import { Select } from "@/components/ui/select";
import type { EntityCard } from "@/lib/entities";
import { stripHtml } from "@/lib/format";
import { COMPANY_KINDS, SCOPE_PRESETS, WORK_BUCKETS, parseScopes, scopeColor, type BucketKey } from "@/lib/work";

type Company = { id: string; name: string; role: string; kind: string; active: boolean; notes: string };
type Item = { id: string; title: string; bucket: string; scope: string };

const DATALIST_ID = "work-scopes";

export default function CompanyDetail({
  company: c,
  items,
  tagged,
  backlinks,
}: {
  company: Company;
  items: Item[];
  tagged: EntityCard[];
  backlinks: EntityCard[];
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notesHtml, setNotesHtml] = useState(c.notes);
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [editScopeId, setEditScopeId] = useState<string | null>(null);
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const usedScopes = useMemo(() => [...new Set(items.flatMap((i) => parseScopes(i.scope)))].sort(), [items]);
  const scopeOptions = useMemo(() => [...new Set([...usedScopes, ...SCOPE_PRESETS])], [usedScopes]);

  const save = (fd: FormData) => start(() => { updateCompany(c.id, fd); setEditing(false); });
  const remove = () => start(async () => { await deleteCompany(c.id); router.push("/work"); });

  const add = (bucket: BucketKey) => {
    const t = (drafts[bucket] ?? "").trim();
    if (!t) return;
    setDrafts((d) => ({ ...d, [bucket]: "" }));
    start(() => addWorkItem(c.id, t, bucket));
  };

  const commitScope = (id: string, value: string) => { setEditScopeId(null); start(() => setWorkItemScope(id, value, c.id)); };
  const commitTitle = (id: string, value: string) => {
    setEditTitleId(null);
    if (value.trim()) start(() => updateWorkItemTitle(id, value, c.id));
  };

  const visible = (list: Item[]) => (scopeFilter ? list.filter((it) => parseScopes(it.scope).includes(scopeFilter)) : list);

  return (
    <div className="mt-6 space-y-6 reveal">
      <datalist id={DATALIST_ID}>
        {scopeOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {editing ? (
        <form action={save} className="card p-5 space-y-2.5">
          <input name="name" defaultValue={c.name} required className="field-input w-full text-lg font-medium" placeholder="Company" />
          <div className="flex flex-wrap gap-2">
            <input name="role" defaultValue={c.role} placeholder="Your role" className="field-input flex-1 min-w-[140px]" />
            <Select name="kind" className="w-36" options={COMPANY_KINDS} defaultValue={c.kind || "freelance"} ariaLabel="Kind" />
          </div>
          <div>
            <div className="label mb-1.5">Notes</div>
            <RichEditor initialHTML={c.notes} onChange={setNotesHtml} placeholder="Scope, rate, contacts… paste images or links too." />
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
            <div className="flex items-center gap-3">
              <h1 className="display text-4xl">{c.name}</h1>
              {!c.active && <span className="label">archived</span>}
            </div>
            <div className="text-sm text-ink-dim mt-1.5">
              {c.role || "—"}
              {c.kind && <span className="text-ink-faint"> · {c.kind}</span>}
            </div>
            {stripHtml(c.notes).trim() && <div className="rte-surface mt-3 text-sm text-ink-dim max-w-xl" dangerouslySetInnerHTML={{ __html: c.notes }} />}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button onClick={() => start(() => toggleActive(c.id, !c.active))} disabled={pending} className="btn btn-ghost">
              {c.active ? "Archive" : "Reactivate"}
            </button>
            <button onClick={() => setEditing(true)} className="btn btn-ghost">Edit</button>
          </div>
        </div>
      )}

      {/* scope filter */}
      {usedScopes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="label mr-1">Scope</span>
          <button
            onClick={() => setScopeFilter(null)}
            className={`text-[11px] rounded px-2 py-0.5 border transition-colors ${scopeFilter === null ? "border-line-strong text-ink bg-surface-2" : "border-line text-ink-dim hover:text-ink"}`}
          >
            All
          </button>
          {usedScopes.map((s) => {
            const on = scopeFilter === s;
            return (
              <button
                key={s}
                onClick={() => setScopeFilter(on ? null : s)}
                className="text-[11px] font-mono uppercase tracking-wide rounded px-2 py-0.5 border transition-all"
                style={{
                  color: scopeColor(s),
                  borderColor: on ? scopeColor(s) : "var(--line)",
                  background: on ? `color-mix(in srgb, ${scopeColor(s)} 14%, transparent)` : "transparent",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}

      {/* buckets */}
      <div className="grid gap-4 md:grid-cols-2 items-start">
        {WORK_BUCKETS.map((b) => {
          const list = visible(items.filter((it) => it.bucket === b.key));
          const total = items.filter((it) => it.bucket === b.key).length;
          return (
            <div key={b.key} className="card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                  <span className="section-title">{b.label}</span>
                </div>
                <span className="label">{scopeFilter ? `${list.length}/${total}` : total}</span>
              </div>

              <div className="space-y-1.5 mb-3 overflow-y-auto max-h-[460px] pr-1 -mr-1">
                {list.length === 0 && <p className="text-xs text-ink-faint italic px-1 py-1">{scopeFilter ? "None in this scope." : "Nothing here."}</p>}
                {list.map((it) => (
                  <div key={it.id} className="group rounded-lg bg-surface-2 px-3 py-2.5">
                    {/* title — full width, click to edit */}
                    {editTitleId === it.id ? (
                      <textarea
                        autoFocus
                        defaultValue={it.title}
                        rows={2}
                        onBlur={(e) => commitTitle(it.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            commitTitle(it.id, (e.target as HTMLTextAreaElement).value);
                          } else if (e.key === "Escape") setEditTitleId(null);
                        }}
                        className="field-input w-full text-[13px] leading-snug resize-y py-1.5"
                      />
                    ) : (
                      <p
                        onClick={() => setEditTitleId(it.id)}
                        title="Click to edit"
                        className={`text-[13px] leading-snug whitespace-pre-wrap cursor-text ${b.key === "DONE" ? "text-ink-dim line-through" : "text-ink"}`}
                      >
                        {it.title}
                      </p>
                    )}

                    {/* meta row: scope (left) · actions (right) */}
                    <div className="flex items-center gap-1.5 mt-2 min-h-[20px] flex-wrap">
                      {editScopeId === it.id ? (
                        <input
                          autoFocus
                          defaultValue={it.scope}
                          list={DATALIST_ID}
                          onBlur={(e) => commitScope(it.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitScope(it.id, (e.target as HTMLInputElement).value);
                            else if (e.key === "Escape") setEditScopeId(null);
                          }}
                          placeholder="e.g. FE, BE"
                          className="field-input w-36 text-[11px] py-0.5"
                        />
                      ) : it.scope ? (
                        <button
                          type="button"
                          onClick={() => setEditScopeId(it.id)}
                          title="Change scope"
                          className="inline-flex items-center gap-1 flex-wrap"
                        >
                          {parseScopes(it.scope).map((sc) => (
                            <span
                              key={sc}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide border"
                              style={{ color: scopeColor(sc), borderColor: scopeColor(sc), background: `color-mix(in srgb, ${scopeColor(sc)} 12%, transparent)` }}
                            >
                              {sc}
                            </span>
                          ))}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditScopeId(it.id)}
                          className="text-[10px] text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                        >
                          + scope
                        </button>
                      )}

                      <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1" title="Move to…">
                          {WORK_BUCKETS.filter((o) => o.key !== b.key).map((o) => (
                            <button
                              key={o.key}
                              type="button"
                              onClick={() => start(() => moveWorkItem(it.id, o.key, c.id))}
                              disabled={pending}
                              title={`Move to ${o.label}`}
                              className="h-3 w-3 rounded-full ring-1 ring-inset ring-[color:var(--line-strong)] hover:scale-125 transition-transform"
                              style={{ background: o.color }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => start(() => deleteWorkItem(it.id, c.id))}
                          disabled={pending}
                          aria-label="Delete"
                          className="text-ink-faint hover:text-bad transition-colors text-sm leading-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <input
                value={drafts[b.key] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [b.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add(b.key);
                  }
                }}
                placeholder={`+  Add to ${b.label.toLowerCase()}`}
                className="field-input text-[13px] py-2 mt-auto"
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-line-soft pt-5">
        <MentionBar sourceType="company" sourceId={c.id} tagged={tagged} backlinks={backlinks} />
      </div>
    </div>
  );
}
