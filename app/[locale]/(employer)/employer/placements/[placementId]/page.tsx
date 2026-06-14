/**
 * Phase 9.20 Tier 1  Employee (placement) detail page.
 *
 * Read-only at Tier 1. Tier 2 wires the "Confirm still employed"
 * quick action + editable internal note. Tier 3 wires the "Mark
 * departed" modal + the re-engage panel. This page renders the
 * skeleton with empty hooks where those actions will land so the
 * shape doesn't shift as we ship the later tiers.
 *
 * Privacy invariant: `getEmployee` already org-scopes the load; the
 * page renders 404 when the placement isn't owned by the caller's
 * org (same posture as `getMyVacancy`  doesn't differentiate
 * "doesn't exist" from "exists but not yours").
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { Avatar } from "@/components/ui/Avatar";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  confirmPlacementStillEmployed,
  getEmployee,
  listOpenVacanciesForReengage,
  listStatusChecksForPlacement,
  listPlacementAuditExcerpt,
  markPlacementDeparted,
  updatePlacementInternalNote,
  type EmployeeDetail,
  type PlacementStatusCheckRow,
  type PlacementAuditRow,
} from "@/lib/employer/placement-lifecycle";
import {
  PLACEMENT_DEPARTURE_CATEGORIES,
  type PlacementDepartureCategory,
} from "@/lib/employer/placement-lifecycle-types";
import { bulkInviteToVacancy } from "@/lib/employer/invitations";
import { getMyOrgRole } from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import { ConfirmStatusIsland } from "@/components/feature/employer/placements/ConfirmStatusIsland";
import { InternalNoteEditorIsland } from "@/components/feature/employer/placements/InternalNoteEditorIsland";
import { DepartureIsland } from "@/components/feature/employer/placements/DepartureIsland";
import { HelpLink } from "@/components/feature/help/HelpLink";
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  History,
  FileText,
} from "lucide-react";

export const revalidate = 0;

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; placementId: string }>;
}) {
  const { locale, placementId } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const employee = await getEmployee(placementId);
  if (!employee) notFound();

  const [checks, auditExcerpt, role, openVacancies] = await Promise.all([
    listStatusChecksForPlacement(employee.placementId),
    listPlacementAuditExcerpt(employee.placementId, employee.profileId),
    getMyOrgRole(),
    listOpenVacanciesForReengage(),
  ]);
  const canEdit = canEditVacancies(role);

  return (
    <DashboardMasthead
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="placements"
      pageEyebrow="Employee"
      pageTitle={employee.displayName}
      pageSubtitle={`${employee.role} · ${employee.city}`}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/employer/placements"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to employees
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <StatusPill employee={employee} />
        <HelpLink slug="check-ins" label="Check-in cadence" />
        <HelpLink slug="departures-reengage" label="Departures + re-engage" />
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <Link
          href={`/employer/dossier/${employee.handle}`}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink)] underline-offset-2 hover:underline"
        >
          Open dossier
        </Link>
      </div>

      <PersonHeader employee={employee} />

      <TenureTimeline
        employee={employee}
        canEdit={canEdit}
        openVacancies={openVacancies}
      />

      <InternalNoteEditorIsland
        placementId={employee.placementId}
        initialNote={employee.internalNote}
        canEdit={canEdit}
        action={async (input) => {
          "use server";
          const res = await updatePlacementInternalNote(input);
          return res.ok ? { ok: true } : { ok: false, message: res.message };
        }}
      />

      <CheckHistoryPanel checks={checks} />

      {employee.vacancyId && employee.vacancyTitle && (
        <SourceVacancyPanel
          vacancyId={employee.vacancyId}
          vacancyTitle={employee.vacancyTitle}
        />
      )}

      <ActivityPanel rows={auditExcerpt} />

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Lifecycle data stays inside your organisation. Aggregate
        retention figures land on{" "}
        <Link href="/insights" className="underline">
          /insights
        </Link>{" "}
        thresholded at k ≥ 10, the same disclosure floor every other
        national surface respects.
      </p>
    </DashboardMasthead>
  );
}

function PersonHeader({ employee }: { employee: EmployeeDetail }) {
  const hiredAtDate = new Date(employee.hiredAt).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <Avatar
          name={employee.displayName}
          photoUrl={employee.profilePhotoUrl}
          size="xl"
          showRing={false}
        />
        <div className="flex-1">
          <h2 className="font-display text-2xl text-[color:var(--color-ink)]">
            {employee.displayName}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Role
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
                <Briefcase className="size-3" aria-hidden="true" />
                {employee.role}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Location
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
                <MapPin className="size-3" aria-hidden="true" />
                {employee.city}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Hired
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 tabular text-[color:var(--color-ink)]">
                <Calendar className="size-3" aria-hidden="true" />
                {hiredAtDate}
              </dd>
            </div>
            <div>
              <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                Tenure
              </dt>
              <dd className="mt-0.5 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
                <Clock className="size-3" aria-hidden="true" />
                {formatTenure(employee.tenureMonths)}
              </dd>
            </div>
          </dl>
          {employee.hiredByDisplayName && (
            <p className="mt-3 text-xs text-[color:var(--color-ink-soft)]">
              Logged as hired by <strong>{employee.hiredByDisplayName}</strong>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TenureTimeline({
  employee,
  canEdit,
  openVacancies,
}: {
  employee: EmployeeDetail;
  canEdit: boolean;
  openVacancies: { vacancyId: string; title: string }[];
}) {
  const hiredAt = new Date(employee.hiredAt);
  const nextCheck = new Date(employee.nextCheckDueAt);
  const lastCheck = employee.lastCheckAt
    ? new Date(employee.lastCheckAt)
    : null;
  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Lifecycle
        </span>
        {canEdit && employee.currentStatus !== "departed" && (
          <div className="flex flex-wrap gap-2">
            <ConfirmStatusIsland
              placementId={employee.placementId}
              employeeName={employee.displayName}
              variant="button"
              action={async (input) => {
                "use server";
                const res = await confirmPlacementStillEmployed(input);
                return res.ok
                  ? { ok: true }
                  : { ok: false, message: res.message };
              }}
            />
            <DepartureIsland
              placementId={employee.placementId}
              profileId={employee.profileId}
              employeeName={employee.displayName}
              hireDateIso={employee.hiredAt}
              openVacancies={openVacancies}
              departureAction={async (input) => {
                "use server";
                const res = await markPlacementDeparted(input);
                return res.ok
                  ? { ok: true }
                  : { ok: false, message: res.message };
              }}
              reengageAction={async (input) => {
                "use server";
                const res = await bulkInviteToVacancy({
                  vacancyId: input.vacancyId,
                  profileIds: [input.profileId],
                });
                return res.ok
                  ? { ok: true }
                  : { ok: false, message: res.message };
              }}
            />
          </div>
        )}
      </div>
      <ol className="space-y-2 text-sm">
        <li className="flex items-baseline gap-3">
          <CheckCircle2
            className="size-4 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <span className="text-[color:var(--color-ink)]">
            <strong>Hired</strong> on{" "}
            <span className="tabular">
              {hiredAt.toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </span>
        </li>
        {lastCheck && (
          <li className="flex items-baseline gap-3">
            <CheckCircle2
              className="size-4 shrink-0 text-[color:var(--color-brand-strong)]"
              aria-hidden="true"
            />
            <span className="text-[color:var(--color-ink)]">
              <strong>Last confirmed still employed</strong> on{" "}
              <span className="tabular">
                {lastCheck.toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {employee.lastCheckByDisplayName
                ? ` by ${employee.lastCheckByDisplayName}`
                : ""}
            </span>
          </li>
        )}
        {employee.currentStatus === "active" && (
          <li className="flex items-baseline gap-3">
            {employee.checkInDue ? (
              <AlertCircle
                className="size-4 shrink-0 text-[color:var(--color-accent)]"
                aria-hidden="true"
              />
            ) : (
              <Clock
                className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
                aria-hidden="true"
              />
            )}
            <span className="text-[color:var(--color-ink)]">
              <strong>
                {employee.checkInDue
                  ? "Status check due"
                  : "Next status check"}
              </strong>{" "}
              <span className="tabular">
                {nextCheck.toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {employee.checkInDue
                ? "  the 3 / 6 / 12-month milestone has passed without a confirmation."
                : ""}
            </span>
          </li>
        )}
        {employee.currentStatus === "departed" && employee.departureDate && (
          <li className="flex items-baseline gap-3">
            <CheckCircle2
              className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
              aria-hidden="true"
            />
            <span className="text-[color:var(--color-ink-soft)]">
              <strong>Departed</strong> on{" "}
              <span className="tabular">{employee.departureDate}</span>
              {employee.departureCategory
                ? `  ${departureCategoryLabel(employee.departureCategory)}`
                : ""}
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}

function CheckHistoryPanel({ checks }: { checks: PlacementStatusCheckRow[] }) {
  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5">
      <div className="mb-3 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <History className="size-3" aria-hidden="true" />
        Check-in history
      </div>
      {checks.length === 0 ? (
        <p className="text-sm italic text-[color:var(--color-ink-soft)]">
          No check-ins recorded yet. Tier 2 of Phase 9.20 wires the
          "Is X still employed?" quick action.
        </p>
      ) : (
        <ol className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.id} className="flex items-baseline gap-3">
              {c.stillEmployed ? (
                <CheckCircle2
                  className="size-4 shrink-0 text-[color:var(--color-brand-strong)]"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="size-4 shrink-0 text-[color:var(--color-ink-soft)]"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="text-[color:var(--color-ink)]">
                  <span className="tabular">
                    {new Date(c.checkedAt).toLocaleDateString("en-ZA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {" "}
                  <span className="text-[color:var(--color-ink-soft)]">

                  </span>{" "}
                  {c.stillEmployed
                    ? "Still employed in this role"
                    : "No longer in this role"}
                  {c.checkedByDisplayName ? ` (${c.checkedByDisplayName})` : ""}
                </p>
                {c.note && (
                  <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
                    {c.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SourceVacancyPanel({
  vacancyId,
  vacancyTitle,
}: {
  vacancyId: string;
  vacancyTitle: string;
}) {
  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5">
      <div className="mb-2 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <Briefcase className="size-3" aria-hidden="true" />
        Source vacancy
      </div>
      <Link
        href={`/employer/vacancies/${vacancyId}`}
        className="font-display text-base text-[color:var(--color-ink)] hover:underline"
      >
        {vacancyTitle}
      </Link>
    </section>
  );
}

function ActivityPanel({ rows }: { rows: PlacementAuditRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5">
      <div className="mb-3 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <FileText className="size-3" aria-hidden="true" />
        Activity
      </div>
      <ol className="space-y-1.5 text-xs text-[color:var(--color-ink-soft)]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline gap-2">
            <span className="tabular">
              {new Date(r.at).toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <code className="rounded bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-[0.65rem] text-[color:var(--color-ink)]">
              {r.kind}
            </code>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusPill({ employee }: { employee: EmployeeDetail }) {
  if (employee.currentStatus === "departed") {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        Departed
      </span>
    );
  }
  if (employee.checkInDue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
        <AlertCircle className="size-2.5" aria-hidden="true" />
        Check-in due
      </span>
    );
  }
  if (employee.currentStatus === "unknown") {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        Unknown
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
      Active
    </span>
  );
}

function formatTenure(months: number): string {
  if (months < 1) return "<1 month";
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years}y ${rem}m`;
}

function departureCategoryLabel(c: PlacementDepartureCategory): string {
  return (
    PLACEMENT_DEPARTURE_CATEGORIES.find((opt) => opt.value === c)?.label ?? c
  );
}
