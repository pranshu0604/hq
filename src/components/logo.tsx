export function HqMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} role="img" aria-label="HQ">
      <defs>
        <linearGradient id="hq-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dc9a58" />
          <stop offset="1" stopColor="#b77932" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#hq-mark)" />
      <rect x="0.5" y="0.5" width="35" height="35" rx="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.16" />
      <text
        x="18"
        y="18.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-body), Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="14"
        letterSpacing="-0.5"
        fill="#2a1608"
      >
        HQ
      </text>
    </svg>
  );
}
