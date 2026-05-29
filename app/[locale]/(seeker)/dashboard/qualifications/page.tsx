import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { getMyProfile } from "@/lib/profile/me";
import { getDb } from "@/db/client";
import { qualifications } from "@/db/schema";
import { ShieldCheck } from "lucide-react";
import {
  QualificationsManager,
  type QualificationRow,
} from "@/components/feature/profile/QualificationsManager";
import type { VerificationStatus } from "@/lib/mock/types";
import { getSetting } from "@/lib/admin/settings";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function QualificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/qualifications");

  const t = await getTranslations("seekerDash.qualifications");
  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );

  const db = getDb();
  const rows = await db
    .select()
    .from(qualifications)
    .where(eq(qualifications.profileId, me.profileId))
    .orderBy(asc(qualifications.awardedYear));

  const initial: QualificationRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    institution: r.institution,
    awardedYear: r.awardedYear,
    verification: r.verification as VerificationStatus,
    hasDocument: !!r.documentStorageKey,
  }));

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="qualifications"
      pageEyebrow="Credentials"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="uploading-certificates-and-verification" label="How verification works" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Verification info  left rail */}
        <section className="rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6 md:col-span-1">
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            How verification works
          </div>
          <h2 className="mt-2 font-display text-xl">
            Default state is unverified.
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]"
                aria-hidden="true"
              />
              <span>Upload an original certificate (PDF, JPEG or PNG; max 10 MB).</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]"
                aria-hidden="true"
              />
              <span>Upload flips state to <strong>pending</strong>; the admin queue or a SAQA partner verifies authenticity.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand)]"
                aria-hidden="true"
              />
              <span>Files live in a private Supabase Storage bucket  every reveal is audit-logged.</span>
            </li>
          </ul>
          <p className="mt-5 text-xs text-[color:var(--color-ink-soft)]">
            {t("verificationBy")} <strong>Sebenza admin (Phase 7)</strong> ·
            partner SAQA integration in Phase 8.
          </p>
        </section>

        {/* Live manager */}
        <div className="md:col-span-2">
          <QualificationsManager
            initial={initial}
            labels={{
              add: t("add"),
              empty: t("empty"),
            }}
            verificationVisible={verificationVisible}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
