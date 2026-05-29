import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "two-factor",
  title: "Two-factor authentication (2FA)",
  shortDescription:
    "TOTP-based 2FA. Required for Owners; recommended for everyone with write access.",
  category: "organisation",
  keywords: [
    "2fa",
    "two factor",
    "two-factor",
    "totp",
    "authenticator",
    "security",
    "owner",
    "required",
  ],
  related: [
    "team-roles",
    "kyc",
    "what-we-hold",
  ],
  surfaceLink: "/employer/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza supports TOTP-based 2FA via any authenticator app
        (Google Authenticator, Authy, 1Password, Bitwarden &mdash;
        anything that follows the RFC 6238 standard). Required for
        Owners; strongly recommended for Recruiters.
      </p>

      <h2>Setting up 2FA</h2>
      <p>
        On <strong>/setup-2fa</strong> (linked from the Account page
        when 2FA is off):
      </p>
      <ol>
        <li>
          Scan the QR code with your authenticator app, or paste the
          secret key manually.
        </li>
        <li>
          Enter the 6-digit code your app generates to confirm
          enrollment.
        </li>
        <li>
          Save the backup codes the platform shows you &mdash;
          single-use codes for when you lose access to the
          authenticator. <strong>Print them or save to a password
          manager</strong>; they&rsquo;re shown once.
        </li>
      </ol>

      <Callout type="warning" title="Owners with 2FA off lose write access">
        <p>
          If an Owner&rsquo;s 2FA gets disabled (e.g. by an admin
          force-disable for compliance), write operations gate off
          until 2FA is re-enabled. The dashboard shows a banner. This
          is the security floor for the role most likely to be
          targeted.
        </p>
      </Callout>

      <h2>Signing in with 2FA</h2>
      <p>
        After your email + password, the platform asks for a 6-digit
        code. Enter the current code from your authenticator. If
        you&rsquo;ve lost access, use one of your backup codes
        instead.
      </p>

      <h2>If you lose your authenticator</h2>
      <p>
        Two recovery paths:
      </p>
      <ul>
        <li>
          <strong>Backup codes</strong> &mdash; each is single-use.
          Use one to sign in, then immediately set up 2FA on a new
          device.
        </li>
        <li>
          <strong>Admin reset</strong> &mdash; contact Sebenza support
          if you&rsquo;ve lost both the authenticator + backup codes.
          The admin disables 2FA on your account; you re-enroll on
          next sign-in. The reset writes an audit row.
        </li>
      </ul>

      <h2>Disabling 2FA</h2>
      <p>
        On the Account page, the 2FA section has a disable button.
        Requires a current code to confirm. The action writes an audit
        row + immediately gates off the surfaces that require 2FA for
        your role. Re-enable any time by going through{" "}
        <strong>/setup-2fa</strong> again.
      </p>

      <Callout type="info" title="2FA status on the Team page">
        <p>
          /employer/team surfaces a small 2FA pill next to each member
          (green when on; muted when off). Owners can see at a glance
          whether the team&rsquo;s security floor is met. The pill is
          read-only &mdash; an Owner can&rsquo;t enable 2FA on
          someone&rsquo;s behalf; the member has to do it themselves.
        </p>
      </Callout>
    </HelpProse>
  );
}
