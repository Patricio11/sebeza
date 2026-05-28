"use server";

/**
 * Admin-only test-email send. Lets an operator fire a fixed payload
 * through the `sendEmail()` pipeline so they can confirm SMTP
 * credentials, domain verification, and the transport switch are all
 * lined up before a real user is affected.
 *
 * Why this exists: the historical failure mode is `EMAIL_TRANSPORT`
 * being unset in production, which makes `sendEmail()` silently
 * fall back to `console.info` and report success to the caller. A
 * test button surfaces the actual transport + provider response so
 * the operator can debug in seconds instead of after the first user
 * complaint.
 *
 * Always audit-logged so the trail captures every test-send + the
 * admin that fired it. The send itself goes through the same
 * `sendEmail()` helper every other code path uses; nothing about
 * this action bypasses the normal pipeline.
 */

import { z } from "zod";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import { emailShell } from "@/lib/email/templates/shell";

const schema = z.object({
  to: z
    .string()
    .email("Enter a valid email address.")
    .max(254),
});

export type TestEmailResult =
  | {
      ok: true;
      /** Which transport actually handled the send. `console` means the
       *  EMAIL_TRANSPORT env var wasn't set to `smtp`  emails are not
       *  going out, the operator needs to fix the env. */
      transport: "smtp" | "console";
      /** Provider message id when the transport returned one. */
      messageId?: string;
    }
  | { ok: false; message: string };

export async function sendTestEmail(
  input: z.infer<typeof schema>,
): Promise<TestEmailResult> {
  const session = await verifyAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const now = new Date();
  const subject = "Sebenza email pipeline test";
  const html = emailShell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">
      Diagnostic
    </p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:24px;line-height:1.2;margin:0 0 16px;color:#14110d;">
      Test email from Sebenza
    </h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;color:#14110d;">
      If you can read this, your Sebenza SMTP configuration is reaching
      the provider successfully.
    </p>
    <p style="font-size:13px;line-height:1.6;margin:0 0 12px;color:#5a5249;">
      Fired by <strong>${session.email ?? session.id}</strong> at
      ${now.toISOString()}.
    </p>
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:24px 0 0;font-style:italic;">
      This message was sent from /admin/settings as a diagnostic.
      You can safely ignore + delete it.
    </p>
  `);

  try {
    const result = await sendEmail({
      to: parsed.data.to,
      subject,
      html,
    });
    await logAccess({
      kind: "setting.update",
      actor: session.id,
      meta: {
        debug: "email.test_send",
        recipient: parsed.data.to,
        transport: result.transport,
        messageId: result.id ?? null,
      },
    });
    return {
      ok: true,
      transport: result.transport,
      messageId: result.id,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Log the failure too  same as a successful send, this trail
    // helps an operator correlate "I clicked test at X" with the
    // server log line that probably has the underlying cause.
    await logAccess({
      kind: "setting.update",
      actor: session.id,
      meta: {
        debug: "email.test_send",
        recipient: parsed.data.to,
        error: message,
      },
    });
    return { ok: false, message };
  }
}
