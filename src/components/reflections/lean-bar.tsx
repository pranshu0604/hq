// where the worldview sits between the two poles. lean = 0 (fully antithesis) … 100 (fully thesis).
export function leanWord(lean: number) {
  if (lean >= 60) return "thesis";
  if (lean <= 40) return "antithesis";
  return "balanced";
}

export function LeanBar({
  lean,
  thesisLabel,
  antithesisLabel,
  size = "lg",
}: {
  lean: number;
  thesisLabel?: string;
  antithesisLabel?: string;
  size?: "sm" | "lg";
}) {
  const l = Math.min(100, Math.max(0, lean));
  const fillLeft = Math.min(50, l);
  const fillWidth = Math.abs(l - 50);

  return (
    <div className="w-full">
      {size === "lg" && (
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <div className="min-w-0">
            <span className="metric text-sm">{100 - l}%</span>{" "}
            <span className="text-xs text-ink-dim truncate">{antithesisLabel}</span>
          </div>
          <div className="min-w-0 text-right">
            <span className="text-xs text-ink-dim truncate">{thesisLabel}</span>{" "}
            <span className="metric text-sm text-accent">{l}%</span>
          </div>
        </div>
      )}
      <div className={`relative w-full ${size === "lg" ? "h-2.5" : "h-1.5"} rounded-full`} style={{ background: "var(--card-3)" }}>
        {/* center tick */}
        <span className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 h-full w-px" style={{ background: "var(--line-strong)" }} />
        {/* directional fill from center */}
        <span
          className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%`, background: "var(--accent)" }}
        />
        {/* marker */}
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 transition-all duration-500"
          style={{
            left: `${l}%`,
            width: size === "lg" ? 12 : 9,
            height: size === "lg" ? 12 : 9,
            background: "var(--accent-strong)",
            boxShadow: "0 1px 4px var(--shadow)",
            ["--tw-ring-color" as string]: "var(--bg)",
          }}
        />
      </div>
    </div>
  );
}
