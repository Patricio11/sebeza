import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "cost-and-free-alternatives",
  title: "Cost made you abandon? Swap to a free alternative",
  shortDescription:
    "When you mark a learning item abandoned for cost or access reasons, the platform surfaces a free alternative for the same skill inline  one-tap swap.",
  category: "growth",
  keywords: [
    "cost",
    "expensive",
    "free",
    "alternative",
    "swap",
    "access",
    "transport",
    "abandon",
  ],
  related: [
    "finding-the-right-course",
    "learning-paths-and-proficiency",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Marking a learning item abandoned has always opened a small
        modal asking why. When you pick <em>too expensive</em> or{" "}
        <em>access / transport made it impractical</em>, the modal
        now expands inline with a <strong>free alternative</strong>{" "}
        for the same skill.
      </p>

      <h2>What the inline alternative shows</h2>
      <p>
        A small card with the alternative path&rsquo;s title,
        provider, duration, cost (free or subsidised), and outcome.
        Two buttons:
      </p>
      <ul>
        <li>
          <strong>Accept this instead</strong>  atomic swap. The
          original path moves to <em>abandoned</em> with the cost
          reason recorded; the alternative is added to your active
          learning list. Both transitions land in one transaction;
          you can&rsquo;t end up between states.
        </li>
        <li>
          <strong>Just abandon for now</strong>  the original flow.
          The path is marked abandoned; nothing new is added. The
          abandon reason still flows to gov analytics anonymised.
        </li>
      </ul>

      <Callout type="info" title="Honest when nothing matches">
        <p>
          If there&rsquo;s no free path for that skill in the
          catalogue, the modal says so plainly. We don&rsquo;t
          fabricate a fake alternative just to fill the slot.
        </p>
      </Callout>

      <h2>Why the gov analytics still benefit</h2>
      <p>
        Even when you swap, the original abandonment is preserved as
        honest signal: the cost was real enough to make you stop. The
        gov analytics on{" "}
        <em>why learners stall</em> aggregates these signals
        anonymised and never per-person. Your swap to a free
        alternative is a personal win; the abandon record is a
        policy-evidence row.
      </p>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
