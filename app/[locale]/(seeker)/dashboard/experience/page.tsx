import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { getMyProfile } from "@/lib/profile/me";
import { getDb } from "@/db/client";
import { experiences } from "@/db/schema";
import {
  ExperienceManager,
  type ExperienceRow,
} from "@/components/feature/profile/ExperienceManager";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/experience");

  const t = await getTranslations("seekerDash.experience");

  // We re-query experiences here (rather than re-using me.experience) so we
  // capture each row's `id`  needed for edit/delete.
  const db = getDb();
  const rows = await db
    .select()
    .from(experiences)
    .where(eq(experiences.profileId, me.profileId))
    .orderBy(desc(experiences.startedAt));

  const initial: ExperienceRow[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    organization: r.organization,
    city: r.city,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    description: r.description,
  }));

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow="Track record"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <ExperienceManager
        initial={initial}
        labels={{
          add: t("add"),
          to: t("to"),
          current: t("current"),
          empty: t("empty"),
        }}
      />
    </DashboardMasthead>
  );
}
