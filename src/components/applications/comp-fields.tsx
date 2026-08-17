"use client";

import { Select } from "@/components/ui/select";

export const CURRENCY_OPTS = [
  { value: "INR", label: "₹ INR" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
];

// shared by the create form and the edit form so the two can't drift.
// the inputs are text, not number, because "18L" and "1.2Cr" are how you actually think
// about a salary — the server action parses the shorthand.
export default function CompFields({
  currency = "INR",
  min,
  max,
  note = "",
}: {
  currency?: string | null;
  min?: number | null;
  max?: number | null;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="label">Compensation</label>
        <span className="label text-ink-faint/70 normal-case tracking-normal">a range is fine · type 18L, 1.2Cr or 120k</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Select name="offerCurrency" options={CURRENCY_OPTS} defaultValue={currency ?? "INR"} ariaLabel="Currency" />
        <input name="offerAmount" defaultValue={min ?? ""} className="field-input" placeholder="From — e.g. 18L" aria-label="Minimum" />
        <input name="offerMax" defaultValue={max ?? ""} className="field-input" placeholder="To — optional" aria-label="Maximum" />
        <input
          name="offerNote"
          defaultValue={note}
          className="field-input"
          placeholder="Note — base + ESOPs?"
          aria-label="Compensation note"
        />
      </div>
    </div>
  );
}
