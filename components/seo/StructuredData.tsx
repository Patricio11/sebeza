/**
 * Phase 33  JSON-LD structured data (docs/PHASE_33_SEO_PLAN.md §33.3).
 *
 * Server-rendered <script type="application/ld+json"> blocks. Before
 * this phase the platform shipped ZERO structured data; these give
 * Google the Organization card, the sitelinks search box, rich FAQ
 * results, and  on consented dossiers only  a Person entity.
 *
 * Rules:
 *   - Every builder states only facts the page already renders
 *     (Redaction Rule: no fields beyond the public payload).
 *   - `sameAs` ships empty until real social profiles exist
 *     (SOCIAL_PROFILES flagged UNKNOWN in the plan's §1 inputs).
 *   - PersonJsonLd is mounted ONLY when the profile is indexable
 *     (searchability consent granted  D3): structured data must not
 *     out-reach the robots meta.
 *
 * XSS note: JSON.stringify output is embedded in a <script> tag, so
 * `<` must not be able to close the tag. serialize() escapes `<` to
 * `<` (the standard approach from the React docs)  user-shaped
 * strings (display names) can't break out.
 */

import {
  BRAND_NAME,
  LEGAL_NAME,
  SITE_DESCRIPTION,
  SITE_URL,
  SUPPORT_EMAIL,
  TAGLINE,
} from "@/lib/seo";

function serialize(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

/** Organization  who runs the platform. Mounted on the landing page. */
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: BRAND_NAME,
        legalName: LEGAL_NAME,
        alternateName: TAGLINE,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/icon-512.png`,
        description: SITE_DESCRIPTION,
        areaServed: "ZA",
        contactPoint: {
          "@type": "ContactPoint",
          email: SUPPORT_EMAIL,
          contactType: "customer support",
          availableLanguage: ["en", "zu", "xh", "af"],
        },
        sameAs: [],
      }}
    />
  );
}

/**
 * WebSite + SearchAction  tells Google the site is searchable at
 * /search?q=… (eligible for the sitelinks search box). Mounted on the
 * landing page.
 */
export function WebSiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BRAND_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: ["en", "zu", "xh", "af"],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

/**
 * Person  a consented public dossier. Fields are strictly the ones
 * /p/[handle] already renders: redacted display name, profession,
 * province. Never mount on an unconsented (noindex) profile.
 */
export function PersonJsonLd({
  displayName,
  profession,
  province,
  handle,
}: {
  displayName: string;
  profession: string;
  province: string;
  handle: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Person",
        name: displayName,
        jobTitle: profession,
        url: `${SITE_URL}/p/${handle}`,
        address: {
          "@type": "PostalAddress",
          addressRegion: province,
          addressCountry: "ZA",
        },
      }}
    />
  );
}

/**
 * FAQPage  mirrors the landing FAQ section. Pass the SAME
 * question/answer strings that are rendered in the HTML (Google
 * requires the marked-up content to be visible on the page).
 */
export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((i) => ({
          "@type": "Question",
          name: i.question,
          acceptedAnswer: { "@type": "Answer", text: i.answer },
        })),
      }}
    />
  );
}
