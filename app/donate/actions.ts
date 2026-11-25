"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { bangkokNow, SLIP_MAX_BYTES, validateDonation, validateSlipFile, type DonationFields, type FieldErrors } from "@/lib/donation-form";
import { encryptTaxId, hashTaxId, maskTaxId } from "@/lib/donor-crypto";
import { deleteSlip, detectSlipType, hashSlip, saveSlip } from "@/lib/slip-storage";

export type DonationState =
  | null
  | { status: "error"; message: string; fieldErrors?: FieldErrors }
  | { status: "success"; referenceNo: string; amount: string; fundName: string; email: string };

const text = (formData: FormData, name: keyof DonationFields) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, 1000) : "";
};

async function nextReferenceNo(now: Date) {
  const prefix = `MEDUP-${bangkokNow(now).date.replaceAll("-", "")}-`;
  const existing = await prisma.donation.findMany({ where: { referenceNo: { startsWith: prefix } }, select: { referenceNo: true } });
  const last = existing.reduce((max, row) => Math.max(max, Number(row.referenceNo.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}

export async function submitDonation(_previous: DonationState, formData: FormData): Promise<DonationState> {
  const fields: DonationFields = {
    fundCode: text(formData, "fundCode"),
    studentRecipientName: text(formData, "studentRecipientName"),
    studentRecipientCode: text(formData, "studentRecipientCode"),
    amount: text(formData, "amount"),
    donorType: text(formData, "donorType"),
    donorPrefix: text(formData, "donorPrefix"),
    donorName: text(formData, "donorName"),
    taxId: text(formData, "taxId"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    transferDate: text(formData, "transferDate"),
    transferTime: text(formData, "transferTime"),
    needTaxDeduction: formData.get("needTaxDeduction") === "on",
    pdpaConsent: formData.get("pdpaConsent") === "on",
  };
  const slip = formData.get("slip");
  const slipFile = slip instanceof File ? slip : null;

  let funds;
  try {
    const [activeFunds, students] = await Promise.all([
      prisma.scholarshipFund.findMany({ where: { isActive: true }, select: { fundId: true, fundCode: true, fundNameTh: true, requiresStudentName: true } }),
      prisma.scholarshipStudent.findMany({ where: { isActive: true }, select: { fullName: true, studentCode: true } }),
    ]);
    funds = activeFunds.map((fund) => ({ ...fund, students }));
  } catch {
    return { status: "error", message: "ไม่สามารถบันทึกรายการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" };
  }

  const now = new Date();
  const result = validateDonation(fields, funds, now);
  const fieldErrors: FieldErrors = result.ok ? {} : { ...result.errors };
  const slipError = validateSlipFile(slipFile);
  let bytes: Uint8Array | null = null;
  let slipType: "jpg" | "png" | null = null;
  if (slipError) fieldErrors.slip = slipError;
  else if (slipFile) {
    bytes = new Uint8Array(await slipFile.arrayBuffer());
    slipType = bytes.length <= SLIP_MAX_BYTES ? detectSlipType(bytes) : null;
    if (!slipType) fieldErrors.slip = "ไฟล์สลิปไม่ใช่ภาพ JPG หรือ PNG ที่ถูกต้อง";
  }
  if (!result.ok || Object.keys(fieldErrors).length > 0 || !bytes || !slipType) {
    return { status: "error", message: "กรุณาตรวจสอบข้อมูลที่ไฮไลต์ไว้", fieldErrors };
  }

  const data = result.data;
  const fund = funds.find((item) => item.fundCode === data.fundCode)!;
  const slipFileHash = hashSlip(bytes);
  let slipFilePath: string | null = null;

  try {
    const transferDate = new Date(`${data.transferDate}T00:00:00Z`);
    const transferTime = new Date(`1970-01-01T${data.transferTime}:00Z`);
    const duplicate = await prisma.donation.findFirst({
      where: { OR: [{ slipFileHash }, { transferDate, transferTime, amount: data.amount }] },
      select: { referenceNo: true },
    });

    slipFilePath = await saveSlip(bytes, slipType, now);
    const taxIdEncrypted = encryptTaxId(data.taxId);
    const taxIdHash = hashTaxId(data.taxId);

    // The reference number is sequential per day; retry if another request took the same number.
    for (let attempt = 0; attempt < 5; attempt++) {
      const referenceNo = await nextReferenceNo(now);
      try {
        await prisma.$transaction(async (tx) => {
          const donation = await tx.donation.create({
            data: {
              referenceNo,
              fundId: fund.fundId,
              studentRecipientName: data.studentRecipientName,
              studentRecipientCode: data.studentRecipientCode,
              donorType: data.donorType,
              donorPrefix: data.donorPrefix,
              donorName: data.donorName,
              taxIdEncrypted,
              taxIdMasked: maskTaxId(data.taxId),
              taxIdHash,
              phone: data.phone,
              email: data.email,
              needTaxDeduction: data.needTaxDeduction,
              pdpaConsent: true,
              amount: data.amount,
              transferDate,
              transferTime,
              slipFilePath: slipFilePath!,
              slipFileHash,
            },
            select: { donationId: true },
          });
          const amountText = Number(data.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 });
          await tx.adminNotification.create({
            data: {
              donationId: donation.donationId,
              notifyType: duplicate ? "POSSIBLE_DUPLICATE_SLIP" : "NEW_SLIP_UPLOADED",
              title: (duplicate
                ? `ตรวจสอบพิเศษ: สลิปอาจซ้ำกับ ${duplicate.referenceNo} — ${referenceNo} ${amountText} บาท`
                : `สลิปใหม่ ${referenceNo} — ${data.donorPrefix} ${data.donorName} ${amountText} บาท`).slice(0, 255),
              channelSent: "WEB",
            },
          });
        });
        return { status: "success", referenceNo, amount: data.amount, fundName: fund.fundNameTh, email: data.email };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error("Could not allocate a reference number.");
  } catch (error) {
    if (slipFilePath) await deleteSlip(slipFilePath).catch(() => {});
    console.error("Donation submission failed", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "ไม่สามารถบันทึกรายการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง ข้อมูลของท่านยังไม่ถูกส่ง" };
  }
}
