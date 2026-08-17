import { prisma } from "@/lib/prisma";
import WorkBoard, { type CompanyRow } from "@/components/work/work-board";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const companies = await prisma.company.findMany({
    include: { items: { select: { bucket: true } } },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  const rows: CompanyRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    kind: c.kind,
    active: c.active,
    counts: {
      DOING: c.items.filter((i) => i.bucket === "DOING").length,
      BUG: c.items.filter((i) => i.bucket === "BUG").length,
      PARKED: c.items.filter((i) => i.bucket === "PARKED").length,
      DONE: c.items.filter((i) => i.bucket === "DONE").length,
    },
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-8">
        <div className="eyebrow mb-2.5">02 · Work</div>
        <h1 className="display text-4xl">Work</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-2xl">
          Every engagement — internship, freelance, full-time — with what&apos;s in flight, what&apos;s broken, what&apos;s parked, and what&apos;s shipped.
        </p>
      </div>
      <WorkBoard rows={rows} />
    </div>
  );
}
