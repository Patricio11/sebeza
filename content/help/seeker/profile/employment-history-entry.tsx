import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "employment-history-entry",
  title: "Adding a work-history entry",
  shortDescription:
    "What to put in each field, how to handle gaps, students-with-no-jobs, and what the optional employment-verification flow does.",
  category: "profile",
  keywords: [
    "work history",
    "experience",
    "job",
    "role",
    "employment",
    "verification",
    "graduate",
    "student",
  ],
  related: [
    "uploading-certificates-and-verification",
    "understanding-profile-completeness",
  ],
  surfaceLink: "/dashboard/experience",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Experience page is a list of work-history rows. Add one
        per job, internship, or substantive project. Each row is a
        small form &mdash; nothing on this page is free-text in a CV
        sense; the matcher reads structured fields, not paragraphs.
      </p>

      <h2>The fields on a row</h2>
      <ul>
        <li>
          <strong>Role title.</strong> Free-text, but pick the cleanest
          version. &ldquo;Senior Backend Engineer&rdquo; reads better
          than &ldquo;Sr. Back-End Eng II.&rdquo;
        </li>
        <li>
          <strong>Organisation name.</strong> Free-text. If the
          organisation is on Sebenza, type the first few letters and
          pick from the autocomplete &mdash; that links your row to
          their org page for the optional verification flow below.
        </li>
        <li>
          <strong>City + province.</strong> Where you actually worked.
          For remote roles, use the city you were based in.
        </li>
        <li>
          <strong>Start date.</strong> Month + year.
        </li>
        <li>
          <strong>End date.</strong> Month + year, or
          &ldquo;current&rdquo; if you&rsquo;re still there. Setting
          your current row triggers a small prompt on the Profile editor
          asking whether you want to confirm your work status as{" "}
          <em>employed</em>.
        </li>
        <li>
          <strong>Short description.</strong> 12 sentences on what
          you actually did. Skip the buzzwords; describe the outcomes.
        </li>
      </ul>

      <h2>Students and recent graduates</h2>
      <p>
        If you don&rsquo;t have a paid job yet, add the most substantive
        non-paid thing you&rsquo;ve done: an internship, a research
        project, a paid student-society role. The Experience page is
        used by the matcher to anchor your profile in something
        concrete; leaving it empty makes you harder to rank.
      </p>

      <h2>Gaps</h2>
      <p>
        There&rsquo;s no platform pressure to fill every month. Gaps
        between rows are fine &mdash; they&rsquo;re a normal part of
        most careers. Don&rsquo;t invent rows to cover them; employers
        looking at your dossier see what you put there and that&rsquo;s
        all the inference they make.
      </p>

      <Callout type="info" title="The optional employment-verification flow">
        <p>
          Phase 9.23 added an opt-in flow: if you linked your current row
          to an organisation that&rsquo;s on Sebenza, you can request
          they confirm you work there. The platform asks them once; they
          either confirm or not. A confirmed badge appears beside the
          row. This is purely opt-in &mdash; if you&rsquo;d rather your
          current employer not know you&rsquo;re on Sebenza, skip it.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/experience">Edit your experience</DashboardLink>
    </HelpProse>
  );
}
