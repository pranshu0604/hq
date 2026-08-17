"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Option = { value: string; label: string };

type Props = {
  options: Option[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  align?: "left" | "right";
};

export function Select({
  options,
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Select…",
  ariaLabel,
  className = "",
  align = "left",
}: Props) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? value! : internal;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === current);

  function commit(v: string) {
    if (!controlled) setInternal(v);
    onChange?.(v);
    setOpen(false);
  }

  function openMenu() {
    const idx = options.findIndex((o) => o.value === current);
    setActive(idx < 0 ? 0 : idx);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return openMenu();
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[active];
      if (opt) commit(opt.value);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={current} />}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="field-input flex items-center justify-between gap-2 text-left cursor-pointer"
      >
        <span className={selected ? "truncate" : "truncate text-ink-faint"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`shrink-0 text-ink-faint transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        role="listbox"
        id={listId}
        data-open={open}
        className={`elevated absolute z-30 mt-1.5 min-w-full max-h-64 overflow-auto rounded-lg border border-line-strong bg-card p-1 origin-top transition-[opacity,transform] duration-150 ${
          align === "right" ? "right-0" : "left-0"
        } ${open ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 -translate-y-1 scale-[0.98] pointer-events-none"}`}
      >
        {options.map((o, i) => {
          const isSel = o.value === current;
          const isActive = i === active;
          return (
            <li
              key={o.value}
              role="option"
              aria-selected={isSel}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(o.value)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer whitespace-nowrap transition-colors ${
                isActive ? "bg-surface-2 text-ink" : "text-ink-dim"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                  isSel ? "bg-accent" : "bg-transparent"
                }`}
              />
              {o.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
