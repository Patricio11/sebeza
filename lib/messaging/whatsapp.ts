/**
 * Phase 11.4.4  WhatsApp Business transport (DORMANT BY DEFAULT).
 *
 * Same posture as lib/messaging/sms.ts: provider-agnostic with a
 * `console` fallback. `WHATSAPP_PROVIDER` env switches between Twilio
 * (uses the Twilio API with a WhatsApp `From` channel) + the Meta
 * Cloud API (direct WhatsApp Business). Both require pre-approved
 * message templates per the WhatsApp Business policy  the dispatch
 * layer above renders one of a small approved set per kind.
 *
 * Dispatch is OFF unless the same 6 gates as SMS are met (see
 * lib/messaging/sms.ts header) with the `whatsapp` channel substituted
 * everywhere.
 *
 * COST NOTE: WhatsApp Business is ~R0.10 per "conversation" (24-hour
 * window per recipient). Cheaper than SMS per-message but template-
 * restricted in scope. Same allowlist + admin-flag gating applies.
 */

import "server-only";

export interface SendWhatsAppInput {
  /** E.164 destination phone number. */
  to: string;
  /** Pre-approved template id. Required when using Meta Cloud API. */
  templateId?: string;
  /** Plain-text body  for Twilio's WhatsApp channel this is enough;
   *  Meta Cloud requires the templateId path. */
  body: string;
  /** Free-text tag used for billing report. */
  tag?: string;
}

export type WhatsAppTransport = "twilio" | "meta" | "console" | "disabled";

export interface SendWhatsAppResult {
  transport: WhatsAppTransport;
  id?: string;
}

function transport(): WhatsAppTransport {
  const v = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (v === "twilio") return "twilio";
  if (v === "meta") return "meta";
  if (v === "console") return "console";
  return "disabled";
}

export async function sendWhatsApp(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  const kind = transport();

  if (kind === "disabled") {
    // eslint-disable-next-line no-console
    console.info(
      "[whatsapp] DISABLED (no WHATSAPP_PROVIDER env). Would send to=" +
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
      `\n📞 [whatsapp:console] ${input.to}\n   body: ${input.body}\n   templateId: ${input.templateId ?? "n/a"}\n   tag: ${input.tag ?? "n/a"}\n`,
    );
    return { transport: "console" };
  }

  if (kind === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.WHATSAPP_FROM_NUMBER;
    if (!sid || !token || !from) {
      throw new Error(
        "WHATSAPP_PROVIDER=twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / WHATSAPP_FROM_NUMBER is missing.",
      );
    }
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${input.to}`,
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
      throw new Error(`Twilio WhatsApp send failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { transport: "twilio", id: json.sid };
  }

  if (kind === "meta") {
    // Meta Cloud API: requires WHATSAPP_PHONE_NUMBER_ID +
    // WHATSAPP_ACCESS_TOKEN + a pre-approved templateId. Operator
    // runbook path  not auto-wired so a misconfigured deploy can't
    // accidentally start sending.
    throw new Error(
      `WHATSAPP_PROVIDER=meta is wired but the implementation is deferred to operator runbook. Set WHATSAPP_PROVIDER=twilio for the working path.`,
    );
  }

  return { transport: "disabled" };
}
