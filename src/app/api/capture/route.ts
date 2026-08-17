// Capture inbox contract — spoken by the desktop global-capture hotkey and the
// web inbox. Local-only, no auth (same posture as the rest of HQ).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  addCapture,
  listCaptures,
  captureCounts,
  setCaptureStatus,
  setCaptureKind,
  updateCaptureText,
  promoteToTodo,
  deleteCapture,
  type CaptureKind,
  type CaptureStatus,
} from "@/lib/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["TASK", "IDEA", "WORRY", "RABBIT_HOLE", "COMMITMENT"];

export async function GET() {
  const [captures, counts] = await Promise.all([listCaptures(), captureCounts()]);
  return NextResponse.json({ captures, counts });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  const kind = KINDS.includes(String(body.kind)) ? (String(body.kind) as CaptureKind) : undefined;
  const capture = await addCapture(text, kind, body.who ? String(body.who) : "");
  revalidatePath("/inbox");
  revalidatePath("/");
  return NextResponse.json({ capture });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });

  let capture = null;
  if (action === "park") capture = await setCaptureStatus(id, "PARKED");
  else if (action === "drop") capture = await setCaptureStatus(id, "DROPPED");
  else if (action === "reopen") capture = await setCaptureStatus(id, "OPEN");
  else if (action === "todo") capture = await promoteToTodo(id);
  else if (action === "kind" && KINDS.includes(String(body.kind))) capture = await setCaptureKind(id, String(body.kind) as CaptureKind);
  else if (action === "text") capture = await updateCaptureText(id, String(body.text ?? ""));
  else if (action === "status") capture = await setCaptureStatus(id, String(body.status) as CaptureStatus);
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });

  revalidatePath("/inbox");
  revalidatePath("/");
  return NextResponse.json({ capture });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = String(body.id ?? "");
  if (id) await deleteCapture(id);
  revalidatePath("/inbox");
  return NextResponse.json({ ok: true });
}
