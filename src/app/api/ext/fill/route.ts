// The autofill bridge — spoken by the browser extension and the running Claude
// session. CORS-open (it's token-gated, personal, single-user) so the extension
// background worker can reach it cross-origin.
//
//   Extension  →  POST { action:"create", url, fields[] }        → { id }
//   Claude     →  GET  ?status=pending                           → jobs to fill
//   Claude     →  POST { action:"answer", id, answers, note }    → job ANSWERED
//   Extension  →  GET  ?id=…            (poll)                    → { job }
//   Extension  →  POST { action:"apply", id, company, role, … }  → Application made
//   Extension  →  POST { action:"cancel", id }                   → job CANCELLED
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createFillJob,
  getFillJob,
  listPendingFillJobs,
  listRecentFillJobs,
  answerFillJob,
  setFillStatus,
  type ScrapedField,
} from "@/lib/fill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type, x-hq-token",
  "access-control-max-age": "86400",
};

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const job = await getFillJob(id);
    return job ? json({ job }) : json({ error: "not found" }, 404);
  }
  const status = url.searchParams.get("status");
  if (status === "pending") return json({ jobs: await listPendingFillJobs() });
  return json({ jobs: await listRecentFillJobs(Number(url.searchParams.get("take")) || 20) });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(b.action ?? "create");

  try {
    if (action === "create") {
      const job = await createFillJob({
        url: b.url ? String(b.url) : "",
        pageTitle: b.pageTitle ? String(b.pageTitle) : "",
        company: b.company ? String(b.company) : "",
        role: b.role ? String(b.role) : "",
        fields: Array.isArray(b.fields) ? (b.fields as ScrapedField[]) : [],
      });
      return json({ id: job.id, job });
    }

    if (action === "answer") {
      const id = String(b.id ?? "");
      const answers = (b.answers && typeof b.answers === "object" ? b.answers : {}) as Record<string, string>;
      const job = await answerFillJob(id, answers, b.note ? String(b.note) : "", {
        company: b.company ? String(b.company) : undefined,
        role: b.role ? String(b.role) : undefined,
      });
      return job ? json({ job }) : json({ error: "not found" }, 404);
    }

    if (action === "apply") {
      const id = String(b.id ?? "");
      const existing = id ? await getFillJob(id) : null;
      const company = String(b.company ?? existing?.company ?? "").trim() || "Unknown";
      const role = String(b.role ?? existing?.role ?? "").trim() || "Role";
      const link = String(b.link ?? existing?.url ?? "").trim() || null;
      const notes = String(b.notes ?? "").slice(0, 4000);
      const app = await prisma.application.create({
        data: { company, role, link, status: "APPLIED", submittedAt: new Date(), notes },
      });
      if (id) await setFillStatus(id, "APPLIED", app.id);
      revalidatePath("/applications");
      revalidatePath("/");
      return json({ applicationId: app.id });
    }

    if (action === "cancel") {
      await setFillStatus(String(b.id ?? ""), "CANCELLED");
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch {
    return json({ error: "failed" }, 500);
  }
}
