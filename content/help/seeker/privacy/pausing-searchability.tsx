import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "pausing-searchability",
  title: "Pausing searchability  step out for a while",
  shortDescription:
    "Granted, but not interested right now. Pause searchability for 1 / 3 / 6 / 12 months. Auto-resumes on the date you pick.",
  category: "privacy",
  keywords: [
    "pause",
    "searchability",
    "consent",
    "freshness",
    "break",
    "step out",
    "recruiter",
  ],
  related: [
    "what-consent-purposes-mean",
    "blocking-employers",
    "deleting-your-account-right-to-erasure",
  ],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Sometimes you&rsquo;re employed, the job is fine, the
        recruiter calls are exhausting. Pausing searchability lets
        you step out of the recruiter funnel for a defined window
        without revoking consent.
      </p>

      <h2>Three states on one toggle</h2>
      <ul>
        <li>
          <strong>Active</strong>  searchability granted, you appear
          in employer search + can receive invites.
        </li>
        <li>
          <strong>Paused</strong>  searchability still granted, but
          temporarily withheld. You don&rsquo;t appear in employer
          search; bulk-invite silently skips you. Your existing
          relationships hold; your status freshness stays intact.
        </li>
        <li>
          <strong>Off</strong>  searchability revoked. The pause
          control is hidden in this state  you&rsquo;d revoke, not
          pause.
        </li>
      </ul>

      <h2>Auto-resume</h2>
      <p>
        Pick a duration on pause: 1, 3, 6, or 12 months. A nightly
        cron sweeps expired pauses + flips you back to active. You
        can also unpause manually from <em>Privacy &amp;
        consent</em> any time before the auto-resume date.
      </p>

      <Callout type="info" title="Honest signal, not stale status">
        <p>
          Before this surface existed, the only way to stop the
          recruiter calls was to revoke searchability (heavy; loses
          the freshness streak) or stop confirming your status
          (becomes stale &rarr; ranking drops). Neither was honest.
          Pause is honest: <em>I&rsquo;m here, just not interested
          right now.</em>
        </p>
      </Callout>

      <h2>Optional private note</h2>
      <p>
        You can attach a 200-character private note when you pause
        (&ldquo;just took a new role&rdquo;, &ldquo;travelling
        until Sept&rdquo;). The note is for your own benefit  it
        never reaches employers + never appears in any report.
      </p>

      <DashboardLink href="/dashboard/privacy">Open Privacy &amp; consent</DashboardLink>
    </HelpProse>
  );
}
