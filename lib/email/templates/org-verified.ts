/**
 * "Your organisation is verified" email (2026-08, founder request).
 *
 * Sent to every ACTIVE member of an organisation the moment an admin
 * approves its KYC review, alongside the in-app org.verified
 * notification. Transactional only, no tracking, same Civic-Editorial
 * shell + anti-phishing footer as the welcome email. The single CTA is
 * exactly what the founder asked for: sign in and start.
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
  "font-family:'Fraunces',Georgia,serif;font-size:30px;line-height:1.15;margin:0 0 16px;color:#14110d;";
const P = "font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;";
const SMALL = "font-size:13px;line-height:1.6;color:#5a5249;margin:0 0 12px;";
const EYEBROW =
  "font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;";
const BTN =
  "display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;";
const CARD =
  "border:1px solid #e4ded4;border-radius:12px;padding:16px;margin:0 0 20px;background:#faf8f3;";

export function orgVerifiedEmail(input: {
  name: string;
  orgName: string;
}): string {
  const name = escapeHtml(input.name);
  const orgName = escapeHtml(input.orgName);
  return emailShell(`
    <p style="${EYEBROW}">Verification complete</p>
    <h1 style="${H1}">${orgName} is now a verified employer. Welcome aboard, ${name}.</h1>
    <p style="${P}">
      Our team has reviewed and approved your organisation's documents.
      Everything is unlocked for your whole team, effective immediately:
    </p>
    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">What you can do now</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Search the live talent register and reveal candidate contact details
        (with each seeker's consent, always audit-logged) &middot; request and
        download qualification documents &middot; run vacancies, invite
        candidates to named roles, and share public apply links &middot; log
        confirmed hires so your numbers and the national picture stay true.
      </p>
    </div>
    <p style="margin:24px 0;">
      <a href="${origin()}/sign-in" style="${BTN}">Sign in to your workspace</a>
    </p>
    <p style="${SMALL}">
      A note on how we work: profiles marked &ldquo;unverified&rdquo; mean
      exactly that, statuses carry honest freshness dates, and every reveal
      of a seeker's details is recorded where they can see it. That honesty
      is what makes the register worth your time.
    </p>
    <div style="${CARD}">
      <p style="${SMALL}margin-bottom:6px;"><strong style="color:#14110d;">Staying safe</strong></p>
      <p style="${SMALL}margin-bottom:0;">
        Sebenza will <strong>never</strong> ask you for your password by
        email. If a message claims otherwise, it isn't from us. Questions?
        Reply to this email or visit
        <a href="${origin()}/help" style="color:#006b3c;">the help centre</a>.
      </p>
    </div>
  `);
}
