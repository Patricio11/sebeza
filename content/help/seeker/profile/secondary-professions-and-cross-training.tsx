import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "secondary-professions-and-cross-training",
  title: "Secondary professions + the cross-trainable tags",
  shortDescription:
    "Up to 3 extra profession lanes alongside your primary, plus two new Open-To tags  Open to training + Cross-industry  for seekers whose careers don't sit in one box.",
  category: "profile",
  keywords: [
    "secondary professions",
    "multiple",
    "cross-industry",
    "open to training",
    "entry-level",
    "career change",
    "pivot",
    "matric",
  ],
  related: [
    "employment-history-entry",
    "adding-skills-from-the-taxonomy",
    "open-to-tags",
  ],
  surfaceLink: "/dashboard/profile#professional",
  updatedAt: "2026-06-06",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Real careers don&rsquo;t always sit in one profession. If
        you&rsquo;ve worked 7 years in customer service plus 2 years as
        a barista plus 2 years caregiving, you don&rsquo;t have to pick
        one and hide the rest. Two Phase 13.10 additions on the{" "}
        <DashboardLink href="/dashboard/profile#professional">
          Profile editor
        </DashboardLink>{" "}
        cover this.
      </p>

      <h2>1. Up to 3 secondary professions</h2>
      <p>
        Below the main <strong>Profession</strong> field you&rsquo;ll
        find <strong>Also experienced in (optional)</strong>. Type-to-
        search the canonical profession list and pick up to{" "}
        <strong>three</strong> additional lanes you&rsquo;ve worked in.
        The headline stays your primary  the one with the most weight
        on your trajectory  but the matcher recognises you for the
        secondaries too.
      </p>
      <ul>
        <li>
          Employers who search for any of your secondary professions
          see you in the result list  ranked just below seekers
          whose primary matches, never invisible.
        </li>
        <li>
          The vacancy reverse-match tool on the employer side shows a
          small <em>matched via secondary profession</em> note next
          to your row when you surfaced via a secondary lane  so the
          employer reads &ldquo;why is this person here?&rdquo;
          honestly before clicking through.
        </li>
        <li>
          Your public profile <code>/p/{`{your-handle}`}</code>
          renders the secondaries as small chips below the headline
          (&ldquo;Also experienced in: Caregiver · Barista · Kitchen
          Porter&rdquo;).
        </li>
      </ul>

      <Callout type="info" title="Headline stays one primary">
        <p>
          The platform is editorially one-headline-per-seeker  it
          surfaces your strongest credential first. Secondaries are{" "}
          <em>additive</em>, not co-equal. Pick the lane with the
          most weight (usually the longest stint or the strongest
          qualification) as your primary; the rest go in the
          secondaries.
        </p>
      </Callout>

      <h2>2. Two new Open-To tags for cross-trainable seekers</h2>
      <p>
        In the Open-To section of your profile you&rsquo;ll find two
        Phase 13.10 chips alongside the existing Mentorship /
        Freelance / Contract gigs / Public speaking:
      </p>
      <ul>
        <li>
          <strong>Open to training.</strong> &ldquo;I&rsquo;ll take on
          a new role if the employer is willing to train me. Open to
          entry-level + skill-adjacent moves.&rdquo; Use this when
          you&rsquo;re willing to learn a role you haven&rsquo;t done
          before.
        </li>
        <li>
          <strong>Cross-industry.</strong> &ldquo;Willing to bring my
          skills into a different industry than my primary
          profession.&rdquo; Use this when your customer-service
          experience would transfer into retail, or your hospitality
          experience would transfer into office admin.
        </li>
      </ul>
      <p>
        The two are independent  tick whichever apply. A Matric
        school-leaver willing to learn anything is{" "}
        <em>Open to training</em>. A senior chef considering
        hospital-cafeteria management is <em>Cross-industry</em> but
        NOT <em>Open to training</em>. Some seekers are both.
      </p>

      <h2>What this is NOT</h2>
      <ul>
        <li>
          NOT a way to keep adding professions forever  the cap is
          three. The matcher&rsquo;s signal weakens if every seeker
          claims fifteen lanes.
        </li>
        <li>
          NOT a per-secondary years-of-experience field. Years live on
          your{" "}
          <DashboardLink href="/dashboard/experience">
            Experience entries
          </DashboardLink>{" "}
          (one row per stint) and on{" "}
          <DashboardLink href="/dashboard/skills">
            individual skills
          </DashboardLink>
          .
        </li>
        <li>
          NOT a free-text path. New professions go through the admin
          taxonomy queue first  pick &ldquo;Other&rdquo; on the
          primary <strong>Profession</strong> field if your role isn&rsquo;t
          listed; once admins promote it, it appears in the
          secondaries picker too.
        </li>
      </ul>

      <DashboardLink href="/dashboard/profile#professional">
        Update your profile
      </DashboardLink>
    </HelpProse>
  );
}
