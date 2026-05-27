/**
 * Phase 9.17  recipient-facing email for the employer-initiated
 * seeker invitation.
 *
 * Different shape from the rest of `notifications.ts`: the recipient
 * is NOT yet a Sebenza user (no `app_user` row), so the email cannot
 * go through `createNotification`  it's a one-off transactional
 * `sendEmail()` call from `lib/employer/seeker-invitations.ts`.
 *
 * Reuses the shared `emailShell()` chrome so the brand reads
 * identically to every other Sebenza email + the existing
 * `escapeHtml()` helper so the personal note + org name can't smuggle
 * HTML into the body.
 *
 * POPIA §16 transparency: the footer carries the "why did I get this"
 * paragraph + a "Report this invite" link that routes to the
 * `/report-invite/[token]` token-gated form  no auth required to
 * file a report.
 */

import { emailShell, escapeHtml } from "./shell";

export interface SeekerInviteEmailInput {
  /** Display name we addressed the email to. Pre-filled by the inviter
   *  on the invite form; may be null. */
  recipientName: string | null;
  /** Verified org doing the inviting (display name). */
  orgName: string;
  /** Optional 200-char free-text note from the inviter. Rendered
   *  verbatim inside a blockquote. */
  personalNote: string | null;
  /** Profession the inviter pre-selected, if any. Mentioned in the
   *  body so the recipient knows what role context they're stepping
   *  into. */
  profession: string | null;
  /** Public-app origin (e.g. https://sebenza.co.za). The accept +
   *  decline + report links are composed against this. */
  origin: string;
  /** The signed token  goes into the URL path. */
  token: string;
}

export interface SeekerInviteEmailOutput {
  subject: string;
  html: string;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="display:inline-block;padding:14px 24px;background:#006b3c;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:16px;">${escapeHtml(label)}</a>
  </p>`;
}

export function seekerInviteEmail(
  input: SeekerInviteEmailInput,
): SeekerInviteEmailOutput {
  const acceptHref = `${input.origin.replace(/\/$/, "")}/sign-up/invited/${encodeURIComponent(input.token)}`;
  const declineHref = `${input.origin.replace(/\/$/, "")}/sign-up/invited/${encodeURIComponent(input.token)}/decline`;
  const reportHref = `${input.origin.replace(/\/$/, "")}/report-invite/${encodeURIComponent(input.token)}`;
  const greeting = input.recipientName
    ? `Hi ${escapeHtml(input.recipientName)},`
    : `Hello,`;

  const professionLine = input.profession
    ? `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;">
        They suggested the role context: <strong>${escapeHtml(input.profession)}</strong>. You'll be able to confirm or change this on the next screen.
      </p>`
    : "";

  const noteBlock = input.personalNote
    ? `<blockquote style="margin:16px 0 24px;padding:12px 16px;border-left:3px solid #f5a623;background:#fbf6e8;font-style:italic;color:#14110d;font-size:15px;line-height:1.5;">
        ${escapeHtml(input.personalNote)}
      </blockquote>`
    : "";

  const html = emailShell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">
      Invitation to Sebenza
    </p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:28px;line-height:1.2;margin:0 0 16px;color:#14110d;">
      ${escapeHtml(input.orgName)} has invited you
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;">
      ${greeting}
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;">
      <strong>${escapeHtml(input.orgName)}</strong>, a verified employer on Sebenza, has invited you to set up a profile on South Africa's talent platform. Sebenza is a national-scale, POPIA-compliant directory  your profile is yours to control, and verified employers can find you for the work you do.
    </p>
    ${professionLine}
    ${noteBlock}
    ${ctaButton(acceptHref, "Set up my profile")}
    <p style="font-size:14px;line-height:1.6;color:#5a5249;margin:0 0 16px;">
      Not interested? <a href="${declineHref}" style="color:#5a5249;text-decoration:underline;">Tell us so they don't ask again.</a>
    </p>
    <hr style="border:none;border-top:1px solid #e4ded4;margin:32px 0 16px;" />
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:0 0 8px;">
      <strong>Why did I get this?</strong> An employer at ${escapeHtml(input.orgName)} entered your email on Sebenza to invite you to set up a profile. If you don't know them or don't want to receive invitations like this,
      <a href="${declineHref}" style="color:#5a5249;text-decoration:underline;">decline above</a>
      &mdash; we will respect that decision for at least 90 days from this org.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:0;">
      If this invitation looks abusive (the inviter doesn't know you, or this isn't your email address), please
      <a href="${reportHref}" style="color:#5a5249;text-decoration:underline;">report it</a>
      &mdash; a Sebenza administrator will review and may suspend the inviter's org.
    </p>
  `);

  return {
    subject: `${input.orgName} has invited you to join Sebenza`,
    html,
  };
}
