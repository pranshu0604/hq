// The unified command list. Presents captures + todos + scheduled transitions as
// ONE filterable list (Open · Committed · Scheduled · Done) without merging the
// underlying tables — so the NOW engine, gamification and overload keep reading
// Todo/Capture unchanged, and nothing is ever migrated or deleted.
import { prisma } from "@/lib/prisma";
import { listCaptures } from "@/lib/capture";
import { listReminders } from "@/lib/schedule";

export type Bucket = "open" | "committed" | "scheduled" | "done";
export type ItemSource = "capture" | "todo" | "reminder";

export type ListItem = {
  id: string;
  source: ItemSource;
  text: string;
  bucket: Bucket;
  tag?: string; // capture kind, or todo priority
  when?: string | null; // ISO — reminder time or todo due date
  parked?: boolean;
  done?: boolean;
  recurEveryDays?: number | null; // todos: repeats every N days
  todoId?: string | null;
  createdAt: string;
};

export type UnifiedList = {
  open: ListItem[];
  committed: ListItem[];
  scheduled: ListItem[];
  done: ListItem[];
};

export async function getUnifiedList(nowMs = Date.now()): Promise<UnifiedList> {
  const [captures, todos, reminders] = await Promise.all([
    listCaptures(false), // OPEN + PARKED captures
    prisma.todo.findMany({ orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] }),
    listReminders(nowMs),
  ]);

  const open: ListItem[] = captures.map((c) => ({
    id: c.id,
    source: "capture",
    text: c.text,
    bucket: "open",
    tag: c.kind,
    parked: c.status === "PARKED",
    todoId: c.todoId,
    createdAt: c.createdAt,
  }));

  const committed: ListItem[] = todos
    .filter((t) => !t.done)
    .map((t) => ({
      id: t.id,
      source: "todo",
      text: t.title,
      bucket: "committed",
      tag: t.priority,
      when: t.dueDate ? t.dueDate.toISOString() : null,
      done: false,
      recurEveryDays: t.recurEveryDays,
      createdAt: t.createdAt.toISOString(),
    }));

  const done: ListItem[] = todos
    .filter((t) => t.done)
    .map((t) => ({
      id: t.id,
      source: "todo",
      text: t.title,
      bucket: "done",
      tag: t.priority,
      when: t.dueDate ? t.dueDate.toISOString() : null,
      done: true,
      createdAt: t.createdAt.toISOString(),
    }));

  // standalone scheduled transitions (capture-origin or direct) — todo-linked
  // reminders stay as background nudges so a task never double-shows.
  const scheduled: ListItem[] = reminders
    .filter((r) => r.status !== "DONE" && r.status !== "SKIPPED" && !r.todoId)
    .map((r) => ({
      id: r.id,
      source: "reminder",
      text: r.label,
      bucket: "scheduled",
      when: r.at,
      createdAt: r.at,
    }));

  return { open, committed, scheduled, done };
}
