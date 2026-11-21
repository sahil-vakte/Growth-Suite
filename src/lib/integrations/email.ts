/** Transactional email over SMTP (any provider: SES, Postmark, SendGrid, Mailgun, Google Workspace…). */
import nodemailer from "nodemailer";
import { env, isConfigured } from "../env";
import { recordMock } from "./http";

let transport: nodemailer.Transporter | null = null;

export async function sendEmail(m: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}) {
  if (!isConfigured.smtp()) return recordMock("email", "send", { to: m.to, subject: m.subject });
  transport ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  const info = await transport.sendMail({ from: env.smtp.from, ...m });
  return { id: info.messageId };
}
