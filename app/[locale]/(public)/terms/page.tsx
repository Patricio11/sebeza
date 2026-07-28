import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Link } from "@/i18n/navigation";
import { SAChevron } from "@/components/ui/SAChevron";

export const metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and Sebenza covering accounts, acceptable use, employer obligations, and your rights.",
};

/**
 * Terms of Service (2026-07-02, alongside the sign-up consent
 * regroup  see docs/SIGNUP_CONSENT_REGROUP_PLAN.md).
 *
 * Also fixes a live gap: the SiteFooter linked /terms since Phase 9
 * but the route never existed (404).
 *
 * Engineering-authored draft in the same voice as the self-authored
 * Privacy Policy + PAIA manual. The banner below the title flags the
 * attorney-review requirement honestly  same posture as the DPIA's
 * unsigned sign-off section. Sections describe what the platform
 * ACTUALLY does (verification honesty, audited reveals, granular
 * consent); nothing here promises behaviour the code doesn't have.
 *
 * The sign-up step-2 terms checkbox links here; acceptance evidence
 * lands in the auth.signup audit meta (termsAcceptedAt). Deliberately
 * SEPARATE from the granular POPIA consents  this page is the
 * contract; /privacy is the processing notice.
 */
export default async function TermsOfServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lastUpdated = "2026-07-02";

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-[color:var(--color-paper)]">
        <header className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] py-12 md:py-16">
          <div className="mx-auto max-w-[820px] px-6">
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              Legal · Terms
            </div>
            <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
              Terms of Service
            </h1>
            <p className="mt-3 text-[color:var(--color-ink-soft)]">
              Last updated <time dateTime={lastUpdated}>{lastUpdated}</time>.
              The agreement between you and Sebenza when you create an
              account or use the platform.
            </p>
            <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
              This is a plain-language draft prepared by the Sebenza team.
              It will be reviewed by a South African attorney before
              commercial launch; if any clause conflicts with South African
              law, the law prevails.
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-[820px] px-6 py-12 md:py-16">
          <Section title="1. Who we are">
            <p>
              Sebenza (working name) is a South African national
              talent-intelligence platform operated by{" "}
              <strong>Yetotec (Pty) Ltd</strong>, a company registered in
              South Africa. &ldquo;We&rdquo;, &ldquo;us&rdquo; and
              &ldquo;the platform&rdquo; refer to Yetotec (Pty) Ltd and
              the Sebenza service at sebenzasa.com.
            </p>
            <p>
              Questions about these terms:{" "}
              <a href="mailto:popia@sebenzasa.com" className="underline">
                popia@sebenzasa.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. What Sebenza is (and is not)">
            <p>
              Sebenza is a talent register and matching platform: job
              seekers make a redacted professional profile findable;
              verified employers search, request contact, and send role
              invitations; government partners read aggregate,
              privacy-floored statistics.
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Sebenza is not an employment agency.</strong> We do
                not employ you, place you, or take a fee from your wages.
                Any employment relationship you enter is between you and
                the employer.
              </li>
              <li>
                <strong>No guarantee of outcomes.</strong> We do not
                promise you interviews, invitations, offers, or hires
                or, for employers, that any search will produce suitable
                candidates.
              </li>
              <li>
                <strong>Honesty by design.</strong> Verification badges
                reflect what has actually been verified; unverified means
                unverified. Statistics count a hire only when it is
                confirmed through the platform.
              </li>
            </ul>
          </Section>

          <Section title="3. Your account">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                You must be at least <strong>14 years old</strong> (the
                minimum working age under the Basic Conditions of
                Employment Act) to create a seeker account.
              </li>
              <li>
                The information you provide must be true. Claiming
                qualifications, experience, or an identity you do not have
                is a breach of these terms and grounds for suspension.
              </li>
              <li>
                Keep your password to yourself. You are responsible for
                activity on your account; tell us immediately at{" "}
                <a href="mailto:popia@sebenzasa.com" className="underline">
                  popia@sebenzasa.com
                </a>{" "}
                if you suspect it has been compromised.
              </li>
              <li>
                One account per person or organisation. You may close your
                account at any time from your privacy centre; erasure
                follows the process described in the{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                post false, misleading, or unlawful content, or
                impersonate another person or organisation;
              </li>
              <li>
                harass, threaten, or discriminate against other users
                including on the grounds of nationality: Sebenza matches
                by residence and skill, never by nationality, and abusive
                conduct toward foreign nationals is a breach of these
                terms;
              </li>
              <li>
                scrape, bulk-download, or systematically extract profiles
                or platform data, or attempt to re-identify individuals
                from aggregate statistics;
              </li>
              <li>
                probe, disable, or circumvent security or privacy
                controls, including consent gates and redaction;
              </li>
              <li>
                use the platform to send spam or to recruit for schemes
                that are not genuine work opportunities.
              </li>
            </ul>
          </Section>

          <Section title="5. Employer obligations">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                Organisation accounts start <strong>unverified</strong>;
                contact details and documents stay locked until your
                organisation passes verification.
              </li>
              <li>
                Contact details revealed to you may be used{" "}
                <strong>only for recruitment for a genuine role</strong>.
                Re-selling, marketing use, or adding seekers to unrelated
                databases is prohibited. Every reveal is audit-logged.
              </li>
              <li>
                Invitations must describe real vacancies. Seekers can
                report abusive invitations; patterns of abuse lead to
                suspension of the organisation.
              </li>
              <li>
                Documents shared with you (e.g. qualifications) are for
                the assessment at hand  do not retain or redistribute
                them beyond that purpose.
              </li>
            </ul>
          </Section>

          <Section title="6. Consent and your data">
            <p>
              Your privacy choices are <strong>separate from these
              terms</strong>. Data processing is governed by the{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>{" "}
              and the granular consent purposes you grant at sign-up or
              later  each individually revocable from your privacy
              centre without closing your account. Accepting these terms
              does not grant any data-processing consent, and revoking a
              consent is never a breach of these terms. Access-to-records
              requests follow the{" "}
              <Link href="/paia" className="underline">
                PAIA manual
              </Link>
              .
            </p>
          </Section>

          <Section title="7. The service, changes, and availability">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                Sebenza is currently free for job seekers. If paid
                features are ever introduced, they will be clearly
                marked and nothing you already have will be silently
                converted to paid.
              </li>
              <li>
                Features may be added, changed, gated, or retired. Some
                capabilities ship dormant and activate later.
              </li>
              <li>
                We aim for high availability but do not guarantee
                uninterrupted service. Planned maintenance and incident
                recovery may interrupt access.
              </li>
            </ul>
          </Section>

          <Section title="8. Content and intellectual property">
            <p>
              You own the content you post (your profile, documents,
              descriptions). You grant us the licence needed to operate
              the service: storing, displaying (subject to your consents
              and the redaction rules), and processing it into the
              aggregate statistics described in the Privacy Policy. The
              platform&rsquo;s software, design, and brand remain ours.
            </p>
          </Section>

          <Section title="9. Liability">
            <p>
              To the extent permitted by South African law: the platform
              is provided &ldquo;as is&rdquo;; we are not liable for
              indirect or consequential loss, for the conduct of other
              users (including employers and seekers), or for decisions
              made on the basis of platform information. Nothing in these
              terms limits rights you have under the Consumer Protection
              Act, POPIA, or any other law that cannot be contracted out
              of.
            </p>
          </Section>

          <Section title="10. Suspension and termination">
            <p>
              We may suspend or close accounts that breach these terms
              including false information, abuse of other users, misuse
              of revealed contact details, or attempts to circumvent
              privacy controls. Where practical we warn first; serious
              abuse may result in immediate suspension. Moderation
              decisions can be queried at{" "}
              <a href="mailto:popia@sebenzasa.com" className="underline">
                popia@sebenzasa.com
              </a>
              .
            </p>
          </Section>

          <Section title="11. Governing law">
            <p>
              These terms are governed by the law of the Republic of South
              Africa, and South African courts have jurisdiction over any
              dispute arising from them.
            </p>
          </Section>

          <Section title="12. Changes to these terms">
            <p>
              We may update these terms as the platform evolves. Material
              changes are announced on the platform, and the
              &ldquo;last updated&rdquo; date above always reflects the
              current version. Continuing to use Sebenza after a change
              takes effect means you accept the updated terms.
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
        {title}
      </h2>
      <div className="prose prose-sm max-w-none text-[color:var(--color-ink)] [&_p]:my-3 [&_p]:text-base [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
