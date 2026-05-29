import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "talent-pools",
  title: "Talent pools (cross-vacancy shortlists)",
  shortDescription:
    "Named pools for relationships across roles. Cross-cutting bookmarks distinct from per-vacancy shortlists.",
  category: "talent_search",
  keywords: [
    "talent pool",
    "talent pools",
    "pool",
    "shortlist pool",
    "bookmark",
    "cross-vacancy",
    "graduate cohort",
    "pipeline",
  ],
  related: [
    "shortlist-vs-pools",
    "searching",
    "saved-searches",
  ],
  surfaceLink: "/employer/shortlists",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Talent pools at <strong>/employer/shortlists</strong> are
        cross-vacancy bookmarks. Distinct from the per-vacancy
        shortlist on the Find Matches page; this is for tracking
        candidates across many roles + over time.
      </p>

      <h2>Creating a pool</h2>
      <p>
        On <strong>/employer/shortlists</strong> hit{" "}
        <strong>New pool</strong>. Give it a name + an optional
        description. Pool names live forever on your org &mdash; they
        rarely get deleted, so pick a name that&rsquo;s meaningful in
        a year (&ldquo;CT graduate cohort 2026&rdquo;, &ldquo;Senior
        backend devs&rdquo;).
      </p>

      <h2>Adding candidates to a pool</h2>
      <p>
        From a seeker&rsquo;s dossier or any search row, hit{" "}
        <strong>Add to pool</strong>. The picker lists your
        organisation&rsquo;s pools; pick one. The candidate is now
        bookmarked across your team.
      </p>
      <Callout type="info" title="The seeker can see they were pooled">
        <p>
          Adding to a pool writes a <em>profile.shortlist.add</em>{" "}
          audit row. The seeker sees the event in their
          /dashboard/activity feed (they don&rsquo;t see which pool,
          just that your org bookmarked them). Removing them writes
          a corresponding <em>profile.shortlist.remove</em> row.
          Transparency is the platform&rsquo;s posture.
        </p>
      </Callout>

      <h2>Browsing a pool</h2>
      <p>
        On a pool detail page, every member appears as a card with the
        same redacted public profile shape that /search returns.
        Open dossiers from here when you&rsquo;re ready to reach out.
      </p>
      <p>
        There&rsquo;s no bulk-invite affordance on talent pools &mdash;
        if you want to invite multiple pool members to a specific
        vacancy, open Find Matches on that vacancy + bookmark them
        there (per-vacancy shortlist). The two surfaces deliberately
        don&rsquo;t cross-pollinate; that would conflate &ldquo;keep
        relationship warm&rdquo; with &ldquo;invite to this role
        now.&rdquo;
      </p>

      <h2>Privacy boundary</h2>
      <p>
        Adding a seeker to a pool doesn&rsquo;t reveal their contact.
        It&rsquo;s a bookmark, not a reveal action. To get phone +
        email you still open the dossier &mdash; same audited path as
        any other contact reveal.
      </p>

      <h2>Pools vs Saved searches</h2>
      <p>
        Both surface candidates over time, but the mechanism differs:
      </p>
      <ul>
        <li>
          <strong>Pool</strong> &mdash; explicit, hand-picked list. You
          add + remove specific seekers. Membership is durable.
        </li>
        <li>
          <strong>Saved search</strong> &mdash; filter set. Membership
          changes every time the cron re-runs the filters; new matches
          appear automatically.
        </li>
      </ul>
      <p>
        Use a pool when you have an opinion about specific people. Use
        a saved search when you have a definition of the kind of person
        you want to keep finding.
      </p>
    </HelpProse>
  );
}
