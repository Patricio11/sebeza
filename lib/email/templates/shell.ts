/**
 * Phase 8  Shared email shell.
 *
 * Lifted from `lib/auth/server.ts` (Phase 2) so the notification
 * templates can reuse the brand chrome. Keep this file presentation-
 * only; logic stays in `lib/email/send.ts`.
 *
 * Standard SA-flag stripe top border + Fraunces/Hanken-style stack
 * fallback chain (we can't web-font from email so the cascade picks
 * up the best system serif/sans).
 */

export function emailShell(body: string): string {
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
                ·
                <a href="#" style="color:#5a5249;text-decoration:underline;">Notification preferences</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
