// Career profile contract. GET returns the singleton (Claude and the extension's
// auto-apply loop read this to fill applications); PATCH saves edits from the
// /career editor. CORS-open like /api/ext/* so the LinkedIn-page content script
// can read it cross-origin — it's still token-gated for anything but a browser
// session cookie.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCareerProfile, updateCareerProfile } from "@/lib/career";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type, x-hq-token",
  "access-control-max-age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  return NextResponse.json({ profile: await getCareerProfile() }, { headers: CORS });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const profile = await updateCareerProfile(body);
  revalidatePath("/career");
  return NextResponse.json({ profile }, { headers: CORS });
}
