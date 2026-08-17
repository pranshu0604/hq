// Scheduled morning brief → web push to every subscribed device (your phone).
// Triggered by Vercel Cron (which sends Authorization: Bearer $CRON_SECRET).
// Reuses buildDigest (the mission-brief) + sendPush.
import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/reminders";
import { sendPush } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const payload = await buildDigest(Date.now());
  if (!payload) return NextResponse.json({ sent: 0, reason: "nothing due" });
  const res = await sendPush(payload);
  return NextResponse.json(res);
}
