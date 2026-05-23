import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Link } from "@/i18n/navigation";
import { SAChevron } from "@/components/ui/SAChevron";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Sebenza collects, uses, and protects your personal information under POPIA.",
};

/**
 * Phase 9 — Privacy Policy.
 *
 * Plain-language POPIA-aligned policy. Sections map to POPIA's eight
 * conditions for lawful processing. This is the public-facing legal
 * document; the technical implementation lives across the codebase
 * (lib/consent, lib/audit, lib/crypto, the dashboards).
 *
 * Reviewed-by + last-updated stamp at the bottom. Update with every
 * material change; the consent banner version bump triggers a re-prompt
 * for users whose stored version is older.
 */
export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lastUpdated = "2026-05-23";

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-[color:var(--color-paper)]">
        <header className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] py-12 md:py-16">
          <div className="mx-auto max-w-[820px] px-6">
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              Legal · POPIA
            </div>
            <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-[color:var(--color-ink-soft)]">
              Last updated <time dateTime={lastUpdated}>{lastUpdated}</time>.
              Plain-language summary of how Sebenza processes your personal
              information under the Protection of Personal Information Act,
              2013 (POPIA).
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-[820px] px-6 py-12 md:py-16">
          <Section title="1. Who we are">
            <p>
              Sebenza is a South African talent-intelligence platform operated
              from South Africa. We are the <strong>responsible party</strong>{" "}
              under POPIA for the personal information processed through this
              site.
            </p>
            <p>
              Our Information Officer is reachable at{" "}
              <a href="mailto:popia@sebenza.co.za" className="underline">
                popia@sebenza.co.za
              </a>
              . The Information Regulator (South Africa) is the supervisory
              authority for POPIA matters.
            </p>
          </Section>

          <Section title="2. What we collect, and why">
            <p>
              Sebenza is special-category PII territory by design — we
              process ID numbers, qualifications, and employment status to
              make the SA talent pool visible. Each data category is
              attached to a specific lawful purpose:
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Identity</strong> (name, email, encrypted national ID)
                — to create an account, verify you, and link your profile to
                a real person.
              </li>
              <li>
                <strong>Professional</strong> (profession, skills, experience,
                qualifications, work availability) — to make your profile
                findable to employers searching for that talent.
              </li>
              <li>
                <strong>Status</strong> (employed / open-to-work / studying,
                with confirmation timestamps) — to drive the freshness signal
                that down-ranks stale records.
              </li>
              <li>
                <strong>Activity</strong> (sign-ins, profile views, contact
                reveals, document downloads) — to maintain the audit ledger
                you can see on <code>/dashboard/activity</code>.
              </li>
            </ul>
            <p>
              We do not collect anything we do not need for one of these
              purposes. Adding a new column requires a corresponding update
              to this policy.
            </p>
          </Section>

          <Section title="3. Consent — granular, revocable, never weaponised">
            <p>
              We separate consent into independent purposes. You can grant or
              revoke any of them at any time from{" "}
              <Link href="/dashboard/privacy" className="underline">
                your privacy dashboard
              </Link>
              :
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Searchability</strong> — required for your profile to
                appear in employer search results.
              </li>
              <li>
                <strong>Contact reveal</strong> — lets verified employers see
                your email and phone. Every reveal is audit-logged.
              </li>
              <li>
                <strong>Document sharing</strong> — lets verified employers
                download qualification documents you upload.
              </li>
              <li>
                <strong>Aggregate analytics</strong> — lets us count you in
                anonymised national employment statistics.
              </li>
              <li>
                <strong>Outcomes research</strong> (Phase 7.5) — opt-in
                inclusion in the longitudinal education-to-employment
                dataset. Suppressed below cohorts of 10. Withholding does not
                weaken your job-search experience in any way.
              </li>
            </ul>
            <p>
              We do not penalise you for withholding any optional consent.
              We do not bundle consents. The version of consent text you saw
              is recorded so we can prove what you actually agreed to.
            </p>
          </Section>

          <Section title="4. Who sees what (the Redaction Rule)">
            <p>
              Your public profile <strong>never</strong> exposes your ID
              number, uploaded documents, or raw contact details. Those reach
              an employer only when:
            </p>
            <ol className="my-4 list-decimal pl-6 space-y-2">
              <li>The employer's organisation has been verified by an admin.</li>
              <li>The employer has signed in with their work account.</li>
              <li>
                You have granted the relevant consent (<code>contact_reveal</code>{" "}
                for email/phone; <code>document_sharing</code> for documents).
              </li>
              <li>The reveal is recorded in our audit log.</li>
            </ol>
            <p>
              No condition skipped — ever. The audit log is the system of
              record and you can review your own entries at{" "}
              <code>/dashboard/activity</code>.
            </p>
          </Section>

          <Section title="5. How we protect it">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                ID numbers are encrypted with{" "}
                <strong>AES-256-GCM</strong> at write time. The ciphertext is
                what lives in the database; the plaintext is in memory only
                for the length of the request that processed it.
              </li>
              <li>
                Connections to and from our app are encrypted in transit
                (TLS 1.2+).
              </li>
              <li>
                Administrator and employer sign-ins require two-factor
                authentication once the platform flag is enabled (default for
                new orgs).
              </li>
              <li>
                Every personal-information access is audit-logged with
                actor, subject, and timestamp.
              </li>
              <li>
                Rate limits, security headers (CSP, HSTS), and dependency
                audits run on every release.
              </li>
            </ul>
          </Section>

          <Section title="6. How long we keep it">
            <p>
              Active profiles persist for as long as your account is active.
              When you delete your account (<code>/dashboard/privacy</code> →
              Erase), we soft-delete immediately and hard-delete after a{" "}
              <strong>30-day grace window</strong>. The only thing that
              survives the 30 days is a single audit-log tombstone proving we
              erased you on the date you asked.
            </p>
            <p>
              Audit-log entries themselves are retained for{" "}
              <strong>5 years</strong> for accountability, then purged. This
              matches financial-services convention and is documented in our
              retention policy at <code>docs/popia/RETENTION_POLICY.md</code>.
            </p>
          </Section>

          <Section title="7. Where it lives (data residency)">
            <p>
              Sebenza is built for South African in-country data residency.
              During the build phase, the database is hosted on Neon in the
              EU region; before commercial launch we migrate to AWS Cape
              Town (<code>af-south-1</code>) so that personal information
              never leaves South African jurisdiction. The migration
              runbook is at <code>docs/AWS_MIGRATION_RUNBOOK.md</code>; the
              code is already structured to make the swap a one-file change.
            </p>
            <p>
              File uploads (CVs, qualification documents, profile photos)
              are stored in Supabase Storage with private-bucket-only
              access; reads are gated by short-lived signed URLs issued by
              our server only after the access checks above pass.
            </p>
          </Section>

          <Section title="8. Your rights under POPIA">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Section 23 — access:</strong> download a JSON file
                of every row we hold about you from{" "}
                <Link href="/dashboard/privacy" className="underline">
                  your privacy dashboard
                </Link>
                . Audit-logged.
              </li>
              <li>
                <strong>Section 24 — correction:</strong> edit any profile
                field from <code>/dashboard/profile</code>. Re-confirm your
                national ID and consent versions from the same surface.
              </li>
              <li>
                <strong>Section 24 — deletion:</strong> erase your account
                from <code>/dashboard/privacy</code>. 30-day grace window
                during which an administrator can restore; after that the
                row is gone.
              </li>
              <li>
                <strong>Object to processing:</strong> revoke any consent
                (other than searchability while your profile is active);
                effective immediately.
              </li>
              <li>
                <strong>Complain to the Regulator:</strong> Information
                Regulator (South Africa) —{" "}
                <a
                  href="https://inforegulator.org.za/"
                  className="underline"
                  rel="noreferrer noopener"
                >
                  inforegulator.org.za
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="9. Cookies + analytics">
            <p>
              We use essential cookies (sign-in session, locale preference,
              consent state) without which the site cannot work. We do not
              use third-party advertising trackers. If you accept analytics
              cookies on the banner, we use a privacy-respecting tool to
              count page views — no personal profile is built from your
              browsing.
            </p>
          </Section>

          <Section title="10. Sub-processors">
            <p>
              We rely on these processors (POPIA-aligned, with DPA terms in
              place):
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Database</strong> — Neon (EU, build phase) → AWS
                Cape Town (<code>af-south-1</code>, launch). See Section 7.
              </li>
              <li>
                <strong>File storage</strong> — Supabase Storage (private
                buckets, signed-URL reads).
              </li>
              <li>
                <strong>Email</strong> — Resend (transactional only;
                domain auth via SPF + DKIM + DMARC).
              </li>
              <li>
                <strong>KYC verification</strong> — TBC SA-registered
                provider (Home Affairs eHANIS adapter). Currently inactive
                pending partnership confirmation.
              </li>
              <li>
                <strong>SAQA qualification verification</strong> — SAQA NLRD
                via the partnership API. Currently inactive pending
                partnership confirmation.
              </li>
            </ul>
          </Section>

          <Section title="11. Children">
            <p>
              Sebenza is not directed at children under 18. We do not
              knowingly collect information from anyone under 18. If you
              believe we have, contact the Information Officer and we will
              remove it.
            </p>
          </Section>

          <Section title="12. Changes to this policy">
            <p>
              Material changes bump the policy version and re-prompt for
              consent. Minor clarifications are logged in the policy's
              footer with the last-updated date.
            </p>
          </Section>

          <p className="mt-12 rounded-md border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 text-sm text-[color:var(--color-ink-soft)]">
            Questions? Email{" "}
            <a href="mailto:popia@sebenza.co.za" className="underline">
              popia@sebenza.co.za
            </a>{" "}
            — our Information Officer responds within 5 business days. For
            a copy of the records-management arrangement see our{" "}
            <Link href="/paia" className="underline">
              PAIA manual
            </Link>
            .
          </p>
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
