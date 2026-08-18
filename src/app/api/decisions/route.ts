// Decision memory contract. A decision is a situation; revisions are its history.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addDecision, listDecisions, reviseDecision, deleteDecision, deleteRevision } from "@/lib/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ decisions: await listDecisions() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? "add");

  if (action === "add") {
    const d = await addDecision({ title: String(body.title ?? ""), choice: String(body.choice ?? ""), reason: body.reason ? String(body.reason) : "" });
    revalidatePath("/decisions");
    return NextResponse.json({ decision: d });
  }
  if (action === "revise") {
    const d = await reviseDecision(String(body.id ?? ""), {
      choice: String(body.choice ?? ""),
      reason: body.reason ? String(body.reason) : "",
      note: body.note ? String(body.note) : "",
    });
    revalidatePath("/decisions");
    return NextResponse.json({ decision: d });
  }
  if (action === "delRevision") {
    const d = await deleteRevision(String(body.revisionId ?? ""));
    revalidatePath("/decisions");
    return NextResponse.json({ decision: d });
  }
  if (action === "delete") {
    await deleteDecision(String(body.id ?? ""));
    revalidatePath("/decisions");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
