import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ConsentRow } from "@/components/feature/auth/ConsentRow";
import { getMyProfile } from "@/lib/profile/me";
import { CONSENT_PURPOSES, type ConsentState } from "@/lib/consent";
import { verifyRole } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import { consents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { SelfEraseForm } from "@/components/feature/profile/SelfEraseForm";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { SearchabilityPauseControl } from "@/components/feature/privacy/SearchabilityPauseControl";
import { readMyPauseState } from "@/lib/consent/pause";
import { BlockedEmployersList } from "@/components/feature/privacy/BlockedEmployersList";
import { listMyBlocks } from "@/lib/seeker/blocks";

interface ConsentSnapshot {
  state: ConsentState;
  grantedAt: string | null;
  version: string;
}

/** Fallback when a consent row doesn't exist for the user yet  shows
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
  // Phase 9.8.3  default-off; the user must affirmatively opt in to
  // receive vacancy invitations. Withholding does not degrade any
  // other surface.
  vacancy_matching: { state: "none", grantedAt: null, version: "v2.1" },
  // Phase 11.4.4  per-channel opt-in. Default off; admin must
  // additionally flip the platform flag before any send fires.
  messaging_channel_sms: { state: "none", grantedAt: null, version: "v2.1" },
  messaging_channel_whatsapp: { state: "none", grantedAt: null, version: "v2.1" },
};

const PURPOSE_LABEL: Record<(typeof CONSENT_PURPOSES)[number], string> = {
  searchability: "Searchability",
  contact_reveal: "Contact reveal",
  document_sharing: "Document sharing",
  analytics_aggregate: "Aggregate analytics",
  outcomes_research: "Outcomes research (optional)",
  vacancy_matching: "Vacancy invites (optional)",
  messaging_channel_sms: "SMS notifications (optional)",
  messaging_channel_whatsapp: "WhatsApp notifications (optional)",
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
    "Withholding this consent does not weaken job-search in any way  it's a separate, optional contribution to the public-good dataset.",
  // Short summary; the full D8 source text lives in PURPOSE_EXPLAINER
  // (tap-to-expand on mobile, expanded by default on md+).
  vacancy_matching:
    "Let verified employers flag me for a specific role they're trying to fill (e.g. a chef position at a particular restaurant). I'll be notified by name and can accept, decline, or decline with a reason.",
  messaging_channel_sms:
    "Let Sebenza send me an SMS for critical events (a new vacancy invite, a contact-reveal request) instead of waiting for me to open the app. Off-platform reach for the moments that matter.",
  messaging_channel_whatsapp:
    "Let Sebenza send me a WhatsApp message for critical events. Same scope as SMS  no chatty marketing, just the time-sensitive lifecycle events.",
};

/**
 * Long-form explainers, rendered as `<details>` blocks under the body
 * text. Use for purposes where the short summary alone is not enough
 * to make an informed decision  the user needs the full lawful-basis
 * + revocation picture before opting in. D8 source text for
 * `vacancy_matching`; kept verbatim so the human-translated Tier-1
 * versions have a stable English source.
 */
const PURPOSE_EXPLAINER: Partial<
  Record<(typeof CONSENT_PURPOSES)[number], string>
> = {
  vacancy_matching:
    "When you grant this, verified employers can flag you for a specific role they're trying to fill  a chef position at a particular restaurant, a developer role at a particular bank. You'll get a notification with the role + employer named, and you can accept, decline, or decline with a reason. Declining is free. You can revoke this consent any time from your privacy centre, and declining a single invite doesn't hurt your visibility in search.",
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
  // Phase 11.3.1  pause state (only meaningful when searchability is granted).
  const pauseState = await readMyPauseState();
  // Phase 11.3.2  current employer blocks for the seeker.
  const blocks = await listMyBlocks();

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow="POPIA"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="what-consent-purposes-mean" label="Consent purposes explained" />
        <HelpLink role="seeker" slug="pausing-searchability" label="Pause searchability" />
        <HelpLink role="seeker" slug="blocking-employers" label="Block an employer" />
        <HelpLink role="seeker" slug="exporting-your-data-popia-section-23" label="Export your data (s.23)" />
        <HelpLink role="seeker" slug="deleting-your-account-right-to-erasure" label="Delete your account" />
      </div>

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
              <li key={purpose}>
                <ConsentRow
                  purpose={purpose}
                  label={PURPOSE_LABEL[purpose]}
                  body={PURPOSE_BODY[purpose]}
                  explainer={PURPOSE_EXPLAINER[purpose]}
                  initialState={c.state}
                  grantedAt={c.grantedAt}
                  version={c.version}
                />
                {/* Phase 11.3.1  pause control sits directly under the
                    searchability toggle. Hidden when consent is off. */}
                {purpose === "searchability" && (
                  <SearchabilityPauseControl
                    searchabilityOn={c.state === "granted"}
                    pausedUntil={pauseState.pausedUntil}
                    pausedAt={pauseState.pausedAt}
                    pausedReason={pauseState.pausedReason}
                    locale={locale}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Phase 11.3.2  blocked employers (private). */}
      <section aria-labelledby="blocks-h" className="mt-12">
        <h2
          id="blocks-h"
          className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl"
        >
          Blocked employers
        </h2>
        <p className="mb-4 max-w-prose text-sm text-[color:var(--color-ink-soft)]">
          Private to you. Blocked employers can&rsquo;t find you in search or
          send you new invites; they are <strong>not</strong> told. Use the
          report flow on an invitation card instead if you want admins to
          review the employer&rsquo;s conduct.
        </p>
        <BlockedEmployersList initial={blocks} locale={locale} />
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
            <a
              href="/api/dashboard/data-export"
              className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)]"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("exportCta")}
            </a>
            <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
              Streams a JSON file with every row that references your account.
              The download is audit-logged as <code>account.data_export</code>.
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
            <SelfEraseForm />
            <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
              Soft-delete now; the nightly cron hard-deletes after the 30-day
              grace window. An administrator can restore your account inside
              that window if you change your mind.
            </p>
          </div>
        </div>
      </section>
    </DashboardMasthead>
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
