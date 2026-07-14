import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { listAllCrisisResources } from "@/db/queries/crisis-resources";
import { CrisisResourcesManager } from "@/components/feature/admin/CrisisResourcesManager";

/**
 * Phase 22.2  admin management of crisis-support resources shown in the AI
 * Coach's distress pathway. The AI-Coach switch (/admin/llm) is
 * acknowledgement-gated on these being live + verified.
 */
export default async function AdminCrisisResourcesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const resources = await listAllCrisisResources();

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="AI Coach safety"
      pageTitle="Crisis resources"
      pageSubtitle="Verified crisis-support lines shown when the AI Coach detects a seeker in distress. Add + activate real, current resources before enabling the coach  a wrong number is a safety failure."
    >
      <CrisisResourcesManager resources={resources} />
    </DashboardMasthead>
  );
}
