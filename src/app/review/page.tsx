// Weekly review — life compression. Not analytics: a once-a-week collapse of
// everything occupying mental/system space into what actually matters, so the
// system doesn't accumulate indefinitely. Read-only; the actions live elsewhere.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getNow } from "@/lib/format";
import { projectHealth } from "@/lib/project-health";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const nowMs = getNow();

  const [todos, captures, projects, applications] = await Promise.all([
    prisma.todo.findMany({ where: { done: false } }),
    prisma.capture.findMany({ where: { status: { in: ["OPEN", "PARKED"] } } }),
    prisma.project.findMany(),
    prisma.application.findMany({ where: { status: "APPLIED" }, include: { platforms: true } }),
  ]);

  const highTodos = todos.filter((t) => t.priority === "HIGH").length;
  const worries = captures.filter((c) => c.kind === "WORRY");
  const commitments = captures.filter((c) => c.kind === "COMMITMENT");
  const openLoops = captures.filter((c) => c.status === "OPEN").length;

  const activeProjects = projects.filter((p) => !["SHIPPED", "ABANDONED"].includes(p.status));
  const rotting = activeProjects.filter((p) => projectHealth(p, nowMs).level === "RED");
  const waiting = applications.filter((a) => !a.platforms.some((p) => p.responseReceived)).length;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-10">
        <div className="eyebrow">HQ · Weekly review</div>
        <h1 className="display text-4xl mt-2">Compress</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          Everything currently occupying space, and what it collapses to. Do this weekly so nothing accumulates in the dark.
        </p>
      </header>

      <div className="space-y-8">
        <Row
          n={todos.length}
          unit="open todos"
          compressed={highTodos > 0 ? `${highTodos} are HIGH priority — those are the week` : "none marked high — pick 3 that matter"}
          href="/todos"
        />
        <Row
          n={worries.length}
          unit="worries"
          compressed={`process them → act on the ${worries.filter((w) => w.status === "OPEN").length} open, park or drop the rest`}
          href="/inbox"
        />
        <Row
          n={activeProjects.length}
          unit="active projects"
          compressed={rotting.length ? `${rotting.length} at risk — Resume, Replan, or Kill` : "all showing signs of life"}
          href="/projects"
        />
        <Row n={commitments.length} unit="open commitments" compressed={commitments.length ? "people relying on you — clear these first" : "nothing owed"} href="/inbox" />
        <Row n={waiting} unit="waiting on replies" compressed={waiting ? "nudge the stale ones" : "inbox clear"} href="/applications" />
        <Row n={openLoops} unit="open loops in the inbox" compressed={openLoops ? "empty the inbox — park or promote each" : "inbox zero"} href="/inbox" />
      </div>
    </div>
  );
}

function Row({ n, unit, compressed, href }: { n: number; unit: string; compressed: string; href: string }) {
  return (
    <Link href={href} className="flex items-baseline gap-5 group border-t border-line-soft pt-5">
      <span className="metric text-3xl w-12 shrink-0 group-hover:text-accent transition-colors">{n}</span>
      <span className="min-w-0">
        <span className="text-ink text-[15px]">{unit}</span>
        <span className="block text-ink-dim text-[13px] mt-1">→ {compressed}</span>
      </span>
    </Link>
  );
}
