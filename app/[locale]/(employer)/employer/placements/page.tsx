import { setRequestLocale, getTranslations } from "next-intl/server";
import { and, desc, eq } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { verifyEmployer } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { CheckCircle2, Search } from "lucide-react";
import { PlacementDeleteButton } from "@/components/feature/employer/PlacementDeleteButton";

export default async function PlacementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const t = await getTranslations("employerDash.placements");
  const tOuter = await getTranslations("employerDash");

  const db = getDb();
  const rows = session.orgId
    ? await db
        .select({
          id: schema.placements.id,
          role: schema.placements.role,
          city: schema.placements.city,
          hiredAt: schema.placements.hiredAt,
          salaryBand: schema.placements.salaryBand,
          handle: schema.profiles.handle,
          displayName: schema.profiles.displayName,
        })
        .from(schema.placements)
        .innerJoin(
          schema.profiles,
          eq(schema.profiles.id, schema.placements.profileId),
        )
        .where(
          and(
            eq(schema.placements.organizationId, session.orgId),
          ),
        )
        .orderBy(desc(schema.placements.hiredAt))
    : [];

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="placements"
      pageEyebrow="Analytics fuel"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      banner={
        session.verification !== "verified" ? (
          <OrgVerificationBanner
            message={tOuter("orgUnverifiedBanner")}
            cta={tOuter("orgUnverifiedCta")}
          />
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title="No placements logged yet"
          body="Open a candidate's dossier, reveal their contact, then 'Mark as hired' to log a placement here. Every placement feeds the live national hire count."
          action={
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
            >
              <Search className="size-4" aria-hidden="true" />
              Find a candidate
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="px-5 py-3 font-normal">{t("fields.candidate")}</th>
                  <th className="px-5 py-3 font-normal">{t("fields.role")}</th>
                  <th className="px-5 py-3 font-normal">{t("fields.city")}</th>
                  <th className="px-5 py-3 font-normal">{t("fields.hiredAt")}</th>
                  <th className="px-5 py-3 font-normal">{t("fields.salaryBand")}</th>
                  <th className="px-5 py-3 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[color:var(--color-hairline)]"
                  >
                    <td className="px-5 py-3 font-display text-base">
                      <Link
                        href={`/employer/dossier/${p.handle}`}
                        className="hover:underline"
                      >
                        {p.displayName}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{p.role}</td>
                    <td className="px-5 py-3">{p.city}</td>
                    <td className="px-5 py-3 tabular text-[color:var(--color-ink-soft)]">
                      {p.hiredAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 text-[color:var(--color-ink-soft)]">
                      {p.salaryBand ?? ""}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          Logged
                        </span>
                        <PlacementDeleteButton
                          placementId={p.id}
                          candidateName={p.displayName}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/employer/dossier/${p.handle}`}
                      className="block font-display text-lg leading-tight hover:underline"
                    >
                      {p.displayName}
                    </Link>
                    <div className="text-sm text-[color:var(--color-ink-soft)]">
                      {p.role}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Logged
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {t("fields.city")}
                    </dt>
                    <dd>{p.city}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {t("fields.hiredAt")}
                    </dt>
                    <dd className="tabular">
                      {p.hiredAt.toISOString().slice(0, 10)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                      {t("fields.salaryBand")}
                    </dt>
                    <dd className="text-[color:var(--color-ink-soft)]">
                      {p.salaryBand ?? ""}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex justify-end">
                  <PlacementDeleteButton
                    placementId={p.id}
                    candidateName={p.displayName}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs italic text-[color:var(--color-ink-soft)]">
        Placements feed the national placement analytics (
        <Link href="/insights" className="underline">
          /insights
        </Link>
        ) and the skills-gap engine (Phase 6). Salary bands stay private to
        your organisation.
      </p>
    </DashboardShell>
  );
}
