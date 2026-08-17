/**
 * Org-vetting lifecycle emails (2026-08, SRS-blueprint fan-out).
 *
 * Unconditional transactional sends, deliberately OUTSIDE the
 * per-kind notification email preferences: a KYC decision or receipt
 * is not marketing, and a user who never opted into notification
 * emails still must learn their application's fate. Same shell +
 * anti-phishing footer as the welcome email; no tracking.
 */

import { emailShell, escapeHtml } from "./shell";

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

const H1 =
  "font-family:'Fraunces',Georgia,serif;font-size:28px;line-height:1.18;margin:0 0 16px;color:#14110d;";
const P = "font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;";
const SMALL = "font-size:13px;line-height:1.6;color:#5a5249;margin:0 0 12px;";
const EYEBROW =
  "font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;";
const BTN =
  "display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;";
const CARD =
  "border:1px solid #e4ded4;border-radius:12px;padding:16px;margin:0 0 20px;background:#faf8f3;";
const REASON =
  "border-left:4px solid #de3831;background:#faf8f3;border-radius:0 12px 12px 0;padding:12px 16px;margin:0 0 20px;font-size:15px;line-height:1.6;color:#14110d;white-space:pre-wrap;";
const NOTE =
  "border-left:4px solid #c98214;background:#faf8f3;border-radius:0 12px 12px 0;padding:12px 16px;margin:0 0 20px;font-size:15px;line-height:1.6;color:#14110d;white-space:pre-wrap;";

function safety(): string {
  return `
    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">Staying safe</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Sebenza will <strong>never</strong> ask you for your password by email.
        Questions? Reply to this email or visit
        <a href="${origin()}/help" style="color:#006b3c;">the help centre</a>.
      </p>
    </div>`;
}

/** To the Owner the moment they submit for review. */
export function orgSubmittedOwnerEmail(input: {
  name: string;
  orgName: string;
}): string {
  const name = escapeHtml(input.name);
  const orgName = escapeHtml(input.orgName);
  return emailShell(`
    <p style="${EYEBROW}">Application received</p>
    <h1 style="${H1}">Thanks, ${name}. ${orgName} is now under review.</h1>
    <p style="${P}">
      We have your documents. Our team typically reviews KYC submissions
      within one business day, and you will get an email either way the
      moment there is a decision.
    </p>
    <p style="${SMALL}">
      Nothing else is needed from you right now. If our reviewers need a
      correction, the email will say exactly what to change.
    </p>
    ${safety()}
  `);
}

/** Out-of-band nudge to every admin when a submission lands. */
export function orgSubmittedAdminEmail(input: {
  orgName: string;
  ownerEmail: string;
}): string {
  const orgName = escapeHtml(input.orgName);
  const ownerEmail = escapeHtml(input.ownerEmail);
  return emailShell(`
    <p style="${EYEBROW}">Admin · verification queue</p>
    <h1 style="${H1}">${orgName} submitted KYC for review</h1>
    <p style="${P}">
      Owner: ${ownerEmail}. The submission is waiting in the organisations
      queue.
    </p>
    <p style="margin:24px 0;">
      <a href="${origin()}/admin/verifications?tab=organisations" style="${BTN}">Open the review queue</a>
    </p>
  `);
}

/** To the Owner on rejection, with the reason verbatim. */
export function orgRejectedEmail(input: {
  name: string;
  orgName: string;
  reason: string;
}): string {
  const name = escapeHtml(input.name);
  const orgName = escapeHtml(input.orgName);
  const reason = escapeHtml(input.reason);
  return emailShell(`
    <p style="${EYEBROW}">Verification decision</p>
    <h1 style="${H1}">${name}, we could not approve ${orgName}.</h1>
    <p style="${P}">Our team reviewed your application and recorded this reason:</p>
    <div style="${REASON}">${reason}</div>
    <p style="${P}">
      If circumstances change, reply to this email and we will walk through
      it with you. Rejected applications can be re-vetted once the
      underlying issue is resolved.
    </p>
    ${safety()}
  `);
}

/** To the Owner on request-changes, with the admin note verbatim. */
export function orgChangesRequestedEmail(input: {
  name: string;
  orgName: string;
  note: string;
}): string {
  const name = escapeHtml(input.name);
  const orgName = escapeHtml(input.orgName);
  const note = escapeHtml(input.note);
  return emailShell(`
    <p style="${EYEBROW}">One more step</p>
    <h1 style="${H1}">${name}, ${orgName}'s application needs a small fix.</h1>
    <p style="${P}">Our reviewers asked for the following before we can approve:</p>
    <div style="${NOTE}">${note}</div>
    <p style="margin:24px 0;">
      <a href="${origin()}/employer/onboarding" style="${BTN}">Update and resubmit</a>
    </p>
    <p style="${SMALL}">
      Your application keeps its place: fix the item above, resubmit, and it
      goes straight back to the front of the review queue.
    </p>
    ${safety()}
  `);
}
