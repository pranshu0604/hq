// Serves a handbook as real text/html so it renders exactly like opening the file
// in a browser. The HQ session cookie is httpOnly, so this same-origin document
// can't read it — and the content is your own uploaded HTML anyway.
import { getHandbook } from "@/lib/handbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Animate in-page anchor jumps (table-of-contents links) in the standalone view,
// matching the inline preview. Injected last in <head> so it wins over UA default;
// respects reduced-motion. Only applied if the doc doesn't set its own behavior.
const SMOOTH = `<style id="hq-smooth-scroll">@media (prefers-reduced-motion: no-preference){html{scroll-behavior:smooth}}</style>`;

function withSmoothScroll(html: string): string {
  if (/scroll-behavior\s*:/i.test(html)) return html; // respect the handbook's own choice
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${SMOOTH}</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/(<body[^>]*>)/i, `$1${SMOOTH}`);
  return SMOOTH + html;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const hb = await getHandbook(id);
  if (!hb) return new Response("Handbook not found", { status: 404 });
  return new Response(withSmoothScroll(hb.content), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": "inline",
      "cache-control": "no-store",
    },
  });
}
