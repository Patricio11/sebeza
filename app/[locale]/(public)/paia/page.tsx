import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Link } from "@/i18n/navigation";
import { SAChevron } from "@/components/ui/SAChevron";

export const metadata = {
  title: "PAIA Manual",
  description:
    "Sebenza's manual under the South African Promotion of Access to Information Act, 2000.",
};

/**
 * Phase 9 — PAIA manual.
 *
 * South Africa's Promotion of Access to Information Act (Act 2 of 2000)
 * requires every public AND private body to publish a manual describing:
 *   - the records it holds
 *   - the access procedure
 *   - the relevant officials
 *   - the requester's rights and obligations
 *
 * This manual is the public legal-compliance surface. It cross-references
 * the Privacy Policy (POPIA-side) and the runbooks at docs/popia/.
 */
export default async function PaiaManualPage({
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
              Legal · PAIA
            </div>
            <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
              PAIA Manual
            </h1>
            <p className="mt-3 text-[color:var(--color-ink-soft)]">
              Published in terms of Section 51 of the Promotion of Access to
              Information Act, 2000 (Act 2 of 2000). Last updated{" "}
              <time dateTime={lastUpdated}>{lastUpdated}</time>.
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-[820px] px-6 py-12 md:py-16">
          <Section title="1. Particulars of Sebenza (Section 51(1)(a))">
            <table className="my-4 w-full text-sm">
              <tbody>
                <Row k="Name" v="Sebenza (working name)" />
                <Row k="Type" v="Private body, South African talent-intelligence platform" />
                <Row k="Postal address" v="To be confirmed before commercial launch" />
                <Row k="Physical address" v="To be confirmed before commercial launch" />
                <Row k="Telephone" v="To be published with commercial launch" />
                <Row k="Email (Information Officer)" v="popia@sebenza.co.za" />
                <Row k="Website" v="https://sebenza.co.za" />
              </tbody>
            </table>
          </Section>

          <Section title="2. Information Officer & Deputy (Section 51(1)(b))">
            <p>
              The Information Officer is responsible for all PAIA and POPIA
              compliance matters, including responding to access requests.
            </p>
            <table className="my-4 w-full text-sm">
              <tbody>
                <Row k="Information Officer" v="To be designated (named individual recorded in docs/popia/INFORMATION_OFFICER.md)" />
                <Row k="Deputy Information Officer" v="To be designated alongside" />
                <Row k="Email" v="popia@sebenza.co.za" />
              </tbody>
            </table>
          </Section>

          <Section title="3. Guide on how to use the Act (Section 51(1)(c))">
            <p>
              The Information Regulator (South Africa) has published a Guide
              on how to use PAIA. It is available at{" "}
              <a
                href="https://inforegulator.org.za/"
                className="underline"
                rel="noreferrer noopener"
              >
                inforegulator.org.za
              </a>
              .
            </p>
          </Section>

          <Section title="4. Records held by Sebenza (Section 51(1)(d))">
            <p>The records held fall into the following categories:</p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>User account records</strong> — name, email, role,
                hashed password, two-factor secrets, KYC transaction
                references.
              </li>
              <li>
                <strong>Profile records</strong> — handle, profession,
                skills, experience, qualifications, employment status,
                work availability, encrypted national ID (where supplied).
              </li>
              <li>
                <strong>Organisation records</strong> — registered employer
                organisations and members.
              </li>
              <li>
                <strong>Activity records</strong> — sign-ins, search events,
                contact reveals, document downloads, placement confirmations,
                consent grants/revocations, administrator actions.
              </li>
              <li>
                <strong>File uploads</strong> — CVs, qualification documents,
                profile photos (stored privately in Supabase Storage; access
                via short-lived signed URLs only).
              </li>
              <li>
                <strong>Audit log</strong> — every access to special-category
                personal information, with actor + subject + timestamp.
                Retained for 5 years.
              </li>
              <li>
                <strong>Aggregate analytics</strong> — anonymised cohort
                statistics for the longitudinal outcomes dataset (suppressed
                below 10 individuals per cell, per Phase 7.5.4).
              </li>
            </ul>
          </Section>

          <Section title="5. Records automatically available (Section 51(1)(e))">
            <p>The following are published without a PAIA request:</p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                Public talent profiles (only those whose owner has granted{" "}
                <code>searchability</code> consent), at{" "}
                <Link href="/search" className="underline">
                  /search
                </Link>
                .
              </li>
              <li>
                Aggregate national analytics at{" "}
                <Link href="/insights" className="underline">
                  /insights
                </Link>{" "}
                — freshness band counts, skills-gap demand vs supply,
                supply heatmap, longitudinal outcomes (suppressed cells
                only).
              </li>
              <li>
                This PAIA manual and the{" "}
                <Link href="/privacy" className="underline">
                  Privacy Policy
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section title="6. How to request access (Section 51(1)(d)–(f))">
            <p>
              You have a right to your own records and, in certain
              circumstances, to records of other persons (subject to PAIA's
              third-party-protection regime).
            </p>
            <h3 className="mt-5 font-display text-lg">Your own records — easiest path</h3>
            <p>
              Sign in and use{" "}
              <Link href="/dashboard/privacy" className="underline">
                <code>/dashboard/privacy</code>
              </Link>{" "}
              → <strong>Download my data</strong>. We stream a JSON file
              with every row referencing your account. This is free, instant,
              and audit-logged (PAIA + POPIA §23 satisfied in one click).
            </p>
            <h3 className="mt-5 font-display text-lg">Records about a third party — formal PAIA request</h3>
            <p>
              Complete Form 2 of the PAIA Regulations and submit it to the
              Information Officer at{" "}
              <a href="mailto:popia@sebenza.co.za" className="underline">
                popia@sebenza.co.za
              </a>
              . We respond within{" "}
              <strong>30 calendar days</strong> as required by PAIA, and
              follow the third-party-notification procedure if applicable.
            </p>
            <h3 className="mt-5 font-display text-lg">Fees</h3>
            <p>
              No fee for your own records via the dashboard download path.
              For formal PAIA requests, the prescribed PAIA fees apply (see
              the Regulator's fee schedule).
            </p>
          </Section>

          <Section title="7. Grounds for refusal (Section 51(1)(g))">
            <p>
              Access may be refused on the grounds set out in PAIA, including
              (but not limited to):
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                Protection of a third party's personal information (Section
                63).
              </li>
              <li>
                Protection of confidential information of a third party
                (Section 64).
              </li>
              <li>
                Protection of the safety of individuals and of property
                (Section 66).
              </li>
              <li>Records protected by legal privilege (Section 67).</li>
              <li>
                Records relating to commercial activities (Section 68) and
                records of research (Section 69), where applicable.
              </li>
            </ul>
            <p>
              If we refuse access, we give written reasons referencing the
              specific PAIA section and notify you of your appeal rights.
            </p>
          </Section>

          <Section title="8. Right to lodge a complaint with the Information Regulator">
            <p>
              If you are unhappy with our response, you may lodge a
              complaint with the Information Regulator (South Africa):{" "}
              <a
                href="https://inforegulator.org.za/"
                className="underline"
                rel="noreferrer noopener"
              >
                inforegulator.org.za
              </a>
              . You may also approach a court of competent jurisdiction.
            </p>
          </Section>

          <Section title="9. Availability">
            <p>
              This manual is published on{" "}
              <Link href="/paia" className="underline">
                /paia
              </Link>{" "}
              and is available, on request and at no charge, in printable
              format via the Information Officer.
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-[color:var(--color-hairline)] last:border-b-0">
      <th className="w-1/3 py-2 pr-4 text-left align-top font-medium text-[color:var(--color-ink-soft)]">
        {k}
      </th>
      <td className="py-2">{v}</td>
    </tr>
  );
}
