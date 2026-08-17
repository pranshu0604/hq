"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createTodo, deleteTodo, toggleTodo, updateTodo, updateTodoStatus } from "@/app/todos/actions";
import { Tag } from "@/components/tag";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  priority: string;
  kind: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

const PRIORITY_OPTS = [
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function TodosList({ todos }: { todos: Todo[] }) {
  const [showDone, setShowDone] = useState(false);
  const [kind, setKind] = useState<"QUICK" | "ONGOING">("QUICK");
  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const { quick, ongoing } = useMemo(() => {
    const vis = showDone ? todos : todos.filter((t) => !t.done);
    return {
      quick: vis.filter((t) => t.kind !== "ONGOING"),
      ongoing: vis.filter((t) => t.kind === "ONGOING"),
    };
  }, [todos, showDone]);

  const commitStatus = (id: string, value: string) => {
    setEditStatusId(null);
    startTransition(() => updateTodoStatus(id, value));
  };

  return (
    <div>
      <form
        ref={formRef}
        action={(fd) => {
          startTransition(() => createTodo(fd));
          formRef.current?.reset();
        }}
        className="card p-3 mb-6"
      >
        <input type="hidden" name="kind" value={kind} />
        <div className="flex items-center gap-0.5 rounded-lg border border-line-soft p-0.5 mb-2 w-max">
          {(["QUICK", "ONGOING"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1 rounded-md text-[12px] transition-colors ${kind === k ? "bg-selected text-accent font-medium" : "text-ink-dim hover:text-ink"}`}
            >
              {k === "QUICK" ? "Quick" : "Ongoing"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            name="title"
            required
            placeholder={kind === "ONGOING" ? "A long-running effort — e.g. Learn Spanish" : "What needs doing?"}
            className="field-input flex-1 min-w-[160px]"
          />
          <Select name="priority" className="w-28" options={PRIORITY_OPTS} defaultValue="MEDIUM" ariaLabel="Priority" />
          <input name="dueDate" type="date" className="field-input w-auto" />
          <button className="btn btn-primary">Add</button>
        </div>
        {kind === "ONGOING" && (
          <input name="status" placeholder="Running status — e.g. On chapter 3, practicing daily" className="field-input w-full mt-2 text-[13px]" />
        )}
      </form>

      <button onClick={() => setShowDone((v) => !v)} className="label mb-4 hover:text-ink transition-colors">
        {showDone ? "hide completed" : "show completed"}
      </button>

      {/* ongoing */}
      {ongoing.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="section-title">Ongoing</span>
            <span className="label">{ongoing.length}</span>
          </div>
          <div className="space-y-2.5">
            {ongoing.map((t) =>
              editId === t.id ? (
                <div key={t.id} className="card p-4">
                  <TodoEditor todo={t} onDone={() => setEditId(null)} />
                </div>
              ) : (
              <div key={t.id} className="card p-4 group">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Checkbox checked={t.done} onChange={(c) => startTransition(() => toggleTodo(t.id, c))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${t.done ? "line-through text-ink-faint" : "text-ink"}`}>{t.title}</span>
                      {!t.done && (
                        <span className="inline-flex items-center gap-1 label text-[9px] text-accent">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> running
                        </span>
                      )}
                    </div>
                    {editStatusId === t.id ? (
                      <input
                        autoFocus
                        defaultValue={t.status}
                        onBlur={(e) => commitStatus(t.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitStatus(t.id, (e.target as HTMLInputElement).value);
                          else if (e.key === "Escape") setEditStatusId(null);
                        }}
                        placeholder="Where are you with this?"
                        className="field-input w-full mt-1.5 text-[13px] py-1"
                      />
                    ) : (
                      <button
                        onClick={() => setEditStatusId(t.id)}
                        className="text-left mt-1 text-[13px] text-ink-dim hover:text-ink transition-colors"
                      >
                        {t.status ? t.status : <span className="text-ink-faint italic">+ add a running status</span>}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Tag value={t.priority} />
                    {t.dueDate && <span className="label">{formatDate(t.dueDate)}</span>}
                    <button
                      onClick={() => setEditId(t.id)}
                      aria-label="Edit"
                      className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => startTransition(() => deleteTodo(t.id))}
                      disabled={pending}
                      aria-label="Delete"
                      className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
              )
            )}
          </div>
        </div>
      )}

      {/* quick */}
      <div>
        {ongoing.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <span className="section-title">Quick</span>
            <span className="label">{quick.length}</span>
          </div>
        )}
        <div className="border-t border-line">
          {quick.length === 0 && ongoing.length === 0 && <div className="text-ink-dim text-sm py-8">Nothing here. Add a todo above.</div>}
          {quick.map((t, i) =>
            editId === t.id ? (
              <div key={t.id} className="py-3 border-b border-line-soft">
                <TodoEditor todo={t} onDone={() => setEditId(null)} />
              </div>
            ) : (
            <div
              key={t.id}
              style={{ animationDelay: `${Math.min(i * 35, 300)}ms` }}
              className="reveal-row flex items-center gap-3 py-3.5 border-b border-line-soft text-sm group"
            >
              <Checkbox checked={t.done} onChange={(c) => startTransition(() => toggleTodo(t.id, c))} />
              <span className={`flex-1 transition-all duration-200 ${t.done ? "line-through text-ink-faint" : ""}`}>{t.title}</span>
              <Tag value={t.priority} />
              {t.dueDate && <span className="label">{formatDate(t.dueDate)}</span>}
              <button
                onClick={() => setEditId(t.id)}
                aria-label="Edit"
                className="label text-ink-faint hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
              >
                edit
              </button>
              <button
                onClick={() => startTransition(() => deleteTodo(t.id))}
                disabled={pending}
                className="text-ink-faint hover:text-bad transition-colors opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function TodoEditor({ todo, onDone }: { todo: Todo; onDone: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [priority, setPriority] = useState(todo.priority);
  const [due, setDue] = useState(todo.dueDate ? todo.dueDate.slice(0, 10) : "");
  const [kind, setKind] = useState(todo.kind === "ONGOING" ? "ONGOING" : "QUICK");
  const [pending, start] = useTransition();

  const save = () => {
    if (!title.trim()) return;
    start(() => updateTodo(todo.id, { title, priority, kind, dueDate: due || null }));
    onDone();
  };

  return (
    <div>
      <div className="flex items-center gap-0.5 rounded-lg border border-line-soft p-0.5 mb-2 w-max">
        {(["QUICK", "ONGOING"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1 rounded-md text-[12px] transition-colors ${kind === k ? "bg-selected text-accent font-medium" : "text-ink-dim hover:text-ink"}`}
          >
            {k === "QUICK" ? "Quick" : "Ongoing"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="field-input flex-1 min-w-[160px]"
          placeholder="What needs doing?"
        />
        <Select className="w-28" options={PRIORITY_OPTS} value={priority} onChange={setPriority} ariaLabel="Priority" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="field-input w-auto" />
        <button onClick={save} disabled={pending || !title.trim()} className="btn btn-primary text-[13px]">
          {pending ? "…" : "Save"}
        </button>
        <button onClick={onDone} className="btn text-[13px]">
          Cancel
        </button>
      </div>
    </div>
  );
}
