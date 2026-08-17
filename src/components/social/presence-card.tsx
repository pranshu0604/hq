import Link from "next/link";
import { IconArrow } from "@/components/icons";
import type { SocialSummary } from "@/lib/social";
import PresenceTiles from "./presence-tiles";

export default function PresenceCard({ summary }: { summary: SocialSummary }) {
  const remaining = 3 - summary.platformsToday;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-1.5">
        <div className="section-title">Presence</div>
        <Link href="/social" className="label hover:text-accent transition-colors flex items-center gap-1">
          log <IconArrow />
        </Link>
      </div>

      <p className="text-xs text-ink-faint mb-4">
        {summary.sweep
          ? "Full sweep today. Nothing left to prove."
          : summary.today === 0
          ? "Were you visible today? Tap when you post."
          : `${remaining} more platform${remaining === 1 ? "" : "s"} for the sweep.`}
      </p>

      <div className="-mx-6">
        <PresenceTiles counts={summary.todayByPlatform} variant="compact" />
      </div>

      <div className="flex items-center justify-between mt-3.5">
        <span className="label">
          <span className={summary.streak > 0 ? "" : "opacity-40"}>🔥</span> {summary.streak} day streak
        </span>
        <span className={`label ${summary.sweep ? "text-accent" : ""}`}>
          {summary.platformsToday}/3 today
        </span>
      </div>
    </div>
  );
}
