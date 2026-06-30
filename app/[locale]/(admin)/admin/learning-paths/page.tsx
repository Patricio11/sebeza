import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { listLearningPathsAdmin } from "@/db/queries/learning-paths";
import {
  LearningPathsManager,
  type AdminPathDto,
} from "@/components/feature/admin/LearningPathsManager";

/**
 * Phase 18.2 ("Living Learning Catalog")  the editorial admin surface. Curate
 * the SA-grounded learning-path catalog seekers see on the Career Compass:
 * re-verify paths (so links don't rot), edit, remove + restore. The weekly
 * freshness cron nudges admins here when paths go 90+ days unverified.
 */
export default async function AdminLearningPathsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const rows = await listLearningPathsAdmin();
  const paths: AdminPathDto[] = rows.map(({ row, stale }) => ({
    id: row.id,
    title: row.title,
    provider: row.provider,
    providerKind: row.providerKind,
    cost: row.cost,
    costNote: row.costNote,
    outcome: row.outcome,
    durationWeeks: row.durationWeeks,
    unlocksSkills: row.unlocksSkills,
    national: row.national,
    url: row.url,
    sebenzaReviewed: row.sebenzaReviewed,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    reviewCount: row.reviewCount,
    recommendCount: row.recommendCount,
    deleted: row.deletedAt != null,
    stale,
  }));

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Catalog"
      pageTitle="Learning paths"
      pageSubtitle="Curate the learning-path catalog seekers see on the Career Compass. Re-verify paths so links don't rot, edit details, and remove ones that have closed."
    >
      <LearningPathsManager paths={paths} />
    </DashboardMasthead>
  );
}
