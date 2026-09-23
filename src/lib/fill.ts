// Fill jobs — the hand-off between the browser extension and the running Claude
// session. The extension creates one (PENDING) with a scrape of the page's form
// fields; Claude reads it, writes answers, flips it ANSWERED; the extension polls
// the same row and fills the DOM. On submit it's linked to an Application.
import { prisma } from "@/lib/prisma";

export type ScrapedField = {
  key: string; // stable id the extension assigns (used to map answers back to the DOM)
  label: string; // human label shown next to the field
  type: string; // text | email | tel | textarea | select | radio | checkbox | url | number | ...
  options?: string[]; // for select / radio
  name?: string; // the input's name/id attribute, a hint for matching
  required?: boolean;
  current?: string; // any value already in the field
};

export type FillJobRow = {
  id: string;
  url: string;
  pageTitle: string;
  company: string;
  role: string;
  status: string;
  fields: ScrapedField[];
  answers: Record<string, string>;
  note: string;
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
};

function parse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function shape(r: {
  id: string; url: string; pageTitle: string; company: string; role: string; status: string;
  fields: string; answers: string; note: string; applicationId: string | null;
  createdAt: Date; updatedAt: Date;
}): FillJobRow {
  return {
    id: r.id,
    url: r.url,
    pageTitle: r.pageTitle,
    company: r.company,
    role: r.role,
    status: r.status,
    fields: parse<ScrapedField[]>(r.fields, []),
    answers: parse<Record<string, string>>(r.answers, {}),
    note: r.note,
    applicationId: r.applicationId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function createFillJob(input: {
  url?: string;
  pageTitle?: string;
  company?: string;
  role?: string;
  fields?: ScrapedField[];
}): Promise<FillJobRow> {
  const row = await prisma.fillJob.create({
    data: {
      url: String(input.url ?? "").slice(0, 2000),
      pageTitle: String(input.pageTitle ?? "").slice(0, 500),
      company: String(input.company ?? "").slice(0, 200),
      role: String(input.role ?? "").slice(0, 200),
      fields: JSON.stringify(Array.isArray(input.fields) ? input.fields.slice(0, 200) : []),
    },
  });
  return shape(row);
}

export async function getFillJob(id: string): Promise<FillJobRow | null> {
  const row = await prisma.fillJob.findUnique({ where: { id } });
  return row ? shape(row) : null;
}

/** pending jobs — what the Claude poller pulls. Oldest first so nothing starves. */
export async function listPendingFillJobs(): Promise<FillJobRow[]> {
  const rows = await prisma.fillJob.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 20 });
  return rows.map(shape);
}

export async function listRecentFillJobs(take = 20): Promise<FillJobRow[]> {
  const rows = await prisma.fillJob.findMany({ orderBy: { createdAt: "desc" }, take });
  return rows.map(shape);
}

/** Claude writes the computed answers back and flips the job to ANSWERED. It can
 *  also stamp the company/role it inferred from the page, which the popup reads
 *  back to pre-fill the "Save to Applied" step. */
export async function answerFillJob(
  id: string,
  answers: Record<string, string>,
  note = "",
  meta: { company?: string; role?: string } = {},
): Promise<FillJobRow | null> {
  const row = await prisma.fillJob
    .update({
      where: { id },
      data: {
        answers: JSON.stringify(answers ?? {}),
        note: String(note).slice(0, 4000),
        status: "ANSWERED",
        ...(meta.company ? { company: String(meta.company).slice(0, 200) } : {}),
        ...(meta.role ? { role: String(meta.role).slice(0, 200) } : {}),
      },
    })
    .catch(() => null);
  return row ? shape(row) : null;
}

export async function setFillStatus(id: string, status: string, applicationId?: string | null): Promise<FillJobRow | null> {
  const row = await prisma.fillJob
    .update({ where: { id }, data: { status, ...(applicationId !== undefined ? { applicationId } : {}) } })
    .catch(() => null);
  return row ? shape(row) : null;
}

export async function deleteFillJob(id: string): Promise<void> {
  await prisma.fillJob.delete({ where: { id } }).catch(() => null);
}
