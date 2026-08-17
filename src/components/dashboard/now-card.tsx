"use client";

// NOW — the single authoritative "what am I doing right now". Reads/writes the
// shared /api/now contract (same one the desktop beacon uses), ticks the
// countdown locally between polls, and can start straight from a top todo.
import { useCallback, useEffect, useRef, useState } from "react";
import ActivationLadder from "@/components/dashboard/activation-ladder";

type NowState = {
  id: string;
  label: string;
  kind: string; // FOCUS | CULTURE
  goal: string;
  nextAction: string;
  todoId: string | null;
  projectId: string | null;
  plannedMin: number;
  startedAt: string;
  endsAt: string;
  paused: boolean;
  remainingMs: number;
  done: boolean;
  status: string;
};

type TopTodo = { id: string; title: string };

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

function liveRemaining(now: NowState) {
  return now.paused ? Math.max(0, now.remainingMs) : Math.max(0, new Date(now.endsAt).getTime() - Date.now());
}

export default function NowCard({ initialNow, topTodos }: { initialNow: NowState | null; topTodos: TopTodo[] }) {
  const [now, setNow] = useState<NowState | null>(initialNow);
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/now", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      setNow(data.now ?? null);
    } catch {
      /* server may be mid-restart — keep last state */
    } finally {
      setBusy(false);
    }
  }, []);

  // poll the shared state so sessions started from the desktop beacon show here
  useEffect(() => {
    async function pull() {
      try {
        const res = await fetch("/api/now", { cache: "no-store" });
        const data = await res.json();
        setNow(data.now ?? null);
      } catch {
        /* ignore */
      }
    }
    pollRef.current = setInterval(pull, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // 1s tick just to re-render the countdown between polls
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const start = (l: string, mins: number, todoId?: string, kind: "FOCUS" | "CULTURE" = "FOCUS") => {
    const name = l.trim();
    if (!name) return;
    post({ action: "start", label: name, minutes: mins, todoId: todoId ?? null, kind });
    setLabel("");
  };

  // ---- active session ----
  if (now && now.status === "ACTIVE") {
    const rem = liveRemaining(now);
    const done = !now.paused && rem <= 0;
    const isCulture = now.kind === "CULTURE";
    const frac = now.plannedMin > 0 ? Math.min(1, rem / (now.plannedMin * 60_000)) : 0;
    const tone = done ? "var(--accent)" : now.paused ? "var(--ink-faint)" : "var(--ink)";
    return (
      <section className="card-hero p-7">
        <div className="flex items-center justify-between mb-4">
          <div className="eyebrow text-accent">
            {isCulture ? "CULTURE · enjoy it" : "NOW"}
            {now.paused ? " · paused" : done ? (isCulture ? " · still going?" : " · time's up") : ""}
          </div>
          {!isCulture && now.nextAction ? <div className="label">next: {now.nextAction}</div> : null}
        </div>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="display text-3xl leading-tight truncate">{now.label}</div>
            {isCulture ? (
              <div className="text-ink-dim text-sm mt-1.5">This is yours. No timer guilt — the clock is just a gentle nudge.</div>
            ) : now.goal ? (
              <div className="text-ink-dim text-sm mt-1.5">{now.goal}</div>
            ) : null}
          </div>
          <div className="metric tabular-nums" style={{ fontSize: "44px", lineHeight: 1, color: tone }}>
            {done ? "done" : fmt(rem)}
          </div>
        </div>

        <div className="track h-1.5 mt-5">
          <span style={{ width: `${frac * 100}%`, background: done ? "var(--accent)" : "var(--accent)" }} />
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          {!done && (
            <button disabled={busy} onClick={() => post({ action: "pause" })} className="btn text-[13px]">
              {now.paused ? "Resume" : "Pause"}
            </button>
          )}
          <button disabled={busy} onClick={() => post({ action: "finish", status: "DONE" })} className="btn btn-primary text-[13px]">
            {done ? "Clear" : "Finish"}
          </button>
          {done && (
            <button disabled={busy} onClick={() => start(now.label, 10, now.todoId ?? undefined)} className="btn text-[13px]">
              +10 min
            </button>
          )}
          {!done && (
            <button disabled={busy} onClick={() => post({ action: "finish", status: "ABANDONED" })} className="btn text-[13px] text-ink-faint">
              Drop
            </button>
          )}
        </div>
      </section>
    );
  }

  // ---- idle: start something ----
  return (
    <section className="card-hero p-7">
      <div className="eyebrow text-accent mb-4">NOW</div>
      <div className="display text-2xl leading-snug">Nothing running.</div>
      <p className="text-ink-dim text-sm mt-2">What are you doing? One thing, one timer.</p>

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start(label, minutes)}
          placeholder="e.g. DSA — binary trees"
          className="field-input flex-1 min-w-[220px]"
        />
        <input
          type="number"
          value={minutes}
          min={1}
          max={600}
          onChange={(e) => setMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 25)))}
          className="field-input w-20"
          aria-label="minutes"
        />
        <span className="label">min</span>
        <button disabled={busy || !label.trim()} onClick={() => start(label, minutes)} className="btn btn-primary text-[13px]">
          Start
        </button>
      </div>
      {minutes > 0 && minutes < 20 && <p className="label mt-2 text-ink-faint">round up — things take longer than they look.</p>}

      <div className="mt-2">
        <ActivationLadder label={label} />
      </div>

      {topTodos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line-soft">
          <div className="label mb-2.5">or start on a top todo</div>
          <div className="flex flex-wrap gap-2">
            {topTodos.slice(0, 4).map((t) => (
              <button
                key={t.id}
                disabled={busy}
                onClick={() => start(t.title, 25, t.id)}
                className="text-[13px] text-ink-dim border border-line-soft rounded-lg px-3 py-1.5 hover:text-ink hover:border-line-strong hover:bg-surface-2 transition-all max-w-[240px] truncate"
                title={t.title}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-line-soft flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13px] text-ink-dim">Done working? Enjoy the internet on purpose.</div>
          <div className="label mt-1 text-ink-faint">Don&apos;t optimize the humanity out of your life.</div>
        </div>
        <button disabled={busy} onClick={() => start("Culture", 45, undefined, "CULTURE")} className="btn text-[13px]">
          Enter Culture mode
        </button>
      </div>

      <p className="label mt-4 text-ink-faint">⌥⌘N to start · ⌥⌘K capture · ⌥⌘O overwhelmed · ⌥⌘Y culture — from anywhere.</p>
    </section>
  );
}
