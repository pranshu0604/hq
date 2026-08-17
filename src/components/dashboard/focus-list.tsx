"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleTodo } from "@/app/todos/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { IconPlus } from "@/components/icons";
import { dayLabel } from "@/lib/format";

type Todo = { id: string; title: string; done: boolean; priority: string; dueDate: string | null; overdue: boolean };

export default function FocusList({ todos }: { todos: Todo[] }) {
  const [pending, startTransition] = useTransition();
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  function onToggle(id: string, done: boolean) {
    setJustDone((s) => {
      const n = new Set(s);
      if (done) n.add(id);
      else n.delete(id);
      return n;
    });
    startTransition(() => toggleTodo(id, done));
  }

  if (todos.length === 0) {
    return (
      <div className="text-sm text-ink-dim">
        <p className="text-ink">You&apos;re clear for today.</p>
        <p className="mt-1 text-ink-faint">Nothing due. Add something to focus on.</p>
        <Link href="/todos" className="btn btn-ghost mt-3 -ml-2 text-[13px] text-accent">
          <IconPlus /> Add a todo
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-0.5">
      {todos.map((t) => {
        const checked = justDone.has(t.id) || (t.done && !pending);
        return (
          <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
            <Checkbox checked={checked} onChange={(c) => onToggle(t.id, c)} />
            <span className={`flex-1 transition-all duration-200 ${checked ? "line-through text-ink-faint" : "text-ink"}`}>
              {t.title}
            </span>
            {t.dueDate && (
              <span className={`label ${t.overdue ? "text-bad" : ""}`}>{dayLabel(t.dueDate)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
