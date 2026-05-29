/**
 * Phase 9.23  one-shot transactional email to the contact named by
 * the seeker as their manager at the employer.
 *
 * Like the Phase 9.17 seeker-invite email, the recipient is NOT a
 * Sebenza user. The contact's email lives at most 14 days in our
 * encrypted record (D4 in the plan); after they click any of the three
 * action links, the encrypted email is redacted immediately. If they
 * do nothing, the nightly cron redacts on day 14.
 *
 * Three CTAs:
 *   verify        confirms the seeker works at the employer
 *   decline       cannot confirm (employed elsewhere, no longer there,
 *                  uncertain)  not necessarily adversarial
 *   not-me        the contact says the seeker isn't their employee
 *                  / they aren't this person's manager. Recorded as
 *                  state='disputed' in audit; the seeker sees only a
 *                  binary outcome (D9).
 *
 * POPIA §16 transparency: the footer carries the "why did I get this"
 * paragraph + the deletion clock language ("your email will be
 * deleted from our records after your response or within 14 days").
 */

import { emailShell, escapeHtml } from "./shell";

export interface EmploymentVerificationEmailInput {
  /** Display name of the contact at the employer. Pre-supplied by the
   *  seeker on the consent form. */
  contactName: string;
  /** Display name of the seeker requesting verification. */
  seekerName: string;
  /** Display name of the employer (verified org). */
  orgName: string;
  /** Public-app origin. The three CTA links are composed against this. */
  origin: string;
  /** URL-safe verification token  goes into the URL path. Cleared
   *  from the durable record after any response. */
  token: string;
  /** ISO date string for the verification window end. Shown in the
   *  footer so the contact knows when their email goes away. */
  expiresAt: string;
}

export interface EmploymentVerificationEmailOutput {
  subject: string;
  html: string;
}

function ctaButton(href: string, label: string, bg: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 20px;background:${bg};color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;margin:4px 6px 4px 0;">${escapeHtml(label)}</a>`;
}

export function employmentVerificationEmail(
  input: EmploymentVerificationEmailInput,
): EmploymentVerificationEmailOutput {
  const base = `${input.origin.replace(/\/$/, "")}/verify-employment/${encodeURIComponent(input.token)}`;
  const verifyHref = `${base}?outcome=verified`;
  const declineHref = `${base}?outcome=declined`;
  const disputeHref = `${base}?outcome=disputed`;

  const subject = `${input.seekerName} listed you as their manager at ${input.orgName}  one-time verification request`;

  const expiresFormatted = new Date(input.expiresAt).toLocaleDateString(
    "en-ZA",
    { year: "numeric", month: "long", day: "numeric" },
  );

  const body = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(input.contactName)},</p>
    <p style="margin:0 0 16px;">
      <strong>${escapeHtml(input.seekerName)}</strong> listed you as their
      manager at <strong>${escapeHtml(input.orgName)}</strong> on Sebenza,
      South Africa&rsquo;s national talent-intelligence platform, and asked
      us to email you <strong>once</strong> to confirm they currently work
      there.
    </p>
    <p style="margin:0 0 16px;">Three options:</p>
    <div style="margin:0 0 20px;">
      ${ctaButton(verifyHref, "Yes, verify they work here", "#006b3c")}
      ${ctaButton(declineHref, "I can't confirm", "#a06d2d")}
      ${ctaButton(disputeHref, "I'm not this person's employer", "#8c2727")}
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#5a5a5a;">
      This is the <strong>only</strong> email you&rsquo;ll receive about
      ${escapeHtml(input.seekerName)}&rsquo;s verification request. If
      you do nothing, the request expires on
      <strong>${escapeHtml(expiresFormatted)}</strong> and your email is
      deleted from our records.
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#5a5a5a;">
      Your response is shared with ${escapeHtml(input.seekerName)} only as
      a binary outcome (verified / not verified). The platform never
      reveals which button you clicked.
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#7a7a7a;">
      You received this because ${escapeHtml(input.seekerName)} entered
      your name and work email on Sebenza&rsquo;s consent form to verify
      their employment. POPIA §11: lawful basis is performance of an
      employment-services platform; your data is processed under the
      explicit consent recorded against the seeker&rsquo;s account.
    </p>
  `;

  return {
    subject,
    html: emailShell(body),
  };
}
