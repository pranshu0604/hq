import { prisma } from "@/lib/prisma";
import { outgoingFor, backlinksFor } from "@/lib/entities";
import QuotesBoard, { type QuoteRow } from "@/components/quotes/quotes-board";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({ orderBy: [{ favorite: "desc" }, { createdAt: "desc" }] });
  const ids = quotes.map((q) => q.id);
  const [tagged, backlinks] = await Promise.all([outgoingFor("quote", ids), backlinksFor("quote", ids)]);

  const rows: QuoteRow[] = quotes.map((q) => ({
    id: q.id,
    text: q.text,
    author: q.author,
    source: q.source,
    kind: q.kind,
    labels: q.labels ? q.labels.split(",").map((s) => s.trim()).filter(Boolean) : [],
    favorite: q.favorite,
    createdAt: q.createdAt.toISOString(),
    tagged: tagged.get(q.id) ?? [],
    backlinks: backlinks.get(q.id) ?? [],
  }));

  const allLabels = [...new Set(rows.flatMap((r) => r.labels))].sort();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">07 · Quotes</div>
        <h1 className="display text-4xl">Quotes &amp; Poetry</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">
          The lines worth keeping — no longer buried in your notes. Label them, and they&apos;ll surface when you need them.
        </p>
      </div>
      <QuotesBoard rows={rows} allLabels={allLabels} />
    </div>
  );
}
