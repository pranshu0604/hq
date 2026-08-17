"use server";

import { prisma } from "@/lib/prisma";
import {
  ApplicationCategory,
  ApplicationStatus,
  WorkMode,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// accepts "18L", "1.2Cr", "120k", "1,800,000" or a plain number — nobody wants to type six zeros
function money(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(/[,\s₹$€£]/g, "");
  if (!raw) return null;
  const m = raw.match(/^([0-9.]+)\s*(cr|crore|l|lac|lakh|k|m)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = (m[2] ?? "").toLowerCase();
  const mult = unit.startsWith("cr") ? 1e7 : unit.startsWith("l") ? 1e5 : unit === "k" ? 1e3 : unit === "m" ? 1e6 : 1;
  return n * mult;
}

// a range typed backwards is still a range — swap rather than reject
function comp(fd: FormData) {
  let lo = money(fd, "offerAmount");
  let hi = money(fd, "offerMax");
  if (lo != null && hi != null && hi < lo) [lo, hi] = [hi, lo];
  return {
    offerAmount: lo,
    offerMax: hi,
    offerNote: str(fd, "offerNote"),
    offerCurrency: str(fd, "offerCurrency") || "INR",
  };
}

export async function createApplication(formData: FormData) {
  const company = str(formData, "company");
  const role = str(formData, "role");
  if (!company || !role) throw new Error("Company and role are required");

  const workMode = str(formData, "workMode");
  const status = (str(formData, "status") || "APPLIED") as ApplicationStatus;

  const app = await prisma.application.create({
    data: {
      company,
      role,
      description: str(formData, "description"),
      category: (str(formData, "category") || "BACKUP") as ApplicationCategory,
      status,
      workMode: workMode ? (workMode as WorkMode) : null,
      city: str(formData, "city") || null,
      link: str(formData, "link") || null,
      // a parked draft hasn't gone out yet — the clock starts when you submit it
      submittedAt: status === "PENDING" ? null : new Date(),
      ...comp(formData),
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/applications");
  redirect(`/applications/${app.id}`);
}

export async function updateApplication(id: string, formData: FormData) {
  const workMode = str(formData, "workMode");
  const status = str(formData, "status") as ApplicationStatus;
  const existing = await prisma.application.findUnique({ where: { id }, select: { submittedAt: true } });

  await prisma.application.update({
    where: { id },
    data: {
      company: str(formData, "company"),
      role: str(formData, "role"),
      description: str(formData, "description"),
      category: str(formData, "category") as ApplicationCategory,
      status,
      workMode: workMode ? (workMode as WorkMode) : null,
      city: str(formData, "city") || null,
      link: str(formData, "link") || null,
      // stamped the first time it leaves PENDING; cleared if you park it again
      submittedAt: status === "PENDING" ? null : existing?.submittedAt ?? new Date(),
      ...comp(formData),
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
}

/** one-click "I finally sent it" — from the parked list */
export async function submitApplication(id: string) {
  await prisma.application.update({
    where: { id },
    data: { status: "APPLIED", submittedAt: new Date() },
  });
  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  revalidatePath("/");
}

export async function deleteApplication(id: string) {
  await prisma.application.delete({ where: { id } });
  revalidatePath("/applications");
  redirect("/applications");
}

export async function addPlatform(applicationId: string, formData: FormData) {
  const platform = str(formData, "platform");
  if (!platform) throw new Error("Platform is required");

  await prisma.applicationPlatform.create({
    data: {
      applicationId,
      platform,
      link: str(formData, "link") || null,
    },
  });

  revalidatePath(`/applications/${applicationId}`);
}

export async function updatePlatformResponse(
  platformId: string,
  applicationId: string,
  formData: FormData
) {
  await prisma.applicationPlatform.update({
    where: { id: platformId },
    data: {
      responseReceived: formData.get("responseReceived") === "on",
      responseSource: str(formData, "responseSource") || null,
      responseNotes: str(formData, "responseNotes"),
    },
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function updatePlatform(platformId: string, applicationId: string, patch: { platform?: string; link?: string }) {
  const data: { platform?: string; link?: string | null } = {};
  if (patch.platform !== undefined && patch.platform.trim()) data.platform = patch.platform.trim();
  if (patch.link !== undefined) data.link = patch.link.trim() || null;
  await prisma.applicationPlatform.update({ where: { id: platformId }, data }).catch(() => null);
  revalidatePath(`/applications/${applicationId}`);
}

export async function deletePlatform(platformId: string, applicationId: string) {
  await prisma.applicationPlatform.delete({ where: { id: platformId } });
  revalidatePath(`/applications/${applicationId}`);
}

export async function addEmail(
  applicationPlatformId: string,
  applicationId: string,
  formData: FormData
) {
  await prisma.emailSent.create({
    data: {
      applicationPlatformId,
      recipientName: str(formData, "recipientName") || null,
      recipientEmail: str(formData, "recipientEmail") || null,
      subject: str(formData, "subject") || null,
    },
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function toggleEmailReply(emailId: string, applicationId: string, gotReply: boolean) {
  await prisma.emailSent.update({ where: { id: emailId }, data: { gotReply } });
  revalidatePath(`/applications/${applicationId}`);
}

export async function updateEmail(emailId: string, applicationId: string, formData: FormData) {
  await prisma.emailSent.update({
    where: { id: emailId },
    data: {
      recipientName: str(formData, "recipientName") || null,
      recipientEmail: str(formData, "recipientEmail") || null,
      subject: str(formData, "subject") || null,
    },
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function deleteEmail(emailId: string, applicationId: string) {
  await prisma.emailSent.delete({ where: { id: emailId } });
  revalidatePath(`/applications/${applicationId}`);
}

export async function addInterview(applicationId: string, formData: FormData) {
  const scheduledOnRaw = str(formData, "scheduledOn");
  await prisma.interview.create({
    data: {
      applicationId,
      round: Number(str(formData, "round") || "1"),
      type: str(formData, "type"),
      scheduledOn: scheduledOnRaw ? new Date(scheduledOnRaw) : null,
      outcome: str(formData, "outcome"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function updateInterview(
  interviewId: string,
  applicationId: string,
  formData: FormData
) {
  const scheduledOnRaw = str(formData, "scheduledOn");
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      round: Number(str(formData, "round") || "1"),
      type: str(formData, "type"),
      scheduledOn: scheduledOnRaw ? new Date(scheduledOnRaw) : null,
      outcome: str(formData, "outcome"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/applications/${applicationId}`);
}

export async function deleteInterview(interviewId: string, applicationId: string) {
  await prisma.interview.delete({ where: { id: interviewId } });
  revalidatePath(`/applications/${applicationId}`);
}
