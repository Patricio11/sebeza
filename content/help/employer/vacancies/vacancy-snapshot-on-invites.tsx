import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "vacancy-snapshot-on-invites",
  title: "Seekers see the vacancy spec  frozen at send time",
  shortDescription:
    "Every invitation now carries the full vacancy spec the seeker sees on their detail page. Frozen at send  edits after the send don&rsquo;t change what the seeker is evaluating.",
  category: "vacancies",
  keywords: [
    "vacancy",
    "snapshot",
    "frozen",
    "invitation",
    "spec",
    "edit",
    "integrity",
  ],
  related: [
    "creating-a-vacancy",
    "bulk-invite",
    "invitation-lifecycle",
  ],
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you send an invitation, the seeker now sees the full
        vacancy spec on their invitation detail page, not just the
        role title + your personal note. The spec is{" "}
        <strong>frozen at send time</strong>: subsequent edits to
        the vacancy don&rsquo;t change what the seeker is reading.
      </p>

      <h2>What gets snapshotted</h2>
      <p>
        The fields captured at send time:
      </p>
      <ul>
        <li>Title, description.</li>
        <li>Profession, province, city, seniority.</li>
        <li>Required skill slugs (rendered as their labels).</li>
        <li>Work availability, season window (when set).</li>
        <li>Minimum years of experience + NQF level (when set).</li>
        <li>Salary band (when the field is visible).</li>
        <li>Capture timestamp.</li>
      </ul>

      <Callout type="info" title="Why frozen, not live?">
        <p>
          Integrity. The seeker is evaluating the spec you sent
          them. If you later raise the experience floor, change
          the season window, or trim the description, the
          original invitation context stays unchanged. Honest +
          predictable. If you need a materially-different spec
          out to the same seeker, withdraw + re-invite with the
          new vacancy.
        </p>
      </Callout>

      <h2>What about pre-migration invitations?</h2>
      <p>
        Invitations sent before 30 May 2026 don&rsquo;t carry a
        snapshot. The seeker&rsquo;s page falls back to the live
        description with a small &ldquo;may have changed&rdquo;
        annotation. New invitations from that date carry the
        snapshot automatically  no action needed on your side.
      </p>

      <DashboardLink href="/employer/vacancies">Open vacancies</DashboardLink>
    </HelpProse>
  );
}
