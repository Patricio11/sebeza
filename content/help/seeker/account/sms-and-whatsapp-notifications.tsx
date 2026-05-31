import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "sms-and-whatsapp-notifications",
  title: "SMS &amp; WhatsApp notifications  opt-in, off-platform reach",
  shortDescription:
    "For critical events that can&rsquo;t wait for your next app open. Dormant until an admin enables the channel + you opt in + verify your phone + we add you to the allowlist.",
  category: "account",
  keywords: [
    "sms",
    "whatsapp",
    "notification",
    "channel",
    "phone",
    "verify",
    "opt-in",
    "twilio",
  ],
  related: [
    "managing-notification-preferences",
    "what-consent-purposes-mean",
  ],
  surfaceLink: "/dashboard/account",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Email reaches you when you check your inbox. The bell
        reaches you when you open the app. SMS + WhatsApp reach
        you on your phone, immediately  reserved for critical
        events with response windows.
      </p>

      <Callout type="info" title="Dormant by default  zero spend without explicit approval">
        <p>
          SMS + WhatsApp are external paid channels. Sebenza will
          NOT send a real SMS or WhatsApp message unless all six
          gates align: (1) admin has enabled the platform flag,
          (2) the provider env is configured, (3) you&rsquo;ve
          granted the per-channel consent in <em>Privacy &amp;
          consent</em>, (4) you&rsquo;ve toggled the channel on
          here, (5) your phone is verified, (6) an admin has added
          you to the allowlist for the gated rollout. Until then
          you&rsquo;ll see &ldquo;Coming soon&rdquo; on the
          channel section.
        </p>
      </Callout>

      <h2>How to opt in (when the channel is available)</h2>
      <Steps>
        <Step number={1}>
          <p>
            Grant the <em>SMS notifications</em> and/or{" "}
            <em>WhatsApp notifications</em> consent on{" "}
            <em>Privacy &amp; consent</em>. Both are
            default-off  withholding doesn&rsquo;t weaken any
            other surface.
          </p>
        </Step>
        <Step number={2}>
          <p>
            On <em>Account &rarr; SMS &amp; WhatsApp
            notifications</em>, enter your phone in E.164 format
            (<code>+27821234567</code>). Sebenza sends a
            6-digit code via SMS; enter the code to verify.
          </p>
        </Step>
        <Step number={3}>
          <p>
            Toggle SMS and/or WhatsApp on. Per the dormant
            posture, real messages start arriving only after the
            admin allowlist gate clears.
          </p>
        </Step>
      </Steps>

      <h2>Quiet hours</h2>
      <p>
        SMS dispatch is silent between 21:00 and 07:00 SAST. The
        same window applies to WhatsApp. Critical messages that
        land during quiet hours go out when the window opens; the
        platform doesn&rsquo;t wake you at 3 AM.
      </p>

      <h2>What we send  and what we don&rsquo;t</h2>
      <p>
        At launch only two notification kinds dispatch via SMS /
        WhatsApp: a new vacancy invitation, and a contact-reveal
        request from an employer. No marketing, no promotional
        copy, no &ldquo;you might also like&rdquo;. Stopping via
        STOP at any provider level immediately disables the
        channel on your account.
      </p>

      <h2>Removing your phone</h2>
      <p>
        The &ldquo;Remove phone&rdquo; button clears the encrypted
        number + the verification timestamp + flips both channel
        toggles off. The encrypted phone is gone from durable
        storage within the same transaction.
      </p>

      <DashboardLink href="/dashboard/account">Open Account</DashboardLink>
    </HelpProse>
  );
}
