// Unified command-list contract. GET returns the four buckets (open · committed ·
// scheduled · done); POST routes every mutation by {source, action}. Captures,
// todos and reminders keep their own tables — this is a view/command layer only.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUnifiedList } from "@/lib/list";
import {
  addCapture,
  updateCaptureText,
  setCaptureKind,
  setCaptureStatus,
  deleteCapture,
  promoteToTodo,
  type CaptureKind,
} from "@/lib/capture";
import { addReminder, setReminderStatus, snoozeReminder, deleteReminder } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["TASK", "IDEA", "WORRY", "RABBIT_HOLE", "COMMITMENT"];

// midnight, n days from today — the next occurrence anchor for recurring todos
function startOfDayPlus(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}
// parse a repeat interval: null/none clears it; otherwise 1..365 days
function parseRecur(v: unknown): number | null {
  if (v == null || v === "" || v === "none") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : null;
}

function refresh() {
  revalidatePath("/inbox");
  revalidatePath("/todos");
  revalidatePath("/");
}

export async function GET() {
  return NextResponse.json(await getUnifiedList());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}) as Record<string, unknown>);
  const source = String(b.source ?? "");
  const action = String(b.action ?? "");
  const id = String(b.id ?? "");

  try {
    if (source === "capture") {
      if (action === "add") {
        const text = String(b.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
        const kind = KINDS.includes(String(b.kind)) ? (String(b.kind) as CaptureKind) : undefined;
        await addCapture(text, kind, b.who ? String(b.who) : "");
      } else if (action === "edit") await updateCaptureText(id, String(b.text ?? ""));
      else if (action === "kind" && KINDS.includes(String(b.kind))) await setCaptureKind(id, String(b.kind) as CaptureKind);
      else if (action === "park") await setCaptureStatus(id, "PARKED");
      else if (action === "unpark") await setCaptureStatus(id, "OPEN");
      else if (action === "delete") await deleteCapture(id);
      else if (action === "commit") await promoteToTodo(id);
      else if (action === "schedule") {
        const cap = await prisma.capture.findUnique({ where: { id } });
        if (cap) {
          await addReminder({ label: cap.text, at: String(b.at ?? ""), leadMin: b.leadMin != null ? Number(b.leadMin) : undefined });
          await setCaptureStatus(id, "ACTIONED"); // leaves Open, moves to Scheduled (not deleted)
        }
      } else return NextResponse.json({ error: "unknown action" }, { status: 400 });
    } else if (source === "todo") {
      if (action === "add") {
        const title = String(b.text ?? "").trim();
        if (!title) return NextResponse.json({ error: "empty" }, { status: 400 });
        const recur = parseRecur(b.recurEveryDays);
        await prisma.todo.create({
          data: {
            title: title.slice(0, 200),
            recurEveryDays: recur,
            // a recurring task starts due today; a one-off takes an optional due date
            dueDate: recur ? startOfDayPlus(0) : b.at ? new Date(String(b.at)) : null,
          },
        });
      } else if (action === "toggle") {
        const t = await prisma.todo.findUnique({ where: { id } });
        if (t?.recurEveryDays && b.done) {
          // completing a recurring task re-arms it for the next interval instead of finishing
          await prisma.todo.update({ where: { id }, data: { done: false, dueDate: startOfDayPlus(t.recurEveryDays) } }).catch(() => null);
        } else {
          await prisma.todo.update({ where: { id }, data: { done: !!b.done } }).catch(() => null);
        }
      } else if (action === "repeat") {
        const recur = parseRecur(b.recurEveryDays);
        const data: { recurEveryDays: number | null; done?: boolean; dueDate?: Date } = { recurEveryDays: recur };
        if (recur) {
          data.done = false;
          data.dueDate = startOfDayPlus(0); // becomes due today, then cycles
        }
        await prisma.todo.update({ where: { id }, data }).catch(() => null);
      } else if (action === "edit") {
        const title = String(b.text ?? "").trim();
        if (title) await prisma.todo.update({ where: { id }, data: { title: title.slice(0, 200) } }).catch(() => null);
      } else if (action === "due") await prisma.todo.update({ where: { id }, data: { dueDate: b.at ? new Date(String(b.at)) : null } }).catch(() => null);
      else if (action === "delete") await prisma.todo.delete({ where: { id } }).catch(() => null);
      else return NextResponse.json({ error: "unknown action" }, { status: 400 });
    } else if (source === "reminder") {
      if (action === "start") await setReminderStatus(id, "STARTED");
      else if (action === "done") await setReminderStatus(id, "DONE");
      else if (action === "snooze") await snoozeReminder(id, b.minutes != null ? Number(b.minutes) : 10);
      else if (action === "delete") await deleteReminder(id);
      else return NextResponse.json({ error: "unknown action" }, { status: 400 });
    } else {
      return NextResponse.json({ error: "unknown source" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  refresh();
  return NextResponse.json({ ok: true });
}
