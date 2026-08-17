import { prisma } from "@/lib/prisma";
import NotesApp from "@/components/notes/notes-app";
import { outgoingFor, backlinksFor, type EntityCard } from "@/lib/entities";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await prisma.note.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  const ids = notes.map((n) => n.id);
  const [tagged, backlinks] = await Promise.all([outgoingFor("note", ids), backlinksFor("note", ids)]);
  const mentions: Record<string, { tagged: EntityCard[]; backlinks: EntityCard[] }> = {};
  for (const id of ids) mentions[id] = { tagged: tagged.get(id) ?? [], backlinks: backlinks.get(id) ?? [] };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-10">
        <div className="eyebrow mb-2.5">06 · Notes</div>
        <h1 className="display text-4xl">Notes</h1>
      </div>
      <NotesApp
        notes={notes.map((n) => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        }))}
        mentions={mentions}
      />
    </div>
  );
}
