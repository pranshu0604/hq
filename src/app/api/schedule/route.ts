// Scheduled transitions contract. GET lists today's schedule; POST adds / sets
// status / polls due nudges (the desktop calls poll every ~30s).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addReminder, listReminders, setReminderStatus, deleteReminder, pollDue, snoozeReminder } from "@/lib/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ reminders: await listReminders() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? "");

  if (action === "poll") {
    return NextResponse.json({ due: await pollDue() });
  }
  if (action === "add") {
    const r = await addReminder({
      label: String(body.label ?? ""),
      at: String(body.at ?? ""),
      leadMin: body.leadMin != null ? Number(body.leadMin) : undefined,
      todoId: body.todoId ? String(body.todoId) : null,
    });
    revalidatePath("/");
    return NextResponse.json({ reminder: r });
  }
  if (action === "status") {
    const r = await setReminderStatus(String(body.id ?? ""), String(body.status) as "PENDING" | "STARTED" | "DONE" | "SKIPPED");
    revalidatePath("/");
    return NextResponse.json({ reminder: r });
  }
  if (action === "snooze") {
    const r = await snoozeReminder(String(body.id ?? ""), body.minutes != null ? Number(body.minutes) : 10);
    revalidatePath("/");
    return NextResponse.json({ reminder: r });
  }
  if (action === "delete") {
    await deleteReminder(String(body.id ?? ""));
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
