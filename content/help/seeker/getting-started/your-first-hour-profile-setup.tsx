import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "your-first-hour-profile-setup",
  title: "Your first hour: profile setup",
  shortDescription:
    "Six concrete steps that take a fresh profile from empty to findable. Roughly 4560 minutes total.",
  category: "getting_started",
  keywords: [
    "first hour",
    "setup",
    "onboarding",
    "getting started",
    "checklist",
    "next steps",
  ],
  related: [
    "understanding-profile-completeness",
    "adding-skills-from-the-taxonomy",
    "setting-up-your-profile-photo",
    "uploading-certificates-and-verification",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The Overview page has a <em>Next steps</em> checklist that mirrors
        these six items. None of them are clever; the trick is to do
        them in this order so the dashboard&rsquo;s ranking signal
        becomes useful by the time you&rsquo;re finished.
      </p>

      <Steps>
        <Step number={1}>
          <p>
            <strong>Profession + location.</strong> The two fields the
            matcher splits the whole talent pool by. Pick your primary
            profession from the dropdown; pick your province; if you
            have a city, type it. This unlocks your pool ranking &mdash;
            until both are set, &ldquo;Rank in pool&rdquo; on the
            Overview page reads blank.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>Add five skills from the taxonomy.</strong> The
            skill picker on the Profile editor only accepts entries
            from a controlled list; that&rsquo;s how the matcher knows
            &ldquo;Excel&rdquo; and &ldquo;Microsoft Excel&rdquo; are the
            same thing. Five is the threshold the completeness score
            checks for; below it, your card is harder for employers to
            sort.
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>Upload one certificate.</strong> Even a single
            unverified certificate moves you out of &ldquo;empty
            qualifications&rdquo; and into the segment employers
            actually scan. Verification happens later (admin or SAQA);
            uploading puts it into the pending queue.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>Add one work history entry.</strong> Even if
            you&rsquo;re a recent graduate, add the most recent thing
            &mdash; an internship, a student project, a part-time role.
            Empty experience is the most common reason a profile gets
            skipped in dossier review.
          </p>
        </Step>
        <Step number={5}>
          <p>
            <strong>Confirm your status.</strong> The Status card on the
            Overview asks you to confirm &ldquo;Are you employed,
            job-seeking, or dormant?&rdquo; Statuses older than 90 days
            get down-ranked in search. Confirming costs 5 seconds and
            keeps your visibility on.
          </p>
        </Step>
        <Step number={6}>
          <p>
            <strong>Review your consent toggles.</strong> Open Privacy
            &amp; consent. By default, searchability and contact-reveal
            are on; vacancy-matching is off. If you want employers to be
            able to invite you, turn vacancy-matching on. Read each
            toggle&rsquo;s explainer once &mdash; this is the part most
            people skip and then wonder why nothing&rsquo;s happening.
          </p>
        </Step>
      </Steps>

      <Callout type="tip" title="The optional bits that pay off">
        <p>
          A profile photo isn&rsquo;t required, but profiles with one
          are noticeably more likely to be opened from a dossier list.
          Your bio is also optional; if you write one, keep it under
          three sentences and focus on the work you actually want to
          do next, not your CV in miniature.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/profile">Open profile editor</DashboardLink>
    </HelpProse>
  );
}
