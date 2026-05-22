import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { verifyAdmin } from "@/lib/auth/dal";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const t = await getTranslations("adminDash.settings");

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="settings"
      pageEyebrow="Platform settings"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Freshness bands
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              id="freshLt"
              label="Fresh — confirmed within"
              defaultValue="30"
              type="number"
              hint="Days"
            />
            <TextField
              id="staleGt"
              label="Stale — older than"
              defaultValue="90"
              type="number"
              hint="Days"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Search ranking weights
          </h2>
          <div className="grid gap-5">
            <TextField id="wRel" label="Relevance weight" defaultValue="1.0" />
            <TextField id="wFresh" label="Freshness confidence weight" defaultValue="1.0" />
            <TextField id="wComp" label="Completeness weight" defaultValue="0.5" />
            <TextField id="wCitizen" label="Citizen-highlight boost" defaultValue="1.08" />
          </div>
        </section>

        <section className="md:col-span-2">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
            Feature flags
          </h2>
          <ul className="space-y-3">
            <Flag name="Seeker self-export (POPIA §23)" on />
            <Flag name="Aggregate analytics export to CSV" on />
            <Flag name="Citizen-highlight default ON in search" />
            <Flag name="Public insights page" on />
            <Flag name="Government partner API (Phase 8)" />
          </ul>
        </section>

        <div className="md:col-span-2">
          <Button variant="primary" size="md">Save settings</Button>
        </div>
      </div>
    </DashboardShell>
  );
}

function Flag({ name, on }: { name: string; on?: boolean }) {
  return (
    <li className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
      <span className="text-sm">{name}</span>
      <span
        className={
          "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
          (on
            ? "bg-[color:var(--color-brand)] text-white"
            : "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)]")
        }
      >
        {on ? "On" : "Off"}
      </span>
    </li>
  );
}
