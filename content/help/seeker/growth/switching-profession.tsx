import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "switching-profession",
  title: "Switching your primary profession  what changes, what doesn&rsquo;t",
  shortDescription:
    "Switching your primary profession moves your rank into the new pool + recalibrates skill recommendations. Your work history + skills stay. Reversible any time.",
  category: "growth",
  keywords: [
    "profession",
    "switch",
    "pivot",
    "primary",
    "adjacent role",
    "rank",
  ],
  related: [
    "adjacent-roles-and-skill-gaps",
    "career-compass-recommendations",
    "how-search-ranking-works",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Career Compass surfaces adjacent professions  roles where
        your existing skill set overlaps significantly. Each
        adjacent card now carries a small{" "}
        <em>&ldquo;Consider this as your profession &rarr;&rdquo;</em>
        link that opens a confirmation modal explaining what changes.
      </p>

      <h2>What changes when you switch</h2>
      <ul>
        <li>
          Your rank moves into the new pool (e.g. <em>Data Analyst
          &middot; Gauteng</em>). You drop out of the old pool;
          recruiters searching the old profession won&rsquo;t see
          you anymore.
        </li>
        <li>
          Recruiters searching for the <em>new</em> profession will
          start surfacing you.
        </li>
        <li>
          Your skill recommendations recalibrate to the new
          pool&rsquo;s gaps.
        </li>
      </ul>

      <h2>What doesn&rsquo;t change</h2>
      <ul>
        <li>Your work history.</li>
        <li>Your existing skills.</li>
        <li>Your verification state on qualifications.</li>
        <li>Your status freshness.</li>
      </ul>

      <Callout type="tip" title="Reversible">
        <p>
          Switching back is one save from your profile editor. No
          penalty, no cool-down. The modal copy makes the
          reversibility explicit so you don&rsquo;t feel locked in
          by the switch.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
