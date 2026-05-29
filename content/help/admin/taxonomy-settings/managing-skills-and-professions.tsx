import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "managing-skills-and-professions",
  title: "Managing skills and professions",
  shortDescription:
    "Adding a new skill, retiring an obsolete one, merging duplicates. Why every change writes audit rows + which level of admin can do which.",
  category: "taxonomy_settings",
  keywords: [
    "skill",
    "profession",
    "taxonomy",
    "add",
    "retire",
    "merge",
    "synonym",
  ],
  related: [
    "suggestion-workflow-user-other-entries",
    "feature-flags-and-rollouts",
    "team-roles-and-permissions",
  ],
  surfaceLink: "/admin/taxonomy",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The skill + profession taxonomy is the controlled vocabulary
        every matcher decision is built on. Adding a skill takes
        2 minutes; the consequences propagate forever. So changes are
        deliberate: Operator-tier action, mandatory rationale note,
        searchable audit.
      </p>

      <h2>The three operations</h2>
      <ul>
        <li>
          <strong>Add.</strong> Create a new skill or profession.
          Required: canonical name (Title Case), category (which
          profession families it&rsquo;s associated with), short
          description shown in the picker, list of synonyms users
          might type (lowercase, no punctuation). Synonyms are what
          let &ldquo;ms excel&rdquo; resolve to &ldquo;Microsoft
          Excel&rdquo; in search.
        </li>
        <li>
          <strong>Retire.</strong> Mark a skill / profession as
          retired. Existing profiles keep the entry on their
          records (no data deletion); the picker stops offering it
          to new users. Use for genuinely obsolete entries
          (&ldquo;COBOL on Mainframe&rdquo; might warrant retirement
          once nobody is hiring for it); be conservative &mdash;
          obscure does not mean obsolete.
        </li>
        <li>
          <strong>Merge.</strong> Resolve a duplicate. &ldquo;React
          Native&rdquo; and &ldquo;ReactNative&rdquo; somehow both
          ended up in the list; merge into the canonical entry.
          Profiles tagged with the loser get re-tagged with the
          winner; the audit row records the rewrite for each
          affected profile.
        </li>
      </ul>

      <h2>Why every change is audited</h2>
      <p>
        Retiring a skill silently de-ranks every profile that has
        only that skill in their bag. Merging two skills changes
        every match result that filters on either. These are
        platform-wide effects from one operator click. The audit
        row captures:
      </p>
      <ul>
        <li>The operation (add / retire / merge).</li>
        <li>The entries affected.</li>
        <li>The acting admin and the time.</li>
        <li>
          The free-text rationale you supplied (mandatory; the form
          rejects empty submissions).
        </li>
        <li>The downstream count: how many profiles were affected.</li>
      </ul>

      <Callout type="info" title="Add via the suggestion queue when possible">
        <p>
          Users hit the &ldquo;Request a new skill&rdquo; link on the
          skill picker constantly. Those requests land in the
          Suggestion queue (Taxonomy &rsaquo; Suggestions). Process
          those queue items rather than freelancing additions; the
          queue is how you know there&rsquo;s real demand for a skill,
          which is the only justification for adding one. See{" "}
          <em>Suggestion workflow: user &lsquo;Other&rsquo; entries</em>.
        </p>
      </Callout>

      <DashboardLink href="/admin/taxonomy">Open taxonomy</DashboardLink>
    </HelpProse>
  );
}
