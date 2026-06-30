import { setRequestLocale } from "next-intl/server";
import { asc } from "drizzle-orm";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { listAllPrereqsAdmin } from "@/db/queries/skill-prereqs";
import { SkillPrereqsManager } from "@/components/feature/admin/SkillPrereqsManager";

/**
 * Phase 20  the admin surface for the skill-prerequisite graph. Small +
 * high-signal (not an ontology): curate which skills are best learned after
 * which. Drives the flag-gated compass re-ranking + "Requires:" pills.
 */
export default async function AdminSkillPrereqsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const db = getDb();
  const [rows, skills] = await Promise.all([
    listAllPrereqsAdmin(),
    db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .orderBy(asc(schema.skills.label)),
  ]);

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Taxonomy"
      pageTitle="Skill prerequisites"
      pageSubtitle="Curate which skills are best learned after which. The compass sequences its recommendations so a prerequisite never sits below the skill it unlocks (when the flag is on)."
    >
      <SkillPrereqsManager rows={rows} skills={skills} />
    </DashboardMasthead>
  );
}
