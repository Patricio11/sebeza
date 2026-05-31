import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "upgrading-to-verified",
  title: "Upgrading a self-attested skill to verified",
  shortDescription:
    "Completing a learning item adds the skill as self-attested. Upload the certificate to upgrade it to verified  one click from the completed row.",
  category: "growth",
  keywords: [
    "verified",
    "certificate",
    "upgrade",
    "self-attested",
    "learning",
    "completed",
    "qualification",
  ],
  related: [
    "uploading-certificates-and-verification",
    "learning-paths-and-proficiency",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you mark a learning item complete, the skill lands on
        your profile as <em>self-attested  via learning</em>. That
        carries more weight than a plain self-attestation but
        less than a verified credential. Upgrading to verified
        takes one upload.
      </p>

      <h2>The bridge</h2>
      <Steps>
        <Step number={1}>
          <p>
            Open your <em>My Learning</em> section. Any completed
            row carries a small secondary link: &ldquo;Got a
            certificate? Upload it for the verified badge&rdquo;.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Tap the link. You land on the Qualifications page with
            the Add panel pre-filled  the skill name in the title
            field, the learning provider in the institution field.
            Both stay editable; what you actually upload + label is
            up to you.
          </p>
        </Step>
        <Step number={3}>
          <p>
            Upload the PDF / JPG / PNG. The qualification lands as{" "}
            <em>unverified</em>. Admin (or the SAQA partner once
            that lands) reviews + flips to <em>verified</em>. On
            verification, your profile_skills row upgrades from{" "}
            <em>self-attested  via learning</em> to{" "}
            <em>verified</em>.
          </p>
        </Step>
      </Steps>

      <Callout type="info" title="Cert + learning item aren&rsquo;t linked">
        <p>
          The qualification you upload isn&rsquo;t formally tied to
          the learning_item we suggested. Deliberate: you might have
          taken a different course than the one we recommended  the
          certificate stands on its own merits. The platform never
          implies the cert is &ldquo;for&rdquo; a specific learning
          path we proposed.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
