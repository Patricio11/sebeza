import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "first-login-and-2fa-setup",
  title: "First login + mandatory 2FA setup",
  shortDescription:
    "Day-one walkthrough: invite link, password, mandatory TOTP setup, backup codes. 2FA is non-negotiable on admin accounts.",
  category: "getting_started",
  keywords: [
    "first login",
    "onboarding",
    "2fa",
    "two-factor",
    "totp",
    "mandatory",
    "backup codes",
    "setup",
  ],
  related: [
    "what-sebenza-is-for-admins",
    "admin-dashboard-tour",
    "notification-settings-for-admins",
  ],
  surfaceLink: "/admin/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Your admin account was created by an existing admin and sent
        to you as an email invite link. The first-login flow takes
        you through a password set, mandatory 2FA enrolment, and
        backup-code download &mdash; in that order, with no skip
        button on the 2FA step.
      </p>

      <h2>The four steps</h2>
      <Steps>
        <Step number={1}>
          <p>
            <strong>Open the invite link.</strong> Single-use, valid
            for 7 days. If it expired, ask the inviting admin to
            re-send; you cannot self-serve a fresh link until you have
            an account.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>Set a password.</strong> Minimum 12 characters,
            at least one number, at least one symbol &mdash; stricter
            than seeker / employer accounts because admin authority is
            stricter.
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>Enrol TOTP.</strong> Scan the QR code with your
            authenticator app (Google Authenticator, 1Password, Authy
            etc.), type a current code to confirm. The console does
            not let you continue past this step. There is no
            &ldquo;set up later&rdquo; option for admins by design.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>Download backup codes.</strong> Eight one-time
            codes. Store in a password manager and a sealed envelope
            in a locked drawer (we recommend both &mdash; a single
            location is a single point of failure). Each code works
            once if you lose access to your authenticator.
          </p>
        </Step>
      </Steps>

      <Callout type="warning" title="No 2FA bypass exists">
        <p>
          The platform does not have a way for one admin to disable
          another admin&rsquo;s 2FA remotely. If you lose both your
          authenticator and your backup codes, the recovery path is
          identity verification with our compliance lead: photo ID,
          confirmation against your HR record, a video call. Plan to
          spend an afternoon on it. Do not lose your backup codes.
        </p>
      </Callout>

      <h2>What 2FA on means for daily work</h2>
      <p>
        Every sign-in asks for your password and a current TOTP code.
        Sessions last 24 hours on admin accounts (shorter than the
        seeker 30 days) and re-prompt for 2FA at expiry. If you sign
        out manually, the next sign-in requires TOTP again. There is
        no &ldquo;remember this device&rdquo; option.
      </p>

      <DashboardLink href="/admin/account">Open your account settings</DashboardLink>
    </HelpProse>
  );
}
