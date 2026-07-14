import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { listCustomSkillLeaderboard } from "@/db/queries/custom-skills";
import { CustomSkillsLeaderboard } from "@/components/feature/admin/CustomSkillsLeaderboard";

/**
 * Phase 19.2 ("Custom Skills  canonicalization")  the admin surface that turns
 * seeker-claimed niche skills into taxonomy growth. Aggregate + anonymized
 * leaderboard of the most-requested unindexed labels; promoting one creates a
 * canonical skill + migrates every holder into the searchable taxonomy.
 */
export default async function AdminCustomSkillsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const rows = await listCustomSkillLeaderboard();

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Taxonomy growth"
      pageTitle="Custom skills"
      pageSubtitle="The most-requested skills seekers have described but the taxonomy doesn't cover yet. Promote a label to make it a canonical, searchable skill  every seeker who claimed it moves across at their own self-attested level."
    >
      <CustomSkillsLeaderboard rows={rows} />
    </DashboardMasthead>
  );
}
