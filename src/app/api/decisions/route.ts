// Decision memory contract.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addDecision, listDecisions, reopenDecision, deleteDecision } from "@/lib/decisions";

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
  if (action === "reopen") {
    const d = await reopenDecision(String(body.id ?? ""));
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
