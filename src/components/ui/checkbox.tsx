"use client";

type Props = {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  className?: string;
};

// real (visually-hidden) checkbox keeps form semantics + a11y; the <span> is the visual
export function Checkbox({ name, checked, defaultChecked, onChange, label, className = "" }: Props) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none group ${className}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="hqcbx-input peer sr-only"
      />
      <span className="hqcbx relative h-[18px] w-[18px] shrink-0 rounded-[5px] border border-line-strong bg-bg-raised transition-all duration-200 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 group-hover:border-ink-faint">
        <svg viewBox="0 0 14 14" className="hqcbx-check absolute inset-0 h-full w-full p-[3px] text-[color:var(--accent-ink)]">
          <path d="M2 7.5L5.5 11L12 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className="text-ink-dim group-hover:text-ink transition-colors">{label}</span>}
    </label>
  );
}
