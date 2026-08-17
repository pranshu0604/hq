// HQ password gate — edge-safe (Web Crypto only, no Node APIs), so it works in
// middleware. Auth is ACTIVE only when HQ_PASSWORD is set: hosted (Vercel) turns
// it on; your local Mac leaves it unset, so localhost stays open and login-free.
export const SESSION_COOKIE = "hq_session";
export const SESSION_TTL_DAYS = 60;

export function authEnabled(): boolean {
  return !!process.env.HQ_PASSWORD;
}

const enc = (s: string) => new TextEncoder().encode(s);

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc(payload)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// cookie signing key — dedicated secret, or fall back to the password itself
function secret(): string {
  return process.env.HQ_AUTH_SECRET || process.env.HQ_PASSWORD || "hq-local-dev";
}

/** signed, stateless session token: "<expiry_ms>.<hmac>" */
export async function signSession(nowMs: number): Promise<string> {
  const exp = String(nowMs + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  return `${exp}.${await hmac(exp, secret())}`;
}

export async function verifySession(token: string | undefined, nowMs: number): Promise<boolean> {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const exp = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expNum = Number(exp);
  if (!expNum || expNum < nowMs) return false;
  return timingSafeEqual(sig, await hmac(exp, secret()));
}
