// Day contract — energy mode, maintenance mode, and shutdown. Used by the web
// dashboard (and later the desktop menu bar).
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getToday, setEnergy, setMaintenance, recordShutdown, getMorningBrief, type Energy } from "@/lib/day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [today, brief] = await Promise.all([getToday(), getMorningBrief()]);
  return NextResponse.json({ today, brief });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? "");

  let today = null;
  if (action === "energy") today = await setEnergy(String(body.energy ?? "") as Energy);
  else if (action === "maintenance") today = await setMaintenance(Boolean(body.on));
  else if (action === "shutdown")
    today = await recordShutdown({
      finished: body.finished ? String(body.finished) : "",
      remaining: body.remaining ? String(body.remaining) : "",
      firstAction: body.firstAction ? String(body.firstAction) : "",
    });
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });

  revalidatePath("/");
  return NextResponse.json({ today });
}
