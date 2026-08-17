import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/format";

// every section that can be tagged/mentioned registers a type here.
// adding a new section = add a type + its search/resolve/href, and it becomes
// linkable from everywhere automatically.
export type EntityType = "application" | "project" | "note" | "todo" | "social" | "reflection" | "quote" | "workout" | "person" | "company" | "health";

export type EntityRef = { type: EntityType; id: string };
export type EntityCard = EntityRef & { title: string; subtitle?: string; href: string };

export const ENTITY_META: Record<EntityType, { label: string; color: string }> = {
  application: { label: "Application", color: "var(--info)" },
  project: { label: "Project", color: "var(--accent)" },
  note: { label: "Note", color: "var(--violet)" },
  todo: { label: "Todo", color: "var(--warn)" },
  social: { label: "Social", color: "var(--good)" },
  reflection: { label: "Reflection", color: "var(--accent-strong)" },
  quote: { label: "Quote", color: "var(--violet)" },
  workout: { label: "Workout", color: "var(--good)" },
  person: { label: "Person", color: "var(--info)" },
  company: { label: "Company", color: "var(--warn)" },
  health: { label: "Day", color: "var(--good)" },
};

export const ENTITY_TYPES = Object.keys(ENTITY_META) as EntityType[];

function key(type: string, id: string) {
  return `${type}:${id}`;
}

// inline @-mentions serialize as spans carrying data-id="type:entityId".
// pull those refs back out of saved rich-text HTML.
export function parseInlineMentions(html: string): EntityRef[] {
  const out: EntityRef[] = [];
  const seen = new Set<string>();
  const re = /data-id="([^":]+):([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const type = m[1] as EntityType;
    const id = m[2];
    if (!ENTITY_META[type]) continue;
    const k = key(type, id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type, id });
  }
  return out;
}

const trunc = (s: string, n = 60) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

// path to the item — its detail page where one exists, else the section list
export function pathFor(type: EntityType, id: string): string {
  switch (type) {
    case "application":
      return `/applications/${id}`;
    case "project":
      return `/projects/${id}`;
    case "reflection":
      return `/reflections/${id}`;
    case "note":
      return `/notes?note=${id}`;
    case "todo":
      return `/todos`;
    case "social":
      return `/social`;
    case "quote":
      return `/quotes`;
    case "workout":
      return `/gym`;
    case "person":
      return `/people/${id}`;
    case "company":
      return `/work/${id}`;
    case "health":
      return `/wellbeing`;
  }
}

// ---- resolve a batch of refs to display cards (one query per type) ----
export async function resolveRefs(refs: EntityRef[]): Promise<Map<string, EntityCard>> {
  const byType = new Map<EntityType, Set<string>>();
  for (const r of refs) {
    if (!ENTITY_META[r.type]) continue;
    if (!byType.has(r.type)) byType.set(r.type, new Set());
    byType.get(r.type)!.add(r.id);
  }

  const out = new Map<string, EntityCard>();

  await Promise.all(
    [...byType.entries()].map(async ([type, idSet]) => {
      const ids = [...idSet];
      const card = (id: string, title: string, subtitle?: string): EntityCard => ({
        type,
        id,
        title: title || "Untitled",
        subtitle,
        href: pathFor(type, id),
      });

      if (type === "application") {
        const rows = await prisma.application.findMany({ where: { id: { in: ids } }, select: { id: true, company: true, role: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.company, r.role));
      } else if (type === "project") {
        const rows = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, status: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.title, r.status.toLowerCase()));
      } else if (type === "note") {
        const rows = await prisma.note.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, content: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.title || "Untitled note", trunc(stripHtml(r.content))));
      } else if (type === "todo") {
        const rows = await prisma.todo.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, done: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.title, r.done ? "done" : "open"));
      } else if (type === "social") {
        const rows = await prisma.socialLog.findMany({ where: { id: { in: ids } }, select: { id: true, platform: true, note: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.note || r.platform, r.platform));
      } else if (type === "reflection") {
        const rows = await prisma.reflection.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, thesisLabel: true, antithesisLabel: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.title, `${r.thesisLabel} vs ${r.antithesisLabel}`));
      } else if (type === "quote") {
        const rows = await prisma.quote.findMany({ where: { id: { in: ids } }, select: { id: true, text: true, author: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, trunc(r.text, 48), r.author || undefined));
      } else if (type === "workout") {
        const rows = await prisma.workout.findMany({ where: { id: { in: ids } }, select: { id: true, groups: true, date: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.groups || "Workout", r.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })));
      } else if (type === "person") {
        const rows = await prisma.person.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, relation: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.name, r.relation || undefined));
      } else if (type === "company") {
        const rows = await prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } });
        for (const r of rows) out.set(key(type, r.id), card(r.id, r.name, r.role || undefined));
      } else if (type === "health") {
        const rows = await prisma.healthDay.findMany({ where: { id: { in: ids } }, select: { id: true, date: true, mood: true } });
        for (const r of rows)
          out.set(
            key(type, r.id),
            card(r.id, r.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), r.mood ? `felt ${r.mood}/100` : "wellbeing")
          );
      }
    })
  );

  return out;
}

// ---- search across every section for the tag picker ----
// pass `types` to restrict to certain sections (e.g. dropping a note into a reflection)
export async function searchEntities(query: string, limit = 8, exclude: EntityRef[] = [], types?: EntityType[]): Promise<EntityCard[]> {
  const q = query.trim();
  const excl = new Set(exclude.map((e) => key(e.type, e.id)));
  const want = (t: EntityType) => !types || types.includes(t);
  const each = Math.max(3, Math.ceil(limit / 2));
  const none = <T,>(): Promise<T[]> => Promise.resolve([] as T[]);

  const [apps, projects, notes, todos, reflections, quotes, people, companies, healthDays] = await Promise.all([
    want("application")
      ? prisma.application.findMany({ where: q ? { OR: [{ company: { contains: q } }, { role: { contains: q } }] } : {}, select: { id: true, company: true, role: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; company: string; role: string }>(),
    want("project")
      ? prisma.project.findMany({ where: q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; title: string; status: string }>(),
    want("note")
      ? prisma.note.findMany({ where: q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}, select: { id: true, title: true, content: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; title: string; content: string }>(),
    want("todo")
      ? prisma.todo.findMany({ where: q ? { title: { contains: q } } : {}, select: { id: true, title: true, done: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; title: string; done: boolean }>(),
    want("reflection")
      ? prisma.reflection.findMany({ where: q ? { OR: [{ title: { contains: q } }, { thesisLabel: { contains: q } }, { antithesisLabel: { contains: q } }] } : {}, select: { id: true, title: true, thesisLabel: true, antithesisLabel: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; title: string; thesisLabel: string; antithesisLabel: string }>(),
    want("quote")
      ? prisma.quote.findMany({ where: q ? { OR: [{ text: { contains: q } }, { author: { contains: q } }] } : {}, select: { id: true, text: true, author: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; text: string; author: string }>(),
    want("person")
      ? prisma.person.findMany({ where: q ? { OR: [{ name: { contains: q } }, { relation: { contains: q } }] } : {}, select: { id: true, name: true, relation: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; name: string; relation: string }>(),
    want("company")
      ? prisma.company.findMany({ where: q ? { OR: [{ name: { contains: q } }, { role: { contains: q } }] } : {}, select: { id: true, name: true, role: true }, orderBy: { updatedAt: "desc" }, take: each })
      : none<{ id: string; name: string; role: string }>(),
    want("health")
      ? prisma.healthDay.findMany({ where: q ? { notes: { contains: q } } : {}, select: { id: true, date: true, mood: true }, orderBy: { date: "desc" }, take: each })
      : none<{ id: string; date: Date; mood: number | null }>(),
  ]);

  const cards: EntityCard[] = [
    ...reflections.map((r): EntityCard => ({ type: "reflection", id: r.id, title: r.title, subtitle: `${r.thesisLabel} vs ${r.antithesisLabel}`, href: pathFor("reflection", r.id) })),
    ...apps.map((r): EntityCard => ({ type: "application", id: r.id, title: r.company, subtitle: r.role, href: pathFor("application", r.id) })),
    ...projects.map((r): EntityCard => ({ type: "project", id: r.id, title: r.title, subtitle: r.status.toLowerCase(), href: pathFor("project", r.id) })),
    ...notes.map((r): EntityCard => ({ type: "note", id: r.id, title: r.title || "Untitled note", subtitle: trunc(stripHtml(r.content)), href: pathFor("note", r.id) })),
    ...quotes.map((r): EntityCard => ({ type: "quote", id: r.id, title: trunc(r.text, 48), subtitle: r.author || undefined, href: pathFor("quote", r.id) })),
    ...people.map((r): EntityCard => ({ type: "person", id: r.id, title: r.name, subtitle: r.relation || undefined, href: pathFor("person", r.id) })),
    ...companies.map((r): EntityCard => ({ type: "company", id: r.id, title: r.name, subtitle: r.role || undefined, href: pathFor("company", r.id) })),
    ...todos.map((r): EntityCard => ({ type: "todo", id: r.id, title: r.title, subtitle: r.done ? "done" : "open", href: pathFor("todo", r.id) })),
    ...healthDays.map(
      (r): EntityCard => ({
        type: "health",
        id: r.id,
        title: r.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        subtitle: r.mood ? `felt ${r.mood}/100` : "wellbeing",
        href: pathFor("health", r.id),
      })
    ),
  ].filter((c) => !excl.has(key(c.type, c.id)));

  return cards.slice(0, limit);
}

// ---- graph queries ----

// outgoing: what these sources link TO
export async function outgoingFor(sourceType: EntityType, sourceIds: string[]): Promise<Map<string, EntityCard[]>> {
  const map = new Map<string, EntityCard[]>();
  if (sourceIds.length === 0) return map;
  const rows = await prisma.mention.findMany({
    where: { sourceType, sourceId: { in: sourceIds } },
    orderBy: { createdAt: "asc" },
  });
  const resolved = await resolveRefs(rows.map((r) => ({ type: r.targetType as EntityType, id: r.targetId })));
  for (const r of rows) {
    const card = resolved.get(key(r.targetType, r.targetId));
    if (!card) continue; // target was deleted
    if (!map.has(r.sourceId)) map.set(r.sourceId, []);
    map.get(r.sourceId)!.push(card);
  }
  return map;
}

// incoming: what links TO these targets (backlinks)
export async function backlinksFor(targetType: EntityType, targetIds: string[]): Promise<Map<string, EntityCard[]>> {
  const map = new Map<string, EntityCard[]>();
  if (targetIds.length === 0) return map;
  const rows = await prisma.mention.findMany({
    where: { targetType, targetId: { in: targetIds } },
    orderBy: { createdAt: "asc" },
  });
  const resolved = await resolveRefs(rows.map((r) => ({ type: r.sourceType as EntityType, id: r.sourceId })));
  for (const r of rows) {
    const card = resolved.get(key(r.sourceType, r.sourceId));
    if (!card) continue;
    if (!map.has(r.targetId)) map.set(r.targetId, []);
    map.get(r.targetId)!.push(card);
  }
  return map;
}

// convenience for a single item's detail page
export async function tagsFor(type: EntityType, id: string) {
  const [out, back] = await Promise.all([outgoingFor(type, [id]), backlinksFor(type, [id])]);
  return { tagged: out.get(id) ?? [], backlinks: back.get(id) ?? [] };
}
