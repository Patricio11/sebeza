import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "listed-by-seekers-badge",
  title: "The 'Listed by N seekers' + Employer-verified badges",
  shortDescription:
    "Two badges on seeker profiles - what they mean, what they don't, and why both can be honest at once.",
  category: "talent_search",
  keywords: [
    "badge",
    "listed by",
    "employer verified",
    "verification",
    "seeker named",
    "sebenza employer",
    "trust",
    "current employer",
  ],
  related: [
    "dossier-reveal",
    "searching",
  ],
  surfaceLink: "/search",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        When you open a search row or a /p/[handle] page, you might see
        the seeker&rsquo;s current employer surfaced with one of two
        badges. They mean different things; the platform deliberately
        labels them honestly.
      </p>

      <h2>Sebenza employer</h2>
      <p>
        Green badge. The seeker&rsquo;s declared employer is a
        Sebenza-registered organisation &mdash; meaning the employer
        went through the Phase 9.10 KYC flow, uploaded their
        documents, was admin-verified, and actively uses the platform
        for recruiting (or at least signed up to).
      </p>
      <p>
        Sebenza employers can post vacancies, invite seekers, log
        placements. They&rsquo;re full citizens of the platform.
      </p>

      <h2>Verified employer (the Phase 9.22 path)</h2>
      <p>
        Neutral badge. The seeker entered an &ldquo;Other&rdquo;
        employer name at sign-up (or on their dashboard); the platform
        created a pending organisation row + a suggestion in the admin
        queue; admin reviewed the company name, possibly looked it up,
        possibly contacted them, and promoted the row to{" "}
        <em>verification = verified</em>.
      </p>
      <p>
        These orgs are real companies the platform knows about, but
        haven&rsquo;t signed up themselves. They can&rsquo;t post
        vacancies + can&rsquo;t invite seekers. They appear in the
        employer-picker dropdown so future seekers can pick from a
        consistent list instead of typing the company name freshly.
      </p>
      <Callout type="info" title="One organisation can carry both states">
        <p>
          If a Sebenza-registered employer signs up while there&rsquo;s
          already a verified-seeker-named row for the same company,
          admin merges the two during onboarding. The seeker-named
          history is preserved; the org becomes
          <em>sebenza_registered</em>. Future seekers see the &ldquo;Sebenza
          employer&rdquo; badge from then on.
        </p>
      </Callout>

      <h2>Employer-verified (Phase 9.23)</h2>
      <p>
        A small pill in the &ldquo;Currently at&rdquo; dossier row when
        the seeker has a successful Phase 9.23 employment verification
        within the last 12 months. The pill reads{" "}
        <em>&ldquo;Employer-verified · Mar 2026.&rdquo;</em>
      </p>
      <p>
        That means: the seeker opted into the verification flow, named
        a contact at their employer (with explicit consent + a
        SHA-256-hash audit row), the contact got a one-shot email,
        and the contact clicked &ldquo;Yes, verify they work here.&rdquo;
        The contact&rsquo;s email was deleted from our records within
        14 days regardless.
      </p>
      <Callout type="warning" title="The badge decays at 12 months">
        <p>
          Status-Freshness Rule applies to verification too. After 12
          months, the Employer-verified pill silently downgrades to the
          underlying employer badge (Sebenza employer / Verified
          employer). The seeker can request a new verification any time
          to refresh it.
        </p>
      </Callout>

      <h2>What the badges DON&rsquo;T say</h2>
      <p>
        Honesty about what the platform doesn&rsquo;t verify:
      </p>
      <ul>
        <li>
          A &ldquo;Sebenza employer&rdquo; badge means the company is
          KYC&rsquo;d. It does NOT mean the seeker actually works there
          unless they also carry the Employer-verified pill.
        </li>
        <li>
          A &ldquo;Verified employer&rdquo; badge means admin confirmed
          the company exists + the name is canonical. It does NOT mean
          the seeker actually works there unless they also carry the
          Employer-verified pill.
        </li>
        <li>
          An Employer-verified pill means a named contact at the
          employer confirmed by email. It does NOT tell you what the
          contact&rsquo;s response actually was (verify / decline /
          dispute &mdash; the binary outcome is what feeds the badge;
          decline + dispute simply don&rsquo;t produce one).
        </li>
      </ul>
    </HelpProse>
  );
}
