import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ApplicationInfo from "@/components/applications/application-info";
import PlatformsSection from "@/components/applications/platforms-section";
import InterviewsSection from "@/components/applications/interviews-section";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      platforms: { include: { emails: true }, orderBy: { createdAt: "asc" } },
      interviews: { orderBy: { round: "asc" } },
    },
  });

  if (!application) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-14 reveal">
      <Link href="/applications" className="label hover:text-ink transition-colors">
        ← back to applications
      </Link>

      <div className="mt-4">
        <ApplicationInfo
          application={{
            id: application.id,
            company: application.company,
            role: application.role,
            description: application.description,
            status: application.status,
            category: application.category,
            workMode: application.workMode,
            city: application.city,
            link: application.link,
            submittedAt: application.submittedAt ? application.submittedAt.toISOString() : null,
            offerAmount: application.offerAmount,
            offerMax: application.offerMax,
            offerNote: application.offerNote,
            offerCurrency: application.offerCurrency,
            notes: application.notes,
            createdAt: application.createdAt.toISOString(),
            updatedAt: application.updatedAt.toISOString(),
          }}
        />
      </div>

      <div className="mt-12">
        <div className="section-title mb-4">Platforms &amp; outreach</div>
        <PlatformsSection applicationId={application.id} platforms={application.platforms} />
      </div>

      <div className="mt-12">
        <div className="section-title mb-4">Interviews</div>
        <InterviewsSection applicationId={application.id} interviews={application.interviews} />
      </div>
    </div>
  );
}
