import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Clock from "@/components/clock";
import FocusList from "@/components/dashboard/focus-list";
import MomentumBar from "@/components/game/momentum-bar";
import { getGameState } from "@/lib/gamification";
import {
  IconApplications,
  IconArrow,
  IconCalendar,
  IconNotes,
  IconProjects,
  IconTodos,
} from "@/components/icons";
import { dayLabel, getNow, relativeTime } from "@/lib/format";
import { summarize } from "@/lib/social";
import { computeReachOut } from "@/lib/people";
import PresenceCard from "@/components/social/presence-card";
import { gapsFor, isLogged, scoreTone, summarize as summarizeHealth, type DayRow , toDayRow} from "@/lib/wellbeing";
import { getProfileState } from "@/lib/profile";
import { getCurrentNow } from "@/lib/focus";
import { getToday, getMorningBrief } from "@/lib/day";
import NowCard from "@/components/dashboard/now-card";
import DayCard from "@/components/dashboard/day-card";
import ScheduleCard from "@/components/dashboard/schedule-card";
import { listReminders } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const DEAD = ["REJECTED", "WITHDRAWN"];
const NOT_OUT = "PENDING"; // parked drafts aren't in the pipeline yet

const STAGES = [
  { key: "APPLIED", label: "Applied", color: "var(--info)" },
  { key: "RESPONSE", label: "Response", color: "var(--warn)" },
  { key: "INTERVIEWING", label: "Interviewing", color: "var(--violet)" },
  { key: "OFFER", label: "Offer", color: "var(--good)" },
];

export default async function OverviewPage() {
  const [applications, projects, notes, todos, socialLogs, people, workouts, reflectionsCount, quotesCount, workItems, healthRaw] = await Promise.all([
    prisma.application.findMany({ include: { platforms: true, interviews: true } }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.note.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.todo.findMany(),
    prisma.socialLog.findMany({ select: { platform: true, createdAt: true } }),
    prisma.person.findMany({ include: { interactions: { select: { date: true } } } }),
    prisma.workout.findMany({ select: { date: true }, orderBy: { date: "desc" } }),
    prisma.reflection.count(),
    prisma.quote.count(),
    prisma.workItem.findMany({ select: { bucket: true } }),
    prisma.healthDay.findMany({ include: { meals: { select: { id: true, label: true, junkLevel: true, calories: true, proteinG: true, sodiumMg: true, sugarG: true, timeMin: true } }, sleeps: true }, orderBy: { date: "desc" }, take: 60 }),
  ]);

  const game = await getGameState();
  const nowMs = getNow();
  const [now, dayToday, morningBrief, reminders] = await Promise.all([getCurrentNow(nowMs), getToday(nowMs), getMorningBrief(nowMs), listReminders(nowMs)]);
  const hasData = applications.length + projects.length + notes.length + todos.length + socialLogs.length > 0;
  const presence = summarize(socialLogs, nowMs);

  const { targets } = await getProfileState(nowMs);
  const healthDays: DayRow[] = healthRaw.map(toDayRow);
  const health = summarizeHealth(healthDays, targets, nowMs);
  const loggedToday = health.today ? isLogged(health.today) : false;
  const careToday = health.todayScore;
  const careGaps = health.today ? gapsFor(health.today, targets, health.upkeep) : ["brush", "bathe", "log a meal"];

  const parkedApps = applications.filter((a) => a.status === NOT_OUT);
  const active = applications.filter((a) => !DEAD.includes(a.status) && a.status !== NOT_OUT);
  const waiting = applications.filter(
    (a) => a.status === "APPLIED" && !a.platforms.some((p) => p.responseReceived)
  );
  const stageCounts = Object.fromEntries(STAGES.map((s) => [s.key, active.filter((a) => a.status === s.key).length]));
  const maxStage = Math.max(1, ...Object.values(stageCounts));
  const offers = active.filter((a) => a.status === "OFFER").length;

  const upcomingInterviews = applications
    .flatMap((a) => a.interviews.map((iv) => ({ ...iv, company: a.company, role: a.role, appId: a.id })))
    .filter((iv) => iv.scheduledOn && new Date(iv.scheduledOn).getTime() >= nowMs - 3600_000)
    .sort((a, b) => new Date(a.scheduledOn!).getTime() - new Date(b.scheduledOn!).getTime());
  const nextInterview = upcomingInterviews[0];

  const followUps = waiting
    .map((a) => ({ ...a, days: Math.floor((nowMs - new Date(a.createdAt).getTime()) / 86400000) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const startToday = new Date(nowMs);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(nowMs);
  endToday.setHours(23, 59, 59, 999);
  const openTodos = todos.filter((t) => !t.done);
  let focus = openTodos
    .filter((t) => t.dueDate && new Date(t.dueDate) <= endToday)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  if (focus.length === 0) {
    const rank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    focus = [...openTodos].sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5);
  }
  const focusData = focus.slice(0, 6).map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    overdue: !!t.dueDate && new Date(t.dueDate) < startToday && !t.done,
  }));

  const activity = [
    ...applications.map((a) => ({ t: a.updatedAt, c: a.createdAt, verb: verbOf(a.createdAt, a.updatedAt), subject: a.company, kind: "application", href: `/applications/${a.id}` })),
    ...projects.map((p) => ({ t: p.updatedAt, c: p.createdAt, verb: verbOf(p.createdAt, p.updatedAt), subject: p.title, kind: "project", href: "/projects" })),
    ...notes.map((n) => ({ t: n.updatedAt, c: n.createdAt, verb: verbOf(n.createdAt, n.updatedAt), subject: n.title, kind: "note", href: "/notes" })),
    ...todos.map((t) => ({ t: t.updatedAt, c: t.createdAt, verb: verbOf(t.createdAt, t.updatedAt), subject: t.title, kind: "todo", href: "/todos" })),
  ]
    .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
    .slice(0, 6);

  const hour = new Date(nowMs).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const staleCount = followUps.filter((f) => f.days >= 7).length;
  const overdueCount = focusData.filter((t) => t.overdue).length;

  const brief: string[] = [];
  if (nextInterview?.scheduledOn)
    brief.push(`Your next interview — ${nextInterview.company} — is ${dayLabel(nextInterview.scheduledOn)}.`);
  if (waiting.length)
    brief.push(`${waiting.length} ${waiting.length === 1 ? "company is" : "companies are"} waiting on your reply.`);
  if (staleCount)
    brief.push(`${staleCount} ${staleCount === 1 ? "application has" : "applications have"} gone stale.`);
  if (offers) brief.push(`${offers} ${offers === 1 ? "offer is" : "offers are"} on the table.`);
  if (overdueCount) brief.push(`${overdueCount} ${overdueCount === 1 ? "todo is" : "todos are"} overdue.`);
  if (parkedApps.length)
    brief.push(`${parkedApps.length} application form${parkedApps.length === 1 ? " is" : "s are"} parked half-done.`);
  if (hasData && presence.today === 0) brief.push("You haven't been visible online today.");
  else if (presence.sweep) brief.push("Full social sweep already logged today.");
  const dueReachOut = computeReachOut(people, nowMs).length;
  if (dueReachOut) brief.push(`${dueReachOut} ${dueReachOut === 1 ? "person is" : "people are"} due for a catch-up.`);
  const gymDaysSince = workouts[0] ? Math.floor((nowMs - new Date(workouts[0].date).getTime()) / 86400000) : null;
  if (gymDaysSince !== null && gymDaysSince >= 3) brief.push(`It's been ${gymDaysSince} days since the gym.`);
  if (hasData && !loggedToday) brief.push("You haven't checked in on your wellbeing today.");
  else if (loggedToday && careGaps.length) brief.push(`Still to do for yourself — ${careGaps.slice(0, 2).join(" and ")}.`);
  if (health.avgSleep7 !== null && health.avgSleep7 < 6.5) brief.push(`You're averaging ${health.avgSleep7.toFixed(1)}h of sleep.`);
  if (loggedToday && health.waterToday < targets.waterMl)
    brief.push(`${((targets.waterMl - health.waterToday) / 1000).toFixed(1)}L of water still to drink today.`);
  if (health.smokeFreeStreak >= 3) brief.push(`${health.smokeFreeStreak} days smoke-free.`);
  for (const o of health.overdue) brief.push(`${o.label} — ${o.days} days, overdue.`);

  const openWork = workItems.filter((w) => w.bucket !== "DONE").length;
  const activeProjects = projects.filter((p) => !["SHIPPED", "ABANDONED"].includes(p.status)).length;
  const openTodoCount = todos.filter((t) => !t.done).length;

  const briefText = !hasData
    ? "Nothing tracked yet. Set up your command center below — add your first application, project or todo."
    : brief.length
    ? brief.join(" ")
    : "All quiet on every front. You're fully caught up.";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      {/* ops-room header */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="eyebrow">HQ · Command Center</div>
          <Clock />
        </div>
        <h1 className="display text-5xl">{greeting}, Pranshu.</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-dim">
          <span className="text-accent font-medium">Mission brief — </span>
          {briefText}
        </p>
      </header>

      {/* NOW — the single authoritative "what am I doing right now" */}
      <div className="mb-4">
        <NowCard initialNow={now} topTodos={focusData.map((t) => ({ id: t.id, title: t.title }))} />
      </div>

      {/* the day — morning intent + evening shutdown */}
      <div className="mb-4">
        <DayCard initialToday={dayToday} initialBrief={morningBrief} />
      </div>

      {/* momentum — the grind gamified */}
      <div className="mb-4">
        <MomentumBar state={game} />
      </div>

      {/* dominant row: next-up hero + at-a-glance */}
      <section className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-12 lg:col-span-8">
          <NextUp nextInterview={nextInterview} followUp={followUps[0]} focus={focusData[0]} hasData={hasData} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <Glance active={active.length} waiting={waiting.length} interviews={upcomingInterviews.length} offers={offers} />
        </div>
      </section>

      {/* main asymmetric grid */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="section-title">Active pipeline</div>
              <Link href="/applications" className="label hover:text-accent transition-colors flex items-center gap-1">
                all <IconArrow />
              </Link>
            </div>
            {active.length === 0 ? (
              <EmptyLine
                title="No live applications yet."
                sub="Add your first one and it'll flow through the pipeline here."
                href="/applications/new"
                cta="Add application"
              />
            ) : (
              <div className="space-y-3.5">
                {STAGES.map((s) => {
                  const c = stageCounts[s.key];
                  return (
                    <div key={s.key} className="flex items-center gap-4">
                      <div className="w-24 text-[13px] text-ink-dim flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </div>
                      <div className="flex-1 track">
                        <span style={{ width: `${(c / maxStage) * 100}%`, background: c ? s.color : "transparent" }} />
                      </div>
                      <div className="metric text-sm w-6 text-right">{c}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="section-title mb-5">Needs follow-up</div>
            {followUps.length === 0 ? (
              <p className="text-sm text-ink-faint">Nothing waiting — every application has had a response.</p>
            ) : (
              <div className="-mx-2">
                {followUps.map((a) => (
                  <Link key={a.id} href={`/applications/${a.id}`} className="hover-row flex items-center justify-between gap-4 px-2 py-2.5 text-sm">
                    <div>
                      <div className="text-ink">{a.company}</div>
                      <div className="text-ink-faint text-xs mt-0.5">{a.role}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`label ${a.days >= 7 ? "text-warn" : ""}`}>
                        {a.days === 0 ? "today" : `${a.days}d waiting`}
                      </span>
                      <IconArrow className="text-ink-faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="section-title mb-4">Recent activity</div>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-faint">Your activity will show up here as you add and update things.</p>
            ) : (
              <div className="-mx-2">
                {activity.map((a, i) => (
                  <Link key={i} href={a.href} className="hover-row flex items-center gap-3 px-2 py-2.5 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                    <span className="text-ink-dim">
                      <span className="text-ink">{a.verb}</span> {a.subject || "untitled"}
                    </span>
                    <span className="text-ink-faint text-xs">· {a.kind}</span>
                    <span className="label ml-auto">{relativeTime(a.t)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <ScheduleCard initial={reminders} />

          <div className="card p-6">
            <div className="section-title mb-5">Today&apos;s focus</div>
            <FocusList todos={focusData} />
          </div>

          <PresenceCard summary={presence} />

          <CareCard score={careToday} logged={loggedToday} gaps={careGaps} streak={health.streak} smokeFree={health.smokeFreeStreak} />

          <div className="card p-6">
            <div className="section-title mb-4">Across HQ</div>
            <div className="divide-y divide-line-soft">
              {[
                { href: "/work", label: "Work", value: `${openWork} open`, hot: openWork > 0 },
                { href: "/projects", label: "Projects", value: `${activeProjects} active` },
                { href: "/reflections", label: "Reflections", value: `${reflectionsCount}` },
                { href: "/quotes", label: "Quotes", value: `${quotesCount}` },
                { href: "/gym", label: "Gym", value: gymDaysSince === null ? "none yet" : gymDaysSince === 0 ? "today" : `${gymDaysSince}d ago`, hot: gymDaysSince !== null && gymDaysSince >= 3 },
                { href: "/wellbeing", label: "Wellbeing", value: loggedToday ? `${careToday}/100` : "not logged", hot: !loggedToday },
                { href: "/people", label: "People", value: dueReachOut ? `${dueReachOut} due` : `${people.length}`, hot: dueReachOut > 0 },
                { href: "/todos", label: "Todos", value: `${openTodoCount} open` },
              ].map((r) => (
                <Link key={r.href} href={r.href} className="flex items-center justify-between py-2 text-sm hover:text-accent transition-colors group">
                  <span className="text-ink-dim group-hover:text-accent">{r.label}</span>
                  <span className={`font-mono text-xs ${r.hot ? "text-accent" : "text-ink-faint"}`}>{r.value}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="section-title mb-4">Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/applications/new" label="Application" Icon={IconApplications} />
              <QuickAction href="/todos" label="Todo" Icon={IconTodos} />
              <QuickAction href="/notes" label="Note" Icon={IconNotes} />
              <QuickAction href="/projects" label="Project" Icon={IconProjects} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function verbOf(created: Date, updated: Date) {
  return Math.abs(new Date(updated).getTime() - new Date(created).getTime()) < 3000 ? "Added" : "Updated";
}

type NextUpProps = {
  nextInterview?: { company: string; role: string; round: number; type: string; scheduledOn: Date | null; appId: string };
  followUp?: { id: string; company: string; role: string; days: number };
  focus?: { id: string; title: string };
  hasData: boolean;
};

function NextUp({ nextInterview, followUp, focus, hasData }: NextUpProps) {
  if (nextInterview) {
    return (
      <Link href={`/applications/${nextInterview.appId}`} className="card-hero block p-7 h-full transition-transform duration-200 hover:-translate-y-0.5">
        <div className="flex items-center gap-2 label text-accent mb-4">
          <IconCalendar /> Next up · interview
        </div>
        <div className="display text-4xl">{nextInterview.company}</div>
        <div className="text-ink-dim text-sm mt-1.5">
          Round {nextInterview.round}
          {nextInterview.type ? ` · ${nextInterview.type}` : ""} — {nextInterview.role}
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-sm">
          <span className="metric text-accent-strong text-lg">{nextInterview.scheduledOn ? dayLabel(nextInterview.scheduledOn) : "TBD"}</span>
          {nextInterview.scheduledOn && (
            <span className="text-ink-faint">
              {new Date(nextInterview.scheduledOn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </Link>
    );
  }
  if (followUp) {
    return (
      <Link href={`/applications/${followUp.id}`} className="card-hero block p-7 h-full transition-transform duration-200 hover:-translate-y-0.5">
        <div className="label text-accent mb-4">Next up · follow up</div>
        <div className="display text-3xl">{followUp.company}</div>
        <div className="text-ink-dim text-sm mt-1.5">{followUp.role}</div>
        <div className="mt-5 text-sm text-ink-dim">
          Waiting <span className="metric text-accent-strong">{followUp.days}</span> day{followUp.days === 1 ? "" : "s"} on a reply — maybe nudge them.
        </div>
      </Link>
    );
  }
  if (focus) {
    return (
      <Link href="/todos" className="card-hero block p-7 h-full transition-transform duration-200 hover:-translate-y-0.5">
        <div className="label text-accent mb-4">Next up · focus</div>
        <div className="display text-2xl leading-snug">{focus.title}</div>
        <div className="mt-5 text-sm text-ink-dim">Your top open todo. Knock it out.</div>
      </Link>
    );
  }
  // onboarding cockpit
  return (
    <div className="card-hero p-7 h-full">
      <div className="label text-accent mb-3">Get started</div>
      <div className="display text-2xl leading-snug">Set up your command center.</div>
      <p className="text-ink-dim text-sm mt-2.5 max-w-md">
        {hasData ? "You're all caught up — add what's next." : "Track where you applied, who you emailed, interviews, offers, projects and todos — all in one place."}
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Link href="/applications/new" className="btn btn-primary text-[13px]">
          <IconApplications /> Add application
        </Link>
        <Link href="/todos" className="btn text-[13px]">
          <IconTodos /> Add todo
        </Link>
        <Link href="/projects" className="btn text-[13px]">
          <IconProjects /> Add project
        </Link>
      </div>
    </div>
  );
}

function CareCard({ score, logged, gaps, streak, smokeFree }: { score: number; logged: boolean; gaps: string[]; streak: number; smokeFree: number }) {
  const tone = scoreTone(score);
  return (
    <Link href="/wellbeing" className="card p-6 block group">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title">Today&apos;s care</div>
        <span className="label group-hover:text-accent transition-colors">check in</span>
      </div>
      <div className="flex items-end gap-3">
        <span className="metric text-4xl" style={{ color: logged ? tone : "var(--ink-faint)" }}>
          {logged ? score : "—"}
        </span>
        <span className="label mb-1.5">/ 100</span>
      </div>
      <div className="h-1 mt-3 rounded-full overflow-hidden" style={{ background: "var(--card-3)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: tone }} />
      </div>
      <p className="text-[13px] text-ink-dim mt-3.5">
        {!logged
          ? "Brushed? Bathed? Ate? Slept? Twenty seconds."
          : gaps.length === 0
          ? "Everything ticked. Rare and worth noticing."
          : `Still open — ${gaps.slice(0, 2).join(", ")}.`}
      </p>
      {(streak > 1 || smokeFree > 2) && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-line-soft">
          {streak > 1 && <span className="label">{streak}-day streak</span>}
          {smokeFree > 2 && <span className="label text-good">{smokeFree}d smoke-free</span>}
        </div>
      )}
    </Link>
  );
}

function Glance({ active, waiting, interviews, offers }: { active: number; waiting: number; interviews: number; offers: number }) {
  const rows = [
    { label: "Active pipeline", value: active, hero: true },
    { label: "Waiting on reply", value: waiting },
    { label: "Interviews ahead", value: interviews },
    { label: "Offers", value: offers, accent: offers > 0 },
  ];
  return (
    <div className="card p-6 h-full flex flex-col justify-center divide-y divide-line-soft">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between py-3 first:pt-0 last:pb-0">
          <span className="label">{r.label}</span>
          <span className={`metric ${r.hero ? "text-3xl" : "text-xl"} ${r.accent ? "text-good" : ""}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function QuickAction({ href, label, Icon }: { href: string; label: string; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-lg border border-line-soft bg-card px-3 py-2.5 text-[13px] text-ink-dim hover:text-ink hover:border-line-strong hover:bg-surface-2 transition-all">
      <Icon className="text-ink-faint group-hover:text-accent transition-colors" />
      {label}
    </Link>
  );
}

function EmptyLine({ title, sub, href, cta }: { title: string; sub: string; href: string; cta: string }) {
  return (
    <div className="text-sm">
      <p className="text-ink">{title}</p>
      <p className="text-ink-faint mt-1">{sub}</p>
      <Link href={href} className="btn btn-primary text-[13px] mt-4">
        {cta}
      </Link>
    </div>
  );
}
