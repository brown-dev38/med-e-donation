import "server-only";
import { renderCertificatePdf } from "./certificate-pdf";
import { getCertificateSettings } from "./certificate-settings";
import { sendMail } from "./mailer";
import { prisma } from "./prisma";
import { readPrivateFile, savePrivateFile } from "./slip-storage";
import { bahtText, fillTemplate, formatAmount, thaiLongDate, type TemplateValues } from "./thai-text";

const donationInclude = { fund: { select: { fundNameTh: true } }, certificate: true } as const;

async function loadDonation(donationId: string) {
  return prisma.donation.findUniqueOrThrow({ where: { donationId }, include: donationInclude });
}

type LoadedDonation = Awaited<ReturnType<typeof loadDonation>>;

function templateValues(donation: LoadedDonation): TemplateValues {
  return {
    donor_name: `${donation.donorPrefix} ${donation.donorName}`.trim(),
    amount: formatAmount(donation.amount),
    amount_text: bahtText(donation.amount.toString()),
    fund_name: donation.fund.fundNameTh,
    reference_no: donation.referenceNo,
    document_no: donation.certificate?.documentNo ?? "-",
    transfer_date: thaiLongDate(donation.transferDate, "utcDate"),
  };
}

const pdfFileName = (documentNo: string) => `${documentNo.replace(/[^A-Za-z0-9-]/g, "-")}.pdf`;

/** Renders the certificate with the current settings and stores it under storage/certificates/. */
export async function generateCertificatePdf(donationId: string) {
  const donation = await loadDonation(donationId);
  const certificate = donation.certificate;
  if (!certificate) throw new Error("Certificate has not been issued.");
  const settings = await getCertificateSettings();
  const pdf = await renderCertificatePdf(
    {
      documentNo: certificate.documentNo,
      referenceNo: donation.referenceNo,
      donorName: `${donation.donorPrefix} ${donation.donorName}`.trim(),
      amount: donation.amount.toString(),
      fundName: donation.fund.fundNameTh,
      studentName: donation.studentRecipientName,
      issuedAt: certificate.issuedAt,
      transferDate: donation.transferDate,
    },
    settings,
  );
  const relative = `certificates/${certificate.fiscalYearBe}/${pdfFileName(certificate.documentNo)}`;
  await savePrivateFile(relative, pdf, { overwrite: true });
  await prisma.acknowledgementCertificate.update({ where: { certificateId: certificate.certificateId }, data: { pdfFilePath: relative } });
  return { pdf, fileName: pdfFileName(certificate.documentNo) };
}

export async function getCertificatePdf(donationId: string) {
  const donation = await loadDonation(donationId);
  const certificate = donation.certificate;
  if (!certificate) return null;
  if (certificate.pdfFilePath) {
    const stored = await readPrivateFile(certificate.pdfFilePath).catch(() => null);
    if (stored) return { pdf: stored, fileName: pdfFileName(certificate.documentNo) };
  }
  return generateCertificatePdf(donationId);
}

export type EmailResult = { ok: true; delivery: "smtp" | "outbox" } | { ok: false; error: string };

/** Email 1 (after approval 1): the acknowledgement certificate PDF. Records SENT or FAILED. */
export async function sendCertificateEmail(donationId: string): Promise<EmailResult> {
  const donation = await loadDonation(donationId);
  if (!donation.certificate) return { ok: false, error: "ยังไม่ได้ออกใบอนุโมทนาบัตร" };
  try {
    const [settings, file] = await Promise.all([getCertificateSettings(), getCertificatePdf(donationId)]);
    const values = templateValues(donation);
    const result = await sendMail({
      to: donation.email,
      subject: fillTemplate(settings.certificateEmailSubject, values),
      text: fillTemplate(settings.certificateEmailBody, values),
      attachments: file ? [{ filename: file.fileName, content: file.pdf, contentType: "application/pdf" }] : [],
    });
    await prisma.acknowledgementCertificate.update({ where: { certificateId: donation.certificate.certificateId }, data: { emailSentStatus: "SENT", emailSentAt: new Date() } });
    return { ok: true, delivery: result.delivery };
  } catch (error) {
    console.error("Certificate email failed", error instanceof Error ? error.message : "unknown error");
    await prisma.acknowledgementCertificate.update({ where: { certificateId: donation.certificate.certificateId }, data: { emailSentStatus: "FAILED" } });
    return { ok: false, error: "ส่งอีเมลไม่สำเร็จ" };
  }
}

/** Email 2 (after approval 2): confirms the donation was keyed into the Revenue Department's e-Donation system. */
export async function sendRdConfirmationEmail(donationId: string): Promise<EmailResult> {
  const donation = await loadDonation(donationId);
  try {
    const settings = await getCertificateSettings();
    const values = templateValues(donation);
    const result = await sendMail({ to: donation.email, subject: fillTemplate(settings.rdEmailSubject, values), text: fillTemplate(settings.rdEmailBody, values) });
    await prisma.donation.update({ where: { donationId }, data: { rdConfirmEmailSentAt: new Date() } });
    return { ok: true, delivery: result.delivery };
  } catch (error) {
    console.error("e-Donation confirmation email failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "ส่งอีเมลไม่สำเร็จ" };
  }
}
