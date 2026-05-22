import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { Button } from "@/components/ui/Button";
import { recentAuditEventsFromDb } from "@/lib/audit";
import { verifyAdmin } from "@/lib/auth/dal";
import { Download } from "lucide-react";
import { CustomSelect } from "@/components/ui/CustomSelect";

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const t = await getTranslations("adminDash.auditLog");
  const events = await recentAuditEventsFromDb(100);

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
        <Button variant="ghost" size="md">
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      }
    >
      {/* Filters */}
      <form className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {t("filterKind")}
          </span>
          <CustomSelect
            ariaLabel={t("filterKind")}
            variant="compact"
            name="kind"
            defaultValue=""
            placeholder="All kinds"
            options={[
              { value: "", label: "All kinds" },
              { value: "search.profiles", label: "search.profiles" },
              { value: "profile.view", label: "profile.view" },
              { value: "profile.contact.reveal", label: "profile.contact.reveal" },
              { value: "profile.document.download", label: "profile.document.download" },
              { value: "analytics.export", label: "analytics.export" },
              { value: "consent.grant", label: "consent.grant" },
              { value: "consent.revoke", label: "consent.revoke" },
            ]}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            {t("filterActor")}
          </span>
          <input
            placeholder="User id, org, or handle…"
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3"
          />
        </label>
        <div className="self-end">
          <Button variant="primary" size="md">Apply filters</Button>
        </div>
      </form>

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
                  <td className="px-5 py-2 text-xs">{e.subject ?? "—"}</td>
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
                <span className="text-[color:var(--color-ink-soft)]">
                  Subject
                </span>{" "}
                {e.subject ?? "—"}
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </DashboardShell>
  );
}
