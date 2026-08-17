"use client";

import { useEffect, useState } from "react";

type State = "unknown" | "unsupported" | "off" | "on" | "denied" | "working";

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function NotifyButton() {
  const [state, setState] = useState<State>("unknown");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (live) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (live) setState(sub ? "on" : "off");
      } catch {
        if (live) setState("off");
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const enable = async () => {
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await (await fetch("/api/push/public-key")).json();
      if (!key) {
        setState("off");
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
      await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      await fetch("/api/push/test", { method: "POST" });
      setState("on");
    } catch {
      setState("off");
    }
  };

  const disable = async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("off");
    }
  };

  if (state === "unknown" || state === "unsupported") return null;
  if (state === "denied") return <div className="label px-3 py-1 text-ink-faint">🔕 notifications blocked in browser</div>;

  const on = state === "on";
  return (
    <button
      onClick={on ? disable : enable}
      disabled={state === "working"}
      title={on ? "Turn off HQ notifications" : "Get a daily reminder brief"}
      className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors mb-2 ${
        on ? "border border-line text-ink-dim hover:text-ink hover:border-line-strong" : "border border-accent/60 bg-selected text-accent hover:bg-accent hover:text-[color:var(--accent-ink)]"
      }`}
    >
      {state === "working" ? "…" : on ? "🔔 Notifications on" : "🔔 Enable notifications"}
    </button>
  );
}
