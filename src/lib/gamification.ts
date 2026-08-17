import { prisma } from "@/lib/prisma";
import { swr } from "@/lib/cache";
import { getNow } from "@/lib/format";
import { dayKey } from "@/lib/insights";
import { summarize } from "@/lib/social";
import { isCleanDay, isLogged, NUTRIENT_TARGET, proteinOf, summarize as summarizeHealth, type DayRow , toDayRow} from "@/lib/wellbeing";
import { getProfileState } from "@/lib/profile";

export const DAILY_GOAL = 3;

// tiered daily goals — a blitz day should be celebrated harder than the base goal
export const DAILY_TIERS: { count: number; label: string; emoji: string; burst: "small" | "big" | "epic" }[] = [
  { count: 3, label: "Daily goal", emoji: "🎯", burst: "small" },
  { count: 5, label: "On a roll", emoji: "🔥", burst: "small" },
  { count: 8, label: "Heater", emoji: "⚡", burst: "big" },
  { count: 12, label: "Blitz", emoji: "🚀", burst: "big" },
  { count: 18, label: "Relentless", emoji: "💥", burst: "epic" },
  { count: 25, label: "Machine", emoji: "🏆", burst: "epic" },
];

// XP is earned for EFFORT (things you control), not outcomes (which are sparse early)
const XP = {
  application: 10,
  draft: 2, // starting a form is worth something — finishing it is worth more

  platform: 3,
  email: 2,
  interview: 40,
  response: 20,
  offer: 150,
  project: 8,
  taskDone: 4,
  todoDone: 3,
  note: 2,
  social: 4,
  socialSweep: 8,
  quote: 3,
  workout: 12,
  interaction: 5,
  person: 5,
  company: 10,
  workDone: 5,
  healthDay: 6,
  cleanDay: 4,
  smokeFreeDay: 3,
  restedDay: 3,
};

const LEVELS = [
  { min: 0, name: "Getting set up" },
  { min: 60, name: "Warming up" },
  { min: 160, name: "On the hunt" },
  { min: 360, name: "In the arena" },
  { min: 700, name: "Building momentum" },
  { min: 1200, name: "Relentless" },
  { min: 2000, name: "On a tear" },
  { min: 3200, name: "Unstoppable" },
  { min: 5000, name: "Force of nature" },
  { min: 8000, name: "Legend" },
];

type Facts = {
  appCount: number;
  parked: number;
  responded: number;
  interviews: number;
  offers: number;
  platforms: number;
  channels: number;
  emails: number;
  shipped: number;
  tasksDone: number;
  todosDone: number;
  streak: number;
  social: number;
  socialSweeps: number;
  socialStreak: number;
  quotes: number;
  workouts: number;
  gymStreak: number;
  interactions: number;
  people: number;
  companies: number;
  workDone: number;
  notes: number;
  reflections: number;
  projects: number;
  todos: number;
  healthDays: number;
  careStreak: number;
  hygieneStreak: number;
  smokeFreeStreak: number;
  smokeFreeDays: number;
  cleanDays: number;
  restedDays: number;
  alignedDays: number;
  nourishedDays: number;
  bestCare: number;
  hydratedDays: number;
  hydrationStreak: number;
  proteinDays: number;
  roomCleans: number;
  beardTrims: number;
};

export type Achievement = { id: string; title: string; desc: string; emoji: string; unlocked: boolean };

const ACHIEVEMENTS: { id: string; title: string; desc: string; emoji: string; test: (f: Facts) => boolean }[] = [
  { id: "first", title: "First step", desc: "Log your first application", emoji: "🎯", test: (f) => f.appCount >= 1 },
  { id: "ten", title: "Double digits", desc: "10 applications out", emoji: "🔟", test: (f) => f.appCount >= 10 },
  { id: "twentyfive", title: "Quarter century", desc: "25 applications out", emoji: "⚡", test: (f) => f.appCount >= 25 },
  { id: "fifty", title: "Half century", desc: "50 applications out", emoji: "🔥", test: (f) => f.appCount >= 50 },
  { id: "hundred", title: "Century", desc: "100 applications out", emoji: "💯", test: (f) => f.appCount >= 100 },
  { id: "twohundred", title: "Double century", desc: "200 applications out", emoji: "🚀", test: (f) => f.appCount >= 200 },
  { id: "grind", title: "The grind", desc: "350 applications — the real target", emoji: "🏔️", test: (f) => f.appCount >= 350 },
  { id: "warm", title: "Warm lead", desc: "Land your first response", emoji: "📬", test: (f) => f.responded >= 1 },
  { id: "room", title: "In the room", desc: "Log your first interview", emoji: "🎤", test: (f) => f.interviews >= 1 },
  { id: "offer", title: "The offer", desc: "Get an offer on the table", emoji: "🏆", test: (f) => f.offers >= 1 },
  { id: "streak7", title: "On fire", desc: "7-day activity streak", emoji: "🔥", test: (f) => f.streak >= 7 },
  { id: "streak30", title: "Ironclad", desc: "30-day activity streak", emoji: "🛡️", test: (f) => f.streak >= 30 },
  { id: "channels", title: "Multi-channel", desc: "Apply across 3+ platforms", emoji: "📡", test: (f) => f.channels >= 3 },
  { id: "networker", title: "Networker", desc: "Log 10 outreach emails", emoji: "✉️", test: (f) => f.emails >= 10 },
  { id: "shipper", title: "Shipper", desc: "Ship a side project", emoji: "📦", test: (f) => f.shipped >= 1 },
  { id: "taskmaster", title: "Task master", desc: "Complete 25 project tasks", emoji: "✅", test: (f) => f.tasksDone >= 25 },
  { id: "voice", title: "Found your voice", desc: "Log your first social interaction", emoji: "📣", test: (f) => f.social >= 1 },
  { id: "sweep", title: "Full sweep", desc: "X, LinkedIn and Instagram in one day", emoji: "🎭", test: (f) => f.socialSweeps >= 1 },
  { id: "presence", title: "Always on", desc: "7-day presence streak", emoji: "📡", test: (f) => f.socialStreak >= 7 },
  { id: "amplified", title: "Amplified", desc: "50 social interactions", emoji: "📈", test: (f) => f.social >= 50 },
  { id: "curator", title: "Curator", desc: "Save your first quote", emoji: "📖", test: (f) => f.quotes >= 1 },
  { id: "commonplace", title: "Commonplace", desc: "Collect 25 quotes & poems", emoji: "📚", test: (f) => f.quotes >= 25 },
  { id: "firstlift", title: "First rep", desc: "Log your first workout", emoji: "🏋️", test: (f) => f.workouts >= 1 },
  { id: "consistent", title: "Consistent", desc: "7-day training streak", emoji: "💪", test: (f) => f.gymStreak >= 7 },
  { id: "connector", title: "Connector", desc: "Log your first touchpoint", emoji: "🤝", test: (f) => f.interactions >= 1 },
  { id: "network", title: "Inner circle", desc: "Track 10 people", emoji: "👥", test: (f) => f.people >= 10 },
  { id: "gig", title: "On the books", desc: "Add your first work engagement", emoji: "💼", test: (f) => f.companies >= 1 },
  { id: "delivered", title: "Delivered", desc: "Ship 25 work items", emoji: "🚢", test: (f) => f.workDone >= 25 },
  { id: "scribe", title: "Scribe", desc: "Write your first note", emoji: "📝", test: (f) => f.notes >= 1 },
  { id: "journal", title: "Journal keeper", desc: "Keep 25 notes", emoji: "🗂️", test: (f) => f.notes >= 25 },
  { id: "thinker", title: "Thinker", desc: "Start your first dialectic", emoji: "☯️", test: (f) => f.reflections >= 1 },
  { id: "philosopher", title: "Philosopher", desc: "Hold 10 dialectics in tension", emoji: "🧠", test: (f) => f.reflections >= 10 },
  { id: "builder", title: "Builder", desc: "Start your first project", emoji: "🔨", test: (f) => f.projects >= 1 },
  { id: "doer", title: "Doer", desc: "Complete 25 todos", emoji: "✔️", test: (f) => f.todos >= 25 },
  { id: "freshstart", title: "Fresh start", desc: "Log your first wellbeing day", emoji: "🪥", test: (f) => f.healthDays >= 1 },
  { id: "kept", title: "Kept the temple", desc: "30 days of wellbeing logged", emoji: "🧘", test: (f) => f.healthDays >= 30 },
  { id: "hundreddays", title: "Hundred days", desc: "100 days of wellbeing logged", emoji: "🌱", test: (f) => f.healthDays >= 100 },
  { id: "spotless", title: "Spotless", desc: "7-day hygiene streak — brushed twice, bathed", emoji: "🚿", test: (f) => f.hygieneStreak >= 7 },
  { id: "wellrested", title: "Well rested", desc: "25 nights of 7–9 hours", emoji: "😴", test: (f) => f.restedDays >= 25 },
  { id: "inrhythm", title: "In rhythm", desc: "10 days aligned with a healthy circadian rhythm", emoji: "🕰️", test: (f) => f.alignedDays >= 10 },
  { id: "cleanplate", title: "Clean plate", desc: "10 junk-free days", emoji: "🥗", test: (f) => f.cleanDays >= 10 },
  { id: "nourished", title: "Nourished", desc: "Hit your nutrient target on 10 days", emoji: "🥦", test: (f) => f.nourishedDays >= 10 },
  { id: "clearlungs", title: "Clear lungs", desc: "7 days smoke-free", emoji: "🌬️", test: (f) => f.smokeFreeStreak >= 7 },
  { id: "unhooked", title: "Unhooked", desc: "30 days smoke-free", emoji: "🎗️", test: (f) => f.smokeFreeStreak >= 30 },
  { id: "perfectday", title: "Perfect day", desc: "Score 95+ on a day's care", emoji: "✨", test: (f) => f.bestCare >= 95 },
  { id: "hydrated", title: "Hydrated", desc: "Hit your water target 10 days", emoji: "💧", test: (f) => f.hydratedDays >= 10 },
  { id: "watertight", title: "Watertight", desc: "7 days straight on your water target", emoji: "🌊", test: (f) => f.hydrationStreak >= 7 },
  { id: "fuelled", title: "Fuelled", desc: "Hit your protein target 10 days", emoji: "🍗", test: (f) => f.proteinDays >= 10 },
  { id: "tidy", title: "Tidy", desc: "Clean your room 10 times", emoji: "🧹", test: (f) => f.roomCleans >= 10 },
  { id: "sharp", title: "Sharp", desc: "10 beard trims on schedule", emoji: "✂️", test: (f) => f.beardTrims >= 10 },
];

function encouragement(f: Facts, appsToday: number, socialToday: number): string {
  if (f.parked >= 3) return `${f.parked} forms parked half-done. Pick the closest one and just send it.`;
  if (appsToday >= 18) return `${appsToday} applications today. Absolute machine — this is a blitz.`;
  if (appsToday >= 8) return `${appsToday} out today. You're on a serious tear.`;
  if (f.appCount === 0) return "Every offer starts with one application. Fire the first shot.";
  if (f.offers > 0) return "You've got an offer in hand. Negotiate from strength.";
  if (f.streak >= 7) return `${f.streak}-day streak. This is exactly how it's done.`;
  if (f.responded === 0 && f.appCount > 0) return "No replies yet? Completely normal this early — volume is the strategy. Keep firing.";
  if (appsToday >= DAILY_GOAL && socialToday === 0)
    return "Daily goal in the bag. Now go be visible — one post or one reply.";
  if (appsToday >= DAILY_GOAL) return "Daily goal in the bag. Every one past this compounds.";
  if (f.socialStreak >= 5) return `${f.socialStreak} days of showing up online. People are starting to notice.`;
  if (f.smokeFreeStreak >= 7) return `${f.smokeFreeStreak} days smoke-free. Your lungs are keeping score too.`;
  if (f.careStreak >= 7) return `${f.careStreak} days of looking after yourself. The boring habits are the ones that hold.`;
  if (f.streak >= 3) return `${f.streak} days running. Momentum is a muscle — don't skip today.`;
  return "Most of these won't reply. That's the game, not a verdict. Keep going.";
}

export type GameState = {
  xp: number;
  level: number;
  levelName: string;
  xpIntoLevel: number;
  xpForLevel: number | null;
  nextLevelName: string | null;
  applicationCount: number;
  applicationsToday: number;
  parked: number;
  dailyGoal: number;
  dailyTiers: { count: number; label: string; emoji: string; burst: "small" | "big" | "epic" }[];
  dailyTierIndex: number;
  streak: number;
  longestStreak: number;
  socialToday: number;
  socialStreak: number;
  socialPlatformsToday: number;
  achievements: Achievement[];
  unlockedIds: string[];
  encouragement: string;
  todayKey: string;
};

function streakOf(events: Date[], nowMs: number) {
  const active = new Set(events.map((e) => dayKey(new Date(e))));
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  let cur = 0;
  const walk = new Date(today);
  if (!active.has(dayKey(walk))) walk.setDate(walk.getDate() - 1);
  while (active.has(dayKey(walk))) {
    cur++;
    walk.setDate(walk.getDate() - 1);
  }
  return cur;
}

// cached (stale-while-revalidate) because it's called from the LAYOUT on every
// page and does ~13 deep-relation queries. 30s staleness on XP/level is fine.
export async function getGameState(): Promise<GameState> {
  return swr("game", 30_000, computeGameState);
}

async function computeGameState(): Promise<GameState> {
  const [applications, projects, notes, todos, socialLogs, quotes, workouts, people, interactions, companies, workItems, reflections, healthRaw] = await Promise.all([
    prisma.application.findMany({ include: { platforms: { include: { emails: true } }, interviews: true } }),
    prisma.project.findMany({ include: { tasks: true } }),
    prisma.note.findMany(),
    prisma.todo.findMany(),
    prisma.socialLog.findMany({ select: { platform: true, createdAt: true } }),
    prisma.quote.findMany({ select: { createdAt: true } }),
    prisma.workout.findMany({ select: { date: true } }),
    prisma.person.findMany({ select: { createdAt: true } }),
    prisma.interaction.findMany({ select: { date: true } }),
    prisma.company.findMany({ select: { createdAt: true } }),
    prisma.workItem.findMany({ select: { bucket: true, createdAt: true } }),
    prisma.reflection.findMany({ select: { createdAt: true } }),
    prisma.healthDay.findMany({ include: { meals: { select: { id: true, label: true, junkLevel: true, calories: true, proteinG: true, sodiumMg: true, sugarG: true, timeMin: true } }, sleeps: true } }),
  ]);

  const nowMs = getNow();
  const social = summarize(socialLogs, nowMs);

  const { targets } = await getProfileState(nowMs);
  const healthDays: DayRow[] = healthRaw.map(toDayRow);
  const loggedDays = healthDays.filter(isLogged);
  const health = summarizeHealth(healthDays, targets, nowMs);
  const gymStreak = streakOf(workouts.map((w) => w.date), nowMs);
  const startToday = new Date(nowMs);
  startToday.setHours(0, 0, 0, 0);

  // a parked draft isn't an application — it hasn't gone anywhere yet
  const submitted = applications.filter((a) => a.status !== "PENDING");
  const parked = applications.filter((a) => a.status === "PENDING");
  const sentAt = (a: (typeof applications)[number]) => a.submittedAt ?? a.createdAt;

  const events: Date[] = [
    ...applications.map((a) => a.createdAt), // starting a draft is still activity
    ...submitted.map(sentAt),
    ...applications.flatMap((a) => a.platforms.map((p) => p.appliedOn)),
    ...applications.flatMap((a) => a.platforms.flatMap((p) => p.emails.map((e) => e.sentOn))),
    ...applications.flatMap((a) => a.interviews.map((iv) => iv.createdAt)),
    ...projects.map((p) => p.createdAt),
    ...projects.flatMap((p) => p.tasks.map((t) => t.createdAt)),
    ...notes.map((n) => n.createdAt),
    ...todos.map((t) => t.createdAt),
    ...socialLogs.map((s) => s.createdAt),
    ...quotes.map((q) => q.createdAt),
    ...workouts.map((w) => w.date),
    ...interactions.map((i) => i.date),
    ...people.map((p) => p.createdAt),
    ...workItems.map((w) => w.createdAt),
    ...companies.map((c) => c.createdAt),
    ...reflections.map((r) => r.createdAt),
    ...loggedDays.map((d) => new Date(d.date)),
  ];

  const platformsAll = applications.flatMap((a) => a.platforms);
  const emailsAll = platformsAll.flatMap((p) => p.emails);
  const tasksAll = projects.flatMap((p) => p.tasks);

  const facts: Facts = {
    appCount: submitted.length,
    parked: parked.length,
    responded: submitted.filter(
      (a) => a.platforms.some((p) => p.responseReceived) || ["RESPONSE", "INTERVIEWING", "OFFER"].includes(a.status)
    ).length,
    interviews: applications.reduce((n, a) => n + a.interviews.length, 0),
    offers: applications.filter((a) => a.status === "OFFER").length,
    platforms: platformsAll.length,
    channels: new Set(platformsAll.map((p) => p.platform.trim().toLowerCase())).size,
    emails: emailsAll.length,
    shipped: projects.filter((p) => p.status === "SHIPPED").length,
    tasksDone: tasksAll.filter((t) => t.done).length,
    todosDone: todos.filter((t) => t.done).length,
    streak: streakOf(events, nowMs),
    social: social.total,
    socialSweeps: social.sweepDays,
    socialStreak: social.streak,
    quotes: quotes.length,
    workouts: workouts.length,
    gymStreak,
    interactions: interactions.length,
    people: people.length,
    companies: companies.length,
    workDone: workItems.filter((w) => w.bucket === "DONE").length,
    notes: notes.length,
    reflections: reflections.length,
    projects: projects.length,
    todos: todos.filter((t) => t.done).length,
    healthDays: loggedDays.length,
    careStreak: health.streak,
    hygieneStreak: health.perfectHygieneStreak,
    smokeFreeStreak: health.smokeFreeStreak,
    smokeFreeDays: health.smokeFreeDays,
    cleanDays: loggedDays.filter(isCleanDay).length,
    restedDays: health.restedDays,
    alignedDays: health.alignedDays,
    nourishedDays: loggedDays.filter((d) => d.nutrients.length >= NUTRIENT_TARGET).length,
    bestCare: health.bestScore,
    hydratedDays: health.hydratedDays,
    hydrationStreak: health.hydrationStreak,
    proteinDays: loggedDays.filter((d) => proteinOf(d) >= targets.proteinG).length,
    roomCleans: health.roomCleans,
    beardTrims: health.beardTrims,
  };

  const xp =
    facts.appCount * XP.application +
    facts.parked * XP.draft +
    facts.platforms * XP.platform +
    facts.emails * XP.email +
    facts.interviews * XP.interview +
    facts.responded * XP.response +
    facts.offers * XP.offer +
    projects.length * XP.project +
    facts.tasksDone * XP.taskDone +
    facts.todosDone * XP.todoDone +
    notes.length * XP.note +
    facts.social * XP.social +
    facts.socialSweeps * XP.socialSweep +
    facts.quotes * XP.quote +
    facts.workouts * XP.workout +
    facts.interactions * XP.interaction +
    facts.people * XP.person +
    facts.companies * XP.company +
    facts.workDone * XP.workDone +
    facts.healthDays * XP.healthDay +
    facts.cleanDays * XP.cleanDay +
    facts.smokeFreeDays * XP.smokeFreeDay +
    facts.restedDays * XP.restedDay;

  let li = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) li = i;
  const floor = LEVELS[li].min;
  const next = LEVELS[li + 1];

  const achievements: Achievement[] = ACHIEVEMENTS.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.desc,
    emoji: a.emoji,
    unlocked: a.test(facts),
  }));

  // counts the day you SENT it, not the day you started the draft
  const applicationsToday = submitted.filter((a) => new Date(sentAt(a)) >= startToday).length;

  let dailyTierIndex = -1;
  for (let i = 0; i < DAILY_TIERS.length; i++) if (applicationsToday >= DAILY_TIERS[i].count) dailyTierIndex = i;

  return {
    xp,
    level: li + 1,
    levelName: LEVELS[li].name,
    xpIntoLevel: xp - floor,
    xpForLevel: next ? next.min - floor : null,
    nextLevelName: next ? next.name : null,
    applicationCount: facts.appCount,
    applicationsToday,
    parked: facts.parked,
    dailyGoal: DAILY_GOAL,
    dailyTiers: DAILY_TIERS,
    dailyTierIndex,
    streak: facts.streak,
    longestStreak: facts.streak,
    socialToday: social.today,
    socialStreak: social.streak,
    socialPlatformsToday: social.platformsToday,
    achievements,
    unlockedIds: achievements.filter((a) => a.unlocked).map((a) => a.id),
    encouragement: encouragement(facts, applicationsToday, social.today),
    todayKey: dayKey(startToday),
  };
}
