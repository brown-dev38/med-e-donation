"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/lib/auth";
import { fiscalYearBe, formatDocumentNo } from "@/lib/certificate-number";
import { decryptTaxId } from "@/lib/donor-crypto";
import { generateCertificatePdf, sendCertificateEmail, sendRdConfirmationEmail, type EmailResult } from "@/lib/donor-notifications";
import { prisma } from "@/lib/prisma";

export type ReviewState = null | { status: "error"; message: string } | { status: "success"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALREADY_PROCESSED = "รายการนี้ถูกดำเนินการไปแล้ว กรุณาโหลดหน้าใหม่";

class AlreadyProcessed extends Error {}

async function clientIp() {
  const list = await headers();
  return (list.get("x-forwarded-for")?.split(",")[0] ?? list.get("x-real-ip") ?? "").trim().slice(0, 45) || null;
}

function donationIdFrom(formData: FormData) {
  const id = formData.get("donationId");
  return typeof id === "string" && UUID.test(id) ? id : null;
}

/** Approval 1: slip, name and tax ID match the bank book. Issues the certificate number. */
export async function approveSlip(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireStaff();
  const donationId = donationIdFrom(formData);
  if (!donationId) return { status: "error", message: "ไม่พบรายการบริจาค" };
  const checks = ["checkSlip", "checkName", "checkTaxId"].every((name) => formData.get(name) === "on");
  if (!checks) return { status: "error", message: "กรุณายืนยันการตรวจสอบให้ครบทั้ง 3 ข้อก่อนอนุมัติ" };
  const ipAddress = await clientIp();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const documentNo = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const updated = await tx.donation.updateMany({
          where: { donationId, verificationStatus: "PENDING_SLIP_CHECK" },
          data: { verificationStatus: "WAITING_TREASURY_RD", slipVerifiedBy: admin.userId, slipVerifiedAt: now, rejectionReason: null },
        });
        if (updated.count !== 1) throw new AlreadyProcessed();

        const fiscalYear = fiscalYearBe(now);
        const last = await tx.acknowledgementCertificate.findFirst({ where: { fiscalYearBe: fiscalYear }, orderBy: { runningSeq: "desc" }, select: { runningSeq: true } });
        const runningSeq = (last?.runningSeq ?? 0) + 1;
        const certificate = await tx.acknowledgementCertificate.create({
          data: { donationId, fiscalYearBe: fiscalYear, runningSeq, documentNo: formatDocumentNo(fiscalYear, runningSeq), issuedBy: admin.userId, issuedAt: now },
          select: { documentNo: true },
        });
        await tx.adminNotification.updateMany({ where: { donationId, isRead: false }, data: { isRead: true, readBy: admin.userId, readAt: now } });
        await tx.auditLog.create({
          data: { userId: admin.userId, action: "APPROVE_SLIP", targetTable: "donations", targetId: donationId, details: { documentNo: certificate.documentNo, checks: ["slip", "name", "taxId"] }, ipAddress },
        });
        return certificate.documentNo;
      });
      // The approval is committed; an email problem must not undo it. Staff can resend from the page.
      const email = await sendCertificateEmail(donationId).catch((): EmailResult => ({ ok: false, error: "ส่งอีเมลไม่สำเร็จ" }));
      refresh();
      return email.ok
        ? { status: "success", message: `อนุมัติแล้ว ออกเลขที่ ${documentNo} และส่งใบอนุโมทนาบัตรทางอีเมลแล้ว${email.delivery === "outbox" ? " (โหมดทดสอบ: บันทึกไว้ใน storage/outbox)" : ""}` }
        : { status: "error", message: `อนุมัติแล้ว ออกเลขที่ ${documentNo} แต่ส่งอีเมลไม่สำเร็จ กรุณากด “ส่งอีเมลอีกครั้ง”` };
    } catch (error) {
      if (error instanceof AlreadyProcessed) return { status: "error", message: ALREADY_PROCESSED };
      // Two approvals took the same running number at once; retry with the next number.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
      console.error("Slip approval failed", error instanceof Error ? error.message : "unknown error");
      return { status: "error", message: "อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
    }
  }
  return { status: "error", message: "อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
}

export async function rejectSlip(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireStaff();
  const donationId = donationIdFrom(formData);
  if (!donationId) return { status: "error", message: "ไม่พบรายการบริจาค" };
  const raw = formData.get("reason");
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < 5 || reason.length > 1000) return { status: "error", message: "กรุณาระบุเหตุผลที่ไม่อนุมัติ 5–1,000 ตัวอักษร" };
  const ipAddress = await clientIp();
  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.donation.updateMany({ where: { donationId, verificationStatus: "PENDING_SLIP_CHECK" }, data: { verificationStatus: "REJECTED", rejectionReason: reason } });
      if (updated.count !== 1) throw new AlreadyProcessed();
      await tx.adminNotification.updateMany({ where: { donationId, isRead: false }, data: { isRead: true, readBy: admin.userId, readAt: now } });
      await tx.auditLog.create({ data: { userId: admin.userId, action: "REJECT_SLIP", targetTable: "donations", targetId: donationId, details: { reason }, ipAddress } });
    });
  } catch (error) {
    if (error instanceof AlreadyProcessed) return { status: "error", message: ALREADY_PROCESSED };
    console.error("Slip rejection failed", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  refresh();
  return { status: "success", message: "บันทึกว่าไม่อนุมัติแล้ว" };
}

/** Shows the full tax ID to compare with the donor's documents. Every view is audited (PDPA). */
export async function revealTaxId(donationId: string): Promise<{ taxId: string } | { error: string }> {
  const admin = await requireStaff();
  if (!UUID.test(donationId)) return { error: "ไม่พบรายการบริจาค" };
  const donation = await prisma.donation.findUnique({ where: { donationId }, select: { taxIdEncrypted: true } });
  if (!donation) return { error: "ไม่พบรายการบริจาค" };
  try {
    const taxId = decryptTaxId(donation.taxIdEncrypted);
    await prisma.auditLog.create({ data: { userId: admin.userId, action: "VIEW_TAX_ID", targetTable: "donations", targetId: donationId, ipAddress: await clientIp() } });
    return { taxId };
  } catch {
    return { error: "ถอดรหัสเลขผู้เสียภาษีไม่ได้ ตรวจสอบ TAX_ID_ENCRYPTION_KEY" };
  }
}

const emailNote = (result: EmailResult) => (result.ok && result.delivery === "outbox" ? " (โหมดทดสอบ: บันทึกไว้ใน storage/outbox)" : "");

/** Approval 2: treasury confirmed and the donation was keyed into the RD e-Donation system. */
export async function approveRdSubmission(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireStaff();
  const donationId = donationIdFrom(formData);
  if (!donationId) return { status: "error", message: "ไม่พบรายการบริจาค" };
  if (formData.get("checkKeyed") !== "on") return { status: "error", message: "กรุณายืนยันว่าคีย์ข้อมูลเข้าระบบ e-Donation แล้ว" };
  const ipAddress = await clientIp();
  let needTaxDeduction = true;
  try {
    await prisma.$transaction(async (tx) => {
      const donation = await tx.donation.findUnique({ where: { donationId }, select: { needTaxDeduction: true } });
      const updated = await tx.donation.updateMany({
        where: { donationId, verificationStatus: "WAITING_TREASURY_RD" },
        data: { verificationStatus: "COMPLETED_RD", rdSubmittedBy: admin.userId, rdSubmittedAt: new Date() },
      });
      if (!donation || updated.count !== 1) throw new AlreadyProcessed();
      needTaxDeduction = donation.needTaxDeduction;
      await tx.auditLog.create({ data: { userId: admin.userId, action: "APPROVE_RD_SUBMISSION", targetTable: "donations", targetId: donationId, ipAddress } });
    });
  } catch (error) {
    if (error instanceof AlreadyProcessed) return { status: "error", message: ALREADY_PROCESSED };
    console.error("RD approval failed", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "อนุมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  // Donors who did not ask for a tax deduction get no "sent to the Revenue Department" email.
  if (!needTaxDeduction) {
    refresh();
    return { status: "success", message: "อนุมัติครั้งที่ 2 แล้ว (ผู้บริจาคไม่ประสงค์ลดหย่อนภาษี จึงไม่ส่งอีเมล)" };
  }
  const email = await sendRdConfirmationEmail(donationId);
  refresh();
  return email.ok
    ? { status: "success", message: `อนุมัติครั้งที่ 2 และส่งอีเมลยืนยันแล้ว${emailNote(email)}` }
    : { status: "error", message: "อนุมัติครั้งที่ 2 แล้ว แต่ส่งอีเมลยืนยันไม่สำเร็จ กรุณากด “ส่งอีเมลอีกครั้ง”" };
}

/** Resends email 1 (certificate) or email 2 (RD confirmation). `regenerate` re-renders the PDF with current settings. */
export async function resendDonorEmail(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireStaff();
  const donationId = donationIdFrom(formData);
  const kind = formData.get("kind");
  if (!donationId || (kind !== "certificate" && kind !== "rd")) return { status: "error", message: "ไม่พบรายการบริจาค" };
  const donation = await prisma.donation.findUnique({ where: { donationId }, select: { verificationStatus: true, certificate: { select: { certificateId: true } } } });
  if (!donation?.certificate || (kind === "rd" && donation.verificationStatus !== "COMPLETED_RD")) return { status: "error", message: "รายการนี้ยังส่งอีเมลประเภทนี้ไม่ได้" };
  try {
    if (kind === "certificate" && formData.get("regenerate") === "on") await generateCertificatePdf(donationId);
  } catch (error) {
    console.error("Certificate PDF generation failed", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "สร้าง PDF ไม่สำเร็จ" };
  }
  const result = kind === "certificate" ? await sendCertificateEmail(donationId) : await sendRdConfirmationEmail(donationId);
  await prisma.auditLog.create({ data: { userId: admin.userId, action: kind === "certificate" ? "RESEND_CERTIFICATE_EMAIL" : "RESEND_RD_EMAIL", targetTable: "donations", targetId: donationId, details: { ok: result.ok }, ipAddress: await clientIp() } });
  refresh();
  return result.ok ? { status: "success", message: `ส่งอีเมลแล้ว${emailNote(result)}` } : { status: "error", message: result.error };
}
