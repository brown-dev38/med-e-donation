import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CertificateSettings } from "./certificate-settings";
import { readPrivateFile } from "./slip-storage";
import { bahtText, formatAmount, thaiLongDate } from "./thai-text";

Font.register({ family: "NotoSansThai", src: path.join(process.cwd(), "app/fonts/NotoSansThai.ttf") });
// Line breaks come from the word segmentation below, so never hyphenate inside a word.
Font.registerHyphenationCallback((word) => [word]);

const segmenter = new Intl.Segmenter("th", { granularity: "word" });

/**
 * Prepares Thai text for react-pdf:
 * - zero-width spaces between words, because Thai has no spaces and the line breaker needs break points;
 * - SARA AM is split into NIKHAHIT + SARA AA, because the PDF text layout loses one character per SARA AM otherwise.
 */
export function pdfThai(text: string) {
  const decomposed = text.replace(/([่-๋]?)ำ/g, "ํ$1า");
  return Array.from(segmenter.segment(decomposed), (part) => part.segment).join("​");
}

export type CertificateData = {
  documentNo: string;
  referenceNo: string;
  donorName: string;
  amount: string;
  fundName: string;
  studentName: string | null;
  issuedAt: Date;
  transferDate: Date;
};

const GOLD = "#b08d4a";
const GREEN = "#204d3c";
const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansThai", padding: 22, backgroundColor: "#fffdf8", color: "#243e34" },
  frame: { flex: 1, borderWidth: 2, borderColor: GOLD, padding: 6 },
  inner: { flex: 1, borderWidth: 0.7, borderColor: GOLD, paddingVertical: 22, paddingHorizontal: 48, alignItems: "center" },
  docNo: { position: "absolute", top: 14, right: 18, fontSize: 9, color: "#6e7d73" },
  logo: { width: 54, height: 60, objectFit: "contain" },
  org: { marginTop: 6, fontSize: 13, color: GREEN },
  title: { marginTop: 2, fontSize: 30, color: GREEN },
  subtitle: { fontSize: 9, letterSpacing: 2.5, color: GOLD },
  body: { marginTop: 14, fontSize: 13, textAlign: "center" },
  donor: { marginTop: 4, fontSize: 24, color: GREEN, textAlign: "center" },
  line: { marginTop: 8, fontSize: 13, textAlign: "center", lineHeight: 1.6 },
  amount: { color: GREEN },
  blessing: { marginTop: 10, fontSize: 12, textAlign: "center", color: "#4b6753" },
  bottom: { marginTop: "auto", width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  meta: { fontSize: 9, color: "#6e7d73", lineHeight: 1.6, maxWidth: 300 },
  signer: { alignItems: "center", width: 250 },
  signature: { height: 42, width: 160, objectFit: "contain" },
  signatureSpace: { height: 42 },
  signLine: { width: 200, borderTopWidth: 0.7, borderColor: "#9aa79e", marginBottom: 4 },
  signerName: { fontSize: 11 },
  signerPosition: { fontSize: 9, color: "#6e7d73", textAlign: "center" },
});

export async function renderCertificatePdf(data: CertificateData, settings: CertificateSettings) {
  const [logo, signature] = await Promise.all([
    readFile(path.join(process.cwd(), "public/images/LogoMed2.png")),
    settings.signatureImagePath ? readPrivateFile(settings.signatureImagePath).catch(() => null) : Promise.resolve(null),
  ]);
  const signatureFormat = settings.signatureImagePath?.endsWith(".png") ? "png" : "jpg";

  const doc = (
    <Document title={`${settings.title} ${data.documentNo}`} author={settings.orgName} subject={data.referenceNo}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.inner}>
            <Text style={styles.docNo}>{pdfThai(`เลขที่ ${data.documentNo}`)}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
            <Image style={styles.logo} src={{ data: logo, format: "png" }} />
            <Text style={styles.org}>{pdfThai(settings.orgName)}</Text>
            <Text style={styles.title}>{pdfThai(settings.title)}</Text>
            <Text style={styles.subtitle}>{settings.subtitle}</Text>
            <Text style={styles.body}>{pdfThai(settings.bodyText)}</Text>
            <Text style={styles.donor}>{pdfThai(data.donorName)}</Text>
            <Text style={styles.line}>
              {pdfThai("ที่ได้บริจาคเงินจำนวน ")}
              <Text style={styles.amount}>{pdfThai(`${formatAmount(data.amount)} บาท (${bahtText(data.amount)})`)}</Text>
              {"\n"}
              {pdfThai(`เพื่อ${data.fundName}`)}
              {data.studentName ? `\n${pdfThai(`นิสิตผู้รับทุน ${data.studentName}`)}` : ""}
            </Text>
            <Text style={styles.blessing}>{pdfThai(settings.blessingText)}</Text>
            <View style={styles.bottom}>
              <Text style={styles.meta}>
                {pdfThai(`ออกให้ ณ วันที่ ${thaiLongDate(data.issuedAt)}`)}
                {"\n"}
                {pdfThai(`วันที่บริจาค ${thaiLongDate(data.transferDate, "utcDate")} · เลขอ้างอิง ${data.referenceNo}`)}
                {"\n"}
                {pdfThai(settings.footerNote)}
              </Text>
              <View style={styles.signer}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML img */}
                {signature ? <Image style={styles.signature} src={{ data: signature, format: signatureFormat }} /> : <View style={styles.signatureSpace} />}
                <View style={styles.signLine} />
                <Text style={styles.signerName}>{pdfThai(`(${settings.signerName})`)}</Text>
                <Text style={styles.signerPosition}>{pdfThai(settings.signerPosition)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
