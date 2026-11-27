"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_CERTIFICATE_SETTINGS } from "@/lib/certificate-settings";
import { prisma } from "@/lib/prisma";
import type { PaymentMode, QrType } from "@/generated/prisma/client";
import { ACCOUNT_NOT_SET, accountIsSet, getSharedAccount, type PaymentAccount } from "@/lib/payment";
import { qrTargetError } from "@/lib/promptpay";
import { bankByCode } from "@/lib/thai-banks";
import { deleteSlip, detectSlipType, savePrivateFile } from "@/lib/slip-storage";

export type SettingsState = null | { status: "error" | "success"; message: string };

const str = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
/**
 * Reads bank account + QR fields (shared by the shared-account form and the fund forms).
 * Returns an error message, or the values to save.
 */
function readAccount(formData: FormData): { error: string } | { account: PaymentAccount } {
  const bankCode = str(formData, "bankCode", 3);
  const bank = bankByCode(bankCode);
  const bankName = bank?.name ?? str(formData, "bankNameOther", 100);
  const qrType = str(formData, "qrType", 20) as QrType;
  const account: PaymentAccount = {
    bankName,
    bankCode: bank?.code ?? null,
    bankAccountNo: str(formData, "bankAccountNo", 50) || ACCOUNT_NOT_SET,
    bankAccountName: str(formData, "bankAccountName", 255) || null,
    qrType: ["NONE", "PROMPTPAY", "BANK_ACCOUNT"].includes(qrType) ? qrType : "NONE",
    promptpayId: str(formData, "promptpayId", 30).replace(/[\s-]/g, "") || null,
  };
  if (!account.bankName) return { error: "กรุณาเลือกธนาคาร หรือกรอกชื่อธนาคาร" };
  if (account.qrType === "PROMPTPAY") {
    const error = account.promptpayId ? qrTargetError({ type: "PROMPTPAY", promptpayId: account.promptpayId }) : "กรุณากรอกพร้อมเพย์ หรือเลือกไม่แสดง QR";
    if (error) return { error };
  }
  if (account.qrType === "BANK_ACCOUNT") {
    const error = qrTargetError({ type: "BANK_ACCOUNT", bankCode: account.bankCode ?? "", accountNo: account.bankAccountNo });
    if (error) return { error };
  }
  return { account };
}

/** The shared account: one bank account and QR used by every fund set to "ใช้บัญชีรับเงินรวม". */
export async function saveSharedAccount(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const result = readAccount(formData);
  if ("error" in result) return { status: "error", message: result.error };
  if (!accountIsSet(result.account)) {
    const using = await prisma.scholarshipFund.count({ where: { paymentMode: "SHARED", isActive: true } });
    if (using > 0) return { status: "error", message: `มี ${using} วัตถุประสงค์ที่เปิดรับบริจาคโดยใช้บัญชีรวม ต้องมีเลขที่บัญชีจริง` };
  }
  await prisma.$transaction([
    prisma.paymentSetting.upsert({ where: { settingId: 1 }, create: { settingId: 1, ...result.account, updatedBy: admin.userId }, update: { ...result.account, updatedBy: admin.userId } }),
    prisma.auditLog.create({ data: { userId: admin.userId, action: "UPDATE_SHARED_PAYMENT", targetTable: "payment_settings", targetId: "1", details: { qrType: result.account.qrType } } }),
  ]);
  refresh();
  return { status: "success", message: "บันทึกบัญชีรับเงินรวมแล้ว" };
}

/** Adds a new donation purpose. It starts closed and on the shared account, so it is safe until edited. */
export async function createFund(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const fundNameTh = str(formData, "fundNameTh", 255);
  let fundCode = str(formData, "fundCode", 50).toUpperCase().replace(/[\s-]+/g, "_");
  if (fundNameTh.length < 3) return { status: "error", message: "กรุณากรอกชื่อวัตถุประสงค์" };
  if (fundCode && !/^[A-Z][A-Z0-9_]{1,49}$/.test(fundCode)) return { status: "error", message: "รหัสต้องขึ้นต้นด้วยตัวอักษรอังกฤษ และมีได้เฉพาะ A–Z, 0–9 และ _" };
  if (!fundCode) fundCode = `FUND_${Date.now().toString(36).toUpperCase()}`;
  if (await prisma.scholarshipFund.findUnique({ where: { fundCode }, select: { fundId: true } })) return { status: "error", message: `รหัส ${fundCode} ถูกใช้แล้ว` };
  const fund = await prisma.scholarshipFund.create({
    data: { fundCode, fundNameTh, requiresStudentName: formData.get("requiresStudentName") === "on", paymentMode: "SHARED", bankAccountNo: ACCOUNT_NOT_SET, isActive: false },
  });
  await prisma.auditLog.create({ data: { userId: admin.userId, action: "CREATE_FUND", targetTable: "scholarship_funds", targetId: String(fund.fundId), details: { fundCode } } });
  refresh();
  return { status: "success", message: `เพิ่ม “${fundNameTh}” แล้ว (ปิดรับบริจาคไว้ก่อน ตรวจการตั้งค่าแล้วเปิดใช้งานได้)` };
}

/** Deletes a purpose that never received a donation; otherwise it should be closed instead. */
export async function deleteFund(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const fundId = Number(formData.get("fundId"));
  if (!Number.isInteger(fundId) || fundId < 1) return { status: "error", message: "ไม่พบวัตถุประสงค์" };
  if ((await prisma.donation.count({ where: { fundId } })) > 0) return { status: "error", message: "ลบไม่ได้ เพราะมีรายการบริจาคแล้ว" };
  const deleted = await prisma.scholarshipFund.deleteMany({ where: { fundId } });
  if (!deleted.count) return { status: "error", message: "ไม่พบวัตถุประสงค์" };
  await prisma.auditLog.create({ data: { userId: admin.userId, action: "DELETE_FUND", targetTable: "scholarship_funds", targetId: String(fundId) } });
  refresh();
  return { status: "success", message: "ลบวัตถุประสงค์แล้ว" };
}

export async function saveFund(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const fundId = Number(formData.get("fundId"));
  if (!Number.isInteger(fundId) || fundId < 1) return { status: "error", message: "ไม่พบกองทุน" };
  const paymentMode: PaymentMode = formData.get("paymentMode") === "OWN" ? "OWN" : "SHARED";
  const before = await prisma.scholarshipFund.findUnique({ where: { fundId } });
  if (!before) return { status: "error", message: "ไม่พบกองทุน" };

  // In SHARED mode the fund's own account fields are kept as they were, so switching back restores them.
  let own: PaymentAccount = before;
  if (paymentMode === "OWN") {
    const result = readAccount(formData);
    if ("error" in result) return { status: "error", message: result.error };
    own = result.account;
  }
  const data = {
    fundNameTh: str(formData, "fundNameTh", 255),
    fundDescription: str(formData, "fundDescription", 2000) || null,
    requiresStudentName: formData.get("requiresStudentName") === "on",
    paymentMode,
    bankName: own.bankName, bankCode: own.bankCode, bankAccountNo: own.bankAccountNo, bankAccountName: own.bankAccountName, qrType: own.qrType, promptpayId: own.promptpayId,
    isActive: formData.get("isActive") === "on",
  };
  if (!data.fundNameTh) return { status: "error", message: "กรุณากรอกชื่อวัตถุประสงค์ทุน" };
  if (data.isActive) {
    const account = paymentMode === "SHARED" ? await getSharedAccount() : own;
    if (!accountIsSet(account)) return { status: "error", message: paymentMode === "SHARED" ? "ต้องตั้งค่าเลขที่บัญชีในบัญชีรับเงินรวมก่อนเปิดรับบริจาค" : "ต้องกรอกเลขที่บัญชีจริงก่อนเปิดรับบริจาค" };
  }

  await prisma.$transaction([
    prisma.scholarshipFund.update({ where: { fundId }, data }),
    prisma.auditLog.create({
      data: {
        userId: admin.userId, action: "UPDATE_FUND_SETTINGS", targetTable: "scholarship_funds", targetId: String(fundId),
        details: { changed: Object.keys(data).filter((key) => String(before[key as keyof typeof before] ?? "") !== String(data[key as keyof typeof data] ?? "")) },
      },
    }),
  ]);
  refresh();
  return { status: "success", message: data.isActive ? "บันทึกแล้ว กองทุนนี้เปิดรับบริจาค" : "บันทึกแล้ว (ปิดรับบริจาค)" };
}

/** Adds students from a textarea: one per line, "ชื่อ–นามสกุล, รหัสนิสิต, ชั้นปี" (code and year optional). */
export async function addStudents(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const lines = str(formData, "students", 50_000).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { status: "error", message: "กรุณากรอกรายชื่ออย่างน้อย 1 บรรทัด" };
  if (lines.length > 500) return { status: "error", message: "เพิ่มได้ครั้งละไม่เกิน 500 รายชื่อ" };
  const rows = [];
  for (const [index, line] of lines.entries()) {
    const [fullName = "", studentCode = "", year = ""] = line.split(/\s*[,\t]\s*/);
    const yearLevel = year ? Number(year) : null;
    if (fullName.length < 2 || fullName.length > 255) return { status: "error", message: `บรรทัดที่ ${index + 1}: ชื่อไม่ถูกต้อง` };
    if (studentCode && !/^[A-Za-z0-9-]{1,20}$/.test(studentCode)) return { status: "error", message: `บรรทัดที่ ${index + 1}: รหัสนิสิตต้องเป็นตัวอักษรหรือตัวเลข ไม่เกิน 20 ตัว` };
    if (yearLevel !== null && !(Number.isInteger(yearLevel) && yearLevel >= 1 && yearLevel <= 6)) return { status: "error", message: `บรรทัดที่ ${index + 1}: ชั้นปีต้องเป็น 1–6` };
    rows.push({ fullName: fullName.replace(/\s+/g, " "), studentCode: studentCode || null, yearLevel });
  }
  const existing = new Set((await prisma.scholarshipStudent.findMany({ select: { fullName: true } })).map((row) => row.fullName));
  const fresh = rows.filter((row) => !existing.has(row.fullName));
  await prisma.$transaction([
    prisma.scholarshipStudent.createMany({ data: fresh }),
    prisma.auditLog.create({ data: { userId: admin.userId, action: "ADD_STUDENTS", targetTable: "scholarship_students", targetId: "bulk", details: { added: fresh.length } } }),
  ]);
  refresh();
  const skipped = rows.length - fresh.length;
  return { status: "success", message: `เพิ่ม ${fresh.length} รายชื่อ${skipped ? ` (ข้าม ${skipped} รายชื่อที่มีอยู่แล้ว)` : ""}` };
}

const STUDENT_DONE = { delete: "ลบรายชื่อแล้ว", activate: "แสดงรายชื่อบนฟอร์มแล้ว", deactivate: "ซ่อนรายชื่อจากฟอร์มแล้ว" } as const;

export async function updateStudent(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const studentId = Number(formData.get("studentId"));
  const op = formData.get("op");
  if (!Number.isInteger(studentId) || studentId < 1 || (op !== "delete" && op !== "activate" && op !== "deactivate")) return { status: "error", message: "ไม่พบรายชื่อนิสิต" };
  const result = op === "delete"
    ? await prisma.scholarshipStudent.deleteMany({ where: { studentId } })
    : await prisma.scholarshipStudent.updateMany({ where: { studentId }, data: { isActive: op === "activate" } });
  if (!result.count) return { status: "error", message: "ไม่พบรายชื่อนิสิต" };
  await prisma.auditLog.create({ data: { userId: admin.userId, action: `STUDENT_${op.toUpperCase()}`, targetTable: "scholarship_students", targetId: String(studentId) } });
  refresh();
  return { status: "success", message: STUDENT_DONE[op] };
}

const TEXT_LIMITS = {
  orgName: 255, title: 255, subtitle: 255, bodyText: 1000, blessingText: 1000, footerNote: 1000, signerName: 255, signerPosition: 255,
  certificateEmailSubject: 255, certificateEmailBody: 5000, rdEmailSubject: 255, rdEmailBody: 5000,
} as const;

export async function saveCertificateSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const values = {} as Record<keyof typeof TEXT_LIMITS, string>;
  for (const [name, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    values[name] = str(formData, name, max) || DEFAULT_CERTIFICATE_SETTINGS[name];
  }

  const current = await prisma.certificateSetting.findUnique({ where: { settingId: 1 }, select: { signatureImagePath: true } });
  let signatureImagePath = current?.signatureImagePath ?? null;
  const upload = formData.get("signature");
  if (upload instanceof File && upload.size > 0) {
    if (upload.size > 1024 * 1024) return { status: "error", message: "ไฟล์ลายเซ็นต้องไม่เกิน 1 MB" };
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const type = detectSlipType(bytes);
    if (!type) return { status: "error", message: "ลายเซ็นต้องเป็นภาพ PNG หรือ JPG" };
    signatureImagePath = await savePrivateFile(`settings/signature-${randomUUID()}.${type}`, bytes);
  } else if (formData.get("removeSignature") === "on") {
    signatureImagePath = null;
  }

  await prisma.$transaction([
    prisma.certificateSetting.upsert({
      where: { settingId: 1 },
      create: { settingId: 1, ...values, signatureImagePath, updatedBy: admin.userId },
      update: { ...values, signatureImagePath, updatedBy: admin.userId },
    }),
    prisma.auditLog.create({ data: { userId: admin.userId, action: "UPDATE_CERTIFICATE_SETTINGS", targetTable: "certificate_settings", targetId: "1" } }),
  ]);
  if (current?.signatureImagePath && current.signatureImagePath !== signatureImagePath) await deleteSlip(current.signatureImagePath).catch(() => {});
  refresh();
  return { status: "success", message: "บันทึกการตั้งค่าแล้ว ใบอนุโมทนาบัตรที่ออกหลังจากนี้จะใช้รูปแบบใหม่" };
}
