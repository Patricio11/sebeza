/**
 * Transactional email transport  env-driven.
 *
 * Picks transport from `EMAIL_TRANSPORT`:
 *   - "mailtrap" → SMTP via nodemailer to the captured sandbox inbox (dev)
 *   - "resend"   → Resend SDK (production)
 *   - "console"  → log to terminal (fallback / first-boot)
 *
 * Every email-sending code path in Sebenza calls `sendEmail(...)`. Better
 * Auth's verification + password-reset callbacks wire through this module
 * (see `lib/auth/server.ts`).
 *
 * POPIA-First Rule (`docs/TO_START_EVERY_SESSION.md` §4): never log full PII
 * to stdout. The console transport prints recipient + subject + the first
 * 80 chars of the body. Verification + reset links are visible in the URL
 * portion of the HTML for dev convenience.
 */

import "server-only";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback. If omitted, derived from `html`. */
  text?: string;
  /** Optional from override. Defaults to `EMAIL_FROM`. */
  from?: string;
}

export type EmailTransport = "mailtrap" | "resend" | "console";

function transport(): EmailTransport {
  const v = process.env.EMAIL_TRANSPORT?.toLowerCase();
  if (v === "mailtrap" || v === "resend" || v === "console") return v;
  return "console";
}

function fromAddress(override?: string): string {
  return (
    override ??
    process.env.EMAIL_FROM ??
    "Sebenza <noreply@sebenza.co.za>"
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Send an email. Resolves with the transport used + provider message id
 * (when the provider returns one).
 *
 * Never throws on a console-transport "send"  that's by design so dev
 * flows aren't blocked by missing provider credentials.
 */
export async function sendEmail(input: SendEmailInput): Promise<{
  transport: EmailTransport;
  id?: string;
}> {
  const kind = transport();
  const from = fromAddress(input.from);
  const text = input.text ?? htmlToText(input.html);

  if (kind === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "EMAIL_TRANSPORT=resend but RESEND_API_KEY is not set.",
      );
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return { transport: "resend", id: result.data?.id };
  }

  if (kind === "mailtrap") {
    const host = process.env.MAILTRAP_HOST ?? "sandbox.smtp.mailtrap.io";
    const port = Number(process.env.MAILTRAP_PORT ?? "2525");
    const user = process.env.MAILTRAP_USER;
    const pass = process.env.MAILTRAP_PASS;
    if (!user || !pass) {
      throw new Error(
        "EMAIL_TRANSPORT=mailtrap but MAILTRAP_USER / MAILTRAP_PASS are not set.",
      );
    }
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
    });
    return { transport: "mailtrap", id: info.messageId };
  }

  // console  fallback
  // POPIA: print recipient + subject + a short preview only. Real PII in
  // the email body still goes to the terminal in HTML form for dev links
  // to be clickable, but we keep the LOG line itself concise.
  // eslint-disable-next-line no-console
  console.info(
    `\n📧 [email:console] ${input.to}  "${input.subject}"\n` +
      `   from: ${from}\n` +
      `   preview: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}\n` +
      `   html:\n${indentLines(input.html, "     ")}\n`,
  );
  return { transport: "console" };
}

function indentLines(s: string, prefix: string): string {
  return s
    .split(/\r?\n/)
    .map((l) => prefix + l)
    .join("\n");
}
