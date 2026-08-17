import { NextResponse } from "next/server";
import { signSession, timingSafeEqual, SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.HQ_PASSWORD || "";

  // fixed delay on every attempt — blunts brute-forcing over the network
  await new Promise((r) => setTimeout(r, 400));

  if (!expected || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const token = await signSession(Date.now());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
  });
  return res;
}
