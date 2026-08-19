import {
  HelpProse,
  Callout,
  Steps,
  Step,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  // Slug kept so existing links, bookmarks and HelpLink chips keep
  // working; the article itself was rewritten on 2026-08-19 when
  // certificate collection was retired.
  slug: "uploading-certificates-and-verification",
  title: "Qualifications and the Verified badge",
  shortDescription:
    "You list your qualifications yourself, no uploads. The green Verified badge is separate: it comes from the live selfie check and means a real person is behind the profile.",
  category: "profile",
  keywords: [
    "qualification",
    "certificate",
    "verification",
    "verified",
    "self-declared",
    "selfie",
    "nqf",
  ],
  related: [
    "understanding-profile-completeness",
    "deleting-your-account-right-to-erasure",
  ],
  surfaceLink: "/dashboard/qualifications",
  updatedAt: "2026-08-19",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Two different things used to wear the same word. This article
        separates them: <strong>your qualifications</strong>, which you
        list yourself, and <strong>the Verified badge</strong>, which
        says a real person is behind this profile.
      </p>

      <h2>Qualifications are self-declared</h2>
      <p>
        You add what you hold: the title, the institution, the year.
        There is nothing to upload. We do not ask for your certificates
        and we do not store them.
      </p>
      <p>
        Employers see your qualifications exactly as you entered them,
        labelled <em>unverified</em>. That label is not a criticism. It
        is us being straight about what we have checked, which is
        nothing. Most professional platforms work this way; the
        difference is that we say so instead of implying otherwise.
      </p>

      <Callout type="info" title="Be accurate, for your own sake">
        <p>
          Because nobody vets these entries, the only thing protecting
          you is your own accuracy. An employer who discovers an
          inflated qualification at interview will remember it. List
          what you actually hold, and let the work speak.
        </p>
      </Callout>

      <h2>The Verified badge is about you, not your certificates</h2>
      <p>
        The green <strong>Verified</strong> badge answers one question:{" "}
        <em>is a real person behind this profile?</em> You earn it with a
        quick live selfie check on your profile page.
      </p>

      <Steps>
        <Step number={1}>
          <p>
            Go to your profile editor and find{" "}
            <em>Verify your profile with a live selfie</em>, just under
            your photo.
          </p>
        </Step>
        <Step number={2}>
          <p>
            Allow the camera. The check asks you to look straight ahead,
            then to do two small things such as blinking or turning your
            head. It runs <strong>on your own phone or computer</strong>:
            no video is sent to us.
          </p>
        </Step>
        <Step number={3}>
          <p>
            The photo taken at the end becomes your profile photo, and
            the badge appears wherever employers see you. That is the
            whole process, and you can remove the photo at any time.
          </p>
        </Step>
      </Steps>

      <Callout type="info" title="What changed, and why">
        <p>
          We used to collect certificates and have an administrator
          review them. We stopped, because it meant holding a pile of
          personal documents to confirm something a document cannot
          really confirm. Badges already earned that way remain: they
          were honestly reviewed. Verification of actual credentials may
          return through a partnership with SAQA, which checks the
          national record rather than a scan.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/qualifications">
        Open Qualifications
      </DashboardLink>
    </HelpProse>
  );
}
