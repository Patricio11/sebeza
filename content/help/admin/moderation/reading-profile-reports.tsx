import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reading-profile-reports",
  title: "Reading profile reports",
  shortDescription:
    "What each report category means, what the aggregate count signals, and how to triage 50 reports a day without burning out.",
  category: "moderation",
  keywords: [
    "report",
    "moderation",
    "profile",
    "complaint",
    "abuse",
    "spam",
    "triage",
  ],
  related: [
    "when-to-suspend-an-account",
    "suspension-appeals-and-restoration",
    "flagging-suspicious-activity",
  ],
  surfaceLink: "/admin/moderation",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Reports come in from seekers + employers. Each report carries
        a reason category, an optional free-text note, the reporter,
        and the reported subject (a profile or an org). The Moderation
        page lists open reports grouped by subject &mdash; so 12
        reports about one employer show as one row with{" "}
        <em>12 reports</em>, not 12 rows.
      </p>

      <h2>The reason categories</h2>
      <ul>
        <li>
          <strong>Inappropriate messaging.</strong> Employer or seeker
          sent something abusive, threatening, or unprofessional
          inside the invitation flow.
        </li>
        <li>
          <strong>Misrepresenting identity.</strong> The reporter
          believes the subject&rsquo;s profile (or org) is
          impersonating someone else or fundamentally inaccurate.
        </li>
        <li>
          <strong>Discriminatory behaviour.</strong> A pattern of
          declining, refusing contact, or messaging tied to a
          protected characteristic.
        </li>
        <li>
          <strong>Off-platform contact requests.</strong> Employer
          asking the seeker to take a conversation off Sebenza in
          ways that bypass the reveal-and-audit flow.
        </li>
        <li>
          <strong>Spam / unrelated content.</strong> Repeated invites
          for irrelevant roles; bio content that&rsquo;s not about
          work.
        </li>
        <li>
          <strong>Other.</strong> With mandatory free-text. Lower
          priority unless the text reveals a category we missed.
        </li>
      </ul>

      <h2>What aggregate counts signal</h2>
      <p>
        On the list, each row shows <em>(N reports)</em> beside the
        subject. The count alone doesn&rsquo;t determine action; it
        determines priority. Three patterns to read:
      </p>
      <ul>
        <li>
          <strong>One reporter, multiple reports.</strong> The same
          person reporting the same subject repeatedly is usually
          either a real escalation (it&rsquo;s ongoing) or a personal
          grudge (open both reports and read the notes; the tone
          often tells you which).
        </li>
        <li>
          <strong>Many reporters, one event.</strong> A burst of
          reports clustered in time about a single employer often
          means one bad invitation flight; suspending pre-emptively
          might be the right call.
        </li>
        <li>
          <strong>Steady trickle over weeks.</strong> The hardest
          pattern. A subject with low-grade reports across weeks
          almost always reveals a pattern when you open three or
          four of the notes together &mdash; whereas reading one in
          isolation looked benign.
        </li>
      </ul>

      <Callout type="info" title="Triage by priority, not by FIFO">
        <p>
          The Moderation page sorts by aggregate count then by oldest
          unactioned report. Don&rsquo;t feel obliged to walk the
          list top-to-bottom: skim for high counts + recent bursts,
          action those first. The long tail of single-report rows
          can wait until end-of-shift; almost none of them turn out
          to need urgent action.
        </p>
      </Callout>

      <DashboardLink href="/admin/moderation">Open moderation queue</DashboardLink>
    </HelpProse>
  );
}
