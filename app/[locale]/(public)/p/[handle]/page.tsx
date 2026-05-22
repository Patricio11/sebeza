import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { DataSpine } from "@/components/ui/DataSpine";
import { dataProvider } from "@/lib/data/provider";
import { freshnessBand } from "@/lib/mock/helpers";
import { formatRelativeTime } from "@/lib/utils";
import { Lock, ShieldAlert, Flag, GraduationCap } from "lucide-react";
import { INSTITUTION_KIND_LABEL } from "@/lib/mock/taxonomy";
import { monthsUntil, nqfShort } from "@/lib/mock/academic";

interface Props {
  params: Promise<{ locale: string; handle: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  const p = await dataProvider.getProfile(handle);
  return {
    title: p ? `${p.displayName} · ${p.profession}` : "Profile",
  };
}

// The "civic dossier". Magazine masthead + DataSpine left rail + locked panels.
// Redaction-enforced: surname is always partial, contact/docs always gated.
export default async function ProfilePage({ params }: Props) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const profile = await dataProvider.getProfile(handle);
  if (!profile) notFound();

  const t = await getTranslations("profile");
  const tStatus = await getTranslations("status");
  const tNav = await getTranslations("nav");
  const band = freshnessBand(profile.statusConfirmedAt);
  const memberSinceFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(new Date(profile.memberSince));

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Breadcrumb / dossier tag */}
        <div className="border-b border-[color:var(--color-hairline)]">
          <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-3 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)] md:px-8">
            <Link href="/search" className="hover:text-[color:var(--color-ink)]">
              ← {tNav("findTalent")}
            </Link>
            <span aria-hidden="true">·</span>
            <span>Dossier № {profile.handle}</span>
          </div>
        </div>

        {/* Masthead */}
        <header className="border-b-2 border-[color:var(--color-ink)]">
          <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              {profile.seniority ? `${profile.seniority} ` : ""}
              {profile.profession}
            </div>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
              {profile.displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
              <span>{profile.city}, {profile.province}</span>
              {profile.nationality && <span> · {profile.nationality}</span>}
              <span> · {t("memberSince", { date: memberSinceFmt })}</span>
            </p>
            <p className="mt-1 text-[0.78rem] italic text-[color:var(--color-ink-soft)]">
              {t("redacted")}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusChip
                status={profile.status}
                confirmedAt={profile.statusConfirmedAt}
                locale={locale}
              />
              <VerificationBadge state={profile.verification} />
              <ProfileCompleteness value={profile.completeness} />
            </div>
          </div>
        </header>

        {/* Body: DataSpine sidebar + main column */}
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 px-5 py-10 md:grid-cols-[240px_1fr] md:gap-16 md:px-8 md:py-16">
          {/* Left rail — the data spine */}
          <DataSpine
            items={[
              { label: "Location", value: `${profile.city}, ${profile.province}` },
              {
                label: t("headerStatus"),
                value: (
                  <>
                    {tStatus(profile.status)}
                    <span className="block text-xs text-[color:var(--color-ink-soft)]">
                      {tStatus("confirmedRelative", {
                        when: formatRelativeTime(
                          profile.statusConfirmedAt,
                          locale,
                        ),
                      })}{" "}
                      · {band}
                    </span>
                  </>
                ),
              },
              {
                label: t("headerVerification"),
                value: <VerificationBadge state={profile.verification} />,
              },
              {
                label: "Completeness",
                value: <ProfileCompleteness value={profile.completeness} />,
              },
              {
                label: "Member since",
                value: memberSinceFmt,
              },
            ]}
          />

          {/* Main column */}
          <div className="space-y-12">
            {profile.bio && (
              <section aria-labelledby="bio-h">
                <SectionHeading id="bio-h" eyebrow="On the candidate" text={t("bio")} />
                <p className="text-lg leading-relaxed text-[color:var(--color-ink)]">
                  {profile.bio}
                </p>
              </section>
            )}

            {profile.academic && (
              <section aria-labelledby="studies-h">
                <SectionHeading id="studies-h" eyebrow="Studies" text={t("studies")} />
                <div className="grid gap-6 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:grid-cols-[auto_1fr] md:items-start">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-12 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                  >
                    <GraduationCap className="size-6" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl text-[color:var(--color-ink)]">
                        {profile.academic.programme}
                      </h3>
                      <VerificationBadge state={profile.academic.verification} />
                    </div>
                    <p className="mt-1 text-[color:var(--color-ink-soft)]">
                      <span className="text-[color:var(--color-ink)]">
                        {profile.academic.institutionLabel}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>
                        {INSTITUTION_KIND_LABEL[profile.academic.institutionKind]}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{nqfShort(profile.academic.nqfLevel)}</span>
                      {profile.academic.currentYear && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>Year {profile.academic.currentYear}</span>
                        </>
                      )}
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                      <Meta label={t("studiesGraduation")} value={profile.academic.expectedGraduation}>
                        {(() => {
                          const m = monthsUntil(profile.academic.expectedGraduation);
                          return (
                            <span className="block text-[color:var(--color-ink-soft)]">
                              {m <= 0
                                ? `${Math.abs(m)} months ago`
                                : `${m} months to go`}
                            </span>
                          );
                        })()}
                      </Meta>
                      <Meta label={t("studiesNsfas")} value={profile.academic.nsfas ? "Yes" : "No"} />
                      <Meta
                        label={t("studiesOpenInternships")}
                        value={profile.academic.openToInternships ? "Yes" : "No"}
                      />
                      <Meta
                        label={t("studiesOpenGraduateProgrammes")}
                        value={profile.academic.openToGraduateProgrammes ? "Yes" : "No"}
                      />
                    </dl>

                    <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
                      {t("studiesSub")}
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section aria-labelledby="skills-h">
              <SectionHeading id="skills-h" eyebrow="Capability" text={t("skills")} />
              <ul className="flex flex-wrap gap-2">
                {profile.topSkills.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm"
                  >
                    <span>{s.name}</span>
                    <span
                      aria-label={`Self-rated ${s.proficiency} out of 5`}
                      className="flex gap-0.5"
                    >
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="size-1.5 rounded-full"
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
            </section>

            {profile.experience && profile.experience.length > 0 && (
              <section aria-labelledby="exp-h">
                <SectionHeading id="exp-h" eyebrow="Track record" text={t("experience")} />
                <ol className="space-y-6">
                  {profile.experience.map((e, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[120px_1fr] gap-4 border-l border-[color:var(--color-hairline)] pl-5"
                    >
                      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                        {e.startedAt} → {e.endedAt ?? "Now"}
                      </div>
                      <div>
                        <div className="font-display text-lg text-[color:var(--color-ink)]">
                          {e.role}
                        </div>
                        <div className="text-sm text-[color:var(--color-ink-soft)]">
                          {e.organization} · {e.city}
                        </div>
                        {e.description && (
                          <p className="mt-1 text-sm">{e.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {profile.qualifications && profile.qualifications.length > 0 && (
              <section aria-labelledby="qual-h">
                <SectionHeading
                  id="qual-h"
                  eyebrow="Qualifications"
                  text={t("qualifications")}
                />
                <ul className="space-y-4">
                  {profile.qualifications.map((q, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3"
                    >
                      <div>
                        <div className="font-medium text-[color:var(--color-ink)]">
                          {q.title}
                        </div>
                        <div className="text-sm text-[color:var(--color-ink-soft)]">
                          {q.institution}
                          {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                        </div>
                      </div>
                      <VerificationBadge state={q.verification} />
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs italic text-[color:var(--color-ink-soft)]">
                  Document files are gated. Only verified employers can request
                  them — every access is recorded.
                </p>
              </section>
            )}

            {/* Locked panels */}
            <section aria-labelledby="locked-h" className="grid gap-4 md:grid-cols-2">
              <LockedPanel
                title={t("locked.contact")}
                body={t("locked.lockedBody")}
                cta={t("locked.lockedCta")}
              />
              <LockedPanel
                title={t("locked.documents")}
                body={t("locked.lockedBody")}
                cta={t("locked.lockedCta")}
                kind="documents"
              />
            </section>

            <footer className="flex items-center justify-between border-t border-dashed border-[color:var(--color-hairline)] pt-4 text-xs text-[color:var(--color-ink-soft)]">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 hover:text-[color:var(--color-ink)]"
              >
                <Flag className="size-3.5" aria-hidden="true" />
                {t("report")}
              </button>
              <span className="uppercase tracking-[0.18em]">
                Every reveal of contact / documents on this profile is logged.
              </span>
            </footer>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SectionHeading({
  id,
  eyebrow,
  text,
}: {
  id: string;
  eyebrow: string;
  text: string;
}) {
  return (
    <header className="mb-4 border-b border-[color:var(--color-hairline)] pb-2">
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        {eyebrow}
      </div>
      <h2 id={id} className="font-display text-2xl">
        {text}
      </h2>
    </header>
  );
}

function Meta({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[color:var(--color-ink)]">
        {value}
        {children}
      </dd>
    </div>
  );
}

function LockedPanel({
  title,
  body,
  cta,
  kind = "contact",
}: {
  title: string;
  body: string;
  cta: string;
  kind?: "contact" | "documents";
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-6">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink)]">
        {kind === "contact" ? (
          <Lock className="size-3.5" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-3.5" aria-hidden="true" />
        )}
        Recorded access
      </div>
      <h3 className="mt-2 font-display text-xl">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">{body}</p>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)]"
      >
        {cta}
      </button>
    </div>
  );
}
