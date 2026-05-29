import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "internal-notes",
  title: "Internal notes on a placement",
  shortDescription:
    "1000-char durable context, org-private, PII-flagged. What it's for + what it deliberately isn't.",
  category: "employees",
  keywords: [
    "internal note",
    "note",
    "context",
    "private",
    "1000 char",
    "review",
    "performance",
  ],
  related: [
    "lifecycle-view",
    "check-ins",
    "departures-reengage",
  ],
  surfaceLink: "/employer/placements",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Each placement has an internal note panel on its detail page.
        1 000 characters max. Free text. Strictly internal to your
        organisation. Editable by Owners + Recruiters; Viewers see it
        read-only.
      </p>

      <h2>What the note is for</h2>
      <p>
        Durable context only your team needs. The kind of thing that
        used to live in a shared spreadsheet or a Slack DM that
        no-one can find six months later. Examples:
      </p>
      <ul>
        <li>
          <em>&ldquo;Hired into our Cape Town team, relocated from
          Joburg. Her partner works at Capitec. Review in 6 months
          for the Tech Lead role.&rdquo;</em>
        </li>
        <li>
          <em>&ldquo;Came in via Naledi&rsquo;s referral.
          Negotiated salary above band &mdash; covered in the
          Q3 hiring exception.&rdquo;</em>
        </li>
        <li>
          <em>&ldquo;Studying part-time toward MBA, exam season Oct.
          Avoid project-launch dates that month.&rdquo;</em>
        </li>
      </ul>

      <h2>What the note is NOT for</h2>
      <Callout type="warning" title="Not a performance review">
        <p>
          Sebenza deliberately doesn&rsquo;t structure this field.
          There is no rating, no ranking, no &ldquo;exceeds /
          meets / below expectations&rdquo; dropdown. Adding
          structure would turn the note into an HRIS artefact &mdash;
          the line Sebenza explicitly stays behind (Phase 9.20 D0).
        </p>
      </Callout>
      <p>
        Specifically, do NOT use the internal note for:
      </p>
      <ul>
        <li>warnings or disciplinary records (SA labour-law Schedule 8 territory)</li>
        <li>structured performance reviews</li>
        <li>salary history beyond what&rsquo;s already on the placement&rsquo;s salary band</li>
        <li>medical or wellness information</li>
        <li>reasons for departure (the category captures the fact; the reason isn&rsquo;t recorded anywhere)</li>
      </ul>

      <h2>How it&rsquo;s stored</h2>
      <ul>
        <li>
          Plain text on the placements table; not encrypted.
        </li>
        <li>
          Empty string clears the note to NULL (no
          &ldquo;was-cleared&rdquo; ghost row).
        </li>
        <li>
          Every save writes a <em>placement.note.update</em> audit
          row with both the noteLength and the PII-flagged content,
          so any future export sweep handles it correctly.
        </li>
        <li>
          The audit row also records a <em>cleared = true</em> hint
          when the new note is NULL, so the trail distinguishes
          &ldquo;saved nothing&rdquo; from &ldquo;explicitly cleared.&rdquo;
        </li>
      </ul>

      <h2>Editing</h2>
      <p>
        On the placement detail page, hit <strong>Edit</strong> on the
        Internal note panel. The panel switches to a textarea with a
        character counter; Save commits, Cancel reverts to the last
        saved value. Owner + Recruiter roles can edit; Viewer sees a
        read-only display.
      </p>
      <p>
        When you mark someone departed via the Phase 9.20 departure
        modal, the optional 500-char note you enter there is{" "}
        <strong>appended</strong> to the durable internal note with a
        dated header:{" "}
        <em>&ldquo;Departure (2026-05-29, resigned): {`{your
        note}`}.&rdquo;</em> Prior internal-note content is preserved;
        the departure note never overwrites.
      </p>

      <Callout type="info" title="Cap on combined size">
        <p>
          If appending a departure note would push the total past
          1 000 chars, the action fails loudly rather than silently
          truncating. Trim either the new note or the existing internal
          note + try again. The platform never quietly drops your data.
        </p>
      </Callout>
    </HelpProse>
  );
}
