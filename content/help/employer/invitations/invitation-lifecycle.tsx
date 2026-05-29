import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "invitation-lifecycle",
  title: "The invitation lifecycle",
  shortDescription:
    "Invited -> Accepted / Declined / Expired / Withdrawn. What each state means + how decline reasons feed your analytics.",
  category: "invitations",
  keywords: [
    "invitation",
    "lifecycle",
    "state",
    "states",
    "accepted",
    "declined",
    "expired",
    "withdrawn",
    "reconsidering",
    "notice",
    "decline reason",
    "decline reasons",
  ],
  related: [
    "bulk-invite",
    "follow-up-nudges",
    "accept-rate-strip",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Every vacancy invitation has one of seven states. Most are
        terminal &mdash; once a seeker has decided, the row stays in
        that state. Two are transient (invited &rarr; accepted /
        declined) and one is reversible (declined &rarr; reconsidering).
      </p>

      <h2>Invited</h2>
      <p>
        The default state on send. The seeker has received the
        notification + can act on it. The state stays until they
        respond OR the expiry cron fires.
      </p>

      <h2>Accepted</h2>
      <p>
        The seeker said yes. Two-way engagement has happened &mdash;
        this is also the trigger that bypasses the 30-day reveal gate
        when you later mark them as hired (the invitation itself counts
        as a contact attempt + reveal-equivalent).
      </p>

      <h2>Accepted with notice</h2>
      <p>
        The seeker said yes but is currently employed and on a notice
        period (typically 1 month or 3 months in SA). The state carries
        the notice-period months on the row so you know when they can
        start. Same downstream behaviour as plain Accepted &mdash; the
        reveal-gate bypass applies, the placement flow opens up.
      </p>

      <h2>Declined</h2>
      <p>
        The seeker said no. The form they declined through asks for an
        optional structured decline reason (already_employed /
        salary_not_competitive / location_not_feasible / skills_mismatch
        / role_not_what_im_looking_for / other) plus an optional
        200-char note.
      </p>
      <Callout type="info" title="Decline reasons feed your analytics">
        <p>
          The decline-reason aggregate (Phase 9.8.7) lives on{" "}
          <strong>/employer/vacancies</strong> below the vacancy list.
          It shows the dominant decline reason per (profession ×
          province) cell across all your vacancies &mdash; k=10 floor
          applied so individual seekers can&rsquo;t be back-traced from
          counts.
        </p>
      </Callout>

      <h2>Reconsidering</h2>
      <p>
        A declined seeker tapped &ldquo;Express interest again&rdquo;
        from their dashboard. This is the change-of-mind path &mdash;
        not a dead end. Your team gets a{" "}
        <em>vacancy.reconsider</em> notification + you can re-engage.
        The original decline-reason stays on the row.
      </p>

      <h2>Withdrawn</h2>
      <p>
        Your team pulled the invite back (only possible while it&rsquo;s
        in the <em>invited</em> state &mdash; if the seeker already
        responded, withdrawal isn&rsquo;t the right tool). Used when:
        the role was cancelled, you misclicked, the seeker isn&rsquo;t
        actually a fit on reflection. Audit row written.
      </p>

      <h2>Expired</h2>
      <p>
        The vacancy&rsquo;s configured expiry window (default 14 days)
        passed without a response. The nightly cron flips the state +
        fires two notifications: <em>vacancy.invite.expired</em> to the
        seeker, <em>vacancy.invite.unanswered</em> to your team. The
        seeker can still respond on the dashboard if they catch it
        within a window of the expiry &mdash; the cron is the floor,
        not a hard cutoff for the seeker&rsquo;s side.
      </p>

      <Callout type="warning" title="Withdrawn is not Expired">
        <p>
          The two states look similar from outside but mean different
          things in audit: Withdrawn = you cancelled it; Expired = no
          response in the window. The platform-wide analytics distinguish
          them &mdash; expiry rate is a signal about your spec or your
          choice of candidates, withdrawal rate is a signal about your
          team&rsquo;s workflow.
        </p>
      </Callout>
    </HelpProse>
  );
}
