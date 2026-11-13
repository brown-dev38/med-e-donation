import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const thaiFont = localFont({
  src: "./fonts/NotoSansThai.ttf",
  variable: "--font-thai",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MED e-Donation | ให้โอกาสวันนี้ สร้างหมอที่ดีในวันข้างหน้า",
  description: "ร่วมสนับสนุนทุนการศึกษานิสิตแพทย์ คณะแพทยศาสตร์ มหาวิทยาลัยพะเยา ให้โอกาสทางการศึกษา เพื่อสร้างอนาคตทางการแพทย์ไปด้วยกัน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      data-scroll-behavior="smooth"
      className={thaiFont.variable}
    >
      <body>{children}</body>
    </html>
  );
}
