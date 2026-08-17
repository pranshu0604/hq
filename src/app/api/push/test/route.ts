import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const res = await sendPush({
    title: "HQ notifications are on 🎯",
    body: "You'll get a daily brief of who to reach out to, gym nudges, and interviews coming up.",
    url: "/",
    tag: "hq-test",
  });
  return NextResponse.json(res);
}
