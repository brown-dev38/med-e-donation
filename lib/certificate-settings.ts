import "server-only";
import { prisma } from "./prisma";

export const DEFAULT_CERTIFICATE_SETTINGS = {
  orgName: "คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา",
  title: "ใบอนุโมทนาบัตร",
  subtitle: "DONATION ACKNOWLEDGEMENT",
  bodyText: "ขออนุโมทนาในกุศลเจตนาของ",
  blessingText: "ขออำนาจแห่งผลบุญนี้ ส่งผลให้ท่านประสบแต่ความสุข ความเจริญ ตลอดไป",
  footerNote: "ข้อมูลการลดหย่อนภาษีจะนำส่งระบบ e-Donation ของกรมสรรพากร ภายใน 2 สัปดาห์หลังตรวจสอบยอดโอน",
  signerName: "คณบดีคณะแพทยศาสตร์",
  signerPosition: "คณบดีคณะแพทยศาสตร์ มหาวิทยาลัยพะเยา",
  certificateEmailSubject: "ใบอนุโมทนาบัตร {document_no} — กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา",
  certificateEmailBody:
    "เรียน {donor_name}\n\nคณะแพทยศาสตร์ มหาวิทยาลัยพะเยา ขออนุโมทนาในกุศลเจตนาของท่านที่ร่วมบริจาคเงินจำนวน {amount} บาท ({amount_text}) เพื่อ{fund_name}\n\nเจ้าหน้าที่ได้ตรวจสอบยอดโอนเรียบร้อยแล้ว และแนบใบอนุโมทนาบัตรเลขที่ {document_no} มากับอีเมลนี้\n\nข้อมูลการลดหย่อนภาษีจะนำส่งระบบ e-Donation ของกรมสรรพากรภายใน 2 สัปดาห์ หากพ้นกำหนดแล้วยังไม่พบข้อมูล กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขอ้างอิง {reference_no}\n\nขอแสดงความนับถือ\nกองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา\nโทร 054-466-666 · medfund@up.ac.th",
  rdEmailSubject: "นำส่งข้อมูล e-Donation เรียบร้อยแล้ว — {reference_no}",
  rdEmailBody:
    "เรียน {donor_name}\n\nคณะแพทยศาสตร์ มหาวิทยาลัยพะเยา ได้นำส่งข้อมูลการบริจาคของท่านจำนวน {amount} บาท (ใบอนุโมทนาบัตรเลขที่ {document_no}) เข้าสู่ระบบ e-Donation ของกรมสรรพากรเรียบร้อยแล้ว\n\nท่านสามารถตรวจสอบรายการลดหย่อนภาษีได้ที่ระบบ My Tax Account ของกรมสรรพากร หากข้อมูลไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่พร้อมแจ้งเลขอ้างอิง {reference_no}\n\nขอแสดงความนับถือ\nกองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา\nโทร 054-466-666 · medfund@up.ac.th",
};

export type CertificateSettings = typeof DEFAULT_CERTIFICATE_SETTINGS & { signatureImagePath: string | null };

/** Saved settings, or the defaults until an admin saves the settings page. */
export async function getCertificateSettings(): Promise<CertificateSettings> {
  const row = await prisma.certificateSetting.findUnique({
    where: { settingId: 1 },
    omit: { settingId: true, updatedBy: true, updatedAt: true },
  });
  return row ?? { ...DEFAULT_CERTIFICATE_SETTINGS, signatureImagePath: null };
}
