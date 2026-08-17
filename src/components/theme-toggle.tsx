"use client";

import { useSyncExternalStore } from "react";
import { IconSun, IconMoon } from "@/components/icons";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : systemTheme();
}

function subscribe(cb: () => void) {
  window.addEventListener("hq-theme", cb);
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener("hq-theme", cb);
    mq.removeEventListener("change", cb);
  };
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as Theme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("hq-theme", next);
    } catch {}
    window.dispatchEvent(new Event("hq-theme"));
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      suppressHydrationWarning
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-[13px] text-ink-dim hover:text-ink hover:bg-card transition-all duration-200"
    >
      <span className="text-ink-faint" suppressHydrationWarning>
        {isDark ? <IconMoon /> : <IconSun />}
      </span>
      <span suppressHydrationWarning>{isDark ? "Dark" : "Light"} mode</span>
    </button>
  );
}
