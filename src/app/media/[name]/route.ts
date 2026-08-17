import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
};

// serves uploaded images from <project>/uploads. name is validated to prevent traversal.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9]+-[a-z0-9]+\.[a-z0-9]+$/i.test(name)) {
    return new Response("bad name", { status: 400 });
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const obj = await getObject(name);
  if (!obj) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType ?? TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
