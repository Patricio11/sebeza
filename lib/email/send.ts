/**
 * Transactional email transport  SMTP-only via nodemailer.
 *
 * Picks transport from `EMAIL_TRANSPORT`:
 *   - "smtp"     SMTP via nodemailer. Same code path for every
 *                  provider (Mailtrap sandbox for dev, Resend / Sendgrid
 *                  / Postmark / AWS SES SMTP relay for prod). Swapping
 *                  providers is an env-var change, not a code change.
 *   - "console"  log to terminal (fallback / first-boot, no creds)
 *
 * Every email-sending code path in Sebenza calls `sendEmail(...)`. Better
 * Auth's verification + password-reset callbacks wire through this module
 * (see `lib/auth/server.ts`).
 *
 * POPIA-First Rule (`docs/TO_START_EVERY_SESSION.md` §4): never log full PII
 * to stdout. The console transport prints recipient + subject + the first
 * 80 chars of the body. Verification + reset links are visible in the URL
 * portion of the HTML for dev convenience.
 *
 * Why SMTP-only (decision, 2026-05-28): the previous design carried a
 * separate Resend-SDK code path for production + a Mailtrap-SMTP path
 * for dev. That meant two code paths to maintain + a vendor-specific
 * dependency. Collapsing to one nodemailer transport gives us:
 *   - **Vendor portability**: switching from Resend to Sendgrid to AWS
 *     SES is an env-var swap; no code change.
 *   - **Dev/prod parity**: the same code path runs in both, so SMTP-
 *     specific quirks surface in dev rather than at launch.
 *   - **One dependency** (`nodemailer`)  no `resend` SDK lock-in.
 * Trade-off: we lose Resend's richer error responses (e.g.
 * `validation_error` strings); SMTP returns numeric codes. Acceptable
 * for our volume.
 */

import "server-only";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text fallback. If omitted, derived from `html`. */
  text?: string;
  /** Optional from override. Defaults to `SMTP_FROM` / `EMAIL_FROM`. */
  from?: string;
}

export type EmailTransport = "smtp" | "console";

/**
 * Whether to fail loud when `EMAIL_TRANSPORT` is misconfigured.
 * Defaults to "loud in production, silent in dev"  set explicitly
 * via `EMAIL_TRANSPORT_STRICT=true` if you want loud-fail in dev too.
 */
function strict(): boolean {
  const v = process.env.EMAIL_TRANSPORT_STRICT?.toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV === "production";
}

let warnedAboutFallthrough = false;

function transport(): EmailTransport {
  const v = process.env.EMAIL_TRANSPORT?.toLowerCase();
  if (v === "smtp" || v === "console") return v;
  // No `EMAIL_TRANSPORT` set. The historical default is to fall
  // through to `console` so dev flows don't break on missing creds.
  // BUT in prod that's a silent trap: emails go to the server log,
  // Better Auth thinks the send succeeded, the user gets nothing, the
  // Resend dashboard stays empty. Loud-fail in prod; warn-once
  // everywhere else.
  const hasSomeSmtpConfig = Boolean(
    process.env.SMTP_HOST ||
      process.env.SMTP_USER ||
      process.env.SMTP_PASS,
  );
  if (strict() && hasSomeSmtpConfig) {
    throw new Error(
      "EMAIL_TRANSPORT is not set, but SMTP_* env vars are present  this almost always means the deploy is missing `EMAIL_TRANSPORT=smtp`. Refusing to silently log to console. Set EMAIL_TRANSPORT_STRICT=false to opt out.",
    );
  }
  if (!warnedAboutFallthrough && hasSomeSmtpConfig) {
    warnedAboutFallthrough = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[email] EMAIL_TRANSPORT not set but SMTP_* env vars are present  falling back to console transport. Set EMAIL_TRANSPORT=smtp to actually send.",
    );
  }
  return "console";
}

function fromAddress(override?: string): string {
  if (override) return override;
  // SMTP_FROM_NAME + SMTP_FROM lets ops set the display name separately
  // from the address; matches the convention most SMTP UIs (Mailtrap,
  // Resend SMTP, Sendgrid SMTP) document. Falls back to legacy
  // EMAIL_FROM for any deploy that hasn't migrated env vars yet.
  const addr = process.env.SMTP_FROM ?? process.env.EMAIL_FROM;
  if (!addr) return "Sebenza <noreply@sebenzasa.com>";
  const name = process.env.SMTP_FROM_NAME;
  // If the address already includes a display name (`Name <addr@x>`),
  // pass through unchanged. Otherwise compose `Name <addr>`.
  if (name && !addr.includes("<")) return `${name} <${addr}>`;
  return addr;
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

  if (kind === "smtp") {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !portRaw || !user || !pass) {
      throw new Error(
        "EMAIL_TRANSPORT=smtp but one of SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS is not set.",
      );
    }
    const port = Number(portRaw);
    // `secure: true` => TLS-on-connect (port 465 convention).
    // `secure: false` => STARTTLS on a non-TLS port (587 / 2525). Both
    // are encrypted in flight  the flag only picks the handshake.
    const secure = (process.env.SMTP_SECURE ?? "").toLowerCase() === "true";
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
    });
    return { transport: "smtp", id: info.messageId };
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
