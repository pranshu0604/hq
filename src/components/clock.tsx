"use client";

import { useSyncExternalStore } from "react";
import { getNow } from "@/lib/format";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

export default function Clock() {
  const ms = useSyncExternalStore(subscribe, getNow, () => 0);
  const time = ms
    ? new Date(ms).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <span suppressHydrationWarning className="metric text-sm text-ink-dim tracking-tight">
      {time} <span className="text-ink-faint">IST</span>
    </span>
  );
}
