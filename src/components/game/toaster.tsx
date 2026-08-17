"use client";

import { useSyncExternalStore } from "react";
import { getSnapshot, removeToast, subscribe, type Toast } from "./toast-store";

const EMPTY: Toast[] = [];

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  return (
    <div className="fixed bottom-5 right-5 z-[9998] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => removeToast(t.id)}
          className="pointer-events-auto card elevated flex items-center gap-3 pl-3 pr-4 py-3 min-w-[240px] text-left"
          style={{ animation: "reveal-up .35s cubic-bezier(.22,1,.36,1) both" }}
        >
          <span className="grid place-items-center h-9 w-9 rounded-lg bg-selected text-lg shrink-0">{t.emoji}</span>
          <span className="min-w-0">
            <span className="block eyebrow leading-none mb-1">{t.title}</span>
            {t.body && <span className="block text-sm text-ink truncate">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
