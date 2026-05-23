import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { Button } from "@/components/ui/Button";
import { ConsentRow } from "@/components/feature/auth/ConsentRow";
import { getMyProfile } from "@/lib/profile/me";
import { CONSENT_PURPOSES, type ConsentState } from "@/lib/consent";
import { verifyRole } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import { consents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Trash2, Download } from "lucide-react";

interface ConsentSnapshot {
  state: ConsentState;
  grantedAt: string | null;
  version: string;
}

/** Fallback when a consent row doesn't exist for the user yet — shows
    `none` so the UI is honest, not pre-populated as granted. */
const FALLBACK_CONSENT: Record<
  (typeof CONSENT_PURPOSES)[number],
  ConsentSnapshot
> = {
  searchability: { state: "none", grantedAt: null, version: "v2.1" },
  contact_reveal: { state: "none", grantedAt: null, version: "v2.1" },
  document_sharing: { state: "none", grantedAt: null, version: "v2.1" },
  analytics_aggregate: { state: "none", grantedAt: null, version: "v2.1" },
  outcomes_research: { state: "none", grantedAt: null, version: "v2.1" },
};

const PURPOSE_LABEL: Record<(typeof CONSENT_PURPOSES)[number], string> = {
  searchability: "Searchability",
  contact_reveal: "Contact reveal",
  document_sharing: "Document sharing",
  analytics_aggregate: "Aggregate analytics",
  outcomes_research: "Outcomes research (optional)",
};

const PURPOSE_BODY: Record<(typeof CONSENT_PURPOSES)[number], string> = {
  searchability:
    "Allow employers to find me by skill + location in search results.",
  contact_reveal:
    "Allow verified employers to request my contact details, audit-logged.",
  document_sharing:
    "Allow verified employers to request my uploaded qualifications.",
  analytics_aggregate:
    "Count me in anonymised national employment statistics. No personal data shared.",
  outcomes_research:
    "Include me in education-to-employment outcomes research. " +
    "What's shared: cohort-level numbers (programme × institution × province × graduation year, never under 10 people per cell). " +
    "What's never shared: any individual record, my name, my profile. " +
    "Withholding this consent does not weaken job-search in any way — it's a separate, optional contribution to the public-good dataset.",
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/privacy");
  const t = await getTranslations("seekerDash.privacy");

  // Read live consents for the signed-in user.
  const rows = await loadConsents(session.id);

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
      <section aria-labelledby="consents-h">
        <h2
          id="consents-h"
          className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl"
        >
          {t("consents")}
        </h2>
        <ul className="space-y-3">
          {CONSENT_PURPOSES.map((purpose) => {
            const c = rows[purpose] ?? FALLBACK_CONSENT[purpose];
            return (
              <ConsentRow
                key={purpose}
                purpose={purpose}
                label={PURPOSE_LABEL[purpose]}
                body={PURPOSE_BODY[purpose]}
                initialState={c.state}
                grantedAt={c.grantedAt}
                version={c.version}
              />
            );
          })}
        </ul>
      </section>

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
            <Button
              type="button"
              variant="primary"
              size="md"
              className="mt-4"
              disabled
            >
              <Download className="size-4" aria-hidden="true" />
              {t("exportCta")}{" "}
              <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em]">
                Phase 8
              </span>
            </Button>
            <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
              Data-export job wires up in Phase 8 alongside the transactional
              email pipeline (we email you a signed download link).
            </p>
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
              disabled
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-danger)] px-4 py-2 text-sm font-medium text-[color:var(--color-danger)] opacity-50 cursor-not-allowed"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("deleteCta")}{" "}
              <span className="ml-2 text-[0.62rem] uppercase tracking-[0.18em]">
                Phase 8
              </span>
            </button>
            <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
              Soft-delete + 30-day grace period + hard-delete cron all land in
              Phase 8.
            </p>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}

async function loadConsents(
  userId: string | undefined,
): Promise<Partial<Record<(typeof CONSENT_PURPOSES)[number], ConsentSnapshot>>> {
  if (!userId || !process.env.DATABASE_URL) return {};
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(consents)
      .where(eq(consents.userId, userId));
    const out: Partial<
      Record<(typeof CONSENT_PURPOSES)[number], ConsentSnapshot>
    > = {};
    for (const r of rows) {
      out[r.purpose as (typeof CONSENT_PURPOSES)[number]] = {
        state: r.state as ConsentState,
        grantedAt: r.grantedAt ? r.grantedAt.toISOString().slice(0, 10) : null,
        version: r.version,
      };
    }
    return out;
  } catch {
    return {};
  }
}
