// Shared NOW contract — the ONE endpoint both the web dashboard and the desktop
// beacon speak. GET returns the current session; POST drives start/pause/finish.
// Local-only app, so no auth here yet (same posture as the rest of HQ).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentNow, startFocus, pauseFocus, finishFocus } from "@/lib/focus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ now: await getCurrentNow() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = body?.action;

  let now = null;
  if (action === "start") {
    now = await startFocus({
      label: String(body.label ?? "Focus"),
      minutes: Number(body.minutes) || 25,
      kind: body.kind === "CULTURE" ? "CULTURE" : "FOCUS",
      goal: body.goal ? String(body.goal) : undefined,
      nextAction: body.nextAction ? String(body.nextAction) : undefined,
      todoId: body.todoId ? String(body.todoId) : null,
      projectId: body.projectId ? String(body.projectId) : null,
    });
  } else if (action === "pause") {
    now = await pauseFocus();
  } else if (action === "finish") {
    now = await finishFocus(body.status === "ABANDONED" ? "ABANDONED" : "DONE");
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  revalidatePath("/");
  return NextResponse.json({ now });
}
