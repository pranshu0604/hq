// Handbooks contract — upload / list / rename / replace / delete. The HTML itself
// is served (as text/html) by /handbooks/[id]/raw, not here.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listHandbooks, addHandbook, renameHandbook, replaceHandbookContent, deleteHandbook, HANDBOOK_MAX_BYTES } from "@/lib/handbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ handbooks: await listHandbooks() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const title = String(body.title ?? "");
  const content = String(body.content ?? "");
  if (!content.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (Buffer.byteLength(content, "utf8") > HANDBOOK_MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  const hb = await addHandbook({ title, content });
  if (!hb) return NextResponse.json({ error: "failed" }, { status: 400 });
  revalidatePath("/handbooks");
  return NextResponse.json({ handbook: hb });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });
  if (typeof body.title === "string") await renameHandbook(id, body.title);
  if (typeof body.content === "string" && body.content.trim()) await replaceHandbookContent(id, body.content);
  revalidatePath("/handbooks");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const id = String(body.id ?? "");
  if (id) await deleteHandbook(id);
  revalidatePath("/handbooks");
  return NextResponse.json({ ok: true });
}
