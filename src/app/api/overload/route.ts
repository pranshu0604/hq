// Overload contract — GET the one-thing + set-aside counts. Read by the desktop
// "I'm overwhelmed" overlay (⌥⌘O) and the web overload view.
import { NextResponse } from "next/server";
import { getOverload } from "@/lib/overload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getOverload());
}
