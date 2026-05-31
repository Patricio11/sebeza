import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "reading-the-vacancy-spec",
  title: "Reading the vacancy spec on an invitation",
  shortDescription:
    "Every invitation now carries the full role spec the employer published, frozen at send time. Read it before you accept or decline.",
  category: "invitations",
  keywords: [
    "vacancy",
    "spec",
    "snapshot",
    "frozen",
    "skills",
    "salary",
    "description",
  ],
  related: [
    "vacancy-invitations-explained",
    "how-to-accept-decline-or-reconsider",
    "decline-reasons-and-what-they-mean",
  ],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Before, an invitation showed you the role title + the
        employer&rsquo;s 200-character personal note + the response
        action panel. Now it also shows the <strong>full vacancy
        spec</strong>  required skills, work availability, salary
        band when visible, minimum experience / NQF level when set,
        season window if applicable.
      </p>

      <h2>Frozen at send time</h2>
      <p>
        The spec on your invitation is the spec the employer
        published <em>when they sent the invite</em>. If they later
        edit the vacancy  raise the experience floor, drop the
        season window, change the title  your invitation stays
        unchanged.
      </p>

      <Callout type="info" title="Why frozen, not live?">
        <p>
          Integrity. You&rsquo;re evaluating what the employer{" "}
          <em>sent you</em>, not what they later decided. If the
          spec drifts dramatically after you accept, that&rsquo;s a
          conversation to have with the employer  but the original
          invitation context stays intact.
        </p>
      </Callout>

      <h2>Pre-migration invitations</h2>
      <p>
        Invitations sent before 30 May 2026 don&rsquo;t carry a
        frozen spec. They fall back to the live description with a
        small &ldquo;may have changed&rdquo; annotation. New
        invitations from that date forward carry the snapshot
        automatically.
      </p>

      <DashboardLink href="/dashboard/invitations">Open invitations</DashboardLink>
    </HelpProse>
  );
}
