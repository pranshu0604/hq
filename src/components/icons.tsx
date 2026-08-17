// terse stroke icons, 1.6px, inherit currentColor
type P = { className?: string };
const base = "shrink-0";

export function IconOverview({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M3 3h6v6H3V3zM11 3h6v4h-6V3zM11 9h6v8h-6V9zM3 11h6v6H3v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconApplications({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M3 7h14v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM7 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconProjects({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M10 2.5l7 4v7l-7 4-7-4v-7l7-4zM3 6.5l7 4 7-4M10 10.5V18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconNotes({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM12 3v4h3M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconTodos({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M4 4h12v12H4V4zM7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconPlus({ className = "" }: P) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
export function IconArrow({ className = "" }: P) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconInsights({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M3 17V3M3 17h14M6.5 13.5v-3M10 13.5v-6M13.5 13.5v-4.5M17 13.5V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconSun({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
export function IconMoon({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M16 11.5A6 6 0 0 1 8.5 4a6 6 0 1 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconPeople({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <circle cx="7.5" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 16c0-2.5 2-4.2 4.5-4.2S12 13.5 12 16M13 5.6a2.4 2.4 0 0 1 0 4.6M14 15.8c0-2.2-1.3-3.6-2.8-4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconWork({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <rect x="2.5" y="6" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6M2.5 10.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconQuote({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M8 6c-2.2 0-4 1.8-4 4s1.8 3.5 3.5 3.5c.3 0 .5.2.4.5C7.5 15.5 6.4 16.4 5 16.8M17 6c-2.2 0-4 1.8-4 4s1.8 3.5 3.5 3.5c.3 0 .5.2.4.5-.4 1-1.5 1.9-2.9 2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconGym({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M4 7v6M6 5v10M14 5v10M16 7v6M6 10h8M2.5 9v2M17.5 9v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconWellbeing({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path
        d="M2.5 10h3l1.5-3.5L9.5 14l2-6 1.5 2h4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function IconAssistant({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M10 2.5l1.6 4.2 4.4 1.6-4.4 1.6L10 14l-1.6-4.1L4 8.3l4.4-1.6L10 2.5zM15.5 12.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="currentColor" />
    </svg>
  );
}
export function IconReflections({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M10 3v14M10 5.5C8.5 4 6 3.5 4 4.2v10c2-.7 4.5-.2 6 1.3M10 5.5c1.5-1.5 4-2 6-1.3v10c-2-.7-4.5-.2-6 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
export function IconSocial({ className = "" }: P) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.8 5.8a6 6 0 0 0 0 8.4M14.2 14.2a6 6 0 0 0 0-8.4M3.2 3.2a9.6 9.6 0 0 0 0 13.6M16.8 16.8a9.6 9.6 0 0 0 0-13.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// brand glyphs — filled, monochrome, they inherit currentColor so the palette stays ours
export function IconX({ className = "" }: P) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
      <path d="M17.53 3h3.02l-6.6 7.54L21.75 21h-5.98l-4.68-6.12L5.72 21H2.7l7.06-8.07L2.25 3h6.13l4.23 5.6L17.53 3zm-1.06 16.2h1.67L7.6 4.71H5.81L16.47 19.2z" />
    </svg>
  );
}
export function IconLinkedIn({ className = "" }: P) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className={`${base} ${className}`}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4v11H3v-11zM9.5 9.5h3.83v1.5h.05c.53-.95 1.83-1.96 3.77-1.96 4.03 0 4.78 2.5 4.78 5.76v5.7h-4v-5.05c0-1.2-.02-2.75-1.75-2.75-1.75 0-2.02 1.31-2.02 2.66v5.14h-4v-11z" />
    </svg>
  );
}
export function IconInstagram({ className = "" }: P) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}
export function IconCalendar({ className = "" }: P) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className={`${base} ${className}`}>
      <path d="M3 5h14v12H3V5zM3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
