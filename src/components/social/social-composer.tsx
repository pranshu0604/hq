"use client";

import { useRef, useState, useTransition } from "react";
import { createSocialLog } from "@/app/social/actions";
import { Select } from "@/components/ui/select";
import { ACTIONS, PLATFORMS } from "@/lib/social";
import { celebrateLog } from "./presence-tiles";

const PLATFORM_OPTS = PLATFORMS.map((p) => ({ value: p.key, label: p.label }));

export default function SocialComposer() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const label = PLATFORMS.find((p) => p.key === fd.get("platform"))?.label ?? "Logged";
    start(async () => {
      const r = await createSocialLog(fd);
      if (r) {
        celebrateLog(r, label);
        formRef.current?.reset();
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="label hover:text-accent transition-colors">
        + log with details
      </button>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="card p-3 flex flex-wrap gap-2 reveal">
      <Select name="platform" className="w-32" options={PLATFORM_OPTS} defaultValue="X" ariaLabel="Platform" />
      <Select name="action" className="w-32" options={ACTIONS} defaultValue="POST" ariaLabel="Action" />
      <input name="note" placeholder="What about?" className="field-input flex-1 min-w-[160px]" />
      <input name="link" placeholder="Link (optional)" className="field-input w-44" />
      <button disabled={pending} className="btn btn-primary">
        {pending ? "Logging…" : "Log"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
        Cancel
      </button>
    </form>
  );
}
