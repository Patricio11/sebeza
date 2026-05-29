import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "two-factor-authentication",
  title: "Two-factor authentication for gov accounts",
  shortDescription:
    "Mandatory TOTP enrolment on first sign-in. Backup codes, recovery posture, what happens when you switch devices.",
  category: "account_oversight",
  keywords: [
    "2fa",
    "two factor",
    "totp",
    "authenticator",
    "backup codes",
    "security",
    "mandatory",
  ],
  related: [
    "your-activity-audit-trail",
    "the-oversight-log-your-lookups",
  ],
  surfaceLink: "/gov/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Two-factor authentication is mandatory on every gov
        account, like admin accounts and unlike seeker accounts.
        The platform&rsquo;s POPIA posture treats gov access as
        privileged: aggregate data is not personally identifying,
        but the per-employer lookup + nationality-export
        capabilities warrant the protection.
      </p>

      <h2>First-sign-in flow</h2>
      <p>
        On first sign-in after your invite is consumed, the gov
        sign-in flow forces you through TOTP enrolment before
        allowing access to any analytics surface. The steps mirror
        the admin flow:
      </p>
      <ul>
        <li>
          Set a password (minimum 12 characters, at least one
          number, at least one symbol &mdash; same stricter floor
          as admin).
        </li>
        <li>
          Scan the QR code with an authenticator app (Google
          Authenticator, 1Password, Authy &mdash; whatever your
          department&rsquo;s IT policy supports).
        </li>
        <li>
          Confirm by typing a current 6-digit code.
        </li>
        <li>
          Download the 8 backup codes. Store securely; do not skip
          this step.
        </li>
      </ul>

      <h2>Backup codes are the recovery path</h2>
      <p>
        Lost phone, lost authenticator, lost both? Backup codes
        are your way back in. Each one works once. Lost backup
        codes too? The recovery path is a manual identity-
        verification process with Sebenza&rsquo;s compliance lead
        + your departmental IT contact. Plan to spend 13 working
        days; the friction is deliberate because the recovery
        path is also what would let an attacker bypass 2FA.
      </p>

      <h2>Switching devices</h2>
      <p>
        On a new phone:
      </p>
      <ul>
        <li>
          If your authenticator app supports cloud backup +
          you&rsquo;ve restored it, your existing TOTP entry comes
          with you. No action needed in Sebenza.
        </li>
        <li>
          If you&rsquo;re starting fresh, sign in with a backup
          code, then re-enrol TOTP from the Account page
          (Two-factor authentication &rarr; Reset). Generate fresh
          backup codes; the old set is invalidated by the reset.
        </li>
      </ul>

      <h2>Sessions + sign-out posture</h2>
      <p>
        Gov sessions last 12 hours of inactivity, shorter than the
        seeker 30 days and aligned with the admin 24 hours. After
        expiry, you re-authenticate with password + TOTP. Manual
        sign-out invalidates the session immediately; the next
        sign-in is a full auth flow.
      </p>

      <Callout type="warning" title="No 'remember this device' option">
        <p>
          The platform deliberately doesn&rsquo;t offer a
          long-lived remember-this-device cookie for gov accounts.
          A shared department workstation could otherwise leave a
          gov user signed in for weeks. The mild inconvenience of
          re-authenticating each shift is the trade we make for
          the security posture.
        </p>
      </Callout>

      <DashboardLink href="/gov/account">Open account security</DashboardLink>
    </HelpProse>
  );
}
