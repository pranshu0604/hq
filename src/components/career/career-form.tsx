"use client";

// The career profile editor. Grouped, left-aligned, editorial — not a wall of
// identical cards. Saves the whole form in one PATCH; the extension reads the
// saved profile server-side, so there's nothing to sync manually.
import { useState } from "react";
import type { CareerProfileData } from "@/lib/career";

type Kind = "line" | "area";
type FieldDef = { key: keyof CareerProfileData; label: string; ph?: string; kind?: Kind; wide?: boolean };
type Group = { title: string; note?: string; fields: FieldDef[] };

const GROUPS: Group[] = [
  {
    title: "Identity",
    fields: [
      { key: "fullName", label: "Full name", ph: "Pranshu Pandey" },
      { key: "headline", label: "Headline", ph: "Backend | AI Engineer" },
      { key: "email", label: "Email", ph: "you@example.com" },
      { key: "phone", label: "Phone", ph: "+91 …" },
      { key: "location", label: "Location", ph: "Indore, India" },
      { key: "currentTitle", label: "Current title", ph: "Full Stack & GenAI Engineer" },
      { key: "currentCompany", label: "Current company", ph: "Invsto" },
      { key: "yearsExp", label: "Years of experience", ph: "1.5" },
    ],
  },
  {
    title: "Links",
    fields: [
      { key: "linkedin", label: "LinkedIn", ph: "linkedin.com/in/…" },
      { key: "github", label: "GitHub", ph: "github.com/…" },
      { key: "portfolio", label: "Portfolio", ph: "yoursite.com" },
      { key: "twitter", label: "X / Twitter", ph: "x.com/…" },
    ],
  },
  {
    title: "Logistics",
    note: "The awkward form questions — answered once.",
    fields: [
      { key: "workAuth", label: "Work authorization", ph: "Indian citizen; needs sponsorship for US roles" },
      { key: "noticePeriod", label: "Notice period", ph: "Immediate / 30 days" },
      { key: "expectedSalary", label: "Expected salary", ph: "₹— LPA / negotiable" },
      { key: "currentSalary", label: "Current salary", ph: "optional" },
    ],
  },
  {
    title: "Substance",
    note: "The long-form material. Claude pulls sentences from here to answer open questions.",
    fields: [
      { key: "education", label: "Education", kind: "area", ph: "Degree, institution, dates, CGPA", wide: true },
      { key: "skills", label: "Skills", kind: "area", ph: "comma or newline separated", wide: true },
      { key: "experience", label: "Experience", kind: "area", ph: "Role @ company — dates. Bullets…", wide: true },
      { key: "projects", label: "Projects", kind: "area", ph: "Notable projects, what and why", wide: true },
      {
        key: "pitch",
        label: "Pitch — used for “why you” / cover letters",
        kind: "area",
        ph: "2–4 crisp sentences in your voice. This gets adapted per application.",
        wide: true,
      },
      {
        key: "extras",
        label: "Pre-answered extras",
        kind: "area",
        ph: "One per line — e.g. “Willing to relocate: yes”, “Preferred stack: Python/TS”",
        wide: true,
      },
    ],
  },
];

export default function CareerForm({ initial }: { initial: CareerProfileData }) {
  const [form, setForm] = useState<CareerProfileData>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const set = (k: keyof CareerProfileData, v: string) => {
    setForm((s) => ({ ...s, [k]: v }));
    if (state === "saved") setState("idle");
  };

  const save = async () => {
    setState("saving");
    try {
      await fetch("/api/career", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      setState("saved");
    } catch {
      setState("idle");
    }
  };

  return (
    <div className="space-y-10">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <div className="section-title mb-1">{g.title}</div>
          {g.note && <p className="text-[13px] text-ink-faint mb-4 mt-1">{g.note}</p>}
          {!g.note && <div className="mb-4" />}
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={String(f.key)} className={f.wide ? "sm:col-span-2" : ""}>
                <label className="label mb-1.5 block">{f.label}</label>
                {f.kind === "area" ? (
                  <textarea
                    className="field-input min-h-[92px] resize-y leading-relaxed"
                    value={form[f.key] ?? ""}
                    placeholder={f.ph}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    className="field-input"
                    value={form[f.key] ?? ""}
                    placeholder={f.ph}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3 border-t border-line pt-4">
        <button className="btn-accent" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save profile"}
        </button>
        {state === "saved" && <span className="text-[13px] text-[var(--good)]">Saved ✓</span>}
        <span className="ml-auto text-[12px] text-ink-faint mono">The extension reads this live</span>
      </div>
    </div>
  );
}
