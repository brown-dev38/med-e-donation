import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { effectiveAccount, getSharedAccount, qrTargetOf } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { UiProvider } from "./components/feedback";
import DonateForm, { type FundOption } from "./donate/donate-form";
import "./donate/styles.css";

export const metadata: Metadata = {
  title: "บริจาคทุนการศึกษา | MED UP e-Donation",
  description: "แบบฟอร์มบริจาคทุนการศึกษานิสิตแพทย์ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา แนบสลิปโอนเงินและรับใบอนุโมทนาบัตรทางอีเมล",
};

async function DonateContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Fund availability and bank details are edited by staff, so read them per request.
  await connection();
  const [{ fund }, funds, students, shared] = await Promise.all([
    searchParams,
    prisma.scholarshipFund.findMany({
      where: { isActive: true },
      orderBy: { fundId: "asc" },
      select: { fundCode: true, fundNameTh: true, fundDescription: true, requiresStudentName: true, paymentMode: true, bankName: true, bankCode: true, bankAccountNo: true, bankAccountName: true, qrType: true, promptpayId: true },
    }),
    prisma.scholarshipStudent.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" }, select: { fullName: true, studentCode: true, yearLevel: true } }),
    getSharedAccount(),
  ]);
  if (funds.length === 0) {
    return (
      <section className="donate-closed" role="status">
        <h2>ยังไม่เปิดรับบริจาคออนไลน์ในขณะนี้</h2>
        <p>กองทุนกำลังเตรียมข้อมูลบัญชีรับบริจาค กรุณาติดต่อ <a href="mailto:medfund@up.ac.th">medfund@up.ac.th</a> หรือโทร <a href="tel:054466666">054-466-666</a></p>
      </section>
    );
  }
  const options: FundOption[] = funds.map((item) => {
    const account = effectiveAccount(item, shared);
    return {
      fundCode: item.fundCode,
      fundNameTh: item.fundNameTh,
      fundDescription: item.fundDescription ?? "",
      requiresStudentName: item.requiresStudentName,
      bankName: account.bankName,
      bankAccountNo: account.bankAccountNo,
      bankAccountName: account.bankAccountName || "กองทุนทุนการศึกษา คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา",
      qr: qrTargetOf(account),
    };
  });
  const initialFund = typeof fund === "string" && options.some((item) => item.fundCode === fund) ? fund : options[0].fundCode;
  return <DonateForm funds={options} students={students} initialFund={initialFund} />;
}

export default function DonatePage(props: PageProps<"/">) {
  return (
    // Confirm modal and toasts for the form; toasts sit just below the 76px sticky header.
    <UiProvider toastTop={88}>
      <div className="donate-page">
        <header className="donate-header">
          <div className="donate-container donate-header-inner">
            <Link href="/" className="donate-brand">
              <Image src="/images/LogoMed2.png" alt="ตราคณะแพทยศาสตร์ มหาวิทยาลัยพะเยา" width={40} height={44} />
              <span><strong>MED UP <span>e-Donation</span></strong><small>คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา</small></span>
            </Link>
          </div>
        </header>
        <main className="donate-container donate-main">
          <div className="donate-intro">
            <p className="donate-eyebrow"><span /> DONATION FORM</p>
            <h1>แบบฟอร์มบริจาคทุนการศึกษา</h1>
            <p>ไม่ต้องสมัครสมาชิก กรอกข้อมูลให้ครบในหน้าเดียว แล้วแนบสลิปโอนเงินเพื่อให้เจ้าหน้าที่ตรวจสอบ</p>
          </div>
          <Suspense fallback={<p className="donate-loading" role="status">กำลังโหลดแบบฟอร์ม…</p>}>
            <DonateContent searchParams={props.searchParams} />
          </Suspense>
        </main>
        <footer className="donate-footer">
          <div className="donate-container">© 2026 คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา · สอบถาม <a href="mailto:medfund@up.ac.th">medfund@up.ac.th</a> · <a href="tel:054466666">054-466-666</a></div>
        </footer>
      </div>
    </UiProvider>
  );
}
