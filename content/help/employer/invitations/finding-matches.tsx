import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "finding-matches",
  title: "Finding matches for a vacancy",
  shortDescription:
    "The match page: chip filters, sort, per-vacancy shortlist tab + the honest-supply line at the top.",
  category: "invitations",
  keywords: [
    "find",
    "matches",
    "match",
    "candidates",
    "search",
    "filter",
    "chips",
    "sort",
    "shortlist",
    "bookmark",
    "honest supply",
  ],
  related: [
    "bulk-invite",
    "shortlist-vs-pools",
    "match-requirements",
    "searching",
  ],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        On any open vacancy detail page, click <strong>Find matches</strong>.
        The platform reverse-matches the vacancy against the live
        talent pool + returns up to 50 ranked candidates. Same Phase 4
        ranking SQL as <strong>/search</strong> &mdash; there&rsquo;s
        no parallel matcher running on this surface.
      </p>

      <h2>The honest-supply line</h2>
      <p>
        At the top of the match page, sticky on scroll:{" "}
        <em>&ldquo;N SA citizens · M candidates match this
        vacancy.&rdquo;</em> Computed across the <strong>full</strong>{" "}
        match set, not just the visible page. If there are 800 matches
        platform-wide, that count says 800 &mdash; the page still
        shows the top 50 ranked, but the honest supply line tells you
        what&rsquo;s actually out there.
      </p>
      <p>
        The Citizen-Visibility Rule applies: SA citizens get hard-grouped
        above non-citizens in the ranking. Within each group the
        composed score (relevance &times; freshness &times; completeness)
        is the secondary sort. Nationality is shown, never a gate.
      </p>

      <h2>Chip filters (client-side)</h2>
      <p>
        Above the candidate list:
      </p>
      <ul>
        <li>
          <strong>All</strong> &mdash; clears every chip filter.
        </li>
        <li>
          <strong>Six work-availability chips</strong> &mdash; full-time,
          part-time, contract, casual, remote, hybrid. Multi-select.
        </li>
        <li>
          <strong>5+ years / 8+ years</strong> &mdash; quick-pick year
          floors on top of whatever the vacancy itself requires.
        </li>
      </ul>
      <Callout type="info" title="The chips refine the fetched list">
        <p>
          The chips work on the already-fetched top-50 in your browser.
          They DON&rsquo;T re-run the matcher with tighter criteria.
          If you want a different match set with sharper filters, edit
          the vacancy&rsquo;s Match requirements + Find Matches again.
        </p>
      </Callout>

      <h2>Sort</h2>
      <ul>
        <li>
          <strong>Best match</strong> (default) &mdash; the Phase 4
          ranking + the citizen-first hard-group.
        </li>
        <li>
          <strong>Most recent status</strong> &mdash; freshest
          status_confirmed_at first. Useful when you want candidates
          who were active on the platform this week.
        </li>
        <li>
          <strong>Most complete profile</strong> &mdash; richest
          profiles first. Useful when you want to skim more dossier
          material per candidate.
        </li>
        <li>
          <strong>SA citizens first</strong> &mdash; explicit grouping
          (the default does this implicitly; this flips the sort key
          when you also want freshness or completeness as the secondary).
        </li>
      </ul>

      <h2>The Shortlist tab</h2>
      <p>
        Each row has a bookmark icon. Tap it to add the candidate to
        this vacancy&rsquo;s shortlist (per-vacancy, not per-user
        &mdash; two teammates editing the same vacancy share the
        list). Then hit the <strong>Shortlist (N)</strong> tab at the
        top to view only your shortlisted picks.
      </p>
      <p>
        When you bulk-invite from the Shortlist view, only the
        shortlisted candidates land in the confirmation modal. From
        the All matches view, the full selection set is in play.
      </p>
      <p>
        Shortlists are distinct from <strong>Talent pools</strong>{" "}
        &mdash; pools are cross-vacancy bookmarks that live on{" "}
        /employer/shortlists. See <em>Per-vacancy shortlist vs Talent
        pools</em> for when to use each.
      </p>

      <h2>Already-invited badge</h2>
      <p>
        Candidates already on this vacancy&rsquo;s invitation pipeline
        carry an <strong>Invited</strong> pill in their row. The
        bookmark + select-for-bulk-invite controls are disabled on
        them &mdash; the platform never lets you re-invite someone
        you&rsquo;ve already invited to the same vacancy.
      </p>
    </HelpProse>
  );
}
