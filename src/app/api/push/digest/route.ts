import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/reminders";
import { sendPush } from "@/lib/push";

export const runtime = "nodejs";

// invoked by the scheduled LaunchAgent (curl) to fire the daily reminder digest.
export async function POST() {
  const payload = await buildDigest(Date.now());
  if (!payload) return NextResponse.json({ sent: 0, reason: "nothing due" });
  const res = await sendPush(payload);
  return NextResponse.json({ ...res, payload });
}
