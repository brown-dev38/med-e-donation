"use client";

import Image from "next/image";
import QRCode from "qrcode";
import "./promptpay-qr.css";
import { useEffect, useState } from "react";
import { qrTargetError, thaiQrPayload, type QrTarget } from "@/lib/promptpay";

/** Renders a Thai QR Payment code for a PromptPay ID or a bank account. With an amount, banking apps pre-fill it. */
export default function ThaiQr({ target, amount, size = 220, caption }: { target: QrTarget; amount?: string | null; size?: number; caption?: string }) {
  const [svg, setSvg] = useState<{ key: string; markup: string } | null>(null);
  const error = qrTargetError(target);
  const payload = error ? null : thaiQrPayload(target, amount);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0f2a3a", light: "#ffffff" } })
      .then((markup) => { if (!cancelled) setSvg({ key: payload, markup }); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [payload]);

  if (error) return <p className="promptpay-invalid">{error}</p>;
  const ready = svg?.key === payload;
  const label = target.type === "PROMPTPAY" ? "พร้อมเพย์" : "เลขบัญชีธนาคาร";
  return (
    <figure className="promptpay-qr" style={{ width: size }}>
      <figcaption className="promptpay-head">
        <Image src="/images/ThaiQR.jpg" alt="Thai QR Payment" fill sizes={`${size}px`} />
      </figcaption>
      {ready ? (
        // The SVG is generated locally by the qrcode library from a digits-only payload.
        <div className="promptpay-code" role="img" aria-label={`QR ${label}${amount ? ` ยอด ${amount} บาท` : ""}`} dangerouslySetInnerHTML={{ __html: svg.markup }} />
      ) : (
        <div className="promptpay-code promptpay-loading" role="status">กำลังสร้าง QR…</div>
      )}
      <span className="promptpay-foot">{caption ?? (target.type === "PROMPTPAY" ? "PromptPay" : "โอนเข้าบัญชีธนาคาร")}</span>
    </figure>
  );
}
