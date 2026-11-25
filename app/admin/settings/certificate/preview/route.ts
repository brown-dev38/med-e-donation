import { getCurrentAdmin } from "@/lib/auth";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { getCertificateSettings } from "@/lib/certificate-settings";
import { fiscalYearBe, formatDocumentNo } from "@/lib/certificate-number";

// Sample certificate with the saved settings and fictional donor data.
export async function GET() {
  if (!(await getCurrentAdmin())) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const now = new Date();
  const pdf = await renderCertificatePdf(
    {
      documentNo: formatDocumentNo(fiscalYearBe(now), 1),
      referenceNo: "MEDUP-YYYYMMDD-001",
      donorName: "นายตัวอย่าง ใจบุญ",
      amount: "1000.00",
      fundName: "ทุนการศึกษาสำหรับนิสิตแพทย์ที่ขาดแคลนทุนทรัพย์ (คณะจัดสรรให้กับนิสิต)",
      studentName: null,
      issuedAt: now,
      transferDate: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`),
    },
    await getCertificateSettings(),
  );
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="certificate-preview.pdf"', "Cache-Control": "private, no-store" },
  });
}
