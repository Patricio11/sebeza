/**
 * Phase 9.7.7  Sensitive-query oversight log.
 *
 * Admin-only view of every `gov.employer_mix.lookup` + nationality-
 * related `analytics.export` row from the audit log. Filterable by
 * actor (substring), employer (exact name), and date range.
 *
 * Trust rationale  PHASE_9_7_PLAN.md "WHY THIS IS THE SEBENZA
 * VERSION": giving `gov` a powerful lens is safe *because* its use
 * is itself observable. This page is the observability.
 *
 * Renders a summary tiles row at the top so an admin scanning for
 * anomalies (e.g. unusually many below-floor lookups in a day,
 * suggesting a fishing expedition) can spot patterns without
 * scrolling through every row.
 */

import { setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { verifyAdmin } from "@/lib/auth/dal";
import { oversightLogQuery } from "@/lib/gov/oversight-query";
import { REASON_LABELS } from "@/lib/gov/employer-lookup-types";
import { Download, ShieldAlert, Search, FileBarChart } from "lucide-react";
import Link from "next/link";

const PAGE_LIMIT = 200;

export default async function OversightPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    actor?: string;
    employer?: string;
    since?: string;
    until?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  const sp = await searchParams;
  const actor = (sp.actor ?? "").slice(0, 200);
  const employer = (sp.employer ?? "").slice(0, 200);
  const since = isIsoDate(sp.since) ? sp.since : "";
  const until = isIsoDate(sp.until) ? sp.until : "";

  const result = await oversightLogQuery({
    actor,
    employerName: employer,
    since: since || undefined,
    until: until || undefined,
    limit: PAGE_LIMIT,
  });

  const filterActive = Boolean(actor || employer || since || until);

  const exportQs = new URLSearchParams();
  if (actor) exportQs.set("actor", actor);
  if (employer) exportQs.set("employer", employer);
  if (since) exportQs.set("since", since);
  if (until) exportQs.set("until", until);
  const exportHref = `/api/admin/oversight/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ""
  }`;

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="oversight"
      pageEyebrow="Watch the watchers · regulator-of-the-regulator"
      pageTitle="Sensitive-query oversight log"
      pageSubtitle="Every gov per-employer lookup and every nationality-split analytics export. The audit trail itself is the trust mechanism that makes the gov lens defensible."
      pageActions={
        <Link
          href={exportHref}
          prefetch={false}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-sm font-medium hover:border-[color:var(--color-ink)]"
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Link>
      }
    >
      {/* Summary tiles */}
      <section className="grid gap-3 md:grid-cols-5">
        <Tile
          label="Events shown"
          value={String(result.summary.total)}
          hint={
            result.summary.total === PAGE_LIMIT
              ? `capped at ${PAGE_LIMIT}`
              : "in the filter window"
          }
          icon={<FileBarChart className="size-4" aria-hidden="true" />}
        />
        <Tile
          label="Lookups"
          value={String(result.summary.lookups)}
          hint="gov.employer_mix.lookup"
          icon={<Search className="size-4" aria-hidden="true" />}
        />
        <Tile
          label="Above floor"
          value={String(result.summary.lookupsAboveFloor)}
          hint="split returned"
          tone="brand"
        />
        <Tile
          label="Below / not found"
          value={String(
            result.summary.lookupsBelowFloor +
              result.summary.lookupsOrgNotFound,
          )}
          hint="watch for fishing patterns"
          tone="accent"
        />
        <Tile
          label="Exports"
          value={String(result.summary.exports)}
          hint="nationality CSV downloads"
        />
      </section>

      {/* Filters */}
      <form
        method="get"
        action=""
        className="mt-8 grid gap-3 md:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto_auto]"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Actor (substring)
          </span>
          <input
            name="actor"
            defaultValue={actor}
            placeholder="User id or subject id…"
            maxLength={200}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Employer (exact name)
          </span>
          <input
            name="employer"
            defaultValue={employer}
            placeholder="e.g. Discovery Bank"
            maxLength={200}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Since
          </span>
          <input
            type="date"
            name="since"
            defaultValue={since}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Until (exclusive)
          </span>
          <input
            type="date"
            name="until"
            defaultValue={until}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
        </label>
        <div className="self-end">
          <Button type="submit" variant="primary" size="md">
            Apply
          </Button>
        </div>
        {filterActive && (
          <div className="self-end">
            <Link
              href="/admin/oversight"
              className="inline-flex h-10 items-center px-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Clear
            </Link>
          </div>
        )}
      </form>

      {result.employerNotFound && (
        <p
          role="alert"
          className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-3 py-2 text-sm text-[color:var(--color-ink)]"
        >
          No organisation found matching <strong>{employer}</strong>. Filter
          is exact-match (case-folded); check the spelling. Returning empty
          result set.
        </p>
      )}

      {result.rows.length === 0 && !result.employerNotFound ? (
        <p className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
          No oversight events match these filters. This is the
          expected state on a brand-new platform  the surfaces this
          page watches (per-employer lookup + nationality exports)
          fire only when government users actively query them.
        </p>
      ) : (
        result.rows.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="px-5 py-3 font-normal">When (UTC)</th>
                  <th className="px-5 py-3 font-normal">Event</th>
                  <th className="px-5 py-3 font-normal">Actor</th>
                  <th className="px-5 py-3 font-normal">Target</th>
                  <th className="px-5 py-3 font-normal">Details</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <Row key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </section>
        )
      )}
    </DashboardShell>
  );
}

function isIsoDate(v: string | undefined): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function Tile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
  tone?: "brand" | "accent";
}) {
  const toneCls =
    tone === "brand"
      ? "border-[color:var(--color-brand-strong)] bg-[color:var(--color-brand-tint)]"
      : tone === "accent"
        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5"
        : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)]";
  return (
    <div className={`rounded-[var(--radius-md)] border p-4 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display tabular text-2xl">{value}</div>
      <p className="mt-0.5 text-[0.65rem] text-[color:var(--color-ink-soft)]">
        {hint}
      </p>
    </div>
  );
}

function Row({ row }: { row: import("@/lib/gov/oversight-query").OversightRow }) {
  const isLookup = row.kind === "gov.employer_mix.lookup";
  const meta = row.meta as Record<string, unknown>;
  const reason = typeof meta.reason === "string" ? meta.reason : null;
  const reasonLabel =
    reason && reason in REASON_LABELS
      ? REASON_LABELS[reason as keyof typeof REASON_LABELS]
      : reason;
  const aboveFloor = meta.aboveFloor === true;
  const orgFound = meta.orgFound === true;
  const placementCount =
    typeof meta.placementCount === "number" ? meta.placementCount : null;

  return (
    <tr className="border-t border-[color:var(--color-hairline)] align-top">
      <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-ink-soft)]">
        {new Date(row.at).toISOString().replace("T", " ").slice(0, 19)}
      </td>
      <td className="px-5 py-3">
        <code className="rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-xs">
          {row.kind}
        </code>
        {isLookup ? (
          <Tag
            label={
              !orgFound
                ? "not found"
                : aboveFloor
                  ? "above floor"
                  : "below floor"
            }
            tone={!orgFound ? "muted" : aboveFloor ? "brand" : "accent"}
          />
        ) : (
          <Tag
            label={
              typeof meta.surface === "string"
                ? String(meta.surface)
                : "export"
            }
            tone="muted"
          />
        )}
      </td>
      <td className="px-5 py-3 text-xs">{row.actor}</td>
      <td className="px-5 py-3 text-xs">
        {row.orgName ? (
          <>
            <div className="font-medium text-[color:var(--color-ink)]">
              {row.orgName}
            </div>
            <div className="text-[color:var(--color-ink-soft)]">
              {row.subject}
            </div>
          </>
        ) : (
          <span className="text-[color:var(--color-ink-soft)]">
            {row.subject ?? ""}
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-xs">
        {isLookup ? (
          <>
            {reasonLabel && (
              <div>
                <span className="text-[color:var(--color-ink-soft)]">
                  Reason:
                </span>{" "}
                {reasonLabel}
              </div>
            )}
            {typeof meta.reasonNote === "string" &&
              meta.reasonNote.length > 0 && (
                <div className="italic text-[color:var(--color-ink-soft)]">
                  &ldquo;{String(meta.reasonNote)}&rdquo;
                </div>
              )}
            {placementCount != null && (
              <div>
                <span className="text-[color:var(--color-ink-soft)]">
                  Placements:
                </span>{" "}
                {placementCount}
                {typeof meta.floor === "number" && (
                  <span className="text-[color:var(--color-ink-soft)]">
                    {" "}
                    (floor {String(meta.floor)})
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            {typeof meta.rowCount === "number" && (
              <span>
                <span className="text-[color:var(--color-ink-soft)]">Rows:</span>{" "}
                {meta.rowCount}
              </span>
            )}
            {typeof meta.k === "number" && (
              <span className="ml-2">
                <span className="text-[color:var(--color-ink-soft)]">
                  k:
                </span>{" "}
                {String(meta.k)}
              </span>
            )}
          </div>
        )}
        <details className="mt-1">
          <summary className="cursor-pointer text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">
            Full meta JSON
          </summary>
          <pre className="mt-1 max-w-md overflow-x-auto rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] p-2 text-[0.65rem] text-[color:var(--color-ink)]">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </details>
      </td>
    </tr>
  );
}

function Tag({
  label,
  tone,
}: {
  label: string;
  tone: "brand" | "accent" | "muted";
}) {
  const cls =
    tone === "brand"
      ? "border-[color:var(--color-brand)] text-[color:var(--color-brand-strong)]"
      : tone === "accent"
        ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
        : "border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]";
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-[var(--radius-pill)] border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.16em] ${cls}`}
    >
      <ShieldAlert className="mr-0.5 size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
