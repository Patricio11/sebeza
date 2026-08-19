import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  // Slug kept so existing links and HelpLink chips keep working. The
  // article was rewritten on 2026-08-19: the certificate-upload bridge
  // it described no longer exists.
  slug: "upgrading-to-verified",
  title: "What finishing a course does to your profile",
  shortDescription:
    "Completing a learning item adds the skill to your profile as self-attested via learning, which is stronger than a plain claim. There is no certificate to upload any more.",
  category: "growth",
  keywords: [
    "verified",
    "self-attested",
    "learning",
    "completed",
    "qualification",
    "skill",
    "proficiency",
  ],
  related: [
    "uploading-certificates-and-verification",
    "learning-paths-and-proficiency",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-08-19",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you mark a learning item complete, the skill lands on your
        profile as <em>self-attested via learning</em>. That carries more
        weight than a plain self-attestation, because it records that you
        set out to learn something on a real route and finished it.
      </p>

      <h2>There is nothing to upload</h2>
      <p>
        We used to ask for the certificate so an administrator could
        review it and mark the qualification verified. That step is gone.
        Qualifications are now self-declared, we hold no documents, and
        your finished course simply strengthens the skill on your
        profile.
      </p>
      <p>
        You can still add the qualification itself on your Qualifications
        page: the title, the institution, the year. Employers read it as
        you wrote it.
      </p>

      <Callout type="info" title="The green Verified badge is a different thing">
        <p>
          That badge answers <em>is a real person behind this profile?</em>{" "}
          and comes from the live selfie check on your profile page, not
          from any course or certificate. See{" "}
          <em>Qualifications and the Verified badge</em>.
        </p>
      </Callout>

      <h2>What actually moves you up</h2>
      <p>
        Finishing the right course does two useful things. The skill
        appears on your profile, so employers searching for it can find
        you. And your Career compass recalculates: the gap you closed
        drops off the list, and your projected position in the local
        pool updates with it.
      </p>
      <p>
        If you want proof of the work rather than proof of attendance,
        add it under <em>Work and projects</em> on your profile: a link,
        photos, and a sentence in your own words about what your part
        was. For most employers that is more persuasive than a
        certificate.
      </p>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
