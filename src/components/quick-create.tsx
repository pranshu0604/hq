"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReflection } from "@/app/reflections/actions";
import {
  IconApplications,
  IconNotes,
  IconPeople,
  IconPlus,
  IconQuote,
  IconReflections,
  IconTodos,
  IconWellbeing,
  IconWork,
} from "@/components/icons";

export default function QuickCreate() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const newReflection = () => {
    setOpen(false);
    start(async () => {
      const id = await createReflection();
      router.push(`/reflections/${id}`);
    });
  };

  const items: { label: string; Icon: React.ComponentType<{ className?: string }>; onClick: () => void }[] = [
    { label: "Reflection", Icon: IconReflections, onClick: newReflection },
    { label: "Application", Icon: IconApplications, onClick: () => go("/applications/new") },
    { label: "Work / company", Icon: IconWork, onClick: () => go("/work") },
    { label: "Person", Icon: IconPeople, onClick: () => go("/people") },
    { label: "Note", Icon: IconNotes, onClick: () => go("/notes") },
    { label: "Quote", Icon: IconQuote, onClick: () => go("/quotes") },
    { label: "Todo", Icon: IconTodos, onClick: () => go("/todos") },
    { label: "Wellbeing check-in", Icon: IconWellbeing, onClick: () => go("/wellbeing") },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        className={`group w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all ${
          open ? "border-accent text-accent bg-selected" : "border-line-strong text-ink-dim hover:text-ink hover:border-accent/60 hover:bg-card"
        }`}
      >
        <IconPlus className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-45 text-accent" : "group-hover:rotate-90"}`} />
        Create
        <kbd className="ml-auto text-[10px] font-mono text-ink-faint">new</kbd>
      </button>

      {open && (
        <div className="elevated absolute left-0 top-full mt-1.5 w-full rounded-lg border border-line bg-card p-1 z-40 origin-top animate-[pop-in_0.14s_ease]">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-dim hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <it.Icon className="w-[15px] h-[15px] text-ink-faint" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
