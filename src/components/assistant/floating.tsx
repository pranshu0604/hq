"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AssistantChat from "@/components/assistant/chat";
import { IconAssistant } from "@/components/icons";

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (pathname?.startsWith("/assistant")) return null; // redundant on the full page

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-8rem)] rounded-2xl border border-line bg-card elevated p-3 flex flex-col reveal">
          <div className="flex items-center justify-between mb-1 shrink-0 px-1">
            <span className="flex items-center gap-1.5 label">
              <IconAssistant className="w-3.5 h-3.5 text-accent" /> Ask HQ
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-faint hover:text-ink transition-colors text-sm">
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AssistantChat compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask HQ"
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-accent text-[color:var(--accent-ink)] shadow-[0_6px_20px_-4px_var(--accent)] grid place-items-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <span className="text-lg leading-none">✕</span> : <IconAssistant className="w-5 h-5" />}
      </button>
    </>
  );
}
