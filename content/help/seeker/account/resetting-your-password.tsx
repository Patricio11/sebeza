import {
  HelpProse,
  Callout,
  Steps,
  Step,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "resetting-your-password",
  title: "Resetting your password",
  shortDescription:
    "Reset link via email, 60-minute expiry, what happens to active sessions, and what to do if you can't access the email you signed up with.",
  category: "account",
  keywords: [
    "password",
    "reset",
    "forgot",
    "change password",
    "email",
    "session",
  ],
  related: [
    "two-factor-authentication-setup",
  ],
  surfaceLink: "/dashboard/account",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Password resets happen via a single-use email link. You can
        trigger one from the sign-in page (&ldquo;Forgot
        password?&rdquo;) without being signed in, or from the Account
        page if you want to change a password you still remember.
      </p>

      <h2>The reset flow</h2>
      <Steps>
        <Step number={1}>
          <p>
            On the sign-in page, hit <em>Forgot password?</em> Enter
            the email you registered with. Hit submit.
          </p>
        </Step>
        <Step number={2}>
          <p>
            The platform emails a reset link to that address. The link
            is valid for 60 minutes. If you don&rsquo;t see the email,
            check spam; if it&rsquo;s still missing, the email
            isn&rsquo;t registered on Sebenza (no account exists with
            that address). The platform deliberately doesn&rsquo;t
            distinguish between &ldquo;no account&rdquo; and &ldquo;email
            sent&rdquo; on the page itself &mdash; that would let
            someone fish for which addresses have accounts.
          </p>
        </Step>
        <Step number={3}>
          <p>
            Click the link. Enter a new password (8+ characters, at
            least one number, at least one symbol). Submit. The link
            is consumed; you can&rsquo;t use it twice.
          </p>
        </Step>
        <Step number={4}>
          <p>
            All other active sessions are invalidated. Anywhere
            you&rsquo;re signed in &mdash; phone, laptop, work computer
            &mdash; you&rsquo;re signed out and have to log in again
            with the new password. This is the safety net: if your
            password was compromised, the bad actor loses their session
            immediately.
          </p>
        </Step>
      </Steps>

      <h2>If 2FA is on</h2>
      <p>
        A password reset doesn&rsquo;t disable 2FA. After typing the
        new password, you&rsquo;re still asked for your current TOTP
        code (or a backup code) to complete sign-in. If you&rsquo;ve
        lost both your password and your authenticator, see the manual
        recovery section in the 2FA article.
      </p>

      <Callout type="warning" title="If you can't access the email you signed up with">
        <p>
          Email is the canonical identity on Sebenza. If you can&rsquo;t
          access it, the support team needs to verify you&rsquo;re the
          owner of the account via other data we hold (name, national
          ID where on file, recent activity). This is intentionally
          slow &mdash; usually 35 working days &mdash; because it&rsquo;s
          the path that would also work for someone trying to take over
          your account. Reach out via{" "}
          <em>Contact support</em> from the sign-in page.
        </p>
      </Callout>

      <h2>Changing a password you still remember</h2>
      <p>
        From the Account page, the password section has a{" "}
        <em>Request reset link</em> button rather than an inline form.
        The platform always routes through the email flow so the new
        password is set in an authenticated context, not against a
        possibly-stolen session. Slightly more friction; meaningfully
        more security.
      </p>
    </HelpProse>
  );
}
