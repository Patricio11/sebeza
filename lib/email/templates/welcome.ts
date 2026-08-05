import "server-only";
import { emailShell, escapeHtml } from "./shell";
import type { ConsentPurpose } from "@/lib/consent";

/**
 * Phase 32.4  the welcome email.
 *
 * Until now a new user verified their address and then heard nothing:
 * no explanation of what Sebenza is, no prompt to finish their profile,
 * no summary of the consent choices they had just made, no support
 * contact. For a platform asking nervous, often unemployed people to
 * trust it with their data, silence at the one moment they are most
 * receptive was the gap worth closing.
 *
 * This is deliberately NOT marketing:
 *   - transactional only  no tracking pixel, no open/click analytics,
 *     no marketing opt-in smuggled in. A digest would be its own
 *     consent purpose and its own phase.
 *   - the seeker version restates, in plain language, EXACTLY which
 *     consents they granted and where to change them. That is the
 *     POPIA §18 transparency moment, not a nicety.
 *   - it names the honest promises the platform actually keeps (we
 *     never show your ID or contact details without consent; we don't
 *     ask for ID at all right now  Phase 31) and carries the standard
 *     anti-phishing line.
 *
 * Plain-text alternatives are derived by `sendEmail` from this HTML, so
 * the copy is written to degrade readably.
 */

/** Plain-language description of each consent, for a person, not a lawyer. */
const CONSENT_IN_PLAIN_WORDS: Record<ConsentPurpose, string> = {
  searchability: "Employers can find you by skill and location.",
  contact_reveal:
    "Verified employers may request your contact details, and every single request is logged.",
  document_sharing:
    "Verified employers may request the qualification documents you upload.",
  analytics_aggregate:
    "You're counted in national employment statistics. Nothing personal is shared.",
  outcomes_research:
    "You're included in cohort-level education-to-employment research. It never identifies you.",
  vacancy_matching:
    "Verified employers can invite you to a specific, named role.",
  messaging_channel_sms: "You can receive critical notifications by SMS.",
  messaging_channel_whatsapp:
    "You can receive critical notifications on WhatsApp.",
  announcements: "You can receive occasional platform announcements by SMS.",
};

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ORIGIN ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

const H1 =
  "font-family:'Fraunces',Georgia,serif;font-size:30px;line-height:1.15;margin:0 0 16px;color:#14110d;";
const P = "font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;";
const SMALL = "font-size:13px;line-height:1.6;color:#5a5249;margin:0 0 12px;";
const EYEBROW =
  "font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;";
const BTN =
  "display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;";
const CARD =
  "border:1px solid #e4ded4;border-radius:12px;padding:16px;margin:0 0 20px;background:#faf8f3;";

/** Support + anti-phishing footer shared by both roles. */
function trustFooter(): string {
  return `
    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">Staying safe</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Sebenza will <strong>never</strong> ask you for your password, and never asks you to pay
        to apply for work. If a message claims otherwise, it isn't from us.
        Questions? Reply to this email or visit
        <a href="${origin()}/help" style="color:#006b3c;">the help centre</a>.
      </p>
    </div>`;
}

export function seekerWelcomeEmail(input: {
  name: string;
  /** The purposes the seeker actually granted, read from the DB. */
  grantedConsents: ConsentPurpose[];
}): string {
  const name = escapeHtml(input.name.split(" ")[0] ?? input.name);

  const consentRows = input.grantedConsents
    .filter((p) => CONSENT_IN_PLAIN_WORDS[p])
    .map(
      (p) =>
        `<li style="margin:0 0 8px;">${escapeHtml(CONSENT_IN_PLAIN_WORDS[p])}</li>`,
    )
    .join("");

  const consentBlock = consentRows
    ? `<ul style="font-size:14px;line-height:1.6;color:#14110d;margin:0 0 12px;padding-left:20px;">${consentRows}</ul>`
    : `<p style="${SMALL}">You haven't switched any sharing options on yet. Your profile stays private until you do.</p>`;

  return emailShell(`
    <p style="${EYEBROW}">Welcome to Sebenza</p>
    <h1 style="${H1}">You're in, ${name}.</h1>
    <p style="${P}">
      Sebenza is South Africa's talent register. Employers search it by
      <strong>skill and place</strong>, so the work finds you, rather than you
      refreshing a job board. It's free for job seekers, always.
    </p>

    <p style="${EYEBROW}">Three things worth doing now</p>
    <p style="${P}">
      Profiles that carry real detail get found far more often than empty ones:
    </p>
    <ol style="font-size:15px;line-height:1.7;color:#14110d;margin:0 0 20px;padding-left:20px;">
      <li><a href="${origin()}/dashboard/profile" style="color:#006b3c;"><strong>Add your skills</strong></a>. This is what employers actually search on.</li>
      <li><a href="${origin()}/dashboard/experience" style="color:#006b3c;"><strong>Add your experience</strong></a>. Even informal, piece and seasonal work counts.</li>
      <li><a href="${origin()}/dashboard" style="color:#006b3c;"><strong>Confirm you're available</strong></a>. Fresh statuses rank higher, and stale ones are marked honestly.</li>
    </ol>
    <p style="margin:0 0 24px;">
      <a href="${origin()}/dashboard" style="${BTN}">Finish my profile</a>
    </p>

    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">What you agreed to share</strong></p>
      ${consentBlock}
      <p style="${SMALL}margin-bottom:0;">
        You can change or withdraw any of these at any time from your
        <a href="${origin()}/dashboard/privacy" style="color:#006b3c;">privacy centre</a>,
        and withdrawing never weakens your job search.
      </p>
    </div>

    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">What we promise</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Your contact details are never shown in search results. An employer must
        be verified and you must consent, and every reveal is recorded.
        We don't ask for your ID number, and we never count a hire unless it's
        confirmed on the platform.
      </p>
    </div>

    ${trustFooter()}
  `);
}

export function employerWelcomeEmail(input: {
  name: string;
  orgName?: string | null;
}): string {
  const name = escapeHtml(input.name.split(" ")[0] ?? input.name);
  const org = input.orgName ? escapeHtml(input.orgName) : null;

  return emailShell(`
    <p style="${EYEBROW}">Welcome to Sebenza</p>
    <h1 style="${H1}">You're in, ${name}.</h1>
    <p style="${P}">
      ${org ? `${org} is` : "Your organisation is"} now set up on South Africa's
      talent register. You can search by skill, province and availability, and
      invite candidates to specific, named roles.
    </p>

    <p style="${EYEBROW}">Two things before you can reach candidates</p>
    <ol style="font-size:15px;line-height:1.7;color:#14110d;margin:0 0 20px;padding-left:20px;">
      <li><a href="${origin()}/employer/onboarding" style="color:#006b3c;"><strong>Verify your organisation</strong></a>. Contact details and documents stay locked until this is done. It protects seekers, and it's quick.</li>
      <li><a href="${origin()}/employer/account" style="color:#006b3c;"><strong>Set up two-factor authentication</strong></a>. Required for accounts that can reach personal information.</li>
    </ol>
    <p style="margin:0 0 24px;">
      <a href="${origin()}/employer" style="${BTN}">Open my workspace</a>
    </p>

    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">How candidate data works here</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Search results never include contact details, ID numbers or documents.
        Revealing a candidate's contact details requires their active consent, and
        <strong>every reveal is permanently audit-logged</strong>, visible to platform
        administrators. Invitations only reach seekers who opted in to receiving them.
        This is what makes candidates willing to be here.
      </p>
    </div>

    ${trustFooter()}
  `);
}
