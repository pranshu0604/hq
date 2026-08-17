import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tagsFor } from "@/lib/entities";
import { getNow } from "@/lib/format";
import { dailyBuckets, weeklyBuckets, monthlyBuckets } from "@/lib/insights";
import PersonDetail from "@/components/people/person-detail";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: { interactions: { orderBy: { date: "desc" } } },
  });
  if (!person) notFound();

  const { tagged, backlinks } = await tagsFor("person", id);
  const nowMs = getNow();
  const dates = person.interactions.map((i) => i.date);
  const series = {
    daily: dailyBuckets(dates, nowMs, 30),
    weekly: weeklyBuckets(dates, nowMs, 12),
    monthly: monthlyBuckets(dates, nowMs, 12),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-12 reveal">
      <Link href="/people" className="label hover:text-ink transition-colors">
        ← back to people
      </Link>
      <PersonDetail
        person={{ id: person.id, name: person.name, relation: person.relation, handle: person.handle, notes: person.notes, reminderDays: person.reminderDays }}
        interactions={person.interactions.map((i) => ({ id: i.id, kind: i.kind, note: i.note, date: i.date.toISOString() }))}
        series={series}
        tagged={tagged}
        backlinks={backlinks}
      />
    </div>
  );
}
