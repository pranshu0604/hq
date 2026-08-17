import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addObservation, listObservations, deleteObservation } from "@/lib/observations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ observations: await listObservations() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? "add");
  if (action === "add") {
    const o = await addObservation(String(body.text ?? ""));
    revalidatePath("/manual");
    return NextResponse.json({ observation: o });
  }
  if (action === "delete") {
    await deleteObservation(String(body.id ?? ""));
    revalidatePath("/manual");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
