import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "shortlist-vs-pools",
  title: "Per-vacancy shortlist vs Talent pools",
  shortDescription:
    "Two bookmark surfaces; different scopes. When to use each + how they relate to invitations.",
  category: "invitations",
  keywords: [
    "shortlist",
    "talent pool",
    "talent pools",
    "bookmark",
    "save candidate",
    "pool",
    "list",
    "compare",
  ],
  related: [
    "finding-matches",
    "bulk-invite",
    "talent-pools",
  ],
  surfaceLink: "/employer/shortlists",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sebenza has two ways to bookmark a candidate. They look similar
        but serve different jobs, and conflating them slows your team
        down. Here&rsquo;s how to pick.
      </p>

      <h2>Per-vacancy shortlist</h2>
      <p>
        On any vacancy&rsquo;s Find Matches page, the bookmark icon on
        each row adds the candidate to <strong>this
        vacancy&rsquo;s</strong> shortlist. Scope is the vacancy &mdash;
        the same candidate can be shortlisted on three different
        vacancies independently.
      </p>
      <p>
        The shortlist is <strong>per-(org, vacancy)</strong>: every
        teammate who can edit this vacancy works off the same
        shortlist. Two recruiters jointly screening don&rsquo;t need to
        message each other about which candidates they&rsquo;ve
        bookmarked.
      </p>
      <p>
        Use it for: building the next round of invitees as you scroll
        through Find Matches. Switch to the <strong>Shortlist (N)</strong>{" "}
        tab + bulk-invite from there to reach only your picks.
      </p>

      <h2>Talent pools (cross-vacancy)</h2>
      <p>
        At <strong>/employer/shortlists</strong>, you create named
        pools (&ldquo;CT graduate cohort 2026&rdquo;, &ldquo;Senior
        backend devs&rdquo;) and add candidates to them. Scope is the
        organisation, not any one vacancy.
      </p>
      <p>
        Pools are for relationships, not specific roles. The candidate
        might be a great fit for the next role of that shape, even if
        the current vacancy isn&rsquo;t quite right.
      </p>
      <p>
        Use it for: succession-pipeline thinking, intern/graduate
        cohorts, &ldquo;keep an eye on these&rdquo; lists, candidates
        you almost hired and want to revisit next quarter.
      </p>

      <h2>Side-by-side</h2>
      <Callout type="info" title="One word: scope">
        <p>
          <strong>Per-vacancy shortlist</strong> = bookmarked for this
          role. <strong>Talent pool</strong> = relationship across roles.
          Same bookmark icon, very different lifecycle.
        </p>
      </Callout>
      <ul>
        <li>
          <strong>Per-vacancy</strong>: bookmark from Find Matches,
          surfaces on the Shortlist tab of that vacancy, used for
          bulk-invite within that vacancy.
        </li>
        <li>
          <strong>Talent pool</strong>: explicit Add to pool from the
          dossier, surfaces on /employer/shortlists, used for
          longer-term relationship tracking.
        </li>
      </ul>

      <h2>Audit + privacy</h2>
      <p>
        Per-vacancy shortlists are NOT a consent surface &mdash; the
        seeker is never told they&rsquo;ve been bookmarked, no audit
        kind is written. It&rsquo;s an internal workflow preference.
      </p>
      <p>
        Talent pools DO write{" "}
        <em>profile.shortlist.add / profile.shortlist.remove</em> audit
        rows so the org&rsquo;s admin oversight can see who&rsquo;s
        keeping which seekers in which pool. The seeker can see they
        were pooled in their own activity log.
      </p>
    </HelpProse>
  );
}
