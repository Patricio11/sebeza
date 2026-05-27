import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { and, eq, sql, desc } from "drizzle-orm";
import { DashboardShell } from "@/components/layout/DashboardShell";
import {
  EMPLOYER_NAV,
  MOCK_EMPLOYER,
} from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Avatar } from "@/components/ui/Avatar";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { DataSpine } from "@/components/ui/DataSpine";
import { verifyOrgVerified } from "@/lib/auth/dal";
import { dataProvider } from "@/lib/data/provider";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import type { ConsentPurpose, ConsentState } from "@/lib/consent";
import { logAccess } from "@/lib/audit";
import { getSetting } from "@/lib/admin/settings";
import { createNotification } from "@/lib/notifications/server";
import { ContactRevealCard } from "@/components/feature/employer/ContactRevealCard";
import { QualificationDownloadButton } from "@/components/feature/employer/QualificationDownloadButton";
import { MarkAsHiredCard } from "@/components/feature/employer/MarkAsHiredCard";
import { PlacementNudgeBanner } from "@/components/feature/employer/PlacementNudgeBanner";
import { placementNudgeState } from "@/lib/employer/placement-nudge";
import type { ContactReveal } from "@/lib/employer/reveal";
import { FileText, MapPin, Briefcase } from "lucide-react";

const REVEAL_GATE_DAYS = 30;

export default async function EmployerDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ vacancyId?: string }>;
}) {
  const { locale, handle } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const session = await verifyOrgVerified();

  // Phase 9.8.6  optional vacancy linkage from ?vacancyId=… The
  // server resolves the vacancy title here (org-scoped via
  // getMyVacancy) so the MarkAsHiredCard banner reads "Linking this
  // hire to vacancy: <Title>" instead of an opaque id. Cross-org or
  // stale ids resolve to null and the linkage banner just doesn't
  // render  the markAsHired action also re-verifies server-side.
  let linkedVacancy: { id: string; title: string } | null = null;
  if (sp.vacancyId) {
    const { getMyVacancy } = await import("@/lib/employer/vacancies");
    const v = await getMyVacancy(sp.vacancyId);
    if (v) linkedVacancy = { id: v.id, title: v.title };
  }

  const profile = await dataProvider.getProfile(handle);
  if (!profile) notFound();

  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );

  const db = getDb();

  // ── Resolve seeker user id (needed for consent lookup) + actual qual ids ─
  const [profileRow] = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, handle))
    .limit(1);
  if (!profileRow) notFound();

  // ── Load consent states for contact + documents ──────────────────────────
  const consentRows = await db
    .select({
      purpose: schema.consents.purpose,
      state: schema.consents.state,
    })
    .from(schema.consents)
    .where(eq(schema.consents.userId, profileRow.userId));
  const consentByPurpose = new Map<ConsentPurpose, ConsentState>();
  for (const r of consentRows) {
    consentByPurpose.set(r.purpose as ConsentPurpose, r.state as ConsentState);
  }
  const contactConsent = consentByPurpose.get("contact_reveal") ?? "none";
  const documentConsent = consentByPurpose.get("document_sharing") ?? "none";

  // ── Prior reveal by THIS org within the 30-day window ────────────────────
  const since = new Date(Date.now() - REVEAL_GATE_DAYS * 24 * 60 * 60 * 1000);
  const priorRevealRows = await db
    .select({
      at: schema.auditLog.at,
      meta: schema.auditLog.meta,
    })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.kind, "profile.contact.reveal"),
        eq(schema.auditLog.subject, profileRow.id),
        sql`${schema.auditLog.at} >= ${since}`,
        sql`${schema.auditLog.meta}->>'orgId' = ${session.orgId}`,
      ),
    )
    .orderBy(desc(schema.auditLog.at))
    .limit(1);

  const priorRevealRow = priorRevealRows[0];
  // Cache the contact card initial state  saves a round-trip click for
  // employers who've already revealed within the window.
  let initialReveal: ContactReveal | null = null;
  if (priorRevealRow) {
    // We still need the email + city for the cached display. Joining
    // through app_user is the safe path (the audit row never stores PII).
    const [contact] = await db
      .select({
        email: schema.appUser.email,
        city: schema.profiles.city,
      })
      .from(schema.profiles)
      .innerJoin(
        schema.appUser,
        eq(schema.appUser.id, schema.profiles.userId),
      )
      .where(eq(schema.profiles.id, profileRow.id))
      .limit(1);
    const meta = (priorRevealRow.meta ?? {}) as Record<string, string>;
    if (contact) {
      initialReveal = {
        email: contact.email,
        city: contact.city,
        consentVersion: meta["consentVersion"] ?? "v2.1",
        revealedAt: priorRevealRow.at.toISOString(),
      };
    }
  }

  // ── Prior placement by THIS org for this profile ─────────────────────────
  const [existingPlacement] = await db
    .select({
      role: schema.placements.role,
      city: schema.placements.city,
      hiredAt: schema.placements.hiredAt,
    })
    .from(schema.placements)
    .where(
      and(
        eq(schema.placements.profileId, profileRow.id),
        eq(schema.placements.organizationId, session.orgId),
      ),
    )
    .orderBy(desc(schema.placements.hiredAt))
    .limit(1);

  // ── Qualifications with their row ids (needed for download buttons) ──────
  const qualRows = await db
    .select({
      id: schema.qualifications.id,
      title: schema.qualifications.title,
      institution: schema.qualifications.institution,
      awardedYear: schema.qualifications.awardedYear,
      verification: schema.qualifications.verification,
      hasDocument: sql<boolean>`${schema.qualifications.documentStorageKey} IS NOT NULL`,
    })
    .from(schema.qualifications)
    .where(eq(schema.qualifications.profileId, profileRow.id));

  // Audit: every dossier render counts as a profile.view (server-side).
  // dataProvider already wrote one; we add a context tag here so the
  // seeker can see which org viewed them.
  await logAccess({
    kind: "profile.view",
    actor: session.id,
    subject: profileRow.id,
    meta: { orgId: session.orgId, surface: "dossier", handle },
  });

  // Phase 7 (C.5)  Notify the seeker. createNotification dedupes
  // per (userId, kind, dedupeKey) inside the catalog's 24h window,
  // so an employer reloading the dossier 12 times in a day produces
  // ONE notification, not 12.
  const orgRow = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, session.orgId))
    .limit(1);
  const orgName = orgRow[0]?.name ?? "An employer";
  await createNotification({
    userId: profileRow.userId,
    kind: "profile.viewed",
    title: `${orgName} viewed your profile`,
    body: "Your dossier was opened. No contact details were revealed.",
    link: "/dashboard/activity",
    meta: { orgId: session.orgId, orgName },
    dedupeKey: session.orgId,
  });

  // Phase 7.5 (Lever C)  placement-logging nudge.
  const nudge = await placementNudgeState(session.orgId, profileRow.id);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="search"
      pageEyebrow="Candidate dossier"
      pageTitle={profile.displayName}
      pageSubtitle={`${profile.profession} · ${profile.city}, ${profile.province}`}
      banner={
        session.verification !== "verified" ? (
          <OrgVerificationBanner
            message="Verify your organisation before revealing contact details. KYC wires up in Phase 8; in the meantime an admin can flip the flag."
            cta="Open organisation"
          />
        ) : null
      }
    >
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        {/* ─── Left column: the dossier itself ─── */}
        <article className="space-y-10">
          {/* Identity header */}
          <header className="flex items-start gap-5 border-b-2 border-[color:var(--color-ink)] pb-6">
            <Avatar
              name={profile.displayName}
              photoUrl={profile.profilePhotoUrl}
              verification={profile.verification}
              size="2xl"
              showRing={verificationVisible}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                <span>{profile.profession}</span>
                {profile.seniority && <span>· {profile.seniority}</span>}
                {profile.yearsExperience != null && (
                  <span>
                    ·{" "}
                    {profile.yearsExperience === 0
                      ? "<1 yr"
                      : `${profile.yearsExperience} yr${profile.yearsExperience === 1 ? "" : "s"}`}
                  </span>
                )}
              </div>
              <h1 className="mt-1 font-display text-4xl">
                {profile.displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <VerificationBadge state={profile.verification} visible={verificationVisible} />
                <StatusChip
                  status={profile.status}
                  confirmedAt={profile.statusConfirmedAt}
                  locale={locale}
                />
                <span className="inline-flex items-center gap-1 text-sm text-[color:var(--color-ink-soft)]">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {profile.city}, {profile.province}
                </span>
              </div>
            </div>
          </header>

          {/* Bio */}
          {profile.bio && (
            <section aria-labelledby="bio-h">
              <h2 id="bio-h" className="sr-only">
                Bio
              </h2>
              <p className="font-display text-lg italic text-[color:var(--color-ink-soft)]">
                {profile.bio}
              </p>
            </section>
          )}

          {/* Skills */}
          <section aria-labelledby="skills-h">
            <h2
              id="skills-h"
              className="mb-3 border-b border-[color:var(--color-hairline)] pb-2 font-display text-xl"
            >
              Skills
            </h2>
            {profile.topSkills.length === 0 ? (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                No skills on file.
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {profile.topSkills.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
                  >
                    <span className="text-sm">
                      {s.name}
                      {s.yearsOfExperience != null && (
                        <span className="ml-1 text-xs text-[color:var(--color-ink-soft)]">
                          ·{" "}
                          {s.yearsOfExperience === 0
                            ? "<1 yr"
                            : `${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="size-2 rounded-full"
                          style={{
                            background:
                              i < s.proficiency
                                ? "var(--color-brand)"
                                : "var(--color-hairline)",
                          }}
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Experience */}
          {profile.experience && profile.experience.length > 0 && (
            <section aria-labelledby="exp-h">
              <h2
                id="exp-h"
                className="mb-3 border-b border-[color:var(--color-hairline)] pb-2 font-display text-xl"
              >
                Experience
              </h2>
              <ol className="space-y-4">
                {profile.experience.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
                  >
                    <div className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      {e.startedAt} → {e.endedAt ?? "Current"}
                    </div>
                    <div className="mt-1 font-display text-lg">{e.role}</div>
                    <div className="text-sm text-[color:var(--color-ink-soft)]">
                      {e.organization}
                      {e.city ? ` · ${e.city}` : ""}
                    </div>
                    {e.description && (
                      <p className="mt-2 text-sm">{e.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Qualifications with audited download */}
          {qualRows.length > 0 && (
            <section aria-labelledby="qual-h">
              <h2
                id="qual-h"
                className="mb-3 border-b border-[color:var(--color-hairline)] pb-2 font-display text-xl"
              >
                Qualifications
              </h2>
              <ul className="space-y-3">
                {qualRows.map((q) => (
                  <li
                    key={q.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{q.title}</div>
                      <div className="text-xs text-[color:var(--color-ink-soft)]">
                        {q.institution}
                        {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <VerificationBadge state={q.verification} visible={verificationVisible} />
                      <QualificationDownloadButton
                        qualificationId={q.id}
                        hasDocument={!!q.hasDocument}
                        documentSharingGranted={documentConsent === "granted"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* ─── Right column: the action rail ─── */}
        <aside className="space-y-5 md:sticky md:top-6 md:self-start">
          {nudge.show && (
            <PlacementNudgeBanner
              daysSinceReveal={nudge.daysSinceReveal}
              daysRemaining={nudge.daysRemaining}
              candidateName={profile.displayName}
            />
          )}

          <ContactRevealCard
            handle={handle}
            consentState={contactConsent}
            initialReveal={initialReveal}
          />

          <div id="mark-as-hired" />
          <MarkAsHiredCard
            handle={handle}
            defaultRole={profile.profession}
            defaultCity={profile.city}
            priorReveal={initialReveal}
            existingPlacement={
              existingPlacement
                ? {
                    role: existingPlacement.role,
                    city: existingPlacement.city,
                    hiredAt: existingPlacement.hiredAt.toISOString(),
                  }
                : null
            }
            vacancyId={linkedVacancy?.id}
            vacancyTitle={linkedVacancy?.title}
          />

          {/* Dossier vitals */}
          <DataSpine
            items={[
              {
                label: "Member since",
                value: new Date(profile.memberSince).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "short" },
                ),
              },
              {
                label: "Completeness",
                value: (
                  <ProfileCompleteness value={profile.completeness} />
                ),
              },
              ...(profile.academic
                ? [
                    {
                      label: "Currently studying",
                      value: `${profile.academic.programme} · ${profile.academic.institutionLabel}`,
                    },
                  ]
                : []),
              {
                label: "Public profile",
                value: (
                  <a
                    href={`/p/${profile.handle}`}
                    className="text-[color:var(--color-brand)] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    /p/{profile.handle} ↗
                  </a>
                ),
              },
            ]}
          />

          <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-xs text-[color:var(--color-ink-soft)]">
            <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
              <Briefcase className="size-3" aria-hidden="true" />
              Phase 5
            </div>
            <p className="mt-1">
              "Add to shortlist" lands with the shortlist pool UI on{" "}
              <a className="underline" href="/employer/shortlists">
                /employer/shortlists
              </a>
              . Phase 6 brings the skills-gap analytics that surface{" "}
              <em>why</em> this candidate is the right fit.
            </p>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
