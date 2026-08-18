// Serves a handbook as real text/html so it renders exactly like opening the file
// in a browser. The HQ session cookie is httpOnly, so this same-origin document
// can't read it — and the content is your own uploaded HTML anyway.
import { getHandbook } from "@/lib/handbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hb = await getHandbook(id);
  if (!hb) return new Response("Handbook not found", { status: 404 });
  return new Response(hb.content, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": "inline",
      "cache-control": "no-store",
    },
  });
}
