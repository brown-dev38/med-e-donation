import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { savePrivateFile } from "./slip-storage";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

/**
 * Sends through SMTP when SMTP_HOST is set. In development without SMTP, the message is
 * written to storage/outbox/*.eml so the flow can be tested without sending real email.
 * In production without SMTP it throws, so the caller records the email as FAILED.
 */
export async function sendMail(message: MailMessage): Promise<{ delivery: "smtp" | "outbox"; location?: string }> {
  const from = process.env.MAIL_FROM?.trim() || "MED UP e-Donation <no-reply@localhost>";
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST is not configured.");
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    const info = await transport.sendMail({ from, ...message });
    const location = `outbox/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.eml`;
    await savePrivateFile(location, info.message as Buffer);
    return { delivery: "outbox", location };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({ from, ...message });
  return { delivery: "smtp" };
}
