"use client";

import { useEffect } from "react";
import type { GameState } from "@/lib/gamification";
import { burst } from "./confetti";
import { addToast } from "./toast-store";

type Snapshot = { appCount: number; level: number; ids: string[]; tierDay: string | null; tierIdx: number };
type Intensity = "small" | "big" | "epic";

const KEY = "hq-game";
const RANK: Record<Intensity, number> = { small: 1, big: 2, epic: 3 };

function stronger(a: Intensity | null, b: Intensity): Intensity {
  if (!a) return b;
  return RANK[b] > RANK[a] ? b : a;
}

export default function CelebrationEngine({ state }: { state: GameState }) {
  const sig = `${state.level}|${state.unlockedIds.join(",")}|${state.applicationCount}|${state.dailyTierIndex}|${state.applicationsToday}|${state.todayKey}`;

  useEffect(() => {
    let prev: Snapshot | null = null;
    try {
      prev = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {}

    const prevTierIdx = prev && prev.tierDay === state.todayKey ? prev.tierIdx ?? -1 : -1;
    const nextSnap: Snapshot = {
      appCount: state.applicationCount,
      level: state.level,
      ids: state.unlockedIds,
      tierDay: state.todayKey,
      tierIdx: Math.max(state.dailyTierIndex, prevTierIdx),
    };

    // first ever load — snapshot current progress without a celebration barrage
    if (!prev) {
      localStorage.setItem(KEY, JSON.stringify(nextSnap));
      return;
    }

    const newIds = state.unlockedIds.filter((id) => !(prev!.ids || []).includes(id));
    const leveledUp = state.level > (prev.level ?? 1);
    const appDelta = state.applicationCount - (prev.appCount ?? 0);
    const tierCrossed = state.dailyTierIndex > prevTierIdx;

    let heavy: Intensity | null = null;

    for (const id of newIds) {
      const a = state.achievements.find((x) => x.id === id);
      if (!a) continue;
      addToast({ emoji: a.emoji, title: "Achievement unlocked", body: a.title });
      heavy = stronger(heavy, id === "offer" ? "epic" : "big");
    }

    if (leveledUp) {
      addToast({ emoji: "⭐", title: `Level ${state.level}`, body: state.levelName });
      heavy = stronger(heavy, "big");
    }

    if (tierCrossed) {
      const tier = state.dailyTiers[state.dailyTierIndex];
      addToast({ emoji: tier.emoji, title: `Daily · ${tier.label}`, body: `${state.applicationsToday} applications today` });
      heavy = stronger(heavy, tier.burst);
    }

    // plain effort feedback — only when nothing bigger already fired
    if (appDelta > 0 && newIds.length === 0 && !leveledUp && !tierCrossed) {
      addToast({ emoji: "＋", title: `+${appDelta * 10} XP`, body: appDelta === 1 ? "Application logged" : `${appDelta} applications logged` });
    }

    if (heavy) burst(heavy);
    else if (appDelta > 0) burst("small");

    localStorage.setItem(KEY, JSON.stringify(nextSnap));
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
