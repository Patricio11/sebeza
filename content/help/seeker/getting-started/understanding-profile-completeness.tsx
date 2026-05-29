import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "understanding-profile-completeness",
  title: "Understanding profile completeness",
  shortDescription:
    "What the percentage on your Overview means, why it matters for search rank, and the six fields it actually checks.",
  category: "getting_started",
  keywords: [
    "completeness",
    "percentage",
    "score",
    "profile health",
    "search rank",
    "ranking",
  ],
  related: [
    "your-first-hour-profile-setup",
    "how-search-ranking-works",
    "adding-skills-from-the-taxonomy",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The percentage on your Overview is a count, not a guess. It
        checks six concrete fields and shows you what fraction are
        filled. Nothing on the platform &ldquo;rewards more&rdquo; for a
        rounded profile bio or a longer description; the six checks are
        all there is.
      </p>

      <h2>The six checks</h2>
      <ul>
        <li>
          <strong>Profile photo.</strong> Optional, but counted.
          Profiles with a photo are noticeably more likely to be opened
          from a dossier list.
        </li>
        <li>
          <strong>Five or more skills.</strong> From the controlled
          taxonomy. Four doesn&rsquo;t pass; five does. This is the one
          threshold most people miss.
        </li>
        <li>
          <strong>At least one certificate.</strong> Verification state
          doesn&rsquo;t matter for this count &mdash; uploading is what
          counts. Pending and unverified both pass.
        </li>
        <li>
          <strong>At least one work-history entry.</strong> Same idea:
          the matcher needs context for how to rank you against the
          rest of the pool.
        </li>
        <li>
          <strong>National ID on file.</strong> Encrypted, never
          displayed back. Required for the citizen-boost path in
          ranking + for KYC if you want to apply for verified status.
        </li>
        <li>
          <strong>Status confirmed in the last 90 days.</strong> The
          freshness signal. Confirming says &ldquo;I&rsquo;m still
          findable&rdquo; &mdash; without it, your card sinks in search.
        </li>
      </ul>

      <h2>Why this matters for ranking</h2>
      <p>
        Search rank in the (profession × province) pool is a blend of
        three factors: completeness, freshness, and a small citizen
        boost. Completeness is the biggest of the three. Moving from
        four skills to five, or adding a single certificate, can be
        the difference between page one and page four when an employer
        opens the matcher.
      </p>

      <Callout type="info" title="What's not on the list">
        <p>
          Bio length, photo quality, the number of skills above five,
          how many certificates you upload, how recently you edited your
          profile &mdash; none of those move the completeness score. The
          score is binary per field; it isn&rsquo;t a vanity dashboard.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/profile">Open profile editor</DashboardLink>
    </HelpProse>
  );
}
