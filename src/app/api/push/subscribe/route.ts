import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth },
    update: { p256dh, auth },
  });
  return NextResponse.json({ ok: true });
}

// allow unsubscribing (browser sends endpoint)
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
