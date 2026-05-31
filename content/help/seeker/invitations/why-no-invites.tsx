import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "why-no-invites",
  title: "Why no invites? The four-check diagnostic",
  shortDescription:
    "When your invitations inbox is empty, the page surfaces a four-check diagnostic that tells you exactly what&rsquo;s gating employer reach.",
  category: "invitations",
  keywords: [
    "no invites",
    "no invitations",
    "empty",
    "diagnostic",
    "visibility",
    "freshness",
    "consent",
    "pool",
  ],
  related: [
    "vacancy-invitations-explained",
    "what-consent-purposes-mean",
    "understanding-profile-completeness",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Most platforms leave you guessing when the inbox is empty.
        Sebenza shows you exactly why  the same data that gates
        employer reach is the data the diagnostic card surfaces.
      </p>

      <h2>The four checks</h2>
      <Steps>
        <Step number={1}>
          <p>
            <strong>Status freshness.</strong> Your employment status
            must have been confirmed in the last 90 days. Stale
            status drops your search rank materially. Re-confirm from
            the dashboard.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>Profile completeness.</strong> A profile under 50%
            complete is structurally invisible to most employer
            searches  the matcher down-weights low-completeness rows.
            Add skills + a certificate + a recent experience.
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>Vacancy-matching consent.</strong> Invitations
            require an explicit opt-in (separate from searchability).
            Toggle <em>Vacancy invites</em> on in{" "}
            <em>Privacy &amp; consent</em>. Withholding doesn&rsquo;t
            weaken any other surface; it just turns the invitation
            channel off.
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>Pool has employers.</strong> Your profession ×
            province pool might genuinely be quiet right now. If the
            other three checks pass, the diagnostic says so plainly.
            Career compass can suggest adjacent professions with
            stronger demand.
          </p>
        </Step>
      </Steps>

      <Callout type="tip" title="Most seekers see their first invite within 21 days">
        <p>
          The diagnostic is a starting point, not a guarantee. When
          all four checks are green and you still haven&rsquo;t had
          an invite, the matcher hasn&rsquo;t surfaced you for a
          fresh vacancy yet. Median time-to-first-invite for a
          complete, fresh, consented profile is about three weeks.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/invitations">Open invitations</DashboardLink>
    </HelpProse>
  );
}
