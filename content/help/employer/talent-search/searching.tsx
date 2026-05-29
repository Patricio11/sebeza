import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "searching",
  title: "Searching the talent base",
  shortDescription:
    "Every filter explained: profession, location, status, availability, years, NQF, citizenship, student-mode toggles.",
  category: "talent_search",
  keywords: [
    "search",
    "talent",
    "filter",
    "filters",
    "profession",
    "province",
    "city",
    "status",
    "verification",
    "citizens",
    "highlight",
  ],
  related: [
    "saved-searches",
    "dossier-reveal",
    "finding-matches",
    "match-requirements",
  ],
  surfaceLink: "/search",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        <strong>/search</strong> is the canonical talent search surface.
        Every filter the matcher knows about lives here, in the same SQL
        as the per-vacancy Find Matches page &mdash; there&rsquo;s no
        parallel matcher. Use it for proactive talent discovery
        unattached to a specific vacancy.
      </p>

      <h2>The filters</h2>
      <h3>Identity + location</h3>
      <ul>
        <li>
          <strong>Profession</strong> &mdash; exact label match
          (case-insensitive). Use the canonical list; the canonical
          list comes from the Phase 9.15 taxonomy.
        </li>
        <li>
          <strong>Province</strong> &mdash; slug-based; supports the
          KwaZulu-Natal hyphen properly.
        </li>
        <li>
          <strong>City</strong> &mdash; refines within a province.
          Optional; province-wide search is fine.
        </li>
      </ul>

      <h3>Status + verification</h3>
      <ul>
        <li>
          <strong>Status</strong> &mdash; employed / self_employed /
          studying / unemployed / open_to_work. Status-Freshness Rule:
          status records &gt; 90 days stale are downranked.
        </li>
        <li>
          <strong>Verification</strong> &mdash; unverified / pending /
          verified / rejected. The default search returns all states;
          the filter narrows when you want only verified candidates.
          Verification-Honesty Rule: badges reflect reality.
        </li>
      </ul>

      <h3>Skills, seniority + experience</h3>
      <ul>
        <li>
          <strong>Free-text query</strong> &mdash; the search bar
          accepts natural-looking queries (e.g.{" "}
          <em>&ldquo;senior developer&rdquo; -junior</em>). Backed by
          PostgreSQL websearch_to_tsquery.
        </li>
        <li>
          <strong>Seniority</strong> &mdash; junior / intermediate /
          senior.
        </li>
        <li>
          <strong>Minimum years of experience</strong> &mdash; hard
          floor 0&ndash;60. NULL on the seeker (rather not say) is
          treated as not-a-pass when this floor is set. NULL on the
          filter ignores the axis entirely.
        </li>
        <li>
          <strong>Minimum NQF level</strong> &mdash; same posture as
          vacancy match requirements: NULL = the matcher doesn&rsquo;t
          check qualifications; non-NULL checks against the seeker&rsquo;s
          highest academic record.
        </li>
      </ul>

      <h3>Work availability + student mode</h3>
      <ul>
        <li>
          <strong>Available for</strong> &mdash; multi-select work
          availability chips. Array-overlap matching: seeker passes if
          ANY of their chips intersect ANY of yours.
        </li>
        <li>
          <strong>Open to internships</strong> &mdash; scopes to student
          seekers with the internship flag on their academic profile.
        </li>
        <li>
          <strong>Open to graduate programmes</strong> &mdash; scopes
          to student seekers with the graduate-track flag.
        </li>
      </ul>

      <h3>Citizenship highlight</h3>
      <p>
        Toggle <strong>Highlight SA citizens</strong> to hard-group SA
        citizens above non-citizens in the result list. Inside each
        group, the score still orders rows; you get the best SA
        citizen on top, then the rest of the SA citizens by score, then
        the best non-citizen, etc.
      </p>
      <Callout type="info" title="Location-Not-Nationality Rule">
        <p>
          Nationality is shown, never a gate. The platform never
          excludes a candidate because of nationality; the highlight
          toggle is an explicit UX choice to surface SA citizens, not a
          filter that removes anyone. Citizen-Visibility Rule applied
          throughout.
        </p>
      </Callout>

      <h2>Ranking</h2>
      <p>
        Composed score per result row:{" "}
        <em>ts_rank_cd × freshness × (0.5 + 0.5 × completeness/100)</em>.
        Stale statuses fall honestly &mdash; the freshness multiplier
        does the work, not a hidden cutoff.
      </p>
      <p>
        The result page is capped at 50 rows. The honest-supply line
        above the list tells you the total match count + the SA-citizen
        split. If you&rsquo;re seeing 50 but the total says 800, you
        have headroom for more candidates &mdash; refine + research
        more.
      </p>

      <h2>Privacy</h2>
      <p>
        Public-search payloads never include national ID, contact
        details, or documents. The redaction type{" "}
        <em>PublicProfile</em> enforces this structurally; you
        can&rsquo;t accidentally surface PII via /search.
      </p>
      <p>
        Search events write a <em>search.profiles</em> audit row so the
        platform can build the skills-gap signal. The audit captures
        the filters + result count, not the seeker IDs that came back
        &mdash; the search-and-discovery pattern is logged at the level
        of intent, not consumption.
      </p>
    </HelpProse>
  );
}
