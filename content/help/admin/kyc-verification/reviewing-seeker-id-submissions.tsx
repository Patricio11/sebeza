import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reviewing-seeker-id-submissions",
  title: "Reviewing seeker KYC submissions",
  shortDescription:
    "What to look for on a national ID document, how to compare against the profile, and what to do with a mismatch.",
  category: "kyc_verification",
  keywords: [
    "kyc",
    "seeker",
    "id",
    "national id",
    "verification",
    "document",
    "review",
  ],
  related: [
    "qualification-review-and-saqa-workflow",
    "approval-rejection-and-appeals",
    "manual-verification-path",
  ],
  surfaceLink: "/admin/verifications",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Seeker KYC review is the most common verification task. The
        user has uploaded their national ID document and (optionally)
        a selfie holding the ID; you compare it against the profile
        data they typed (name, date of birth, ID number).
      </p>

      <h2>The four checks</h2>
      <Steps>
        <Step number={1}>
          <p>
            <strong>Document is real.</strong> Is this a South African
            national ID, smart-card or green-book format? Is the
            holographic strip visible (smart card)? Are the corners
            and edges intact? Photographs of photocopies are common
            and acceptable; obvious template substitutions are not.
          </p>
        </Step>
        <Step number={2}>
          <p>
            <strong>ID number matches.</strong> The 13-digit number on
            the document matches the encrypted value on the profile.
            The console computes the match server-side so you see a
            green check or red cross &mdash; do not type the number
            into a notepad to compare; the comparison is automatic.
          </p>
        </Step>
        <Step number={3}>
          <p>
            <strong>Name matches.</strong> The full name on the
            document matches the profile&rsquo;s identity-basics name
            (not the display name &mdash; users often have a
            display-name preference like &ldquo;Tumi&rdquo; for
            &ldquo;Boitumelo&rdquo;). Reasonable variants count as a
            match (initials, common nicknames, marriage-name change
            where date supports it).
          </p>
        </Step>
        <Step number={4}>
          <p>
            <strong>Photo matches.</strong> If a selfie was uploaded,
            compare it to the document photo. Faces age; allow for
            reasonable difference. If you genuinely can&rsquo;t tell,
            request more information instead of rejecting.
          </p>
        </Step>
      </Steps>

      <h2>The three dispositions</h2>
      <ul>
        <li>
          <strong>Approve.</strong> All four checks pass. The KYC
          state on the profile moves to <em>verified</em>; the user
          gets a notification.
        </li>
        <li>
          <strong>Request more information.</strong> One check is
          ambiguous (blurry photo, possible name variant, unclear
          document image). Write a short, neutral note explaining
          what to re-upload. The user gets the note + the upload form
          reopens.
        </li>
        <li>
          <strong>Reject.</strong> A check fails in a way that
          suggests bad faith (clearly fake document, ID number is a
          stranger&rsquo;s, name mismatch with no plausible
          explanation). Write a reason note; the user sees the
          decision but not necessarily every detail. Always escalate
          to your Lead if you suspect identity fraud rather than just
          rejecting silently.
        </li>
      </ul>

      <Callout type="warning" title="You see the document; the audit log sees you">
        <p>
          Opening a KYC submission writes one <em>kyc.opened</em>
          audit row with your admin ID + the seeker handle.
          Approving / rejecting / requesting info each write one row.
          A burst of openings without dispositions, or repeated
          opens of the same submission across days, both surface in
          compliance review. Open submissions you intend to work; if
          you bail on one, leave a note in the case &mdash; the team
          can pick it up.
        </p>
      </Callout>

      <DashboardLink href="/admin/verifications">Open verification queue</DashboardLink>
    </HelpProse>
  );
}
