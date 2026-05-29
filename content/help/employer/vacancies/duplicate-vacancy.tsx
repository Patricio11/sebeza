import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "duplicate-vacancy",
  title: "Duplicating an existing vacancy",
  shortDescription:
    "When and why to duplicate. Pre-fills every field including the seasonal window and match requirements.",
  category: "vacancies",
  keywords: [
    "duplicate",
    "copy",
    "template",
    "reuse",
    "clone",
    "similar",
  ],
  related: ["creating-a-vacancy", "vacancy-lifecycle"],
  surfaceLink: "/employer/vacancies",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Two similar roles in a row &mdash; another sous-chef position
        next December, a second junior dev for the same team next
        quarter &mdash; happens often enough that the platform has a
        one-click duplicate. It pre-fills the form so you only change
        what&rsquo;s different.
      </p>

      <h2>The Duplicate button</h2>
      <p>
        On <strong>/employer/vacancies</strong>, every vacancy card has
        a Duplicate link below the Open CTA. Click it and the new-
        vacancy form opens at{" "}
        <strong>/employer/vacancies/new?duplicateFrom=&lt;id&gt;</strong>,
        with every field already filled from the source vacancy:
      </p>
      <ul>
        <li>title (suffixed with &ldquo;(copy)&rdquo; so it&rsquo;s clear)</li>
        <li>profession + province + city + seniority</li>
        <li>required skills</li>
        <li>description</li>
        <li>salary band</li>
        <li>match requirements (work modes, min years, min NQF)</li>
        <li>invite expiry days</li>
        <li>seasonal window (if seasonal)</li>
        <li>follow-up-nudges-enabled flag</li>
      </ul>

      <h2>What duplication doesn&rsquo;t carry</h2>
      <p>
        The new vacancy is its own draft. Saving doesn&rsquo;t touch
        the source row. Specifically the duplicate does NOT carry:
      </p>
      <ul>
        <li>the source vacancy&rsquo;s invitations</li>
        <li>any placements logged against the source</li>
        <li>per-vacancy shortlists from the match page</li>
        <li>the source&rsquo;s audit history</li>
      </ul>
      <p>
        It&rsquo;s a clean restart with the same spec.
      </p>

      <Callout type="info" title="No templates table">
        <p>
          Sebenza deliberately doesn&rsquo;t have a &ldquo;templates&rdquo;
          surface. The duplicate-from-existing path covers 95% of the
          real use case &mdash; two similar roles in a row &mdash; without
          committing to a templates abstraction that adds review surface
          + UX clutter. If you find yourself duplicating the same vacancy
          a third time, that&rsquo;s a signal to revisit the original
          rather than copy it again.
        </p>
      </Callout>

      <h2>Use cases that work well</h2>
      <ul>
        <li>
          <strong>Re-opening a seasonal role next year</strong> &mdash;
          duplicate from December 2025&rsquo;s vacancy when
          December 2026 comes around, tweak the title year, save.
        </li>
        <li>
          <strong>Multiple identical headcount</strong> &mdash; need
          three backend devs at the same level? Create the first,
          duplicate twice, save all three. Match page works
          independently per vacancy.
        </li>
        <li>
          <strong>Variations on a theme</strong> &mdash; sous chef in
          Cape Town and another in Durban: duplicate, change province,
          done.
        </li>
      </ul>
    </HelpProse>
  );
}
