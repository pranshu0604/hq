"use client";

import { useTransition } from "react";
import { logSocial, type LogResult } from "@/app/social/actions";
import { burst } from "@/components/game/confetti";
import { addToast } from "@/components/game/toast-store";
import { IconInstagram, IconLinkedIn, IconX } from "@/components/icons";
import { PLATFORMS, type PlatformKey } from "@/lib/social";

const GLYPH: Record<PlatformKey, React.ComponentType<{ className?: string }>> = {
  X: IconX,
  LINKEDIN: IconLinkedIn,
  INSTAGRAM: IconInstagram,
};

export function celebrateLog(r: LogResult, platformLabel: string) {
  if (r.sweep) {
    burst("big");
    addToast({ emoji: "🎭", title: "Full sweep", body: "All three platforms today. That's the whole point." });
    return;
  }
  if (r.firstToday) {
    burst("small");
    addToast({
      emoji: "📣",
      title: "You showed up",
      body: r.streak > 1 ? `${r.streak}-day presence streak` : "Day one. Come back tomorrow.",
    });
    return;
  }
  if (r.firstOnPlatform) {
    burst("small");
    addToast({ emoji: "✳️", title: platformLabel, body: `${3 - r.platformsToday} more platform${3 - r.platformsToday === 1 ? "" : "s"} for the sweep` });
    return;
  }
  addToast({ emoji: "＋", title: "+4 XP", body: `${r.today} interactions today` });
}

export default function PresenceTiles({
  counts,
  variant = "hero",
}: {
  counts: Record<string, number>;
  variant?: "hero" | "compact";
}) {
  const [pending, start] = useTransition();

  const tap = (platform: PlatformKey, label: string) =>
    start(async () => {
      const r = await logSocial(platform);
      if (r) celebrateLog(r, label);
    });

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-3 gap-px bg-line-soft border-y border-line-soft">
        {PLATFORMS.map((p) => {
          const Glyph = GLYPH[p.key];
          const n = counts[p.key] ?? 0;
          return (
            <button
              key={p.key}
              onClick={() => tap(p.key, p.label)}
              disabled={pending}
              title={`Log a ${p.label} interaction`}
              className="group bg-card hover:bg-surface-2 disabled:opacity-60 transition-colors py-3.5 flex flex-col items-center gap-1.5"
            >
              <Glyph className={`h-[17px] w-[17px] transition-colors ${n ? "text-accent" : "text-ink-faint group-hover:text-ink"}`} />
              <span className={`metric text-sm ${n ? "text-ink" : "text-ink-faint"}`}>{n}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 border-t border-line-soft divide-x divide-line-soft">
      {PLATFORMS.map((p) => {
        const Glyph = GLYPH[p.key];
        const n = counts[p.key] ?? 0;
        return (
          <button
            key={p.key}
            onClick={() => tap(p.key, p.label)}
            disabled={pending}
            className="group text-left px-5 py-5 disabled:opacity-60 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center justify-between gap-3">
              <Glyph className={`h-[18px] w-[18px] transition-colors ${n ? "text-accent" : "text-ink-faint group-hover:text-ink"}`} />
              <span className={`metric text-2xl leading-none ${n ? "text-ink" : "text-ink-faint"}`}>{n}</span>
            </div>
            <div className="mt-3 text-[13px] text-ink">{p.label}</div>
            <div className="text-[11px] text-ink-faint mt-0.5">{n ? "logged today" : p.hint}</div>
            <span className="mt-3.5 block h-[3px] w-full overflow-hidden" style={{ background: "var(--card-3)" }}>
              <span
                className={`block h-full origin-left bg-accent transition-transform duration-500 ease-out ${n ? "scale-x-100" : "scale-x-0"}`}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
