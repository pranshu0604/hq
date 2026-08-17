// Shared HQ MCP tool definitions — registered onto both the stdio and HTTP servers.
import { z } from "zod";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function toHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}
const ok = (text) => ({ content: [{ type: "text", text }] });
const err = (text) => ({ content: [{ type: "text", text }], isError: true });
const json = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }] });
const one = (v, allowed, def) => (allowed.includes(String(v ?? "").toUpperCase()) ? String(v).toUpperCase() : def);
const strip = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
// "18L" / "1.2Cr" / "120k" / 1800000 → a number
const money = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).replace(/[,\s₹$€£]/g, "");
  const m = raw.match(/^([0-9.]+)\s*(cr|crore|l|lac|lakh|k|m)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  const u = (m[2] ?? "").toLowerCase();
  return n * (u.startsWith("cr") ? 1e7 : u.startsWith("l") ? 1e5 : u === "k" ? 1e3 : u === "m" ? 1e6 : 1);
};
const compOf = (a) => {
  let lo = money(a.offerMin);
  let hi = money(a.offerMax);
  if (lo != null && hi != null && hi < lo) [lo, hi] = [hi, lo];
  const d = {};
  if (lo !== null) d.offerAmount = lo;
  if (hi !== null) d.offerMax = hi;
  if (a.offerNote !== undefined) d.offerNote = a.offerNote;
  if (a.currency !== undefined) d.offerCurrency = String(a.currency).toUpperCase();
  return d;
};
const APP = "http://localhost:3411";

export function registerTools(server, prisma) {
  const t = (name, cfg, cb) => server.registerTool(name, cfg, cb);

  // ---------- Notes ----------
  t("add_note", { title: "Add note", description: "Create a note in HQ.", inputSchema: { title: z.string().optional(), content: z.string() } }, async ({ title, content }) => {
    const n = await prisma.note.create({ data: { title: (title || "Untitled note").trim(), content: toHtml(content) } });
    return ok(`Added note "${n.title}" (id ${n.id}).`);
  });
  t("list_notes", { title: "List notes", description: "List/search notes.", inputSchema: { query: z.string().optional(), limit: z.number().optional() } }, async ({ query, limit }) => {
    const notes = await prisma.note.findMany({ where: query ? { OR: [{ title: { contains: query } }, { content: { contains: query } }] } : {}, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: Math.min(limit ?? 20, 50) });
    return notes.length ? ok(notes.map((n) => `• [${n.id}] ${n.title || "Untitled"}`).join("\n")) : ok("No notes found.");
  });
  t("update_note", { title: "Update note", description: "Update a note by id.", inputSchema: { id: z.string(), title: z.string().optional(), content: z.string().optional() } }, async ({ id, title, content }) => {
    const data = {};
    if (title !== undefined) data.title = title.trim() || "Untitled note";
    if (content !== undefined) data.content = toHtml(content);
    const n = await prisma.note.update({ where: { id }, data }).catch(() => null);
    return n ? ok(`Updated note "${n.title}".`) : err(`No note with id ${id}.`);
  });
  t("delete_note", { title: "Delete note", description: "Delete a note by id.", inputSchema: { id: z.string() } }, async ({ id }) => {
    const r = await prisma.note.deleteMany({ where: { id } });
    return r.count ? ok(`Deleted note ${id}.`) : err(`No note with id ${id}.`);
  });

  // ---------- Applications ----------
  t("add_application", { title: "Add job application", description: "Log a job application. Use status PENDING for a form started but parked half-done (it will NOT count as a submitted application until you mark it applied). Compensation can be a range: offerMin/offerMax accept shorthand like '18L', '1.2Cr' or '120k'. offerNote holds the fine print (e.g. 'base + ESOPs').", inputSchema: { company: z.string(), role: z.string(), description: z.string().optional(), category: z.string().optional(), status: z.string().optional(), workMode: z.string().optional(), city: z.string().optional(), link: z.string().optional(), offerMin: z.union([z.string(), z.number()]).optional(), offerMax: z.union([z.string(), z.number()]).optional(), offerNote: z.string().optional(), currency: z.string().optional(), notes: z.string().optional() } }, async (a) => {
    const app = await prisma.application.create({ data: { company: a.company.trim(), role: a.role.trim(), description: a.description ?? "", category: one(a.category, ["DREAM", "STRONG", "BACKUP", "IGNORE_IF_BETTER"], "BACKUP"), status: one(a.status, ["PENDING", "APPLIED", "RESPONSE", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"], "APPLIED"), workMode: a.workMode ? one(a.workMode, ["REMOTE", "ONSITE", "HYBRID"], null) : null, city: a.city ?? null, link: a.link ?? null, submittedAt: one(a.status, ["PENDING", "APPLIED", "RESPONSE", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"], "APPLIED") === "PENDING" ? null : new Date(), ...compOf(a), notes: toHtml(a.notes ?? "") } });
    return ok(`${app.status === "PENDING" ? "Parked" : "Logged"} application: ${app.company} — ${app.role} (id ${app.id}).`);
  });
  t("list_applications", { title: "List applications", description: "List/search applications.", inputSchema: { status: z.string().optional(), query: z.string().optional() } }, async ({ status, query }) => {
    const where = {};
    if (status) where.status = one(status, ["PENDING", "APPLIED", "RESPONSE", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"], undefined);
    if (query) where.OR = [{ company: { contains: query } }, { role: { contains: query } }];
    const apps = await prisma.application.findMany({ where, orderBy: { updatedAt: "desc" }, take: 40 });
    return apps.length ? ok(apps.map((a) => `• [${a.id}] ${a.company} — ${a.role} · ${a.status}${a.status === "PENDING" ? " (parked, not sent)" : ""}${a.link ? ` · ${a.link}` : ""}`).join("\n")) : ok("No applications found.");
  });
  t("update_application", { title: "Update application", description: "Update an application by id. Set status APPLIED on a PENDING one to mark a parked form as finally sent (it then counts as applied today). Also updates the compensation range (offerMin/offerMax accept '18L', '1.2Cr', '120k') and offerNote.", inputSchema: { id: z.string(), status: z.string().optional(), category: z.string().optional(), offerMin: z.union([z.string(), z.number()]).optional(), offerMax: z.union([z.string(), z.number()]).optional(), offerNote: z.string().optional(), currency: z.string().optional(), notes: z.string().optional() } }, async (a) => {
    const { id, status, category, notes } = a;
    const data = { ...compOf(a) };
    if (a.link !== undefined) data.link = a.link;
    if (status) {
      data.status = one(status, ["PENDING", "APPLIED", "RESPONSE", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"], "APPLIED");
      const cur = await prisma.application.findUnique({ where: { id }, select: { submittedAt: true } });
      data.submittedAt = data.status === "PENDING" ? null : cur?.submittedAt ?? new Date();
    }
    if (category) data.category = one(category, ["DREAM", "STRONG", "BACKUP", "IGNORE_IF_BETTER"], "BACKUP");
    if (notes !== undefined) data.notes = toHtml(notes);
    const app = await prisma.application.update({ where: { id }, data }).catch(() => null);
    return app ? ok(`Updated ${app.company} — now ${app.status}.`) : err(`No application with id ${id}.`);
  });

  // ---------- Todos ----------
  t("add_todo", { title: "Add todo", description: "Add a todo. kind QUICK or ONGOING.", inputSchema: { title: z.string(), priority: z.string().optional(), dueDate: z.string().optional(), kind: z.string().optional(), status: z.string().optional() } }, async ({ title, priority, dueDate, kind, status }) => {
    const k = one(kind, ["QUICK", "ONGOING"], "QUICK");
    const todo = await prisma.todo.create({ data: { title: title.trim(), priority: one(priority, ["HIGH", "MEDIUM", "LOW"], "MEDIUM"), kind: k, status: k === "ONGOING" ? (status ?? "") : "", dueDate: dueDate ? new Date(dueDate) : null } });
    return ok(`Added ${k.toLowerCase()} todo "${todo.title}" (id ${todo.id}).`);
  });
  t("list_todos", { title: "List todos", description: "List todos.", inputSchema: { includeDone: z.boolean().optional() } }, async ({ includeDone }) => {
    const todos = await prisma.todo.findMany({ where: includeDone ? {} : { done: false }, orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 50 });
    return todos.length ? ok(todos.map((x) => `• [${x.id}] ${x.done ? "✓ " : ""}${x.title}${x.kind === "ONGOING" && x.status ? ` — ${x.status}` : ""}`).join("\n")) : ok("No todos.");
  });
  t("complete_todo", { title: "Complete todo", description: "Mark a todo done or set its status.", inputSchema: { id: z.string(), done: z.boolean().optional(), status: z.string().optional() } }, async ({ id, done, status }) => {
    const data = {};
    if (done !== undefined) data.done = done;
    if (status !== undefined) data.status = status;
    if (done === undefined && status === undefined) data.done = true;
    const todo = await prisma.todo.update({ where: { id }, data }).catch(() => null);
    return todo ? ok(`Updated todo "${todo.title}".`) : err(`No todo with id ${id}.`);
  });
  t("update_todo", { title: "Edit todo", description: "Edit a todo's title, priority (HIGH/MEDIUM/LOW), kind (QUICK/ONGOING) or due date by id.", inputSchema: { id: z.string(), title: z.string().optional(), priority: z.string().optional(), kind: z.string().optional(), dueDate: z.string().optional() } }, async ({ id, title, priority, kind, dueDate }) => {
    const data = {};
    if (title !== undefined && title.trim()) data.title = title.trim();
    if (priority) data.priority = one(priority, ["HIGH", "MEDIUM", "LOW"], "MEDIUM");
    if (kind) { data.kind = one(kind, ["QUICK", "ONGOING"], "QUICK"); if (data.kind === "QUICK") data.status = ""; }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    const todo = await prisma.todo.update({ where: { id }, data }).catch(() => null);
    return todo ? ok(`Edited todo "${todo.title}".`) : err(`No todo with id ${id}.`);
  });

  // ---------- Reflections ----------
  t("add_reflection", { title: "Add reflection", description: "Create a dialectic (thesis vs antithesis).", inputSchema: { title: z.string(), thesisLabel: z.string(), antithesisLabel: z.string(), thesisBody: z.string().optional(), antithesisBody: z.string().optional(), synthesis: z.string().optional(), lean: z.number().optional() } }, async (r) => {
    const refl = await prisma.reflection.create({ data: { title: r.title.trim(), thesisLabel: r.thesisLabel.trim() || "Thesis", antithesisLabel: r.antithesisLabel.trim() || "Antithesis", thesisBody: r.thesisBody ?? "", antithesisBody: r.antithesisBody ?? "", synthesis: toHtml(r.synthesis ?? ""), lean: Math.min(100, Math.max(0, Math.round(r.lean ?? 50))) } });
    return ok(`Created reflection "${refl.title}" (id ${refl.id}).`);
  });
  t("add_reflection_thought", { title: "Add supporting incident", description: "Add a supporting incident to a reflection side.", inputSchema: { reflectionId: z.string(), side: z.string(), body: z.string() } }, async ({ reflectionId, side, body }) => {
    const s = one(side, ["THESIS", "ANTITHESIS"], "THESIS");
    const max = await prisma.reflectionThought.aggregate({ where: { reflectionId, side: s }, _max: { order: true } });
    const thought = await prisma.reflectionThought.create({ data: { reflectionId, side: s, body: body.trim(), order: (max._max.order ?? -1) + 1 } }).catch(() => null);
    return thought ? ok(`Added incident to the ${s.toLowerCase()} side.`) : err(`No reflection with id ${reflectionId}.`);
  });
  t("list_reflections", { title: "List reflections", description: "List reflections.", inputSchema: { query: z.string().optional() } }, async ({ query }) => {
    const refls = await prisma.reflection.findMany({ where: query ? { title: { contains: query } } : {}, orderBy: { updatedAt: "desc" }, take: 40 });
    return refls.length ? ok(refls.map((r) => `• [${r.id}] ${r.title} (${r.antithesisLabel} vs ${r.thesisLabel}, lean ${r.lean}%)`).join("\n")) : ok("No reflections.");
  });

  // ---------- People ----------
  const findPerson = async (nameOrId) => (await prisma.person.findUnique({ where: { id: nameOrId } }).catch(() => null)) || (await prisma.person.findFirst({ where: { name: { contains: nameOrId } } }));
  t("add_person", { title: "Add person", description: "Add someone to relationships.", inputSchema: { name: z.string(), relation: z.string().optional(), handle: z.string().optional(), notes: z.string().optional(), reminderDays: z.number().optional() } }, async (p) => {
    const person = await prisma.person.create({ data: { name: p.name.trim(), relation: p.relation ?? "", handle: p.handle ?? "", notes: toHtml(p.notes ?? ""), reminderDays: p.reminderDays && p.reminderDays > 0 ? Math.round(p.reminderDays) : null } });
    return ok(`Added ${person.name} (id ${person.id}).`);
  });
  t("log_interaction", { title: "Log interaction", description: "Log connecting with someone (name or id).", inputSchema: { person: z.string(), kind: z.string().optional(), note: z.string().optional(), date: z.string().optional() } }, async ({ person, kind, note, date }) => {
    const p = await findPerson(person);
    if (!p) return err(`No person matching "${person}".`);
    await prisma.interaction.create({ data: { personId: p.id, kind: (kind ?? "").trim(), note: note ?? "", date: date ? new Date(date) : new Date() } });
    return ok(`Logged a touchpoint with ${p.name}.`);
  });
  t("list_people", { title: "List people", description: "List people.", inputSchema: { query: z.string().optional() } }, async ({ query }) => {
    const people = await prisma.person.findMany({ where: query ? { OR: [{ name: { contains: query } }, { relation: { contains: query } }] } : {}, orderBy: { updatedAt: "desc" }, take: 60 });
    return people.length ? ok(people.map((p) => `• [${p.id}] ${p.name}${p.relation ? ` · ${p.relation}` : ""}`).join("\n")) : ok("No people.");
  });

  // ---------- Quotes ----------
  t("add_quote", { title: "Add quote", description: "Save a quote or poem.", inputSchema: { text: z.string(), author: z.string().optional(), source: z.string().optional(), kind: z.string().optional(), labels: z.string().optional() } }, async (q) => {
    const quote = await prisma.quote.create({ data: { text: q.text.trim(), author: q.author ?? "", source: q.source ?? "", kind: one(q.kind, ["QUOTE", "POEM", "PROVERB", "LYRIC"], "QUOTE"), labels: [...new Set((q.labels ?? "").split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean))].join(", ") } });
    return ok(`Saved ${quote.kind.toLowerCase()}${quote.author ? ` by ${quote.author}` : ""}.`);
  });

  // ---------- Gym ----------
  t("log_workout", { title: "Log workout", description: "Log a gym session.", inputSchema: { groups: z.array(z.string()), notes: z.string().optional(), durationMin: z.number().optional(), date: z.string().optional() } }, async ({ groups, notes, durationMin, date }) => {
    const g = (groups ?? []).map((x) => x.trim()).filter(Boolean);
    if (!g.length) return err("Provide at least one muscle group.");
    await prisma.workout.create({ data: { groups: g.join(", "), notes: notes ?? "", durationMin: durationMin && durationMin > 0 ? Math.round(durationMin) : null, date: date ? new Date(date) : new Date() } });
    return ok(`Logged workout: ${g.join(", ")}.`);
  });

  // ---------- Wellbeing ----------
  const NUTRIENT_KEYS = ["PROTEIN", "CARBS", "FIBRE", "GREENS", "VITAMINS", "B12", "OMEGA3", "IRON", "CALCIUM"];
  const dayStart = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(n)));
  // "23:10" or "7:30" → minutes from midnight, or null
  const hhmm = (s) => {
    const m = String(s ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]), min = Number(m[2]);
    return h > 23 || min > 59 ? null : h * 60 + min;
  };

  t(
    "log_health",
    {
      title: "Log wellbeing",
      description:
        "Log or update a wellbeing day: brushing (0-2), bathing, room cleaned, beard trimmed (both on a 3-4 day cadence), cigarettes, water (ml or glasses of 250ml), sleep hours, posture (1-5), mood (1-100), nutrients had, and notes. Defaults to today. Only the fields you pass are changed; waterMl/waterGlasses ADD to what's already logged unless setWater is true.",
      inputSchema: {
        date: z.string().optional(),
        brushed: z.number().optional(),
        bathed: z.boolean().optional(),
        roomCleaned: z.boolean().optional(),
        beardTrimmed: z.boolean().optional(),
        smokes: z.number().optional(),
        waterMl: z.number().optional(),
        waterGlasses: z.number().optional(),
        setWater: z.boolean().optional(),
        sleepHours: z.number().optional(),
        posture: z.number().optional(),
        mood: z.number().optional(),
        nutrients: z.array(z.string()).optional(),
        notes: z.string().optional(),
      },
    },
    async (a) => {
      const date = dayStart(a.date ? new Date(a.date) : new Date());
      const data = {};
      if (a.brushed !== undefined) data.brushed = clamp(a.brushed, 0, 2);
      if (a.bathed !== undefined) data.bathed = a.bathed;
      if (a.roomCleaned !== undefined) data.roomCleaned = a.roomCleaned;
      if (a.beardTrimmed !== undefined) data.beardTrimmed = a.beardTrimmed;
      if (a.smokes !== undefined) data.smokes = clamp(a.smokes, 0, 99);
      const addWater = (a.waterMl ?? 0) + (a.waterGlasses ?? 0) * 250;
      if (a.waterMl !== undefined || a.waterGlasses !== undefined) {
        const cur = (await prisma.healthDay.findUnique({ where: { date }, select: { waterMl: true } }))?.waterMl ?? 0;
        data.waterMl = clamp(a.setWater ? addWater : cur + addWater, 0, 15000);
      }
      if (a.sleepHours !== undefined) data.sleepHours = Math.min(24, Math.max(0, a.sleepHours));
      if (a.posture !== undefined) data.posture = clamp(a.posture, 1, 5);
      if (a.mood !== undefined) data.mood = clamp(a.mood, 1, 100);
      if (a.nutrients !== undefined)
        data.nutrients = a.nutrients
          .map((n) => String(n).trim().toUpperCase().replace(/[\s-]/g, ""))
          .filter((n, i, arr) => NUTRIENT_KEYS.includes(n) && arr.indexOf(n) === i)
          .join(",");
      if (a.notes !== undefined) data.notes = toHtml(a.notes);
      const d = await prisma.healthDay.upsert({ where: { date }, create: { date, ...data }, update: data });
      const bits = Object.keys(data);
      return ok(bits.length ? `Logged ${bits.join(", ")} for ${date.toDateString()} (id ${d.id}).` : `Wellbeing day ready for ${date.toDateString()}.`);
    }
  );

  t(
    "add_meal",
    {
      title: "Add meal",
      description: "Add a meal to a wellbeing day. junkLevel: 0 = clean food, 5 = pure junk. time is a 24h clock like '13:30' (when you ate). Calories, protein (g), sodium (mg) and sugar (g) are optional — estimate them if the user doesn't say. Defaults to today.",
      inputSchema: { label: z.string(), junkLevel: z.number().optional(), calories: z.number().optional(), protein: z.number().optional(), sodium: z.number().optional(), sugar: z.number().optional(), time: z.string().optional(), date: z.string().optional() },
    },
    async ({ label, junkLevel, calories, protein, sodium, sugar, time, date }) => {
      const d = dayStart(date ? new Date(date) : new Date());
      const day = await prisma.healthDay.upsert({ where: { date: d }, create: { date: d }, update: {} });
      await prisma.meal.create({
        data: {
          dayId: day.id,
          label: label.trim(),
          junkLevel: clamp(junkLevel ?? 0, 0, 5),
          calories: calories ? clamp(calories, 0, 10000) : null,
          proteinG: protein ? Math.min(500, Math.max(0, protein)) : null,
          sodiumMg: sodium ? clamp(sodium, 0, 20000) : null,
          sugarG: sugar ? Math.min(1000, Math.max(0, sugar)) : null,
          timeMin: hhmm(time),
        },
      });
      const extra = [time && hhmm(time) !== null ? `at ${time}` : null, calories ? `${calories} kcal` : null, protein ? `${protein}g protein` : null, sodium ? `${sodium}mg sodium` : null, sugar ? `${sugar}g sugar` : null].filter(Boolean).join(", ");
      return ok(`Added meal "${label}" (junk ${clamp(junkLevel ?? 0, 0, 5)}/5${extra ? ` · ${extra}` : ""}).`);
    }
  );

  t(
    "log_sleep",
    {
      title: "Log sleep",
      description:
        "Set the sleep for a wellbeing day from clock times (24h, e.g. '23:10'). Pass one or more segments — multiple NIGHT segments capture waking mid-night, and kind 'NAP' logs a daytime nap. This REPLACES the day's existing segments. Bedtime, wake and duration are computed. Defaults to today.",
      inputSchema: {
        segments: z.array(z.object({ kind: z.string().optional(), start: z.string(), end: z.string() })),
        date: z.string().optional(),
      },
    },
    async ({ segments, date }) => {
      const d = dayStart(date ? new Date(date) : new Date());
      const day = await prisma.healthDay.upsert({ where: { date: d }, create: { date: d }, update: {} });
      const clean = (segments ?? [])
        .map((s) => ({ kind: String(s.kind ?? "NIGHT").toUpperCase() === "NAP" ? "NAP" : "NIGHT", startMin: hhmm(s.start), endMin: hhmm(s.end) }))
        .filter((s) => s.startMin !== null && s.endMin !== null && s.startMin !== s.endMin)
        .map((s) => ({ dayId: day.id, ...s }));
      await prisma.$transaction([
        prisma.sleepSegment.deleteMany({ where: { dayId: day.id } }),
        ...(clean.length ? [prisma.sleepSegment.createMany({ data: clean })] : []),
      ]);
      const mins = clean.filter((s) => s.kind === "NIGHT").reduce((n, s) => n + (((s.endMin - s.startMin) % 1440) + 1440) % 1440, 0);
      return ok(`Logged ${clean.length} sleep segment(s) for ${d.toDateString()} · ${Math.floor(mins / 60)}h ${mins % 60}m of night sleep.`);
    }
  );

  t(
    "upkeep_status",
    { title: "Upkeep status", description: "How many days since the room was last cleaned and the beard last trimmed. Both are due every 3-4 days.", inputSchema: {} },
    async () => {
      const today = dayStart(new Date());
      const out = {};
      for (const [key, label] of [["roomCleaned", "room cleaned"], ["beardTrimmed", "beard trimmed"]]) {
        const last = await prisma.healthDay.findFirst({ where: { [key]: true }, orderBy: { date: "desc" }, select: { date: true } });
        const days = last ? Math.round((today - dayStart(last.date)) / 86400000) : null;
        out[key] = { label, daysSince: days, state: days === null ? "never" : days >= 5 ? "overdue" : days >= 3 ? "due" : "fresh" };
      }
      return json({ cadenceDays: "3-4", upkeep: out });
    }
  );

  t(
    "log_weight",
    { title: "Log body weight", description: "Record a body-weight weigh-in (kg). One per day; re-logging the same day overwrites it.", inputSchema: { kg: z.number(), date: z.string().optional(), note: z.string().optional() } },
    async ({ kg, date, note }) => {
      const d = dayStart(date ? new Date(date) : new Date());
      const value = Math.min(400, Math.max(20, kg));
      await prisma.bodyWeight.upsert({ where: { date: d }, create: { date: d, kg: value, note: note ?? "" }, update: { kg: value, note: note ?? "" } });
      return ok(`Logged ${value}kg for ${d.toDateString()}.`);
    }
  );

  t(
    "get_targets",
    {
      title: "Get daily targets",
      description: "The user's personal daily targets (calories, protein, water, fibre) derived from their profile, plus today's progress against them. Call this before advising on food or water.",
      inputSchema: {},
    },
    async () => {
      const [p, latest, today] = await Promise.all([
        prisma.profile.findUnique({ where: { id: "me" } }),
        prisma.bodyWeight.findFirst({ orderBy: { date: "desc" } }),
        prisma.healthDay.findUnique({ where: { date: dayStart(new Date()) }, include: { meals: true } }),
      ]);
      const prof = p ?? { sex: "MALE", birthYear: 2004, heightCm: 177.8, activity: "LIGHT", goal: "MAINTAIN", startWeightKg: 64, sleepTargetMin: 1380, wakeTargetMin: 420 };
      const kg = latest?.kg ?? prof.startWeightKg;
      const age = new Date().getFullYear() - prof.birthYear;
      const factor = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, ATHLETE: 1.9 }[prof.activity] ?? 1.375;
      const adj = { CUT: -400, MAINTAIN: 0, BULK: 300 }[prof.goal] ?? 0;
      const perKg = { CUT: 2.0, MAINTAIN: 1.6, BULK: 1.8 }[prof.goal] ?? 1.6;
      const bmr = Math.round(10 * kg + 6.25 * prof.heightCm - 5 * age + (prof.sex === "FEMALE" ? -161 : 5));
      const tdee = Math.round(bmr * factor);
      const calories = Math.round((tdee + adj) / 10) * 10;
      const proteinG = Math.round(kg * perKg);
      const waterMl = Math.round((kg * 35) / 100) * 100;
      const m = prof.heightCm / 100;
      const kcalToday = (today?.meals ?? []).reduce((n, x) => n + (x.calories ?? 0), 0);
      const protToday = Math.round((today?.meals ?? []).reduce((n, x) => n + (x.proteinG ?? 0), 0));
      const sodiumToday = (today?.meals ?? []).reduce((n, x) => n + (x.sodiumMg ?? 0), 0);
      const sugarToday = Math.round((today?.meals ?? []).reduce((n, x) => n + (x.sugarG ?? 0), 0));
      const fmtMin = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
      return json({
        profile: { age, sex: prof.sex, heightCm: prof.heightCm, weightKg: kg, activity: prof.activity, goal: prof.goal },
        bmi: Math.round((kg / (m * m)) * 10) / 10,
        targets: { calories, proteinG, waterMl, fibreG: Math.round((calories / 1000) * 14), sodiumMgMax: 2000, sugarGMax: prof.sex === "FEMALE" ? 25 : 36, bmr, tdee, sleepHours: "7-9" },
        rhythm: { usualBedtime: fmtMin(prof.sleepTargetMin ?? 1380), usualWake: fmtMin(prof.wakeTargetMin ?? 420) },
        today: { calories: kcalToday, proteinG: protToday, sodiumMg: sodiumToday, sugarG: sugarToday, waterMl: today?.waterMl ?? 0, meals: (today?.meals ?? []).length },
      });
    }
  );

  t(
    "set_rhythm",
    {
      title: "Set usual sleep schedule",
      description: "Update the user's usual bedtime and/or wake time (24h clock like '23:30'). The circadian comparison is judged against these, so update them whenever the schedule changes.",
      inputSchema: { usualBedtime: z.string().optional(), usualWake: z.string().optional() },
    },
    async ({ usualBedtime, usualWake }) => {
      const data = {};
      if (usualBedtime !== undefined) { const b = hhmm(usualBedtime); if (b !== null) data.sleepTargetMin = b; }
      if (usualWake !== undefined) { const w = hhmm(usualWake); if (w !== null) data.wakeTargetMin = w; }
      if (!Object.keys(data).length) return err("Provide usualBedtime and/or usualWake as HH:MM.");
      await prisma.profile.upsert({ where: { id: "me" }, create: { id: "me", ...data }, update: data });
      const p = await prisma.profile.findUnique({ where: { id: "me" } });
      const fm = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
      return ok(`Usual rhythm set: sleep ${fm(p.sleepTargetMin)} → wake ${fm(p.wakeTargetMin)}.`);
    }
  );

  t(
    "list_health",
    { title: "List wellbeing days", description: "Recent wellbeing days with their logged values.", inputSchema: { limit: z.number().optional() } },
    async ({ limit }) => {
      const days = await prisma.healthDay.findMany({ include: { meals: true }, orderBy: { date: "desc" }, take: Math.min(limit ?? 7, 60) });
      if (!days.length) return ok("No wellbeing days logged yet.");
      return ok(
        days
          .map((d) => {
            const parts = [
              `brushed ${d.brushed}x`,
              d.bathed ? "bathed" : "no bath",
              `${d.meals.length} meal(s)`,
              `${d.smokes} cig(s)`,
              `${(d.waterMl / 1000).toFixed(2)}L water`,
              d.sleepHours !== null ? `${d.sleepHours}h sleep` : "sleep —",
              d.mood !== null ? `mood ${d.mood}` : "mood —",
              d.roomCleaned ? "room cleaned" : null,
              d.beardTrimmed ? "beard trimmed" : null,
            ].filter(Boolean);
            return `• ${d.date.toDateString()} — ${parts.join(" · ")}${d.nutrients ? ` · [${d.nutrients}]` : ""}`;
          })
          .join("\n")
      );
    }
  );

  // ---------- Work ----------
  t("add_company", { title: "Add company", description: "Add a work engagement.", inputSchema: { name: z.string(), role: z.string().optional(), kind: z.string().optional() } }, async ({ name, role, kind }) => {
    const c = await prisma.company.create({ data: { name: name.trim(), role: role ?? "", kind: kind ?? "freelance" } });
    return ok(`Added company ${c.name} (id ${c.id}).`);
  });
  t("add_work_item", { title: "Add work item", description: "Add a task/bug to a company (name or id).", inputSchema: { company: z.string(), title: z.string(), bucket: z.string().optional(), scope: z.string().optional() } }, async ({ company, title, bucket, scope }) => {
    let c = await prisma.company.findUnique({ where: { id: company } }).catch(() => null);
    if (!c) c = await prisma.company.findFirst({ where: { name: { contains: company } } });
    if (!c) return err(`No company matching "${company}".`);
    const b = one(bucket, ["DOING", "BUG", "PARKED", "DONE"], "DOING");
    const max = await prisma.workItem.aggregate({ where: { companyId: c.id, bucket: b }, _max: { order: true } });
    await prisma.workItem.create({ data: { companyId: c.id, title: title.trim(), bucket: b, scope: (scope ?? "").split(/[,+/]/).map((s) => s.trim()).filter(Boolean).join(", "), order: (max._max.order ?? -1) + 1 } });
    return ok(`Added "${title}" to ${c.name} (${b.toLowerCase()}).`);
  });

  // ---------- Summary + ChatGPT-style search/fetch ----------
  t("hq_summary", { title: "HQ summary", description: "Counts of everything in HQ.", inputSchema: {} }, async () => {
    const [apps, parked, todos, notes, refl, people, quotes, workouts, companies, workItems, healthDays] = await Promise.all([prisma.application.count({ where: { NOT: { status: "PENDING" } } }), prisma.application.count({ where: { status: "PENDING" } }), prisma.todo.count({ where: { done: false } }), prisma.note.count(), prisma.reflection.count(), prisma.person.count(), prisma.quote.count(), prisma.workout.count(), prisma.company.count(), prisma.workItem.count(), prisma.healthDay.count()]);
    return ok(`HQ contains:\n• ${apps} applications sent (${parked} parked half-done)\n• ${todos} open todos\n• ${notes} notes\n• ${refl} reflections\n• ${people} people\n• ${quotes} quotes\n• ${workouts} workouts\n• ${companies} companies (${workItems} work items)\n• ${healthDays} wellbeing days`);
  });

  t("search", { title: "Search HQ", description: "Search across HQ (notes, applications, people, reflections, quotes). Returns results with ids.", inputSchema: { query: z.string() } }, async ({ query }) => {
    const q = query.trim();
    const [notes, apps, people, refls, quotes] = await Promise.all([
      prisma.note.findMany({ where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] }, take: 5 }),
      prisma.application.findMany({ where: { OR: [{ company: { contains: q } }, { role: { contains: q } }] }, take: 5 }),
      prisma.person.findMany({ where: { OR: [{ name: { contains: q } }, { relation: { contains: q } }] }, take: 5 }),
      prisma.reflection.findMany({ where: { title: { contains: q } }, take: 5 }),
      prisma.quote.findMany({ where: { OR: [{ text: { contains: q } }, { author: { contains: q } }] }, take: 5 }),
    ]);
    const results = [
      ...notes.map((n) => ({ id: `note:${n.id}`, title: n.title || "Untitled note", url: `${APP}/notes` })),
      ...apps.map((a) => ({ id: `application:${a.id}`, title: `${a.company} — ${a.role}`, url: `${APP}/applications/${a.id}` })),
      ...people.map((p) => ({ id: `person:${p.id}`, title: p.name, url: `${APP}/people/${p.id}` })),
      ...refls.map((r) => ({ id: `reflection:${r.id}`, title: r.title, url: `${APP}/reflections/${r.id}` })),
      ...quotes.map((x) => ({ id: `quote:${x.id}`, title: strip(x.text).slice(0, 60), url: `${APP}/quotes` })),
    ];
    return json({ results });
  });

  t("fetch", { title: "Fetch item", description: "Fetch a single HQ item by id (from search, e.g. 'note:abc').", inputSchema: { id: z.string() } }, async ({ id }) => {
    const [type, rid] = id.split(":");
    let doc = { id, title: "Not found", text: "", url: APP };
    if (type === "note") {
      const n = await prisma.note.findUnique({ where: { id: rid } });
      if (n) doc = { id, title: n.title || "Untitled note", text: strip(n.content), url: `${APP}/notes` };
    } else if (type === "application") {
      const a = await prisma.application.findUnique({ where: { id: rid } });
      if (a) {
        const comp = a.offerAmount == null && a.offerMax == null ? "" : ` Compensation ${a.offerCurrency ?? "INR"} ${a.offerAmount ?? "?"}${a.offerMax ? `–${a.offerMax}` : ""}${a.offerNote ? ` (${a.offerNote})` : ""}.`;
        doc = { id, title: `${a.company} — ${a.role}`, text: `Status ${a.status}, category ${a.category}.${comp} ${strip(a.description)} ${strip(a.notes)}`.trim(), url: `${APP}/applications/${a.id}` };
      }
    } else if (type === "person") {
      const p = await prisma.person.findUnique({ where: { id: rid }, include: { interactions: { orderBy: { date: "desc" }, take: 5 } } });
      if (p) doc = { id, title: p.name, text: `${p.relation}. ${strip(p.notes)} Recent: ${p.interactions.map((i) => i.kind).join(", ")}`.trim(), url: `${APP}/people/${p.id}` };
    } else if (type === "reflection") {
      const r = await prisma.reflection.findUnique({ where: { id: rid }, include: { thoughts: true } });
      if (r) doc = { id, title: r.title, text: `${r.antithesisLabel} vs ${r.thesisLabel} (lean ${r.lean}% thesis). ${strip(r.synthesis)}`.trim(), url: `${APP}/reflections/${r.id}` };
    } else if (type === "quote") {
      const x = await prisma.quote.findUnique({ where: { id: rid } });
      if (x) doc = { id, title: x.author || "Quote", text: strip(x.text), url: `${APP}/quotes` };
    }
    return json(doc);
  });
}
