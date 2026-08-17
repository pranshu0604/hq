// Overload — "I'm overwhelmed". Collapse the whole universe to ONE next thing +
// a quiet count of what's being deliberately set aside. Reuses todos, the
// commitment captures, and the current focus session — no new state.
import { prisma } from "@/lib/prisma";
import { getCurrentNow } from "@/lib/focus";

export type OneThing = { label: string; kind: "FOCUS" | "COMMITMENT" | "TODO" | "NONE"; todoId: string | null };
export type Overload = {
  one: OneThing;
  counts: { todos: number; commitments: number; worries: number; parked: number; projects: number };
};

const RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export async function getOverload(nowMs = Date.now()): Promise<Overload> {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);

  const [now, openTodos, commitmentRows, worries, parked, projects] = await Promise.all([
    getCurrentNow(nowMs),
    prisma.todo.findMany({ where: { done: false } }),
    prisma.capture.findMany({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "COMMITMENT" }, orderBy: { createdAt: "asc" } }),
    prisma.capture.count({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "WORRY" } }),
    prisma.capture.count({ where: { status: "PARKED" } }),
    prisma.project.count({ where: { status: { notIn: ["SHIPPED", "ABANDONED"] } } }),
  ]);

  let one: OneThing = { label: "", kind: "NONE", todoId: null };
  if (now && now.status === "ACTIVE") {
    // already on something — that IS the one thing
    one = { label: now.label, kind: "FOCUS", todoId: now.todoId };
  } else if (commitmentRows.length > 0) {
    // something a human is relying on you for wins
    one = { label: commitmentRows[0].text, kind: "COMMITMENT", todoId: null };
  } else if (openTodos.length > 0) {
    // most overdue, else highest priority
    const sorted = [...openTodos].sort((a, b) => {
      const ao = a.dueDate && new Date(a.dueDate) < start ? 0 : 1;
      const bo = b.dueDate && new Date(b.dueDate) < start ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return RANK[a.priority] - RANK[b.priority];
    });
    one = { label: sorted[0].title, kind: "TODO", todoId: sorted[0].id };
  }

  return {
    one,
    counts: { todos: openTodos.length, commitments: commitmentRows.length, worries, parked, projects },
  };
}
