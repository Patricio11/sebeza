/**
 * Phase 9.20 Tier 1  Employees (lifecycle) list page.
 *
 * Transforms /employer/placements from a flat hire log into a
 * lifecycle view. URL stays /employer/placements (D11) so every
 * historic deep-link still resolves; the nav label is "Employees."
 *
 * State lives in the URL: `?tab=active|departed|all&sort=recent_hire|
 * longest_tenure|check_due`. Server component reads searchParams, so
 * deep-link, refresh, and back-button all preserve the view without
 * a client island.
 *
 * Mobile-first: tab/sort strip wraps cleanly at 360px; each row is a
 * single-tap card on phones, a denser row on `md+`.
 *
 * Phase 5's `PlacementDeleteButton` is intentionally NOT surfaced
 * here  delete is a hard action that belongs on the detail page,
 * not in the triage list.
 */

import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { Link } from "@/i18n/navigation";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  confirmPlacementStillEmployed,
  listEmployees,
  type EmployeeListRow,
  type EmployeeListSort,
  type EmployeeListTab,
} from "@/lib/employer/placement-lifecycle";
import {
  PLACEMENT_DEPARTURE_CATEGORIES,
  type PlacementDepartureCategory,
} from "@/lib/employer/placement-lifecycle-types";
import { getMyOrgRole } from "@/lib/employer/vacancies";
import { canEditVacancies } from "@/lib/employer/vacancies-types";
import { ConfirmStatusIsland } from "@/components/feature/employer/placements/ConfirmStatusIsland";
import { Search, MapPin, Calendar, Clock, AlertCircle } from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export const revalidate = 0;

const TAB_OPTIONS: ReadonlyArray<{ value: EmployeeListTab; label: string }> = [
  { value: "active", label: "Active" },
  { value: "departed", label: "Departed" },
  { value: "all", label: "All" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: EmployeeListSort; label: string }> =
  [
    { value: "recent_hire", label: "Most recent hire" },
    { value: "longest_tenure", label: "Longest tenure" },
    { value: "check_due", label: "Check-in due" },
  ];

function parseTab(raw: string | undefined): EmployeeListTab {
  return raw === "departed" || raw === "all" ? raw : "active";
}
function parseSort(raw: string | undefined): EmployeeListSort {
  return raw === "longest_tenure" || raw === "check_due" ? raw : "recent_hire";
}

export default async function EmployeesListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const { tab: tabRaw, sort: sortRaw } = await searchParams;
  const tab = parseTab(tabRaw);
  const sort = parseSort(sortRaw);

  const [rows, role] = await Promise.all([
    listEmployees({ tab, sort }),
    getMyOrgRole(),
  ]);
  const canEdit = canEditVacancies(role);

  // Counts across all buckets so the tabs can show totals even when
  // the user is filtered into one. Cheap second query  same org,
  // single column, single GROUP BY.
  const [activeCount, departedCount] = await Promise.all([
    listEmployees({ tab: "active", sort: "recent_hire" }).then(
      (r) => r.length,
    ),
    listEmployees({ tab: "departed", sort: "recent_hire" }).then(
      (r) => r.length,
    ),
  ]);
  const totalCount = activeCount + departedCount;

  const dueCount = rows.filter((r) => r.checkInDue).length;

  return (
    <DashboardMasthead
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="placements"
      pageEyebrow="Outcomes"
      pageTitle="Employees"
      pageSubtitle="Every Sebenza-confirmed hire your organisation has made, and how that placement is tracking over time. Lifecycle data feeds the platform's retention signal  the harder figure to find anywhere else."
      banner={
        session.verification !== "verified" ? (
          <OrgVerificationBanner
            message="Your organisation isn't verified yet  some surfaces stay limited until verification completes."
            cta="Complete verification"
          />
        ) : null
      }
    >
      {/* Phase 10.1  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink slug="lifecycle-view" label="How the Employees view works" />
        <HelpLink slug="check-ins" label="Status check-ins" />
      </div>
      {totalCount === 0 ? (
        <EmptyState
          title="No placements logged yet"
          body="Open a candidate's dossier, reveal their contact, then 'Mark as hired' to log a placement here. Every placement feeds the live national hire count + the new retention signal."
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
          {/* Filter strip: tabs + sort. State is in the URL so deep-link
              + refresh preserve the view (no client island needed). */}
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Employee view"
                className="inline-flex flex-wrap rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-0.5 text-xs"
              >
                {TAB_OPTIONS.map((t) => {
                  const isActive = t.value === tab;
                  const count =
                    t.value === "active"
                      ? activeCount
                      : t.value === "departed"
                        ? departedCount
                        : totalCount;
                  return (
                    <Link
                      key={t.value}
                      href={`/employer/placements?tab=${t.value}&sort=${sort}`}
                      role="tab"
                      aria-selected={isActive}
                      className={
                        "rounded-[var(--radius-pill)] px-3 py-1.5 transition-colors " +
                        (isActive
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                          : "text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
                      }
                    >
                      {t.label} ({count})
                    </Link>
                  );
                })}
              </div>
              <form
                method="GET"
                action="/employer/placements"
                className="flex items-center gap-2 text-xs text-[color:var(--color-ink-soft)]"
              >
                <input type="hidden" name="tab" value={tab} />
                <label htmlFor="employees-sort">Sort</label>
                <select
                  id="employees-sort"
                  name="sort"
                  defaultValue={sort}
                  className="h-8 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2 text-xs text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-ink)]"
                  aria-label="Sort employees"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                >
                  Apply
                </button>
              </form>
            </div>
            {tab === "active" && dueCount > 0 && (
              <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 px-3 py-2 text-xs text-[color:var(--color-ink)]">
                <strong>{dueCount}</strong>{" "}
                {dueCount === 1 ? "employee is" : "employees are"} past a
                status-check milestone (3 / 6 / 12 months, then annual). A
                short check-in keeps the platform's retention figure honest.
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-8 text-center text-sm text-[color:var(--color-ink-soft)]">
              {tab === "active"
                ? "No active employees in this view  every placement is currently marked as departed or unknown."
                : tab === "departed"
                  ? "No departures logged yet."
                  : "No employees in this view."}
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.placementId}>
                  <EmployeeRow row={row} canEdit={canEdit} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-8 text-xs italic text-[color:var(--color-ink-soft)]">
        Lifecycle data stays inside your organisation. Aggregate
        retention figures land on <Link href="/insights" className="underline">/insights</Link>
        {" "}once Tier 3 of this phase ships  the per-employee detail
        never leaves your workspace.
      </p>
    </DashboardMasthead>
  );
}

function EmployeeRow({
  row,
  canEdit,
}: {
  row: EmployeeListRow;
  canEdit: boolean;
}) {
  const tenureLabel = formatTenure(row.tenureMonths);
  const hiredAtDate = new Date(row.hiredAt).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <article className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 transition-colors hover:border-[color:var(--color-ink)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <Link
          href={`/employer/placements/${row.placementId}`}
          className="flex items-center gap-3 md:flex-1"
        >
          <Avatar
            name={row.displayName}
            photoUrl={row.profilePhotoUrl}
            size="md"
            showRing={false}
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base leading-tight text-[color:var(--color-ink)] hover:underline">
              {row.displayName}
            </h3>
            <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-soft)]">
              {row.role}
            </p>
          </div>
        </Link>
        <dl className="grid grid-cols-2 gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs md:flex-1 md:grid-cols-4 md:border-0 md:pt-0">
          <div className="md:col-span-1">
            <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Location
            </dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 text-[color:var(--color-ink)]">
              <MapPin className="size-3" aria-hidden="true" />
              {row.city}
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
              {tenureLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Status
            </dt>
            <dd className="mt-0.5">
              <StatusPill row={row} canEdit={canEdit} />
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function StatusPill({
  row,
  canEdit,
}: {
  row: EmployeeListRow;
  canEdit: boolean;
}) {
  if (row.currentStatus === "departed") {
    const categoryLabel = row.departureCategory
      ? departureCategoryLabel(row.departureCategory)
      : null;
    return (
      <span
        className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]"
        title={
          row.departureDate
            ? `${categoryLabel ?? "Departed"} · ${row.departureDate}`
            : (categoryLabel ?? "Departed")
        }
      >
        {categoryLabel ? `Departed · ${categoryLabel}` : "Departed"}
      </span>
    );
  }
  // Phase 9.20 T2  swap the static "Check-in due" pill for the
  // interactive ConfirmStatusIsland when the caller can edit. Viewers
  // still see the badge but it stays a label, not an action.
  if (row.checkInDue) {
    if (canEdit) {
      return (
        <ConfirmStatusIsland
          placementId={row.placementId}
          employeeName={row.displayName}
          variant="due-badge"
          action={async (input) => {
            "use server";
            const res = await confirmPlacementStillEmployed(input);
            return res.ok ? { ok: true } : { ok: false, message: res.message };
          }}
        />
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
        <AlertCircle className="size-2.5" aria-hidden="true" />
        Check-in due
      </span>
    );
  }
  if (row.currentStatus === "unknown") {
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
