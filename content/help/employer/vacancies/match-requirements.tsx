import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "match-requirements",
  title: "What 'match requirements' actually do",
  shortDescription:
    "Work availability, min years, min NQF. Blank means no constraint - and why that matters for SA roles.",
  category: "vacancies",
  keywords: [
    "match",
    "requirements",
    "filters",
    "matching",
    "axes",
    "work availability",
    "years experience",
    "nqf",
    "qualifications",
    "credentials",
  ],
  related: [
    "creating-a-vacancy",
    "seasonal-vacancies",
    "finding-matches",
    "listed-by-seekers-badge",
  ],
  surfaceLink: "/employer/vacancies/new",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Match requirements are the three axes Sebenza&rsquo;s reverse-
        matcher uses to narrow candidates beyond the basics (profession,
        province, skills). They&rsquo;re on the new-vacancy form under{" "}
        <strong>Match requirements</strong>. The platform&rsquo;s
        posture &mdash; <em>vacancy is the source of truth, blank means
        no constraint</em> &mdash; matters more than the axes themselves.
      </p>

      <h2>Work mode & employment type</h2>
      <p>
        Multi-select chips: full-time, part-time, contract, casual,
        seasonal, remote, hybrid. The seeker side captures the same
        chips on their profile (Work availability). The matcher uses an
        array-overlap: a seeker passes if{" "}
        <strong>any</strong> of their chips intersect{" "}
        <strong>any</strong> of yours.
      </p>
      <p>
        Example: vacancy with{" "}
        <em>{"{ full_time, remote }"}</em>; seeker open to{" "}
        <em>{"{ full_time }"}</em> but not remote &mdash; they still
        match on <em>full_time</em>. The matcher&rsquo;s job is to
        surface plausible matches; you decide whether the remote-or-not
        detail matters per candidate.
      </p>

      <h2>Minimum years of experience</h2>
      <p>
        Integer 0&ndash;60. A hard floor &mdash; seekers below it
        don&rsquo;t appear in the match. NOT a ranking weight; above
        the floor, ranking still uses the Phase 4 score
        (skill/freshness/completeness/citizen-boost).
      </p>
      <Callout type="warning" title="Unknown is not a pass">
        <p>
          When you set a years floor (say 5), seekers who haven&rsquo;t
          declared their years on their profile don&rsquo;t pass.
          That&rsquo;s the conservative posture &mdash; same as every
          other &ldquo;did the seeker tell us&rdquo; filter on the
          platform.
        </p>
      </Callout>

      <h2>Minimum NQF level</h2>
      <p>
        SAQA&rsquo;s National Qualifications Framework levels: NQF 4 =
        Matric; 6 = Diploma; 7 = Bachelor&rsquo;s; 8 = Honours; 9 =
        Master&rsquo;s; 10 = Doctorate. The matcher checks the
        seeker&rsquo;s <strong>highest</strong> academic record &mdash;
        a seeker with both an NQF 6 diploma and an NQF 8 honours passes
        a min-NQF-7 vacancy.
      </p>
      <Callout type="info" title="Most SA roles don't need NQF">
        <p>
          Trades, hospitality, casual labour, sales &mdash; many real SA
          roles don&rsquo;t require formal credentials. Leave the NQF
          field blank and the matcher won&rsquo;t check qualifications
          at all. <strong>Every seeker passes</strong> regardless of
          whether they hold a credential. This is deliberate; the
          platform never pushes you to declare a fictitious
          qualification requirement just to use the matcher.
        </p>
      </Callout>

      <h2>Why blank-means-no-constraint matters</h2>
      <p>
        The vacancy is the source of truth across every match axis. If
        you don&rsquo;t care about years of experience for this role,
        you leave the field blank &mdash; you don&rsquo;t put zero. Zero
        would mean &ldquo;0 years or more,&rdquo; which excludes the
        seekers who didn&rsquo;t tell us. Blank means &ldquo;the matcher
        doesn&rsquo;t even consider this axis,&rdquo; which includes
        everyone.
      </p>
      <p>
        The same rule applies on the seeker side: an empty chip set
        means &ldquo;I&rsquo;ll take any work mode,&rdquo; not &ldquo;I
        don&rsquo;t want any work.&rdquo;
      </p>

      <h2>Editing match requirements after creation</h2>
      <p>
        You can edit them any time from the vacancy detail page
        (Owner/Recruiter only). Edits take effect immediately on the
        next Find Matches load &mdash; there&rsquo;s no rematch queue,
        no &ldquo;pending&rdquo; state. The Match Requirements strip at
        the top of the detail page always reflects what the matcher is
        currently checking.
      </p>
    </HelpProse>
  );
}
