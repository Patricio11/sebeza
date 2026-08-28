import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { listBlueprintCoverage } from "@/db/queries/blueprints";
import { starterBlueprintFor } from "@/lib/blueprints/catalogue";
import {
  BlueprintsManager,
  type BlueprintRowDto,
} from "@/components/feature/admin/BlueprintsManager";
import {
  BlueprintDraftPanel,
  type BlueprintDraftDto,
} from "@/components/feature/admin/BlueprintDraftPanel";
import { latestPendingDraft } from "@/lib/admin/blueprints";
import { blueprintDraftSchema } from "@/lib/blueprints/draft-parser";

/**
 * Role blueprints (docs/ROLE_BLUEPRINTS_PLAN.md): what each profession's
 * skill set looks like in three tiers. Import the starter catalogue once,
 * then edit tiers, tracks and "prove it" lines per profession.
 */
export default async function AdminBlueprintsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ profession?: string }>;
}) {
  const { locale } = await params;
  const { profession } = await searchParams;
  setRequestLocale(locale);
  await verifyAdmin();

  const db = getDb();
  const [coverage, skills] = await Promise.all([
    listBlueprintCoverage(),
    db
      .select({ slug: schema.skills.slug, label: schema.skills.label })
      .from(schema.skills)
      .orderBy(asc(schema.skills.label)),
  ]);
  const selected =
    coverage.find((c) => c.slug === profession)?.slug ??
    coverage[0]?.slug ??
    "";
  const dbRows = selected
    ? await db
        .select({
          skillSlug: schema.professionSkillBlueprints.skillSlug,
          tier: schema.professionSkillBlueprints.tier,
          track: schema.professionSkillBlueprints.track,
          proveIt: schema.professionSkillBlueprints.proveIt,
          source: schema.professionSkillBlueprints.source,
        })
        .from(schema.professionSkillBlueprints)
        .where(eq(schema.professionSkillBlueprints.professionSlug, selected))
    : [];
  const labelBySlug = new Map(skills.map((s) => [s.slug, s.label]));
  const rows: BlueprintRowDto[] =
    dbRows.length > 0
      ? dbRows.map((r) => ({
          skillSlug: r.skillSlug,
          label: labelBySlug.get(r.skillSlug) ?? r.skillSlug,
          tier: r.tier as BlueprintRowDto["tier"],
          track: r.track,
          proveIt: r.proveIt,
          source: r.source,
          live: true,
        }))
      : starterBlueprintFor(selected).map((r) => ({
          skillSlug: r.skillSlug,
          label: labelBySlug.get(r.skillSlug) ?? r.skillSlug,
          tier: r.tier,
          track: r.track,
          proveIt: r.proveIt,
          source: "starter",
          live: false,
        }));
  const liveCount = coverage.filter((c) => c.dbRows > 0).length;
  const missing = coverage
    .filter((c) => c.dbRows === 0 && c.starterRows === 0)
    .map((c) => ({ slug: c.slug, label: c.label }));
  const pendingRow = selected ? await latestPendingDraft(selected) : null;
  const draftParsed = pendingRow
    ? blueprintDraftSchema.safeParse(pendingRow.payload)
    : null;
  const draft: BlueprintDraftDto | null =
    pendingRow && draftParsed?.success
      ? {
          id: pendingRow.id,
          professionSlug: pendingRow.professionSlug,
          rawModel: pendingRow.rawModel,
          createdAt: pendingRow.createdAt.toISOString(),
          payload: {
            core: draftParsed.data.core,
            expected: draftParsed.data.expected,
            tracks: draftParsed.data.tracks,
            proveIt: draftParsed.data.proveIt ?? {},
            newSkills: draftParsed.data.newSkills,
          },
        }
      : null;
  const selectedLabel =
    coverage.find((c) => c.slug === selected)?.label ?? selected;

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Catalog"
      pageTitle="Role blueprints"
      pageSubtitle="What each profession's skill set looks like: core, expected, and next-level tracks. The Career Compass reads these to show every seeker an honest route, even where employer demand is still quiet."
    >
      <div className="mb-8">
        <BlueprintDraftPanel
          selected={selected}
          selectedLabel={selectedLabel}
          hasRows={dbRows.length > 0}
          draft={draft}
          labels={Object.fromEntries(labelBySlug)}
          missing={missing}
        />
      </div>
      <BlueprintsManager
        coverage={coverage}
        liveCount={liveCount}
        selected={selected}
        rows={rows}
        skills={skills}
      />
    </DashboardMasthead>
  );
}
