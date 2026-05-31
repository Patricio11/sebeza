import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "seeker-control-surfaces",
  title: "What seekers can do silently  pause, block, report",
  shortDescription:
    "Three seeker-side controls affect your reach. None of them notify you. Honest documentation of the privacy invariants.",
  category: "privacy",
  keywords: [
    "block",
    "pause",
    "report",
    "silent",
    "consent",
    "withdrawn",
    "moderation",
    "invariant",
  ],
  related: [
    "what-we-hold",
    "audit-log",
  ],
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Seekers have three control surfaces that affect whether you
        can find them or invite them. The platform does <strong>not
        notify you</strong> when any of them is used. This is by
        design  the privacy posture protects honest seeker
        agency. This article documents what&rsquo;s happening
        behind the scenes so you can interpret outcomes correctly.
      </p>

      <h2>Pause searchability (per-seeker)</h2>
      <p>
        A seeker can pause appearing in employer search for a
        defined window (1 / 3 / 6 / 12 months). While paused, they
        do not surface in your search results; bulk-invite silently
        skips them under the existing &ldquo;N not eligible right
        now&rdquo; summary. The pause auto-resumes on the chosen
        date. Cause-effect: a seeker who was visible last week +
        isn&rsquo;t this week may simply be paused.
      </p>

      <h2>Block this employer (per-(seeker, org))</h2>
      <p>
        A seeker can block your specific org from finding or
        inviting them. The block is private  you are never told,
        you never see a per-org block count, and the block never
        appears in any audit log you can read. Search results +
        bulk-invite silently exclude blocked-by-you seekers, same
        as the consent-revoke or pause path.
      </p>

      <Callout type="info" title="Block vs report  two different signals">
        <p>
          A block is a routine &ldquo;not interested&rdquo;.
          It&rsquo;s silent + reversible by the seeker any time.
          A report is a moderation escalation  the seeker has
          flagged something about your invitation as inappropriate
          (harassment, off-platform contact, bad-faith pattern).
          Reports do reach the admin queue; you may be asked
          questions during review. The two surfaces are
          deliberately decoupled so a seeker can do one without
          the other.
        </p>
      </Callout>

      <h2>Report this invite (per-invitation)</h2>
      <p>
        A seeker can report a specific invitation with a structured
        reason: harassment, spam, inappropriate, irrelevant role,
        bad-faith company, off-platform contact request, or other.
        Reports land in <code>/admin/moderation</code>. You may be
        contacted by admin during review; you are not told
        automatically that a report was filed.
      </p>

      <h2>Why no notification?</h2>
      <p>
        Telling you about a block, pause, or report would create
        perverse incentives  retaliation off-platform, blacklist
        scoring, social pressure to unblock. The privacy invariant
        keeps the surface honest. Your view degrades quietly; the
        seeker&rsquo;s view stays in their control.
      </p>

      <DashboardLink href="/employer/help">Open employer help</DashboardLink>
    </HelpProse>
  );
}
