"use client";

import { useState } from "react";
import { HqMark } from "@/components/logo";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (res.ok) {
        const next = new URLSearchParams(window.location.search).get("next") || "/";
        window.location.href = next.startsWith("/") ? next : "/";
      } else {
        setErr("Wrong password.");
        setPw("");
      }
    } catch {
      setErr("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-6" style={{ background: "var(--bg)" }}>
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <HqMark className="h-10 w-10 rounded-[10px]" />
          <span className="display text-2xl">HQ</span>
        </div>
        <label className="label mb-2 block">Password</label>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="field-input w-full"
          placeholder="••••••••••••"
          autoComplete="current-password"
        />
        {err && (
          <p className="text-sm mt-2" style={{ color: "var(--bad)" }}>
            {err}
          </p>
        )}
        <button disabled={busy || !pw} className="btn btn-primary w-full mt-4 justify-center">
          {busy ? "…" : "Enter"}
        </button>
        <p className="label text-ink-faint mt-6 text-center">Your HQ is private. This device stays signed in.</p>
      </form>
    </div>
  );
}
