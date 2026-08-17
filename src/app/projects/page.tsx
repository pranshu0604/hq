import { prisma } from "@/lib/prisma";
import ProjectsBoard from "@/components/projects/projects-board";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: { tasks: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-8 py-14 reveal">
      <div className="mb-10">
        <div className="eyebrow mb-2.5">03 · Projects</div>
        <h1 className="display text-4xl">Side Projects &amp; Product Ideas</h1>
      </div>
      <ProjectsBoard
        projects={projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          status: p.status,
          priority: p.priority,
          tasksTotal: p.tasks.length,
          tasksDone: p.tasks.filter((t) => t.done).length,
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
