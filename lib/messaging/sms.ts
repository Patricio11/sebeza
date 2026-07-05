/**
 * Phase 11.4.4  SMS transport (DORMANT BY DEFAULT).
 *
 * Mirrors the lib/email/send.ts pattern: provider abstraction with a
 * `console` fallback so dev flows compile without credentials and the
 * first prod deploy doesn't accidentally spend money.
 *
 * The dispatch decision is OFF unless ALL of these are true:
 *   1. Admin flipped `feature_flag_sms_channel_enabled` ON
 *   2. Env vars set: `SMS_PROVIDER` AND `SMS_API_KEY` (+ provider-specific)
 *   3. Seeker's `messaging_channel_sms` consent granted
 *   4. Seeker's `app_user.sms_channel_enabled` = true
 *   5. Seeker's `phone_verified_at` IS NOT NULL
 *   6. Row exists in `seeker_sms_allowlist` for the seeker
 *
 * Gates 14 are checked by the dispatch layer (lib/messaging/dispatch.ts);
 * this file just contains the provider call. Without `SMS_PROVIDER` set,
 * `sendSms()` returns `{ transport: "console" }` and logs to stdout
 * the call site treats both success paths identically (`ok: true`).
 *
 * Operator runbook (when you're ready to enable):
 *   1. Choose provider: Twilio, AWS SNS, BulkSMS, Clickatell, etc.
 *   2. Set env: SMS_PROVIDER=twilio (or sns), SMS_FROM_NUMBER=+27...,
 *      TWILIO_ACCOUNT_SID=... / TWILIO_AUTH_TOKEN=... (or SNS_AWS_REGION
 *      + standard AWS credential chain).
 *   3. Admin: /admin/settings -> flip `feature_flag_sms_channel_enabled`
 *      ON.
 *   4. Admin: /admin/users -> add seekers to the allowlist one at a
 *      time + watch the monthly spend on /admin/settings.
 *
 * COST NOTE: SMS in SA is ~R0.30/message; WhatsApp Business is ~R0.10/
 * conversation. The allowlist gate caps spend per-seeker; the
 * platform flag caps spend globally.
 */

import "server-only";
import { resolveIntegration } from "@/lib/integrations/resolve";

export interface SendSmsInput {
  /** E.164 destination phone number. Required. */
  to: string;
  /** Plain-text SMS body. 140 chars is the SMS single-segment cap; we
   *  don't enforce a hard limit here  the dispatch layer above wraps
   *  multi-segment when needed. */
  body: string;
  /** Free-text tag used for provider's "label" / billing report. */
  tag?: string;
}

export type SmsTransport = "twilio" | "sns" | "console" | "disabled";

export interface SendSmsResult {
  transport: SmsTransport;
  /** Provider-side id when one was returned (Twilio MessageSid, etc.). */
  id?: string;
}

function transport(): SmsTransport {
  const v = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  if (v === "twilio") return "twilio";
  if (v === "sns") return "sns";
  if (v === "console") return "console";
  // The "disabled" path is the SAFE default. No env => no send.
  return "disabled";
}

/**
 * Dispatch a single SMS. Never throws on the `disabled` / `console`
 * paths  by design, dev flows shouldn't blow up on missing
 * credentials. Throws only on real provider errors so the dispatch
 * layer can write `notification.sms.failed` audit rows.
 */
export async function sendSms(
  input: SendSmsInput,
): Promise<SendSmsResult> {
  // Phase 25  an ENABLED admin-managed integration (encrypted creds in the
  // DB, configured on /admin/integrations) wins over env. Same provider code
  // paths; only the credential source differs.
  const admin = await resolveIntegration("sms");
  const provider = admin
    ? (admin.config.provider ?? "").toLowerCase()
    : null;

  const kind: SmsTransport = admin
    ? provider === "twilio"
      ? "twilio"
      : provider === "sns"
        ? "sns"
        : provider === "console"
          ? "console"
          : "disabled"
    : transport();

  const twilioSid = admin ? admin.secrets.twilioSid : process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = admin ? admin.secrets.twilioToken : process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = admin ? admin.config.fromNumber : process.env.SMS_FROM_NUMBER;

  if (kind === "disabled") {
    // eslint-disable-next-line no-console
    console.info(
      "[sms] DISABLED (no SMS_PROVIDER env). Would send to=" +
        input.to +
        ' body="' +
        input.body.slice(0, 60) +
        '"',
    );
    return { transport: "disabled" };
  }

  if (kind === "console") {
    // eslint-disable-next-line no-console
    console.info(
      `\n📱 [sms:console] ${input.to}\n   body: ${input.body}\n   tag: ${input.tag ?? "n/a"}\n`,
    );
    return { transport: "console" };
  }

  if (kind === "twilio") {
    const sid = twilioSid;
    const token = twilioToken;
    const from = fromNumber;
    if (!sid || !token || !from) {
      throw new Error(
        "SMS provider=twilio but the account SID / auth token / from-number is missing (admin integration or env).",
      );
    }
    // Twilio REST. We don't import the SDK  one HTTP call is cheaper
    // than a 200KB dep.
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: from,
      To: input.to,
      Body: input.body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { transport: "twilio", id: json.sid };
  }

  if (kind === "sns") {
    // AWS SNS Publish via the AWS SDK. We don't import it eagerly to
    // keep cold-start light; lazy require here so the codepath is
    // pay-as-you-use.
    const region =
      (admin ? admin.config.awsRegion : process.env.SNS_AWS_REGION) ??
      "af-south-1";
    const accessKey = admin
      ? admin.secrets.awsAccessKeyId
      : process.env.AWS_ACCESS_KEY_ID;
    const secret = admin
      ? admin.secrets.awsSecretAccessKey
      : process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKey || !secret) {
      throw new Error(
        "SMS_PROVIDER=sns but AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY is missing.",
      );
    }
    // Implementation deferred to operator setup  the SDK install +
    // sigv4 dance is non-trivial. Throw clearly so the dispatch layer
    // logs `notification.sms.failed` rather than silently no-op-ing.
    throw new Error(
      `SMS_PROVIDER=sns is wired but the implementation is deferred to operator runbook (lib/messaging/sms.ts:sns). Set SMS_PROVIDER=twilio for the working path. region=${region}`,
    );
  }

  return { transport: "disabled" };
}
