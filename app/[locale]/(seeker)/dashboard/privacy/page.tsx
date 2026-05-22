import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { Button } from "@/components/ui/Button";
import { dataProvider } from "@/lib/data/provider";
import { CONSENT_PURPOSES } from "@/lib/consent";
import { Trash2, Download } from "lucide-react";

const MOCK_HANDLE = "andile-z";

const MOCK_CONSENT_STATE: Record<
  (typeof CONSENT_PURPOSES)[number],
  { state: "granted" | "revoked" | "none"; grantedAt: string | null; version: string }
> = {
  searchability: { state: "granted", grantedAt: "2024-01-08", version: "v2.1" },
  contact_reveal: { state: "granted", grantedAt: "2024-01-08", version: "v2.1" },
  document_sharing: { state: "granted", grantedAt: "2024-01-08", version: "v2.1" },
  analytics_aggregate: { state: "revoked", grantedAt: null, version: "v2.1" },
};

const PURPOSE_LABEL: Record<(typeof CONSENT_PURPOSES)[number], string> = {
  searchability: "Searchability",
  contact_reveal: "Contact reveal",
  document_sharing: "Document sharing",
  analytics_aggregate: "Aggregate analytics",
};

const PURPOSE_BODY: Record<(typeof CONSENT_PURPOSES)[number], string> = {
  searchability: "Allow employers to find me by skill + location in search results.",
  contact_reveal: "Allow verified employers to request my contact details, audit-logged.",
  document_sharing: "Allow verified employers to request my uploaded qualifications.",
  analytics_aggregate: "Count me in anonymised national employment statistics. No personal data shared.",
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;
  const t = await getTranslations("seekerDash.privacy");

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="privacy"
      pageEyebrow="POPIA"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Consents */}
      <section aria-labelledby="consents-h">
        <h2
          id="consents-h"
          className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl"
        >
          {t("consents")}
        </h2>
        <ul className="space-y-3">
          {CONSENT_PURPOSES.map((purpose) => {
            const c = MOCK_CONSENT_STATE[purpose];
            const granted = c.state === "granted";
            return (
              <li
                key={purpose}
                className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg">
                      {PURPOSE_LABEL[purpose]}
                    </span>
                    <span
                      className={
                        "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] " +
                        (granted
                          ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                          : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]")
                      }
                    >
                      {granted ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                    {PURPOSE_BODY[purpose]}
                  </p>
                  {granted && c.grantedAt && (
                    <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
                      {t("granted", { date: c.grantedAt })} · {t("version", { v: c.version })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant={granted ? "secondary" : "primary"}
                  size="sm"
                >
                  {granted ? t("revoke") : "Re-grant"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Data export + erasure */}
      <section aria-labelledby="data-h" className="mt-12">
        <h2
          id="data-h"
          className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl"
        >
          {t("yourData")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              POPIA section 23
            </div>
            <h3 className="mt-1 font-display text-xl">{t("exportTitle")}</h3>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {t("exportBody")}
            </p>
            <Button type="button" variant="primary" size="md" className="mt-4">
              <Download className="size-4" aria-hidden="true" />
              {t("exportCta")}
            </Button>
          </div>

          <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-danger)] bg-[color:var(--color-surface)] p-6">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-danger)]">
              Right to erasure
            </div>
            <h3 className="mt-1 font-display text-xl">{t("deleteTitle")}</h3>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
              {t("deleteBody")}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] px-4 py-2 text-sm font-medium text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("deleteCta")}
            </button>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
