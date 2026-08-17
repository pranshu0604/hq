import { NextResponse } from "next/server";
import crypto from "crypto";
import { putObject } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

// stores pasted / dropped images under <project>/uploads and returns a URL served
// by the /media route (works in dev AND production `next start`, unlike public/).
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
  const name = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await putObject(name, buf, file.type);

  return NextResponse.json({ url: `/media/${name}` });
}
