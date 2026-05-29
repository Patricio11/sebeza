import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "setting-up-your-profile-photo",
  title: "Setting up your profile photo",
  shortDescription:
    "Optional, but it changes how often dossiers get opened. What kind of photo works, what stays private, what you can change later.",
  category: "profile",
  keywords: [
    "photo",
    "picture",
    "avatar",
    "headshot",
    "profile pic",
    "image",
  ],
  related: [
    "understanding-profile-completeness",
    "your-public-profile-url",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A profile photo is optional. The platform doesn&rsquo;t require
        one to make you findable and doesn&rsquo;t penalise you for
        going without. That said, our internal numbers are blunt:
        dossiers with a photo get opened more often than those without
        when an employer is scanning a results list. If you&rsquo;re
        comfortable adding one, it&rsquo;s the highest-leverage 30
        seconds you&rsquo;ll spend on this profile.
      </p>

      <h2>What works as a photo</h2>
      <ul>
        <li>
          <strong>Your face, clearly visible.</strong> A phone selfie in
          good light beats a moody artistic shot every time. Employers
          are deciding whether to spend 20 minutes on your dossier; the
          photo is just &ldquo;is this a person I can read?&rdquo;
        </li>
        <li>
          <strong>Neutral background.</strong> A wall, a doorway, a
          plain office &mdash; none of it matters as long as it
          doesn&rsquo;t pull focus from you.
        </li>
        <li>
          <strong>JPEG or PNG, under 5MB.</strong> The uploader rejects
          larger files. Smaller is fine; we re-encode for display.
        </li>
      </ul>

      <h2>What doesn&rsquo;t work</h2>
      <ul>
        <li>
          <strong>Group photos.</strong> The display crop is a small
          circle; whoever&rsquo;s on the left disappears.
        </li>
        <li>
          <strong>Logos or stock images.</strong> The platform flags
          obvious non-human uploads in moderation review and may remove
          them.
        </li>
        <li>
          <strong>Watermarked or copyrighted images.</strong> Use a photo
          you own. The platform asks you to confirm this on upload.
        </li>
      </ul>

      <Callout type="tip" title="You can change it any time">
        <p>
          The photo isn&rsquo;t a contract. Replace it whenever you want
          &mdash; the change shows on your profile within a few seconds.
          The audit log records that you changed it (not the old image),
          and that&rsquo;s all the persistence the system keeps of past
          photos.
        </p>
      </Callout>

      <h2>Where it shows up</h2>
      <p>
        Your photo appears on your public profile page (only if your
        searchability consent is on), on the dossier view an employer
        opens for you, and on the small avatar chip beside your name in
        an invitation thread. It does <strong>not</strong> appear on any
        public marketing surface, in any cohort statistic, or anywhere
        outside auth-gated employer routes.
      </p>

      <DashboardLink href="/dashboard/profile">Open profile editor</DashboardLink>
    </HelpProse>
  );
}
