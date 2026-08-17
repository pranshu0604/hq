import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/format";
import ReflectionsBoard, { type ReflectionRow } from "@/components/reflections/reflections-board";

export const dynamic = "force-dynamic";

export default async function ReflectionsPage() {
  const reflections = await prisma.reflection.findMany({
    orderBy: { updatedAt: "desc" },
    include: { thoughts: { select: { id: true, side: true } } },
  });

  const rows: ReflectionRow[] = reflections.map((r) => ({
    id: r.id,
    title: r.title,
    thesisLabel: r.thesisLabel,
    antithesisLabel: r.antithesisLabel,
    lean: r.lean,
    thesisCount: r.thoughts.filter((t) => t.side === "THESIS").length,
    antithesisCount: r.thoughts.filter((t) => t.side === "ANTITHESIS").length,
    hasSynthesis: stripHtml(r.synthesis).trim().length > 0,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">05 · Reflections</div>
        <h1 className="display text-4xl">Dialectics</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">
          Hold two opposing ideas in tension. Throw every observation onto the side it supports — then watch where your worldview actually settles.
        </p>
      </div>
      <ReflectionsBoard rows={rows} />
    </div>
  );
}
