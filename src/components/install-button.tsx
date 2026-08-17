"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Explicit install affordance. Chromium browsers fire `beforeinstallprompt` only when
// the app is installable (manifest + SW + icons all valid) and not already installed —
// so if this button appears, install is ready; clicking it opens the native dialog.
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    <button
      onClick={async () => {
        await deferred.prompt();
        setDeferred(null);
      }}
      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-accent/60 bg-selected text-accent px-3 py-1.5 text-[12px] font-medium hover:bg-accent hover:text-[color:var(--accent-ink)] transition-colors mb-2"
    >
      ⤓ Install HQ
    </button>
  );
}
