import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "case-reference-documenting-your-query",
  title: "Case reference: documenting your query intent",
  shortDescription:
    "Why the case-reference field is mandatory, what makes a good reference, and what happens when admin oversight reads your lookup log.",
  category: "employer_lookup",
  keywords: [
    "case reference",
    "documentation",
    "intent",
    "audit",
    "oversight",
    "compliance",
  ],
  related: [
    "per-employer-lookup-what-you-can-query",
    "the-oversight-log-your-lookups",
    "reading-employment-status-mix",
  ],
  surfaceLink: "/gov/employer-lookup",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Every per-employer lookup requires a case reference before
        you can submit. It&rsquo;s the single most important piece
        of friction on the surface &mdash; not because the platform
        needs the field for its own purposes, but because the
        platform&rsquo;s audit posture requires that every named-
        organisation query map back to a documented reason in your
        own system.
      </p>

      <h2>What a good case reference looks like</h2>
      <ul>
        <li>
          A ticket / case number from your existing case-management
          system (e.g. <code>NT-2026-0481</code> for a Treasury
          case, <code>DHA/POLICY/2026-153</code> for a Home Affairs
          policy review, <code>DOEL-EC-2026-29</code> for an
          Eastern Cape DoEL enquiry).
        </li>
        <li>
          A formal enquiry identifier from a stakeholder
          (Parliamentary question number, NEDLAC reference, oversight
          committee request).
        </li>
        <li>
          A scheduled-report code for recurring compliance work
          (e.g. <code>QUARTERLY-Q1-2026</code> for a quarterly
          sectoral analysis).
        </li>
      </ul>

      <h2>What is NOT a good case reference</h2>
      <ul>
        <li>
          Free text describing your reason (&ldquo;checking
          something for the minister&rdquo;). Reasoning is not a
          reference; it doesn&rsquo;t reconstruct backward into
          your own case system.
        </li>
        <li>
          Personal initials or a generic project name
          (&ldquo;DM-Q1&rdquo;). It works for you for a week and
          then nobody can match it to anything.
        </li>
        <li>
          A blank or a placeholder (the form rejects empty submissions,
          but it doesn&rsquo;t police placeholders &mdash; you can
          submit <code>X</code>, but it makes the audit useless).
        </li>
      </ul>

      <h2>What admins see when they review your lookups</h2>
      <p>
        Sebenza admins read the Oversight log periodically (see the
        admin-side article on monitoring gov lookups for patterns).
        They look at:
      </p>
      <ul>
        <li>
          The pattern of orgs queried (clustering on small
          municipalities, repeated lookups of the same org over
          short windows).
        </li>
        <li>
          The presence + quality of case references on each lookup.
        </li>
        <li>
          The cadence of lookups (after-hours bursts, batched
          extractions).
        </li>
      </ul>
      <p>
        A pattern that doesn&rsquo;t map to documented case work
        triggers a conversation with your team lead &mdash; not
        with you individually, and not as accusation. The posture
        is &ldquo;help us understand the pattern&rdquo; rather than
        &ldquo;we&rsquo;ve caught you.&rdquo; A clean case-reference
        field makes those conversations short.
      </p>

      <Callout type="info" title="Your own audit trail is also visible to you">
        <p>
          The Account page surfaces your own lookup history with
          the case references you supplied. If you need to
          reconstruct &ldquo;which orgs did I query for the Q1
          policy work?&rdquo;, that&rsquo;s the surface to use.
          It&rsquo;s also a useful self-check before submitting a
          new lookup &mdash; if you can&rsquo;t describe the
          reference from memory, that&rsquo;s a signal you&rsquo;re
          using the field as a placeholder.
        </p>
      </Callout>
    </HelpProse>
  );
}
