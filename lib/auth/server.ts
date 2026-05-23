/**
 * Better Auth server instance.
 *
 * Email + password + email verification + password reset. 2FA enforcement is
 * deferred to Phase 7 (see `docs/PHASE_2_PLAN.md` re-check #3).
 *
 * Schema mapping (see `db/schema.ts`):
 *   - Better Auth `user`        → `app_user` table
 *   - Better Auth `session`     → `session` table
 *   - Better Auth `account`     → `account` table
 *   - Better Auth `verification`→ `verification` table
 *
 * The `app_user` table carries an extra `role` column (`seeker | employer |
 * admin`) — Better Auth exposes it through `additionalFields` so the user
 * object on the client/server carries `user.role`.
 */

import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email/send";

const db = getDb();

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  // Origins Better Auth will accept sign-in / sign-up requests from.
  // Without this dev sign-ins can fail with CSRF-style errors when the
  // request origin doesn't match the configured baseURL exactly.
  trustedOrigins: [appUrl, "http://localhost:3000", "http://localhost:3001"],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Map Better Auth's default model names to our tables.
      user: schema.appUser,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),

  // Carry the `role` column through Better Auth's user object.
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "seeker",
        input: false, // never settable from client sign-up — server-set only
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Sebenza password",
        html: resetPasswordEmail({ name: user.name || user.email, url }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email — Sebenza",
        html: verifyEmailTemplate({ name: user.name || user.email, url }),
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day on use
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  advanced: {
    // Use Better Auth's default cookie name (`better-auth.session_token`).
    // A custom `cookiePrefix` requires every code path that reads cookies
    // (proxy/middleware, getSessionCookie, etc.) to know about it — easier
    // to silently break than to keep working. Defaults are fine.
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  /**
   * REQUIRED for Next.js Server Actions.
   *
   * Without this plugin, calling `auth.api.signInEmail()` /
   * `signUpEmail()` etc. from a Server Action returns success but the
   * Set-Cookie header is dropped — the session cookie never reaches the
   * browser. Sign-in appears to work, but every subsequent request is
   * unauthenticated, causing the proxy to bounce the user back to /sign-in
   * in an infinite loop.
   *
   * Quoting the Better Auth docs:
   *   "When you call a function that needs to set cookies, like
   *    signInEmail or signUpEmail in a server action, cookies won't
   *    be set. This is because server actions need to use the cookies
   *    helper from Next.js to set cookies."
   *
   * **Must be the last plugin in the array** per the same docs.
   */
  plugins: [
    // Phase 7 (Task 7.2) — TOTP + backup codes. Forced enrollment for
    // employer + admin sessions runs at the DAL layer; this plugin
    // just provides the endpoints (/two-factor/enable, /verify-totp,
    // /verify-backup-code, /generate-backup-codes, /disable).
    //
    // Sign-in flow: when 2FA is enabled, signInEmail returns
    // `{ twoFactorRedirect: true }` instead of a session. Our signIn
    // Server Action handles that branch by sending the user to
    // /verify-2fa where the verifyTOTP / verifyBackupCode endpoints
    // finish the handshake and mint the session.
    twoFactor({
      issuer: "Sebenza",
      skipVerificationOnEnable: false,
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;

// ─── Email templates ─────────────────────────────────────────────────────────

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fbf8f0;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif;color:#14110d;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbf8f0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e4ded4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="height:3px;background:linear-gradient(to right,#006b3c 50%,#f5a623 50%,#f5a623 83%,#de3831 83%);"></td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <span style="font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;color:#14110d;">Sebenza</span>
                <span style="display:inline-block;margin-left:4px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#5a5249;vertical-align:middle;">ZA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background:#f3efe7;color:#5a5249;font-size:12px;line-height:1.5;">
                South African talent. Visible. In real time.<br/>
                <a href="#" style="color:#5a5249;text-decoration:underline;">Privacy &amp; POPIA</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function verifyEmailTemplate({
  name,
  url,
}: {
  name: string;
  url: string;
}): string {
  return shell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">Verify your email</p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.1;margin:0 0 16px;color:#14110d;">
      One tap to confirm, ${escapeHtml(name)}.
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#14110d;">
      Tap the button below to verify your email and activate your Sebenza account.
      The link is good for 24 hours.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;">Verify email</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#5a5249;margin:0;">
      If the button doesn't work, paste this link into your browser:<br/>
      <span style="word-break:break-all;color:#006b3c;">${url}</span>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:24px 0 0;font-style:italic;">
      Didn't sign up for Sebenza? You can ignore this email — no account will be created.
    </p>
  `);
}

function resetPasswordEmail({
  name,
  url,
}: {
  name: string;
  url: string;
}): string {
  return shell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">Reset your password</p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.1;margin:0 0 16px;color:#14110d;">
      Pick a new password, ${escapeHtml(name)}.
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#14110d;">
      Tap the button below to set a new password for your Sebenza account.
      For your safety the link is only good for one hour.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${url}" style="display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;">Set a new password</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#5a5249;margin:0;">
      If the button doesn't work, paste this link into your browser:<br/>
      <span style="word-break:break-all;color:#006b3c;">${url}</span>
    </p>
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:24px 0 0;font-style:italic;">
      Didn't request this? You can safely ignore the email — your current password still works.
    </p>
  `);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
