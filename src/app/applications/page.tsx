import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ApplicationsTable from "@/components/applications/applications-table";
import ParkedPanel, { type ParkedRow } from "@/components/applications/parked-panel";
import { getNow } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    include: { platforms: { include: { emails: true } }, interviews: true },
    orderBy: { updatedAt: "desc" },
  });

  const nowMs = getNow();
  const parked: ParkedRow[] = applications
    .filter((a) => a.status === "PENDING")
    .map((a) => ({
      id: a.id,
      company: a.company,
      role: a.role,
      link: a.link,
      updatedAt: a.updatedAt.toISOString(),
      days: Math.floor((nowMs - a.updatedAt.getTime()) / 86400000),
    }))
    .sort((a, b) => b.days - a.days);

  const rows = applications.map((a) => ({
    id: a.id,
    company: a.company,
    role: a.role,
    category: a.category,
    status: a.status,
    workMode: a.workMode,
    city: a.city,
    offerAmount: a.offerAmount,
    offerMax: a.offerMax,
    offerNote: a.offerNote,
    offerCurrency: a.offerCurrency,
    createdAt: a.createdAt.toISOString(),
    platformsCount: a.platforms.length,
    emailsCount: a.platforms.reduce((n, p) => n + p.emails.length, 0),
    anyResponse: a.platforms.some((p) => p.responseReceived),
    interviewsCount: a.interviews.length,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-14 reveal">
      <div className="flex items-end justify-between mb-10">
        <div>
          <div className="eyebrow mb-2.5">01 · Applications</div>
          <h1 className="display text-4xl">Job Applications</h1>
        </div>
        <Link href="/applications/new" className="btn btn-primary">
          + New Application
        </Link>
      </div>
      <ParkedPanel rows={parked} />
      <ApplicationsTable rows={rows} />
    </div>
  );
}
