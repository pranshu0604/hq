import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ProjectDetail from "@/components/projects/project-detail";
import ProjectTasks from "@/components/projects/project-tasks";
import ProjectResume from "@/components/projects/project-resume";
import { projectHealth, HEALTH_TONE } from "@/lib/project-health";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { tasks: { orderBy: { order: "asc" } } },
  });
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-14 reveal">
      <Link href="/projects" className="label hover:text-ink transition-colors">
        ← back to projects
      </Link>

      <div className="mt-4">
        <ProjectDetail
          project={{
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            priority: project.priority,
            link: project.link,
            targetDate: project.targetDate ? project.targetDate.toISOString() : null,
            notes: project.notes,
            updatedAt: project.updatedAt.toISOString(),
          }}
        />
      </div>

      {(() => {
        const h = projectHealth(project);
        if (h.level === "GREEN") return null;
        return (
          <div className="mt-6 flex items-center gap-2.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_TONE[h.level] }} />
            <span style={{ color: HEALTH_TONE[h.level] }} className="label">
              {h.level === "RED" ? "At risk" : "Watch"}
            </span>
            <span className="text-ink-faint">{h.reasons.join(" · ")}</span>
          </div>
        );
      })()}

      <div className="mt-6">
        <ProjectResume
          projectId={project.id}
          initial={{ goal: project.goal, state: project.state, blocker: project.blocker, nextAction: project.nextAction }}
        />
      </div>

      <div className="card p-6 mt-8">
        <ProjectTasks
          projectId={project.id}
          tasks={project.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done }))}
        />
      </div>
    </div>
  );
}
