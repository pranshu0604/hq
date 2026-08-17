"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { HqMark } from "@/components/logo";
import QuickCreate from "@/components/quick-create";
import InstallButton from "@/components/install-button";
import NotifyButton from "@/components/notify-button";
import { IconAssistant } from "@/components/icons";

type NavItem = { n: string; href: string; label: string };
type NavGroup = { heading?: string; items: NavItem[] };

// numbers double as each page's section index (the eyebrow "01 · …").
const GROUPS: NavGroup[] = [
  { items: [{ n: "00", href: "/", label: "Overview" }, { n: "13", href: "/state", label: "Life state" }, { n: "14", href: "/inbox", label: "Inbox · Tasks" }] },
  {
    heading: "Career",
    items: [
      { n: "01", href: "/applications", label: "Applications" },
      { n: "02", href: "/work", label: "Work" },
      { n: "03", href: "/projects", label: "Projects" },
      { n: "04", href: "/social", label: "Social" },
    ],
  },
  {
    heading: "Mind",
    items: [
      { n: "05", href: "/reflections", label: "Reflections" },
      { n: "06", href: "/notes", label: "Notes" },
      { n: "07", href: "/quotes", label: "Quotes" },
      { n: "15", href: "/decisions", label: "Decisions" },
      { n: "17", href: "/manual", label: "Manual" },
    ],
  },
  {
    heading: "Life",
    items: [
      { n: "08", href: "/people", label: "People" },
      { n: "18", href: "/reframe", label: "Reality check" },
      { n: "09", href: "/gym", label: "Gym" },
      { n: "10", href: "/wellbeing", label: "Wellbeing" },
    ],
  },
  { items: [{ n: "12", href: "/insights", label: "Insights" }, { n: "16", href: "/review", label: "Review" }] },
];

export default function Sidebar({ level = 1, levelName = "", xpPct = 0 }: { level?: number; levelName?: string; xpPct?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll while the drawer is open on mobile
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const panel = (
    <>
      {/* masthead */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <HqMark className="h-9 w-9 shrink-0 rounded-[9px] shadow-[0_3px_12px_-3px_var(--accent)]" />
          <div className="leading-tight min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold tracking-tight leading-none">HQ</span>
              <span className="label text-[8px] text-ink-faint/70">field manual</span>
            </div>
            <div className="label text-[9px] truncate mt-1" title={`Level ${level} · ${levelName}`}>
              Pranshu · Lv {level}
            </div>
          </div>
        </div>
        <div className="track h-1 mt-3" title={`${xpPct}% to next level`}>
          <span style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="px-3 pb-2">
        <QuickCreate />
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/assistant"
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
            isActive("/assistant")
              ? "bg-accent text-[color:var(--accent-ink)]"
              : "border border-accent/40 text-accent hover:bg-selected"
          }`}
        >
          <IconAssistant className="w-4 h-4" />
          Assistant
        </Link>
      </div>

      {/* the index */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {GROUPS.map((group, gi) => (
          <div key={gi} className={gi === 0 ? "" : "mt-5"}>
            {group.heading && (
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className="label text-[8px] text-ink-faint/70">{group.heading}</span>
                <span className="h-px flex-1 bg-line-soft" />
              </div>
            )}
            <div className="space-y-px">
              {group.items.map(({ n, href, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`group relative flex items-center gap-3 rounded-md pl-3 pr-2 py-[9px] sm:py-[7px] text-[13px] transition-colors ${
                      active ? "bg-selected text-ink" : "text-ink-dim hover:text-ink hover:bg-card"
                    }`}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[2px] rounded-full bg-accent" />}
                    <span
                      className={`font-mono text-[10px] tabular-nums w-[16px] shrink-0 transition-colors ${
                        active ? "text-accent" : "text-ink-faint/70 group-hover:text-accent/80"
                      }`}
                    >
                      {n}
                    </span>
                    <span className={`transition-transform duration-200 ${active ? "font-medium" : "group-hover:translate-x-0.5"}`}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-line-soft space-y-0.5">
        <InstallButton />
        <NotifyButton />
        <ThemeToggle />
        <div className="flex items-center gap-2 label px-3 pt-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          local · sqlite
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── mobile top bar (below lg) ── */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line-soft bg-sidebar/95 px-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="btn-ghost -ml-1 flex h-10 w-10 items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <HqMark className="h-7 w-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight">HQ</span>
        </Link>
      </header>

      {/* ── backdrop (mobile, drawer open) ── */}
      {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />}

      {/* ── sidebar: sticky column on lg, slide-in drawer below ── */}
      <aside
        className={`bg-sidebar border-r border-line-soft flex flex-col
          w-[264px] lg:w-[210px] shrink-0 h-screen
          fixed lg:sticky top-0 left-0 z-50
          transition-transform duration-300 ease-out lg:transition-none
          ${open ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* close button, mobile only */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="lg:hidden btn-ghost absolute right-2 top-3 flex h-9 w-9 items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
        {panel}
      </aside>
    </>
  );
}
