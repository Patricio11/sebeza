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
};

export function emailContentFor(
  kind: NotificationKind,
  ctx: NotificationEmailContext,
): NotificationEmailContent | null {
  const tpl = TEMPLATES[kind];
  return tpl ? tpl(ctx) : null;
}
