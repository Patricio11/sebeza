/**
 * Phase 13.3  /admin/curriculum  editorial-catalogue curation.
 *
 * Three views:
 *   1. Catalogue queue  pending `module_skills` rows from LLM
 *      suggestions. Approve / reject / edit-and-approve.
 *   2. Bulk import  paste a syllabus, the dispatcher fans out to
 *      the active LLM provider, suggestions land in the queue.
 *   3. Provenance ledger  approved rows with approver + source.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";
import { CurriculumQueueManager } from "@/components/feature/admin/CurriculumQueueManager";

export const revalidate = 0;

export default async function AdminCurriculumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const db = getDb();
  const [
    queue,
    recentApproved,
    activeProvider,
    killSwitchOn,
    skills,
    institutions,
  ] = await Promise.all([
    db
      .select({
        id: schema.moduleSkills.id,
        moduleSlug: schema.moduleSkills.moduleSlug,
        moduleLabel: schema.moduleSkills.moduleLabel,
        skillSlug: schema.moduleSkills.skillSlug,
        skillLabel: schema.skills.label,
        confidence: schema.moduleSkills.confidence,
        institutionSlug: schema.moduleSkills.institutionSlug,
        createdAt: schema.moduleSkills.createdAt,
      })
      .from(schema.moduleSkills)
      .leftJoin(
        schema.skills,
        eq(schema.moduleSkills.skillSlug, schema.skills.slug),
      )
      .where(eq(schema.moduleSkills.source, "llm_suggested"))
      .orderBy(desc(schema.moduleSkills.createdAt))
      .limit(100),
    db
      .select({
        id: schema.moduleSkills.id,
        moduleLabel: schema.moduleSkills.moduleLabel,
        skillSlug: schema.moduleSkills.skillSlug,
        skillLabel: schema.skills.label,
        confidence: schema.moduleSkills.confidence,
        institutionSlug: schema.moduleSkills.institutionSlug,
        approvedAt: schema.moduleSkills.approvedAt,
        approvedBy: schema.moduleSkills.approvedBy,
      })
      .from(schema.moduleSkills)
      .leftJoin(
        schema.skills,
        eq(schema.moduleSkills.skillSlug, schema.skills.slug),
      )
      .where(eq(schema.moduleSkills.source, "editorial"))
      .orderBy(desc(schema.moduleSkills.approvedAt))
      .limit(25),
    db
      .select({
        id: schema.llmProviders.id,
        displayName: schema.llmProviders.displayName,
      })
      .from(schema.llmProviders)
      .where(eq(schema.llmProviders.active, true))
      .limit(1),
    getSetting<boolean>("feature_flag_llm_curriculum_enabled"),
    db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .orderBy(asc(schema.skills.label)),
    db
      .select({
        slug: schema.institutions.slug,
        label: schema.institutions.label,
      })
      .from(schema.institutions)
      .orderBy(asc(schema.institutions.label)),
  ]);

  const subtitle = !killSwitchOn
    ? "LLM kill-switch is OFF. Existing queue rows can be reviewed; bulk import refuses every request."
    : activeProvider[0]
      ? `Active provider: ${activeProvider[0].displayName}. Paste a syllabus to land suggestions in the queue.`
      : "No active LLM provider. Visit /admin/llm to configure + activate one.";

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Catalogue"
      pageTitle="Curriculum"
      pageSubtitle={subtitle}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/admin/llm"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          LLM providers
        </Link>
      </div>

      <CurriculumQueueManager
        queue={queue.map((q) => ({
          ...q,
          createdAt: q.createdAt.toISOString(),
        }))}
        recentApproved={recentApproved.map((r) => ({
          ...r,
          approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
        }))}
        skills={skills}
        institutions={institutions}
        bulkImportAvailable={Boolean(killSwitchOn && activeProvider[0])}
        killSwitchOn={killSwitchOn}
        hasActiveProvider={Boolean(activeProvider[0])}
      />
    </DashboardMasthead>
  );
}
