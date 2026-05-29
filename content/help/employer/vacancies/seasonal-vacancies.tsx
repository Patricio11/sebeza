import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "seasonal-vacancies",
  title: "Seasonal vacancies and the season window",
  shortDescription:
    "When to pick seasonal vs casual vs contract, and how the optional month-window sharpens the invitation.",
  category: "vacancies",
  keywords: [
    "seasonal",
    "season",
    "window",
    "summer",
    "christmas",
    "easter",
    "december",
    "lodge",
    "tourism",
    "agriculture",
    "harvest",
    "recurring",
  ],
  related: [
    "creating-a-vacancy",
    "match-requirements",
    "bulk-invite",
  ],
  surfaceLink: "/employer/vacancies/new",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        SA hospitality, tourism, agriculture and retail run on recurring
        windows: chefs at Garden Route lodges from December to February,
        waitresses in KZN for Easter and July school holidays, citrus
        pickers May to October, Christmas-trade retail. The platform has
        a <strong>seasonal</strong> chip in the work-availability set
        plus an optional date window on the vacancy.
      </p>

      <h2>Seasonal vs casual vs contract</h2>
      <ul>
        <li>
          <strong>Casual</strong> &mdash; ad-hoc, irregular shifts. A
          waitress who&rsquo;ll pick up Friday-night cover sometimes.
        </li>
        <li>
          <strong>Contract</strong> &mdash; fixed-term, often a year+.
          A six-month maternity-cover dev role.
        </li>
        <li>
          <strong>Seasonal</strong> &mdash; recurring, predictable, tied
          to a calendar window. The lodge chef every December.
        </li>
      </ul>
      <p>
        A seasonal chef is genuinely a different thing from a casual
        chef; the matcher treats the chips as separate so a seeker who
        ticked &ldquo;seasonal&rdquo; doesn&rsquo;t get casual ad-hoc
        invites they didn&rsquo;t opt into.
      </p>

      <h2>The optional season window</h2>
      <p>
        When you pick the <strong>seasonal</strong> chip on a vacancy,
        the form reveals three more fields: start month, end month,
        repeats every year. All optional. Leave them blank for
        &ldquo;seasonal work, timing TBD&rdquo;; fill them in to say
        &ldquo;this role runs Dec&ndash;Feb, annually.&rdquo;
      </p>
      <Callout type="tip" title="Year-wrap windows">
        <p>
          If your window crosses December (e.g. lodges Nov&ndash;Feb),
          set start to November and end to February. The platform reads
          start &gt; end as &ldquo;wraps the year&rdquo; everywhere
          &mdash; renderer, notification body, future filters.
        </p>
      </Callout>

      <h2>What the seeker sees</h2>
      <p>
        The window rides along on the invitation notification body. The
        seeker reads &ldquo;Seasonal window: Nov&ndash;Feb,
        annually.&rdquo; (or &ldquo;Dec, this year only, no
        recurrence&rdquo; when you&rsquo;ve unticked recurring). They
        decide whether the timing fits before accepting.
      </p>
      <p>
        The seeker doesn&rsquo;t have a month preference field of their
        own &mdash; the platform deliberately doesn&rsquo;t ask
        &ldquo;what months are you available?&rdquo; on the profile
        side. That would shrink the match set artificially. Instead the
        vacancy declares the window; the seeker inspects per
        opportunity.
      </p>

      <h2>One-off seasonal runs</h2>
      <p>
        Untick <strong>This window repeats every year</strong> for
        one-off events &mdash; a 2026 World Cup pop-up, a one-time
        Christmas trade you don&rsquo;t expect to repeat. The
        notification body then reads &ldquo;this year only, no
        recurrence&rdquo; instead of &ldquo;annually.&rdquo; The
        invitation lifecycle is otherwise identical.
      </p>

      <Callout type="info" title="No automatic re-fire next season">
        <p>
          A recurring seasonal vacancy doesn&rsquo;t automatically
          re-open next December and fire fresh invitations. You re-open
          (or duplicate) it when you&rsquo;re ready &mdash; the platform
          never pretends to know whether you actually want the same role
          again.
        </p>
      </Callout>
    </HelpProse>
  );
}
