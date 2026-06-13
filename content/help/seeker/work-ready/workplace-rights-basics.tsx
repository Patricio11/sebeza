import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "workplace-rights-basics",
  title: "Workplace rights basics",
  shortDescription:
    "A plain-language starting point on your basic rights at work in South Africa  a contract, fair pay, safe conditions  and where to get real help.",
  category: "work_ready",
  keywords: [
    "rights",
    "contract",
    "bcea",
    "wage",
    "minimum wage",
    "uif",
    "leave",
    "ccma",
    "labour",
    "fair",
  ],
  related: ["spotting-job-scams", "what-consent-purposes-mean"],
  surfaceLink: "/dashboard/privacy",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Knowing your basic rights protects you and helps you spot when
        something is wrong. This is a plain-language starting point, not
        legal advice  for a real problem, use the official help at the
        end.
      </p>

      <Callout type="info" title="A starting point, not legal advice">
        <p>
          Laws change and every situation differs. Treat this as
          orientation; for anything serious, contact the Department of
          Employment and Labour or the CCMA (both below).
        </p>
      </Callout>

      <h2>The basics most jobs owe you</h2>
      <ul>
        <li>
          <strong>A contract / written particulars.</strong> You&rsquo;re
          entitled to know your job, your pay, and your hours in writing.
        </li>
        <li>
          <strong>At least the national minimum wage.</strong> Pay below
          it is not lawful for covered work.
        </li>
        <li>
          <strong>Fair hours, leave and rest.</strong> The Basic
          Conditions of Employment Act sets limits on hours and rights
          to annual, sick and family leave.
        </li>
        <li>
          <strong>UIF.</strong> Most employees must be registered for
          the Unemployment Insurance Fund  it&rsquo;s what you claim
          from if you lose the job.
        </li>
        <li>
          <strong>A safe workplace</strong> and the right not to be
          unfairly dismissed or discriminated against.
        </li>
      </ul>

      <Callout type="warning" title="Warning signs">
        <p>
          No contract at all, being asked to pay <em>for</em> the job,
          pay kept &ldquo;until you prove yourself,&rdquo; or your ID
          document being held by an employer  these are red flags. See
          the job-scams article.
        </p>
      </Callout>

      <h2>Where to get real help</h2>
      <ul>
        <li>
          <strong>Department of Employment and Labour</strong>  labour
          centres nationwide for complaints + UIF.
        </li>
        <li>
          <strong>CCMA</strong>  free dispute resolution for unfair
          dismissal and unfair labour practice.
        </li>
      </ul>

      <h2>Your rights on Sebenza too</h2>
      <p>
        You also have rights over your <em>data</em> here: what you
        share, who can see it, and the ability to export or delete it.
        That&rsquo;s in the privacy &amp; consent section.
      </p>

      <DashboardLink href="/dashboard/privacy">
        Privacy &amp; consent
      </DashboardLink>
    </HelpProse>
  );
}
