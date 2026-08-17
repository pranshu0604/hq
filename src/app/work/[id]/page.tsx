import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tagsFor } from "@/lib/entities";
import CompanyDetail from "@/components/work/company-detail";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: { items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!company) notFound();

  const { tagged, backlinks } = await tagsFor("company", id);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-12 reveal">
      <Link href="/work" className="label hover:text-ink transition-colors">
        ← back to work
      </Link>
      <CompanyDetail
        company={{ id: company.id, name: company.name, role: company.role, kind: company.kind, active: company.active, notes: company.notes }}
        items={company.items.map((i) => ({ id: i.id, title: i.title, bucket: i.bucket, scope: i.scope }))}
        tagged={tagged}
        backlinks={backlinks}
      />
    </div>
  );
}
