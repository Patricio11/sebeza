/**
 * Phase 9.7.6  Per-employer governed lookup page.
 *
 * `gov`/`admin` only. Ships dormant behind
 * `feature_flag_employer_mix_lookup`  the page itself renders with
 * a clear dormant notice when the flag is off, so admins flipping it
 * on later can hand a URL to gov users without confusion. When the
 * flag is on, the form mounts client-side and the result panel
 * renders post-action.
 *
 * Defence-in-depth: the Server Action re-checks the flag (see
 * `lib/gov/employer-lookup.ts`)  this page can't accidentally
 * bypass policy by forgetting a check.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { EmployerLookupForm } from "@/components/feature/gov/EmployerLookupForm";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 0; // Always dynamic  the flag may change.

export default async function GovEmployerLookupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();

  const flagOn = await getSetting<boolean>(
    "feature_flag_employer_mix_lookup",
  );
  const floor = await getSetting<number>("employer_mix_min_placements");

  return (
    <DashboardMasthead
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
      activeKey="employer-lookup"
      pageEyebrow="Regulated · single-employer query"
      pageTitle="Per-employer mix lookup"
      pageSubtitle="One employer at a time. Exact-match input only  no autocomplete, no browse, no leaderboard. Every lookup writes an audit row carrying the stated reason; the oversight log makes the trail itself reviewable."
    >
      {/* Phase 10.4  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="gov" slug="per-employer-lookup-what-you-can-query" label="How to query" />
        <HelpLink role="gov" slug="case-reference-documenting-your-query" label="Case reference rules" />
        <HelpLink role="gov" slug="reading-employment-status-mix" label="Reading the mix" />
        <HelpLink role="gov" slug="the-oversight-log-your-lookups" label="Oversight log" />
      </div>

      {/* Bounded-query framing strip  what this surface is and isn't,
          without making specific regulatory-mandate claims. */}
      <section
        aria-labelledby="framing-h"
        className="rounded-[var(--radius-md)] border border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)] p-5 md:p-6"
      >
        <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Bounded query · audit-logged
        </div>
        <h2
          id="framing-h"
          className="mt-2 font-display text-lg text-[color:var(--color-ink)]"
        >
          What this surface is, and what it isn&rsquo;t
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          <strong className="text-[color:var(--color-ink)]">What it is:</strong>{" "}
          a bounded per-employer query for a specific compliance or
          policy follow-up. Returns the SA-citizen / foreign-national
          split of an employer&rsquo;s Sebenza-confirmed placements,
          when the placement count is above the small-numbers floor
          (k = {floor}). Below the floor: the count is shown but never
          the split  that would re-identify individuals.
        </p>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          <strong className="text-[color:var(--color-ink)]">
            What it isn&rsquo;t:
          </strong>{" "}
          a way to audit a company&rsquo;s &ldquo;foreigner ratio,&rdquo;
          a fishing tool, or a list. The query layer has no endpoint
          that ranks or pages employers by nationality mix; only
          single-employer exact-match lookups are possible. Every
          query is audit-logged with the stated reason.
        </p>
      </section>

      {!flagOn ? (
        <DormantNotice />
      ) : (
        <section className="mt-8">
          <EmployerLookupForm />
        </section>
      )}
    </DashboardMasthead>
  );
}

function DormantNotice() {
  return (
    <section
      aria-labelledby="dormant-h"
      className="mt-8 rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-6 md:p-8"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div>
          <h2
            id="dormant-h"
            className="font-display text-xl text-[color:var(--color-ink)]"
          >
            This surface is dormant by default
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            The per-employer governed lookup ships with{" "}
            <code className="rounded bg-[color:var(--color-surface-sunk)] px-1 text-xs">
              feature_flag_employer_mix_lookup
            </code>{" "}
            off. The engine + UI are built and tested; activation pairs
            with a concrete operational need  purpose-limitation,
            retention windows, and named operators become concrete at
            that point. Same dormant-by-default posture as the KYC and
            SAQA adapters from Phase 8.
          </p>
          <p className="mt-3 text-sm text-[color:var(--color-ink-soft)]">
            An admin can flip the flag in{" "}
            <Link href="/admin/settings" className="underline">
              /admin/settings
            </Link>
            . The form then renders here. Every lookup, including the
            first test one after the flip, writes a{" "}
            <code className="rounded bg-[color:var(--color-surface-sunk)] px-1 text-xs">
              gov.employer_mix.lookup
            </code>{" "}
            audit row visible in the 9.7.7 oversight log.
          </p>
        </div>
      </div>
    </section>
  );
}
