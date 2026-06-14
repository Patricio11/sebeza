/**
 * Phase 9.15  Admin queue for "Other" taxonomy suggestions.
 *
 * Pending profession + institution suggestions, deduplicated by
 * (kind, lower(custom_text)) so popular requests cluster. Admin can
 * promote (with optional spelling correction), merge into an existing
 * canonical entry, or reject. User data is preserved across all paths.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { asc, eq, isNull, and, sql } from "drizzle-orm";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { listPendingSuggestions } from "@/lib/taxonomy/suggestions";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { TaxonomySuggestionsManager } from "@/components/feature/admin/TaxonomySuggestionsManager";
import { ChevronLeft } from "lucide-react";

export const revalidate = 0;

export default async function TaxonomySuggestionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const db = getDb();
  const [
    professionSuggestions,
    institutionSuggestions,
    organisationSuggestions,
    skillSuggestions,
    canonicalProfessions,
    canonicalInstitutions,
    canonicalOrganisations,
    canonicalSkills,
  ] = await Promise.all([
    listPendingSuggestions("profession"),
    listPendingSuggestions("institution"),
    // Phase 9.22  org-kind suggestions.
    listPendingSuggestions("organisation"),
    // Phase 10 follow-up  skill suggestions queue.
    listPendingSuggestions("skill"),
    db
      .select({ slug: schema.professions.slug, label: schema.professions.label })
      .from(schema.professions)
      .orderBy(asc(schema.professions.label)),
    db
      .select({ slug: schema.institutions.slug, label: schema.institutions.label })
      .from(schema.institutions)
      .where(
        and(
          eq(schema.institutions.isPending, false),
          isNull(schema.institutions.deletedAt),
        ),
      )
      .orderBy(asc(schema.institutions.label)),
    // Phase 9.22  picker-visible orgs for the merge picker. Includes
    // sebenza_registered + verified seeker_named. Capped at 500 for
    // the picker; if the org list grows past that, the existing
    // ComboboxField client-side filter handles the rest.
    db
      .select({
        slug: schema.organizations.id,
        label: schema.organizations.name,
      })
      .from(schema.organizations)
      .where(
        sql`(${schema.organizations.origin} = 'sebenza_registered' OR ${schema.organizations.verification} = 'verified')`,
      )
      .orderBy(asc(schema.organizations.name))
      .limit(500),
    // Phase 10 follow-up  canonical skills for the skill-merge picker.
    db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .orderBy(asc(schema.skills.label)),
  ]);

  const totalPending =
    professionSuggestions.length +
    institutionSuggestions.length +
    organisationSuggestions.length +
    skillSuggestions.length;

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Queue"
      pageTitle="Taxonomy suggestions"
      pageSubtitle={
        totalPending === 0
          ? "Nothing pending. When users pick \"Other\" + enter free-text on profession, institution, organisation, or skill pickers, suggestions land here."
          : `${totalPending} pending ${totalPending === 1 ? "suggestion" : "suggestions"} across professions, institutions, organisations + skills.`
      }
    >
      <div className="mb-4">
        <Link
          href="/admin/taxonomy"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to taxonomy
        </Link>
      </div>

      <TaxonomySuggestionsManager
        professionSuggestions={professionSuggestions}
        institutionSuggestions={institutionSuggestions}
        organisationSuggestions={organisationSuggestions}
        skillSuggestions={skillSuggestions}
        canonicalProfessions={canonicalProfessions.map((p) => ({
          value: p.slug,
          label: p.label,
        }))}
        canonicalInstitutions={canonicalInstitutions.map((i) => ({
          value: i.slug,
          label: i.label,
        }))}
        canonicalOrganisations={canonicalOrganisations.map((o) => ({
          value: o.slug,
          label: o.label,
        }))}
        canonicalSkills={canonicalSkills.map((s) => ({
          value: s.slug,
          label: s.label,
        }))}
      />

      <aside className="mt-10 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-5 text-xs text-[color:var(--color-ink-soft)]">
        <p className="font-medium text-[color:var(--color-ink)]">How this works</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <strong>Promote</strong>  adds the entry to the canonical list.
            All profiles carrying this exact custom text are backfilled to the
            new canonical value.
          </li>
          <li>
            <strong>Merge into existing</strong>  use this when the suggestion
            is a misspelling or a synonym of an existing canonical entry
            ("Damelan" → "Damelin College"). Profiles re-point at the target.
          </li>
          <li>
            <strong>Reject</strong>  removes the suggestion from this queue.
            <em> The user&rsquo;s data is preserved</em>  their profile keeps
            their entered text. Use this for spam, joke entries, or items that
            shouldn&rsquo;t become canonical.
          </li>
        </ul>
      </aside>
    </DashboardMasthead>
  );
}
