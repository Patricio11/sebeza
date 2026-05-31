import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "open-to-tags",
  title: "&ldquo;Open to&rdquo; tags  mentorship, freelance, contract gigs, public speaking",
  shortDescription:
    "Voluntary secondary-intent tags that surface alongside your status. Independent of employment  fully employed seekers can still be open to mentorship.",
  category: "profile",
  keywords: [
    "open to",
    "tags",
    "mentorship",
    "freelance",
    "contract",
    "public speaking",
    "side gig",
  ],
  related: [
    "uploading-certificates-and-verification",
    "career-compass-recommendations",
  ],
  surfaceLink: "/dashboard/profile#open-to",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        &ldquo;Open to&rdquo; tags are four small chips you can toggle
        on your profile editor: <strong>mentorship</strong>,{" "}
        <strong>freelance</strong>, <strong>contract gigs</strong>,{" "}
        <strong>public speaking</strong>. They tell employers what
        secondary work you&rsquo;d entertain  separate from your
        primary employment status.
      </p>

      <h2>Why they exist</h2>
      <p>
        SA professionals are often more than one thing. A senior
        developer in a permanent role might still mentor a junior on
        weekends. A graphic designer between contracts might take a
        public-speaking gig at a conference. The binary{" "}
        <em>employed</em> / <em>looking</em> status doesn&rsquo;t
        capture that. The tags do.
      </p>

      <h2>How the matcher treats them</h2>
      <p>
        Tags do <strong>not</strong> change your primary ranking.
        Employers searching for &ldquo;Software Developer in
        Gauteng&rdquo; still find you whether you have tags on or off.
        Tags only matter when an employer explicitly filters by them
        (e.g. searching specifically for mentors). They&rsquo;re a
        secondary surface  no penalty for skipping them.
      </p>

      <Callout type="tip" title="Honest signal, not a contract">
        <p>
          A tag is an invitation, not a commitment. Toggling{" "}
          <em>contract gigs</em> doesn&rsquo;t obligate you to accept
          one  it tells an employer with a contract-gig brief that
          you&rsquo;d at least consider the conversation. Decline like
          you would any other vacancy invite.
        </p>
      </Callout>

      <h2>Privacy</h2>
      <p>
        Tags render on your public profile{" "}
        <code>/p/{`{your-handle}`}</code> as small chips below the
        location. Toggle them off any time; they disappear from the
        public view immediately.
      </p>

      <DashboardLink href="/dashboard/profile#open-to">
        Open the Open-to section
      </DashboardLink>
    </HelpProse>
  );
}
