import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "saved-searches",
  title: "Saving searches + getting new-match notifications",
  shortDescription:
    "Persist a filter set; the nightly cron re-runs it + notifies on genuinely new matches.",
  category: "talent_search",
  keywords: [
    "saved search",
    "saved searches",
    "save search",
    "monitor",
    "cron",
    "new matches",
    "notification",
    "subscribe",
    "persist",
  ],
  related: [
    "searching",
    "talent-pools",
    "shortlist-vs-pools",
  ],
  surfaceLink: "/employer/saved-searches",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you find a useful filter combination on /search, you can
        save it. The platform stores the filter set + a nightly cron
        re-runs it against the live talent pool; you get notified when
        genuinely new candidates match (not the same set that matched
        yesterday).
      </p>

      <h2>Saving a search</h2>
      <p>
        Refine your filters on <strong>/search</strong> until the
        result set looks like the kind of candidate you want to keep
        seeing. Hit <strong>Save this search</strong> at the top of
        the page. Give it a meaningful name (&ldquo;Senior backend
        devs in WC&rdquo;) so the index page on{" "}
        <strong>/employer/saved-searches</strong> reads cleanly.
      </p>
      <p>
        The saved search is org-private &mdash; every member of your
        team sees the org&rsquo;s saved searches. There&rsquo;s no
        per-user separation; deliberate, so a teammate&rsquo;s leave
        doesn&rsquo;t orphan the team&rsquo;s monitoring strategy.
      </p>

      <h2>How the new-match signal works</h2>
      <p>
        Each saved search stores a SHA-1 hash of the sorted profile-ID
        set returned by the last cron run. When the cron re-runs, it
        diffs the current result set against the hash; any IDs that
        weren&rsquo;t in the previous set count as &ldquo;new
        matches.&rdquo;
      </p>
      <Callout type="tip" title="Why hash diff matters">
        <p>
          Naively notifying every night &ldquo;you have 47 matches&rdquo;
          would be useless &mdash; the same 47 matches every night.
          The diff-based approach means you only hear when something
          actually changed, which is the signal worth surfacing.
        </p>
      </Callout>

      <h2>The notification</h2>
      <p>
        When the diff finds &ge; 1 new match, the platform fires{" "}
        <em>saved_search.new_matches</em> to your org members:
      </p>
      <p>
        <em>&ldquo;{`{N}`} new candidates match &ldquo;{`{search
        name}`}&rdquo; today.&rdquo;</em>
      </p>
      <p>
        Click through + the search opens on /search with the saved
        filters pre-loaded so you can review the new matches in
        context.
      </p>

      <h2>Managing saved searches</h2>
      <p>
        On <strong>/employer/saved-searches</strong>:
      </p>
      <ul>
        <li>
          <strong>The list</strong> &mdash; every saved search with
          its name, last-run-at timestamp, and the new-matches count
          from the most recent cron.
        </li>
        <li>
          <strong>Open</strong> &mdash; re-run the search live on{" "}
          /search.
        </li>
        <li>
          <strong>Delete</strong> &mdash; removes the saved search +
          stops the cron from running it. The candidates the search
          matched stay untouched (this is just a saved query).
        </li>
      </ul>

      <h2>How many saved searches?</h2>
      <p>
        The platform doesn&rsquo;t cap explicitly; the practical limit
        is the cron runtime + your team&rsquo;s notification tolerance.
        A focused org typically has 3&ndash;8 saved searches covering
        their main hiring areas; teams with 20+ saved searches usually
        find the notifications become noise + start ignoring them.
      </p>

      <Callout type="info" title="No personal saved searches in this view">
        <p>
          The saved-searches feature is org-private, not user-private.
          A teammate can edit / delete searches you created and vice
          versa. Use names that signal team ownership when relevant
          (&ldquo;Cape Town team &mdash; senior dev pipeline&rdquo;).
        </p>
      </Callout>
    </HelpProse>
  );
}
