import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { addSocialCheck, listSocialChecks, deleteSocialCheck } from "@/lib/social-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ checks: await listSocialChecks() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? "add");
  if (action === "add") {
    const c = await addSocialCheck({
      event: String(body.event ?? ""),
      interpretation: body.interpretation ? String(body.interpretation) : "",
      evidenceFor: body.evidenceFor ? String(body.evidenceFor) : "",
      evidenceAgainst: body.evidenceAgainst ? String(body.evidenceAgainst) : "",
      verdict: body.verdict ? String(body.verdict) : "",
    });
    revalidatePath("/reframe");
    return NextResponse.json({ check: c });
  }
  if (action === "delete") {
    await deleteSocialCheck(String(body.id ?? ""));
    revalidatePath("/reframe");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
