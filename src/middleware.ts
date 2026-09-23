import { NextRequest, NextResponse } from "next/server";
import { authEnabled, verifySession, SESSION_COOKIE } from "@/lib/auth";

// Paths reachable without a session: the login flow, and PWA/static assets so the
// app can install and render its icon before you sign in.
const PUBLIC = ["/login", "/api/login", "/api/logout", "/api/cron", "/.well-known", "/icons", "/apple-icon", "/icon", "/manifest", "/sw.js", "/favicon"];

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next(); // local Mac: no gate

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // CORS preflight carries no token/cookie — let it through so the extension's
  // cross-origin POSTs to /api/ext/* can complete. The actual request is gated.
  if (req.method === "OPTIONS") return NextResponse.next();

  // native clients (widgets) authenticate with a bearer token instead of a cookie
  if (pathname.startsWith("/api/")) {
    const tok = req.headers.get("x-hq-token");
    if (tok && process.env.HQ_API_TOKEN && tok === process.env.HQ_API_TOKEN) return NextResponse.next();
  }

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, Date.now())) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // run on everything except Next's build assets
  matcher: ["/((?!_next/static|_next/image).*)"],
};
