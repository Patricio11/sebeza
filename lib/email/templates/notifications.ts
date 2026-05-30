/**
 * Phase 8  Notification email templates.
 *
 * One template per kind that's flagged `defaultEmail: true (Phase 8)`
 * in the notification catalog. The shape is intentionally small: each
 * template takes the same `meta` JSONB the in-app notification stores,
 * so we have a single source of truth for copy.
 *
 * `emailContentFor(kind, ctx)` is the dispatcher; it returns `null`
 * when the kind doesn't have an email template (e.g. `profile.viewed`,
 * which is in-app-only by policy).
 *
 * Localisation: English now. Tier-1 (`zu`/`xh`/`af`) translations land
 * in Phase 10 alongside the official rollout (per user decision).
 */

import { emailShell, escapeHtml } from "./shell";
import type { NotificationKind } from "@/lib/notifications/catalog";

export interface NotificationEmailContent {
  subject: string;
  html: string;
}

export interface NotificationEmailContext {
  /** Recipient display name (for the greeting). */
  recipientName: string | null;
  /** Notification copy that was rendered in-app. */
  title: string;
  body: string | null;
  /** Where the in-app notification links to. We add the public origin. */
  link: string | null;
  meta: Record<string, unknown> | null;
}

function appUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function fullLink(link: string | null): string | null {
  if (!link) return null;
  if (/^https?:/i.test(link)) return link;
  return `${appUrl()}${link}`;
}

function greeting(name: string | null): string {
  return name ? `Hi ${escapeHtml(name.split(/\s+/)[0] ?? name)},` : "Hi,";
}

function ctaButton(href: string | null, label: string): string {
  if (!href) return "";
  return `
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#14110d;color:#fbf8f0;text-decoration:none;padding:14px 24px;border-radius:9999px;font-weight:500;">${escapeHtml(label)}</a>
    </p>
  `;
}

function genericTemplate(
  ctx: NotificationEmailContext,
  ctaLabel: string,
  eyebrow: string,
): NotificationEmailContent {
  const link = fullLink(ctx.link);
  const html = emailShell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">${escapeHtml(eyebrow)}</p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:28px;line-height:1.2;margin:0 0 16px;color:#14110d;">
      ${escapeHtml(ctx.title)}
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;">
      ${greeting(ctx.recipientName)}
    </p>
    ${ctx.body ? `<p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#14110d;">${escapeHtml(ctx.body)}</p>` : ""}
    ${ctaButton(link, ctaLabel)}
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:24px 0 0;font-style:italic;">
      You can change which Sebenza emails you receive in your account's
      Notification preferences.
    </p>
  `);
  return { subject: ctx.title, html };
}

const TEMPLATES: Partial<
  Record<
    NotificationKind,
    (ctx: NotificationEmailContext) => NotificationEmailContent
  >
> = {
  "contact.revealed": (ctx) =>
    genericTemplate(ctx, "See your activity log", "Contact revealed"),
  "document.downloaded": (ctx) =>
    genericTemplate(ctx, "See your activity log", "Document downloaded"),
  "placement.confirmed": (ctx) =>
    genericTemplate(ctx, "Update your status", "Placement confirmed"),
  "qualification.verified": (ctx) =>
    genericTemplate(ctx, "See your dashboard", "Qualification verified"),
  "qualification.rejected": (ctx) =>
    genericTemplate(ctx, "Review and resubmit", "Qualification rejected"),
  "account.suspended": (ctx) =>
    genericTemplate(ctx, "Open your dashboard", "Account suspended"),
  "org.verified": (ctx) =>
    genericTemplate(ctx, "Open your workspace", "Organisation verified"),
  "org.rejected": (ctx) =>
    genericTemplate(ctx, "Contact support", "Verification not approved"),
  "status.stale.warning": (ctx) =>
    genericTemplate(ctx, "Re-confirm your status", "Keep your profile fresh"),
  "saved_search.new_matches": (ctx) =>
    genericTemplate(ctx, "Open the saved search", "New matches"),
  // ── Phase 9.8  vacancy invitations + responses ────────────────────────
  // All five go through `genericTemplate`  the in-app title + body already
  // carry the attribution (employer name + role) so the email reads
  // identically to the bell. The CTA labels differ per audience so the
  // recipient lands on the right surface.
  "vacancy.invite": (ctx) =>
    genericTemplate(ctx, "Open the invitation", "New vacancy invitation"),
  "vacancy.invite.expired": (ctx) =>
    genericTemplate(ctx, "Open your inbox", "Invitation closed"),
  "vacancy.invite.unanswered": (ctx) =>
    genericTemplate(ctx, "Open the vacancy", "Invitation expired"),
  "vacancy.response": (ctx) =>
    genericTemplate(ctx, "Open the vacancy", "Candidate response"),
  "vacancy.reconsider": (ctx) =>
    genericTemplate(ctx, "Open the vacancy", "Change of mind"),
  // ── Phase 9.10  employer KYC / org vetting lifecycle ──────────────────
  // All five use the shared genericTemplate shell. Eyebrow + CTA label
  // differ so the recipient lands on the right surface. The
  // notification body itself (composed at the action site) carries
  // the org name, the rejection reason, or the admin note  the
  // template just wraps it.
  "org.documents.submitted": (ctx) =>
    genericTemplate(ctx, "Open your application", "Application received"),
  "org.review.changes": (ctx) =>
    genericTemplate(ctx, "Open your application", "Updates needed"),
  "verification.queued": (ctx) =>
    genericTemplate(ctx, "Open the admin queue", "New submission"),
  // ── Phase 9.11  vacancy-outcome growth notification ──────────────────
  // Eyebrow + CTA send the recipient to Career Compass with the
  // missing-skills hint already in the URL (?missing=...) so they
  // land on the actionable surface, not a generic dashboard.
  "vacancy.outcome.other-hired": (ctx) =>
    genericTemplate(ctx, "Open Career Compass", "Vacancy outcome"),
  // ── Phase 9.12  learning-loop celebration ─────────────────────────────
  // `learning.completed` is the positive payoff. CTA points at the
  // profile so the seeker can see the freshly-added (self-attested)
  // skill in context.
  "learning.completed": (ctx) =>
    genericTemplate(ctx, "Open your profile", "Skill added"),
  // ── Phase 9.17  invited-seeker outcome to the org ────────────────────
  // Fires to every member of the inviting org when the seeker
  // completes sign-up via the invitation link. CTA lands on the
  // employer invites page where the new "Joined" row is waiting.
  "org.seeker_invite.accepted": (ctx) =>
    genericTemplate(ctx, "Open the Invites tab", "Invited seeker joined"),
  // ── Phase 11.1.1  weekly seeker digest ────────────────────────────────
  // Bespoke template (not genericTemplate)  the body composes four
  // labelled numbers (viewers / contacts / new invites / rank), each
  // with a one-line caption derived from the catalog. The CTA returns
  // the recipient to the dashboard where the same data is in context.
  "seeker.weekly_digest": (ctx) => weeklyDigestTemplate(ctx),
};

function weeklyDigestTemplate(
  ctx: NotificationEmailContext,
): NotificationEmailContent {
  const m = (ctx.meta ?? {}) as Record<string, unknown>;
  const link = fullLink(ctx.link ?? "/dashboard");
  const viewers = Number(m["viewers7d"] ?? 0);
  const contacts = Number(m["contacts7d"] ?? 0);
  const newInvites = Number(m["newInvites7d"] ?? 0);
  const rank = m["rank"] != null ? Number(m["rank"]) : null;
  const poolTotal = m["poolTotal"] != null ? Number(m["poolTotal"]) : null;
  const freshnessBand = String(m["freshnessBand"] ?? "fresh");
  const daysStale = Number(m["daysStale"] ?? 0);

  const rankLine =
    rank != null && poolTotal != null
      ? `<strong>#${rank}</strong> of ${poolTotal} in your local pool.`
      : `Not yet ranked  confirm your status to enter the pool.`;
  const freshnessLine =
    freshnessBand === "fresh"
      ? `Status is fresh (${daysStale} day${daysStale === 1 ? "" : "s"} since last confirmed).`
      : freshnessBand === "ageing"
        ? `Status is ${daysStale} days old  a re-confirm puts you back at the top.`
        : `Status is stale (${daysStale} days). Re-confirming restores full ranking weight.`;

  const html = emailShell(`
    <p style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#003d1f;margin:16px 0 8px;">This week on Sebenza</p>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:28px;line-height:1.2;margin:0 0 16px;color:#14110d;">
      ${escapeHtml(ctx.title)}
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;color:#14110d;">
      ${greeting(ctx.recipientName)}
    </p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#14110d;">
      The numbers from the last seven days.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td style="padding:12px 16px;background:#f3efe7;border-radius:8px 8px 0 0;">
          <div style="font-size:12px;color:#5a5249;letter-spacing:0.04em;text-transform:uppercase;">Employers viewed you</div>
          <div style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.1;color:#14110d;">${viewers}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#fbf8f0;">
          <div style="font-size:12px;color:#5a5249;letter-spacing:0.04em;text-transform:uppercase;">New contacts</div>
          <div style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.1;color:#14110d;">${contacts}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#f3efe7;">
          <div style="font-size:12px;color:#5a5249;letter-spacing:0.04em;text-transform:uppercase;">New vacancy invitations</div>
          <div style="font-family:'Fraunces',Georgia,serif;font-size:32px;line-height:1.1;color:#14110d;">${newInvites}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background:#fbf8f0;border-radius:0 0 8px 8px;">
          <div style="font-size:12px;color:#5a5249;letter-spacing:0.04em;text-transform:uppercase;">Rank</div>
          <div style="font-size:16px;line-height:1.4;color:#14110d;margin-top:4px;">${rankLine}</div>
          <div style="font-size:13px;line-height:1.5;color:#5a5249;margin-top:6px;">${freshnessLine}</div>
        </td>
      </tr>
    </table>
    ${ctaButton(link, "Open your dashboard")}
    <p style="font-size:12px;line-height:1.6;color:#5a5249;margin:24px 0 0;font-style:italic;">
      You can change which Sebenza emails you receive in your account's
      Notification preferences.
    </p>
  `);
  return { subject: ctx.title, html };
}

export function emailContentFor(
  kind: NotificationKind,
  ctx: NotificationEmailContext,
): NotificationEmailContent | null {
  const tpl = TEMPLATES[kind];
  return tpl ? tpl(ctx) : null;
}
