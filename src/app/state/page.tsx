// "One screen for life state" — the home screen of your life. Deliberately not a
// dashboard of analytics: just what's on you right now, and what's deliberately
// set aside. Read-only aggregation over everything HQ already tracks.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentNow } from "@/lib/focus";
import { getToday } from "@/lib/day";
import { getNow } from "@/lib/format";
import { projectHealth } from "@/lib/project-health";

export const dynamic = "force-dynamic";

export default async function StatePage() {
  const nowMs = getNow();
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(nowMs);
  end.setHours(23, 59, 59, 999);

  const [now, day, openTodos, applications, commitments, projects, openLoops, parked, worries] = await Promise.all([
    getCurrentNow(nowMs),
    getToday(nowMs),
    prisma.todo.findMany({ where: { done: false } }),
    prisma.application.findMany({ where: { status: "APPLIED" }, include: { platforms: true } }),
    prisma.capture.findMany({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "COMMITMENT" }, orderBy: { createdAt: "asc" }, take: 5 }),
    prisma.project.findMany(),
    prisma.capture.count({ where: { status: "OPEN" } }),
    prisma.capture.count({ where: { status: "PARKED" } }),
    prisma.capture.count({ where: { status: { in: ["OPEN", "PARKED"] }, kind: "WORRY" } }),
  ]);

  const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const important = [...openTodos]
    .filter((t) => (t.dueDate && new Date(t.dueDate) <= end) || t.priority === "HIGH")
    .sort((a, b) => rank[a.priority] - rank[b.priority])
    .slice(0, 3);
  const waiting = applications.filter((a) => !a.platforms.some((p) => p.responseReceived));

  const activeProjects = projects.filter((p) => !["SHIPPED", "ABANDONED"].includes(p.status));
  const rotting = activeProjects.filter((p) => projectHealth(p, nowMs).level === "RED");
  const highTodos = openTodos.filter((t) => t.priority === "HIGH").length;

  const system = day?.maintenance ? "Maintenance" : now ? (now.kind === "CULTURE" ? "Culture" : "Focused") : day?.energy ? cap(day.energy) : "Open";

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-16 reveal">
      <header className="mb-10">
        <div className="eyebrow">HQ · Life state</div>
        <p className="mt-3 text-[13px] text-ink-dim max-w-md">Everything on you right now, and what&apos;s set aside. Glance daily; compress weekly.</p>
      </header>

      <Block label="Now">
        {now ? (
          <div className="text-2xl text-ink">{now.label}</div>
        ) : (
          <Link href="/" className="text-2xl text-ink-faint hover:text-accent transition-colors">
            nothing running →
          </Link>
        )}
      </Block>

      <Block label="Today" hint={highTodos ? `${highTodos} high-priority — that's the week` : undefined}>
        {important.length === 0 ? (
          <Empty>nothing pressing</Empty>
        ) : (
          important.map((t) => (
            <div key={t.id} className="text-[15px] text-ink-dim">
              {t.title}
            </div>
          ))
        )}
      </Block>

      <Block label={`Waiting · ${waiting.length}`} hint="people who owe you a reply">
        {waiting.length === 0 ? (
          <Empty>no one</Empty>
        ) : (
          waiting.slice(0, 4).map((a) => (
            <Link key={a.id} href={`/applications/${a.id}`} className="text-[15px] text-ink-dim hover:text-accent transition-colors block">
              {a.company}
            </Link>
          ))
        )}
      </Block>

      <Block label={`Commitments · ${commitments.length}`} hint="things a human is relying on you for">
        {commitments.length === 0 ? (
          <Empty>none logged</Empty>
        ) : (
          commitments.map((c) => (
            <div key={c.id} className="text-[15px] text-ink-dim">
              {c.text}
              {c.who ? <span className="text-ink-faint"> — {c.who}</span> : null}
            </div>
          ))
        )}
      </Block>

      <Block label={`Projects · ${activeProjects.length}`} hint={rotting.length ? `${rotting.length} at risk — resume, replan, or kill` : "all showing signs of life"}>
        {activeProjects.length === 0 ? (
          <Empty>none active</Empty>
        ) : (
          <Link href="/projects" className="text-[15px] text-ink-dim hover:text-accent transition-colors block">
            {rotting.length ? `${rotting.length} rotting · ${activeProjects.length - rotting.length} healthy →` : `${activeProjects.length} active →`}
          </Link>
        )}
      </Block>

      <div className="grid grid-cols-3 gap-4 mt-10 pt-8 border-t border-line-soft">
        <Stat n={openLoops} label="open loops" href="/inbox" />
        <Stat n={parked} label="parked" href="/inbox" />
        <Stat n={worries} label="worries" href="/inbox" />
      </div>

      <div className="mt-10 flex items-center gap-2">
        <span className="label">System</span>
        <span className="text-accent text-sm font-medium">{system}</span>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s ? s[0] + s.slice(1).toLowerCase() : s;
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2 mb-2">
        <div className="label">{label}</div>
        {hint && <div className="text-[11px] text-ink-faint">{hint}</div>}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[15px] text-ink-faint">{children}</div>;
}

function Stat({ n, label, href }: { n: number; label: string; href: string }) {
  return (
    <Link href={href} className="group">
      <div className="metric text-3xl group-hover:text-accent transition-colors">{n}</div>
      <div className="label mt-1">{label}</div>
    </Link>
  );
}
