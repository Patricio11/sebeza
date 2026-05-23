import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { recentAuditEventsFromDb, type AuditKind } from "@/lib/audit";
import { verifyAdmin } from "@/lib/auth/dal";
import { Download } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import Link from "next/link";

// Catalog of selectable kinds for the filter. Mirrors the AuditKind
// union but kept compact for the dropdown  admins can type into the
// actor field for anything more specific.
const FILTER_KINDS: { value: string; label: string }[] = [
  { value: "", label: "All kinds" },
  { value: "search.profiles", label: "search.profiles" },
  { value: "profile.view", label: "profile.view" },
  { value: "profile.contact.reveal", label: "profile.contact.reveal" },
  { value: "profile.document.download", label: "profile.document.download" },
  { value: "analytics.export", label: "analytics.export" },
  { value: "auth.signin", label: "auth.signin" },
  { value: "auth.signup", label: "auth.signup" },
  { value: "auth.signout", label: "auth.signout" },
  { value: "consent.grant", label: "consent.grant" },
  { value: "consent.revoke", label: "consent.revoke" },
  { value: "report.flag", label: "report.flag" },
  { value: "report.close", label: "report.close" },
  { value: "account.suspend", label: "account.suspend" },
  { value: "account.restore", label: "account.restore" },
  { value: "account.erase", label: "account.erase" },
  { value: "account.2fa.reset", label: "account.2fa.reset" },
  { value: "verification.approve", label: "verification.approve" },
  { value: "verification.reject", label: "verification.reject" },
  { value: "org.approve", label: "org.approve" },
  { value: "org.reject", label: "org.reject" },
  { value: "taxonomy.add", label: "taxonomy.add" },
  { value: "taxonomy.remove", label: "taxonomy.remove" },
  { value: "setting.update", label: "setting.update" },
  { value: "placement.confirm", label: "placement.confirm" },
];

const VALID_KIND_VALUES = new Set(
  FILTER_KINDS.filter((k) => k.value).map((k) => k.value),
);

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; actor?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const t = await getTranslations("adminDash.auditLog");

  const sp = await searchParams;
  const rawKind = sp.kind ?? "";
  const kind = VALID_KIND_VALUES.has(rawKind) ? (rawKind as AuditKind) : null;
  const actor = (sp.actor ?? "").slice(0, 200);

  const events = await recentAuditEventsFromDb({
    kind,
    actor,
    limit: 200,
  });

  const exportQs = new URLSearchParams();
  if (kind) exportQs.set("kind", kind);
  if (actor) exportQs.set("actor", actor);
  const exportHref = `/api/admin/audit-log/export${
    exportQs.toString() ? `?${exportQs.toString()}` : ""
  }`;

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="auditLog"
      pageEyebrow="PII access ledger"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
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
      {/* Filters  plain GET form so URL state survives reloads / sharing */}
      <form
        method="get"
        action=""
        className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {t("filterKind")}
          </span>
          <CustomSelect
            ariaLabel={t("filterKind")}
            variant="compact"
            name="kind"
            defaultValue={kind ?? ""}
            placeholder="All kinds"
            options={FILTER_KINDS}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {t("filterActor")}
          </span>
          <input
            name="actor"
            defaultValue={actor}
            placeholder="User id, org id, subject id…"
            maxLength={200}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
          />
        </label>
        <div className="self-end">
          <Button type="submit" variant="primary" size="md">
            Apply filters
          </Button>
        </div>
        {(kind || actor) && (
          <div className="self-end">
            <Link
              href="/admin/audit-log"
              className="inline-flex h-10 items-center px-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Clear
            </Link>
          </div>
        )}
      </form>

      {(kind || actor) && (
        <p className="mb-4 text-xs text-[color:var(--color-ink-soft)]">
          Filtering by {kind && <code className="font-mono">kind={kind}</code>}
          {kind && actor && " · "}
          {actor && <code className="font-mono">actor~{actor}</code>}{" "}
          · {events.length} match{events.length === 1 ? "" : "es"}.
        </p>
      )}

      {events.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
          {t("noEvents")}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="px-5 py-3 font-normal">When (UTC)</th>
                  <th className="px-5 py-3 font-normal">Kind</th>
                  <th className="px-5 py-3 font-normal">Actor</th>
                  <th className="px-5 py-3 font-normal">Subject</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className="border-t border-[color:var(--color-hairline)]">
                    <td className="px-5 py-2 font-mono text-xs text-[color:var(--color-ink-soft)]">
                      {new Date(e.at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-5 py-2">
                      <code className="rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5 text-xs">
                        {e.kind}
                      </code>
                    </td>
                    <td className="px-5 py-2 text-xs">{e.actor}</td>
                    <td className="px-5 py-2 text-xs">{e.subject ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {events.map((e, i) => (
              <li
                key={i}
                className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <code className="break-all rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5">
                    {e.kind}
                  </code>
                  <span className="shrink-0 font-mono text-[0.68rem] text-[color:var(--color-ink-soft)]">
                    {new Date(e.at).toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-[color:var(--color-ink)]">
                  <span className="text-[color:var(--color-ink-soft)]">Actor</span>{" "}
                  {e.actor}
                </div>
                <div className="text-xs text-[color:var(--color-ink)]">
                  <span className="text-[color:var(--color-ink-soft)]">Subject</span>{" "}
                  {e.subject ?? ""}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardShell>
  );
}
