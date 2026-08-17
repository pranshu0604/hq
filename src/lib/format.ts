export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatMoney(amount: number | null | undefined, currency = "INR") {
  if (amount == null) return "—";
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  return `${symbol}${amount.toLocaleString("en-IN")}`;
}

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

// compact money — ₹18,00,000 reads as ₹18L, $120000 as $120k. keeps tables narrow.
export function formatMoneyShort(amount: number, currency = "INR") {
  const sym = SYMBOL[currency] ?? "₹";
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (currency === "INR") {
    if (amount >= 1e7) return `${sym}${round(amount / 1e7)}Cr`;
    if (amount >= 1e5) return `${sym}${round(amount / 1e5)}L`;
    if (amount >= 1e3) return `${sym}${round(amount / 1e3)}k`;
    return `${sym}${amount.toLocaleString("en-IN")}`;
  }
  if (amount >= 1e6) return `${sym}${round(amount / 1e6)}M`;
  if (amount >= 1e3) return `${sym}${round(amount / 1e3)}k`;
  return `${sym}${amount.toLocaleString("en-US")}`;
}

export type Comp = { offerAmount: number | null; offerMax: number | null; offerCurrency: string | null };

/** compensation as a range: an exact figure, a band, or an open-ended floor/ceiling */
export function formatComp(c: Comp, short = false): string {
  const cur = c.offerCurrency ?? "INR";
  const f = (n: number) => (short ? formatMoneyShort(n, cur) : formatMoney(n, cur));
  const { offerAmount: lo, offerMax: hi } = c;
  if (lo == null && hi == null) return "—";
  if (lo != null && hi == null) return f(lo);
  if (lo == null && hi != null) return `up to ${f(hi)}`;
  if (lo === hi) return f(lo!);
  return `${f(lo!)} – ${f(hi!)}`;
}

/** full-precision figures for a tooltip, since the display is compacted */
export function compTitle(c: Comp): string {
  const cur = c.offerCurrency ?? "INR";
  if (c.offerAmount == null && c.offerMax == null) return "No compensation recorded";
  return formatComp({ ...c, offerCurrency: cur }, false);
}

// wall-clock read kept out of component render to satisfy react purity lint
export function getNow() {
  return Date.now();
}

// today's local date as a yyyy-mm-dd string for <input type="date"> defaults
export function todayInputValue() {
  const d = new Date(getNow());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function relativeTime(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  const mins = Math.round(secs / 60);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  if (secs < 60) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

// human day label relative to today
export function dayLabel(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days}d overdue`;
  if (days < 7) return date.toLocaleDateString("en-IN", { weekday: "long" });
  return formatDate(date);
}

// strip HTML tags for plain-text previews/search of rich content
export function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// attribute values in stored HTML are entity-encoded (e.g. & -> &amp;); decode before
// using the URL in an <img src>, or query-param-heavy URLs (Instagram etc.) break.
function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&#x26;/gi, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// pull a text + first-image preview out of rich note HTML (for list thumbnails)
export function notePreview(html: string): { text: string; image: string | null } {
  const img = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
  const embed = html.match(/data-image="([^"]*)"/i)?.[1];
  const raw = img || (embed && embed.length ? embed : null);
  return { text: stripHtml(html), image: raw ? decodeEntities(raw) : null };
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
