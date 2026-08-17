"use client";

// shared search + filter + sort row so every section looks and behaves the same.
// pass filter/sort <Select>s as children; owner keeps the state.
export default function FilterBar({
  query,
  onQuery,
  placeholder = "Search…",
  children,
  count,
  total,
  noun = "shown",
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  count?: number;
  total?: number;
  noun?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2.5 items-center mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="field-input w-full"
            style={{ paddingLeft: "2.35rem" }}
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
        {children}
      </div>
      {count !== undefined && total !== undefined && (
        <div className="label mb-4">
          {count} of {total} {noun}
        </div>
      )}
    </div>
  );
}
