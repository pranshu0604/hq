import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { tagsFor } from "@/lib/entities";
import ReflectionDetail from "@/components/reflections/reflection-detail";

export const dynamic = "force-dynamic";

export default async function ReflectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reflection = await prisma.reflection.findUnique({
    where: { id },
    include: { thoughts: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!reflection) notFound();

  const { tagged, backlinks } = await tagsFor("reflection", id);

  // titles for notes dropped in as incidents (for the "from note" link)
  const noteIds = [...new Set(reflection.thoughts.map((t) => t.noteId).filter((v): v is string => !!v))];
  const linkedNotes = noteIds.length
    ? await prisma.note.findMany({ where: { id: { in: noteIds } }, select: { id: true, title: true } })
    : [];
  const noteTitles: Record<string, string> = {};
  for (const n of linkedNotes) noteTitles[n.id] = n.title || "Untitled note";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-12 reveal">
      <Link href="/reflections" className="label hover:text-ink transition-colors">
        ← back to reflections
      </Link>
      <ReflectionDetail
        reflection={{
          id: reflection.id,
          title: reflection.title,
          thesisLabel: reflection.thesisLabel,
          antithesisLabel: reflection.antithesisLabel,
          thesisBody: reflection.thesisBody,
          antithesisBody: reflection.antithesisBody,
          synthesis: reflection.synthesis,
          lean: reflection.lean,
          updatedAt: reflection.updatedAt.toISOString(),
        }}
        thoughts={reflection.thoughts.map((t) => ({ id: t.id, side: t.side, body: t.body, noteId: t.noteId }))}
        noteTitles={noteTitles}
        tagged={tagged}
        backlinks={backlinks}
      />
    </div>
  );
}
