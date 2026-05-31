import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StatusChip } from "@/components/ui/StatusChip";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { Avatar } from "@/components/ui/Avatar";
import { SAChevron } from "@/components/ui/SAChevron";
import { dataProvider } from "@/lib/data/provider";
import { freshnessBand } from "@/lib/mock/helpers";
import { formatRelativeTime } from "@/lib/utils";
import {
  Lock,
  ShieldAlert,
  Flag,
  GraduationCap,
  Briefcase,
  MapPin,
  Calendar,
  ShieldCheck,
  ArrowUpRight,
  Bookmark,
  Eye,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { INSTITUTION_KIND_LABEL } from "@/lib/mock/taxonomy";
import { monthsUntil, nqfShort } from "@/lib/mock/academic";
import { ReportProfileButton } from "@/components/feature/profile/ReportProfileButton";
import { WorkAvailabilityChips } from "@/components/feature/profile/WorkAvailabilityChips";
import { getSessionUser } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import { getSetting } from "@/lib/admin/settings";

interface Props {
  params: Promise<{ locale: string; handle: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { handle } = await params;
  const p = await dataProvider.getProfile(handle);
  if (!p) return { title: "Profile" };
  const title = `${p.displayName} · ${p.profession}`;
  const description = `${p.displayName}  ${p.profession} based in ${p.city}, ${p.province}. Trust-verified Sebenza profile.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "Sebenza",
      // Phase 11.4.1  rich-preview card. Same redaction rules
      // apply (the /card route reads through dataProvider.getProfile
      // which enforces them). The seeker is the one sharing the URL;
      // we don't bake the image into every public hit unprompted.
      images: [
        {
          url: `/p/${p.handle}/card`,
          width: 1200,
          height: 630,
          alt: `${p.displayName}  ${p.profession}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/p/${p.handle}/card`],
    },
    alternates: {
      canonical: `/p/${p.handle}`,
    },
    robots: { index: true, follow: true },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public profile  "civic dossier" redesign.
//
// The previous layout was a flat editorial column. This redesign:
//   - leads with a hero avatar (with honest verification ring)
//   - puts a "trust dossier" action panel as the floating right column
//   - converts experience into a real vertical timeline
//   - upgrades skills to proficiency bars
//   - consolidates the gated panels into a single "Recorded access" section
//
// All redaction guarantees from the original are preserved.
// ─────────────────────────────────────────────────────────────────────────────

export default async function ProfilePage({ params }: Props) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const profile = await dataProvider.getProfile(handle);
  if (!profile) notFound();

  // Route the CTAs based on who's looking. Public visitors → sign-in
  // with a ?next= cursor back to the dossier. Verified employers →
  // straight into the dossier. The profile owner gets an entirely
  // different right-rail (preview controls) instead of the
  // request-to-engage card  it's their own profile.
  const viewer = await getSessionUser();
  // Only seekers can own a handle; cheap query, only fired when there's a session.
  const me = viewer?.role === "seeker" ? await getMyProfile() : null;
  const isOwner = !!me && me.handle === handle;
  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );

  const dossierHref = `/employer/dossier/${profile.handle}`;
  const ctaHref =
    viewer?.role === "employer" || viewer?.role === "admin"
      ? dossierHref
      : `/sign-in?next=${encodeURIComponent(dossierHref)}`;
  const ctaEnabled = !viewer || viewer.role === "employer" || viewer.role === "admin";

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
      <main id="main" className="bg-[color:var(--color-paper)]">
        {/* Owner-preview banner  proves they're signed in and gives them the
            way back. Renders only when the viewer owns this handle. */}
        {isOwner && <OwnerPreviewBanner />}

        {/* Breadcrumb / dossier tag  destination depends on who's looking. */}
        <div className="border-b border-[color:var(--color-hairline)]">
          <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-5 py-3 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)] md:px-10">
            <Link
              href={isOwner ? "/dashboard" : "/search"}
              className="transition-colors hover:text-[color:var(--color-brand)]"
            >
              ← {isOwner ? "Back to dashboard" : tNav("findTalent")}
            </Link>
            <span aria-hidden="true">·</span>
            <span>Dossier № {profile.handle}</span>
          </div>
        </div>

        <ProfileHero
          profile={profile}
          memberSinceFmt={memberSinceFmt}
          band={band}
          locale={locale}
          tStatus={tStatus}
          t={t}
          ctaHref={ctaHref}
          ctaEnabled={ctaEnabled}
          viewerSignedIn={Boolean(viewer)}
          isOwner={isOwner}
          verificationVisible={verificationVisible}
        />

        <ProfileBody
          profile={profile}
          t={t}
          locale={locale}
          isOwner={isOwner}
          viewerSignedInAsNonEmployer={
            !!viewer &&
            viewer.role !== "employer" &&
            viewer.role !== "admin" &&
            !isOwner
          }
          verificationVisible={verificationVisible}
        />
      </main>
      <SiteFooter />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OWNER PREVIEW BANNER
// ─────────────────────────────────────────────────────────────────────────────

function OwnerPreviewBanner() {
  return (
    <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-brand-tint)]">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-5 py-3 md:px-10">
        <div className="flex items-center gap-2.5 text-sm text-[color:var(--color-ink)]">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-paper)]">
            <Eye className="size-3.5" aria-hidden="true" />
          </span>
          <span>
            <span className="font-medium">You&rsquo;re previewing your public profile.</span>
            <span className="ml-1.5 text-[color:var(--color-ink-soft)]">
              This is how verified employers see you.
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to dashboard
          </Link>
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-ink)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

async function ProfileHero({
  profile,
  memberSinceFmt,
  band,
  locale,
  tStatus,
  t,
  ctaHref,
  ctaEnabled,
  viewerSignedIn,
  isOwner,
  verificationVisible,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof dataProvider.getProfile>>>;
  memberSinceFmt: string;
  band: ReturnType<typeof freshnessBand>;
  locale: string;
  tStatus: Awaited<ReturnType<typeof getTranslations<"status">>>;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  /** Where the "Request contact" / "Save to pool" CTAs route to. */
  ctaHref: string;
  /** Whether to surface CTAs at all (false hides them for signed-in seekers). */
  ctaEnabled: boolean;
  viewerSignedIn: boolean;
  /** True when the signed-in viewer owns this handle  swaps the right rail. */
  isOwner: boolean;
  /** Phase 9.16.1  threaded from ProfilePage's getSetting() read. */
  verificationVisible: boolean;
}) {
  return (
    <section
      aria-label="Profile masthead"
      className="relative overflow-hidden border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]"
    >
      {/* Faint chevron watermark in the top-right of the hero */}
      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -right-32 -top-20 size-[460px] opacity-[0.06]"
      />

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-12 gap-8 px-5 py-12 md:gap-12 md:px-10 md:py-20">
        {/* Identity column */}
        <div className="col-span-12 md:col-span-7">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-end">
            <Avatar
              name={profile.displayName}
              photoUrl={profile.profilePhotoUrl}
              verification={profile.verification}
              size="xl"
              showRing={verificationVisible}
              className="anim-rise-soft md:hidden"
            />
            <Avatar
              name={profile.displayName}
              photoUrl={profile.profilePhotoUrl}
              verification={profile.verification}
              size="2xl"
              showRing={verificationVisible}
              className="anim-rise-soft hidden md:inline-flex"
            />

            <div className="flex-1">
              {/* Profession eyebrow  Phase 9.9 appends years experience
                  when declared (NULL renders the eyebrow unchanged; 0
                  renders as "<1 yr"). */}
              <div className="text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
                {profile.seniority ? `${profile.seniority} · ` : ""}
                {profile.profession}
                {profile.yearsExperience != null &&
                  ` · ${profile.yearsExperience === 0 ? "<1 yr" : `${profile.yearsExperience} yr${profile.yearsExperience === 1 ? "" : "s"}`}`}
              </div>

              {/* Name */}
              <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.02em] text-[color:var(--color-ink)]">
                {profile.displayName}
              </h1>

              {/* Meta row */}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[color:var(--color-ink-soft)]">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin
                    className="size-3.5 text-[color:var(--color-brand)]"
                    aria-hidden="true"
                  />
                  {profile.city}, {profile.province}
                </span>
                {profile.nationality && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{profile.nationality}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5" aria-hidden="true" />
                  {t("memberSince", { date: memberSinceFmt })}
                </span>
              </p>

              {/* Honest redaction note  quiet, italic */}
              <p className="mt-2 text-[0.78rem] italic text-[color:var(--color-ink-soft)]">
                {t("redacted")}
              </p>

              {/* Chip row */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <StatusChip
                  status={profile.status}
                  confirmedAt={profile.statusConfirmedAt}
                  locale={locale}
                />
                <VerificationBadge state={profile.verification} visible={verificationVisible} />
                <ProfileCompleteness value={profile.completeness} />
              </div>
            </div>
          </div>
        </div>

        {/* Right-rail panel  swaps between owner-preview and the employer
            request-to-engage card. Same trust-signal block at the bottom in
            both modes  the owner should see what employers see. */}
        <aside className="col-span-12 md:col-span-5">
          <div className="relative rounded-2xl border border-[color:var(--color-ink)]/10 bg-[color:var(--color-surface)] p-7 shadow-press md:p-8">
            {/* Tiny flag mark inside */}
            <div className="absolute -top-px left-7 right-7 flex h-[3px]">
              <div className="flex-[3] bg-[color:var(--color-brand)]" />
              <div className="flex-[2] bg-[color:var(--color-accent)]" />
              <div className="flex-[1] bg-[color:var(--color-danger)]" />
            </div>

            {isOwner ? (
              <>
                <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
                  <Eye className="size-3.5" aria-hidden="true" />
                  Preview mode · owner view
                </div>

                <h2 className="mt-2 font-display text-xl leading-tight">
                  Your public profile
                </h2>
                <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                  This is the dossier verified employers see. The
                  request-to-engage card lives here for them  contact reveals
                  and document requests are gated behind your consent and
                  every action is audit-logged.
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  <Link
                    href="/dashboard/profile"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-ink)] px-5 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Edit profile
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--color-ink)] px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Back to dashboard
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Recorded access · employer-only
                </div>

                <h2 className="mt-2 font-display text-xl leading-tight">
                  Request to engage
                </h2>
                <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                  {t("locked.lockedBody")}
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  {ctaEnabled ? (
                    <Link
                      href={ctaHref}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-ink)] px-5 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
                    >
                      <Lock className="size-3.5" aria-hidden="true" />
                      {viewerSignedIn ? "Open employer dossier" : "Sign in to request contact"}
                    </Link>
                  ) : (
                    <div className="rounded-md border border-dashed border-[color:var(--color-hairline)] px-4 py-3 text-center text-xs text-[color:var(--color-ink-soft)]">
                      Contact reveal is an employer flow. Your seeker workspace
                      doesn&rsquo;t see this action.
                    </div>
                  )}
                  {ctaEnabled && (
                    <Link
                      href={ctaHref}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--color-ink)] px-5 py-3 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
                    >
                      <Bookmark className="size-3.5" aria-hidden="true" />
                      {viewerSignedIn ? "Save to talent pool" : "Sign in to save"}
                    </Link>
                  )}
                </div>
              </>
            )}

            <div className="my-6 h-px bg-[color:var(--color-hairline)]" />

            {/* Trust signals  shown in both modes. */}
            <dl className="space-y-3 text-sm">
              <DossierRow label="Status">
                <span className="capitalize">
                  {tStatus(profile.status)}
                  <span className="ml-2 text-xs text-[color:var(--color-ink-soft)]">
                    {band}
                  </span>
                </span>
              </DossierRow>
              <DossierRow label="Verification">
                <span className="capitalize">{profile.verification}</span>
              </DossierRow>
              <DossierRow label="Completeness">
                <span className="font-display tabular text-base">
                  {profile.completeness}%
                </span>
              </DossierRow>
              <DossierRow label="Member since">
                <span>{memberSinceFmt}</span>
              </DossierRow>
              {profile.workAvailability.length > 0 && (
                <DossierRow label="Available for">
                  <WorkAvailabilityChips
                    values={profile.workAvailability}
                    variant="compact"
                  />
                </DossierRow>
              )}
              {/* Phase 11.5.1  voluntary secondary-intent tags. */}
              {profile.openToTags && profile.openToTags.length > 0 && (
                <DossierRow label="Open to">
                  <ul className="flex flex-wrap gap-1.5">
                    {profile.openToTags.map((tag) => (
                      <li
                        key={tag}
                        className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)]"
                      >
                        {tag.replace(/_/g, " ")}
                      </li>
                    ))}
                  </ul>
                </DossierRow>
              )}
              {/* Phase 9.22  current employer. Only shown for picker-
                  visible orgs (pending seeker_named never appears).
                  Badge spells out the verification posture honestly.
                  Phase 9.23  when the seeker has a verified
                  employment record within the 12-month badge window,
                  the dossier row also shows the Employer-verified
                  badge with the date. The badge silently decays at
                  12 months. */}
              {profile.currentEmployerName && profile.currentEmployerBadge && (
                <DossierRow label="Currently at">
                  <div className="text-sm text-[color:var(--color-ink)]">
                    <strong>{profile.currentEmployerName}</strong>
                    <div className="mt-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      {profile.currentEmployerBadge === "sebenza_registered"
                        ? "Sebenza employer"
                        : "Verified employer"}
                      {profile.currentRoleStartedAt
                        ? ` · since ${formatRoleStartedAt(profile.currentRoleStartedAt)}`
                        : ""}
                    </div>
                    {profile.employmentVerifiedAt && (
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                        Employer-verified · {formatRoleStartedAt(profile.employmentVerifiedAt)}
                      </div>
                    )}
                  </div>
                </DossierRow>
              )}
            </dl>

            <p className="mt-6 rounded-md bg-[color:var(--color-surface-sunk)] px-3 py-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Every reveal of contact or documents is audit-logged
            </p>

            {!isOwner && (
              <Link
                href="/sign-in?as=employer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
              >
                Sign in as a verified employer
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function DossierRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-2 last:border-0">
      <dt className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY
// ─────────────────────────────────────────────────────────────────────────────

async function ProfileBody({
  profile,
  t,
  locale,
  isOwner,
  viewerSignedInAsNonEmployer,
  verificationVisible,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof dataProvider.getProfile>>>;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  locale: string;
  isOwner: boolean;
  /** Seeker (or other non-employer role) is signed in viewing this profile,
   *  and they're not the owner. Drives the calm "employer-only feature"
   *  variant of the gated panel  no "sign in as employer" CTAs. */
  viewerSignedInAsNonEmployer: boolean;
  /** Phase 9.16.1  threaded from ProfilePage's getSetting() read. */
  verificationVisible: boolean;
}) {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-16 md:px-10 md:py-24">
      <div className="grid grid-cols-12 gap-8 md:gap-16">
        {/* Single main column  sections stacked, full-width, editorial */}
        <div className="col-span-12 space-y-20 md:col-span-9">
          {profile.bio && (
            <Section eyebrow="On the candidate" title={t("bio")}>
              <blockquote className="border-l-4 border-[color:var(--color-accent)] pl-6">
                <p className="font-display text-2xl italic leading-snug text-[color:var(--color-ink)] md:text-3xl">
                  &ldquo;{profile.bio}&rdquo;
                </p>
              </blockquote>
            </Section>
          )}

          {profile.academic && (
            <StudiesSection profile={profile} t={t} verificationVisible={verificationVisible} />
          )}

          <SkillsSection skills={profile.topSkills} />

          {profile.experience && profile.experience.length > 0 && (
            <ExperienceTimeline experience={profile.experience} t={t} />
          )}

          {profile.qualifications && profile.qualifications.length > 0 && (
            <QualificationsSection
              items={profile.qualifications}
              t={t}
              verificationVisible={verificationVisible}
            />
          )}

          <GatedSection
            t={t}
            isOwner={isOwner}
            softVisitor={viewerSignedInAsNonEmployer}
          />

          <ProfileFooter handle={profile.handle} t={t} isOwner={isOwner} />
        </div>

        {/* Sticky right rail  at-a-glance stats and recent activity teaser */}
        <aside className="hidden md:sticky md:top-24 md:col-span-3 md:block md:self-start">
          <div className="rounded-2xl bg-[color:var(--color-brand-tint)] p-6">
            <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              At a glance
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <RailRow icon={<MapPin className="size-3.5" />} label="Based in" value={profile.city} />
              {profile.nationality && (
                <RailRow
                  icon={<Flag className="size-3.5" />}
                  label="Nationality"
                  value={profile.nationality}
                />
              )}
              <RailRow
                icon={<Briefcase className="size-3.5" />}
                label="Profession"
                value={profile.profession}
              />
              {profile.academic && (
                <RailRow
                  icon={<GraduationCap className="size-3.5" />}
                  label="Studying"
                  value={profile.academic.programme}
                />
              )}
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6">
            <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Top skills
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {profile.topSkills.slice(0, 5).map((s) => (
                <li
                  key={s.name}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="text-[color:var(--color-ink)]">
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
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`sec-${title.replace(/\W/g, "-")}`}>
      <header className="mb-6 border-b-2 border-[color:var(--color-ink)] pb-3">
        <div className="text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
          {eyebrow}
        </div>
        <h2
          id={`sec-${title.replace(/\W/g, "-")}`}
          className="mt-1 font-display text-3xl"
        >
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function RailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li>
      <div className="flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-[color:var(--color-ink)]">{value}</div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDIES
// ─────────────────────────────────────────────────────────────────────────────

function StudiesSection({
  profile,
  t,
  verificationVisible,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof dataProvider.getProfile>>>;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  verificationVisible: boolean;
}) {
  const academic = profile.academic!;
  const months = monthsUntil(academic.expectedGraduation);

  return (
    <Section eyebrow="Studies" title={t("studies")}>
      <div className="grid gap-6 rounded-2xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:grid-cols-[auto_1fr] md:items-start md:p-8">
        <span
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
        >
          <GraduationCap className="size-7" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-2xl text-[color:var(--color-ink)]">
              {academic.programme}
            </h3>
            <VerificationBadge state={academic.verification} visible={verificationVisible} />
          </div>
          <p className="mt-1 text-[color:var(--color-ink-soft)]">
            <span className="text-[color:var(--color-ink)]">
              {academic.institutionLabel}
            </span>
            <span aria-hidden="true"> · </span>
            <span>{INSTITUTION_KIND_LABEL[academic.institutionKind]}</span>
            <span aria-hidden="true"> · </span>
            <span>{nqfShort(academic.nqfLevel)}</span>
            {academic.currentYear && (
              <>
                <span aria-hidden="true"> · </span>
                <span>Year {academic.currentYear}</span>
              </>
            )}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
            <MetaTile label={t("studiesGraduation")} value={academic.expectedGraduation}>
              <span className="block text-[color:var(--color-ink-soft)]">
                {months <= 0
                  ? `${Math.abs(months)} months ago`
                  : `${months} months to go`}
              </span>
            </MetaTile>
            <MetaTile
              label={t("studiesNsfas")}
              value={academic.nsfas ? "Yes" : "No"}
            />
            <MetaTile
              label={t("studiesOpenInternships")}
              value={academic.openToInternships ? "Yes" : "No"}
            />
            <MetaTile
              label={t("studiesOpenGraduateProgrammes")}
              value={academic.openToGraduateProgrammes ? "Yes" : "No"}
            />
          </dl>

          <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
            {t("studiesSub")}
          </p>
        </div>
      </div>
    </Section>
  );
}

function MetaTile({
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

// ─────────────────────────────────────────────────────────────────────────────
// SKILLS
// ─────────────────────────────────────────────────────────────────────────────

function SkillsSection({
  skills,
}: {
  skills: NonNullable<
    Awaited<ReturnType<typeof dataProvider.getProfile>>
  >["topSkills"];
}) {
  return (
    <Section eyebrow="Capability" title="Skills">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => {
          const pct = (s.proficiency / 5) * 100;
          return (
            <li
              key={s.name}
              className="group rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 transition-colors hover:border-[color:var(--color-brand)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[color:var(--color-ink)]">
                  {s.name}
                  {/* Phase 9.9  years rendered after the skill name. NULL =
                      omit entirely; 0 = "<1 yr". */}
                  {s.yearsOfExperience != null && (
                    <span className="ml-1 text-xs font-normal text-[color:var(--color-ink-soft)]">
                      ·{" "}
                      {s.yearsOfExperience === 0
                        ? "<1 yr"
                        : `${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`}
                    </span>
                  )}
                </span>
                <span className="font-display tabular text-sm text-[color:var(--color-ink-soft)]">
                  {s.proficiency}/5
                </span>
              </div>
              <div
                className="mt-3 h-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-[color:var(--color-brand)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIENCE  proper vertical timeline
// ─────────────────────────────────────────────────────────────────────────────

function ExperienceTimeline({
  experience,
  t,
}: {
  experience: NonNullable<
    NonNullable<
      Awaited<ReturnType<typeof dataProvider.getProfile>>
    >["experience"]
  >;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
}) {
  return (
    <Section eyebrow="Track record" title={t("experience")}>
      <ol className="relative space-y-10 border-l-2 border-[color:var(--color-hairline)] pl-8">
        {experience.map((e, i) => {
          const isCurrent = e.endedAt === null;
          return (
            <li key={i} className="relative">
              {/* Timeline marker */}
              <span
                aria-hidden="true"
                className={
                  "absolute -left-[42px] top-1 inline-flex size-5 items-center justify-center rounded-full border-2 " +
                  (isCurrent
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-paper)]"
                    : "border-[color:var(--color-brand)] bg-[color:var(--color-paper)]")
                }
              >
                <span
                  className={
                    "size-2 rounded-full " +
                    (isCurrent
                      ? "bg-[color:var(--color-accent)]"
                      : "bg-[color:var(--color-brand)]")
                  }
                />
              </span>

              {/* Date row */}
              <div className="flex flex-wrap items-baseline gap-3 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                <span className="tabular">
                  {e.startedAt} → {e.endedAt ?? "Now"}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-[color:var(--color-accent)] px-2 py-0.5 text-[0.62rem] text-[color:var(--color-ink)]">
                    Current
                  </span>
                )}
              </div>

              {/* Role + org */}
              <div className="mt-2 font-display text-2xl leading-tight text-[color:var(--color-ink)]">
                {e.role}
              </div>
              <div className="text-[color:var(--color-ink-soft)]">
                {e.organization}
                {e.city && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>{e.city}</span>
                  </>
                )}
              </div>

              {e.description && (
                <p className="mt-3 max-w-2xl text-[color:var(--color-ink)]">
                  {e.description}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUALIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

function QualificationsSection({
  items,
  t,
  verificationVisible,
}: {
  items: NonNullable<
    NonNullable<
      Awaited<ReturnType<typeof dataProvider.getProfile>>
    >["qualifications"]
  >;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  verificationVisible: boolean;
}) {
  return (
    <Section eyebrow="Qualifications" title={t("qualifications")}>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((q, i) => (
          <li
            key={i}
            className="flex items-start gap-4 rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
          >
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
              <GraduationCap className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-lg text-[color:var(--color-ink)]">
                  {q.title}
                </div>
                <VerificationBadge state={q.verification} visible={verificationVisible} />
              </div>
              <div className="text-sm text-[color:var(--color-ink-soft)]">
                {q.institution}
                {q.awardedYear ? ` · ${q.awardedYear}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs italic text-[color:var(--color-ink-soft)]">
        Document files are gated. Only verified employers can request them 
        every access is audit-logged.
      </p>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GATED ACCESS  consolidated locked panels
// ─────────────────────────────────────────────────────────────────────────────

function GatedSection({
  t,
  isOwner,
  softVisitor,
}: {
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  isOwner: boolean;
  /** Signed-in non-employer viewing someone else's profile  no
   *  "sign in as employer" CTAs (they're already signed in). */
  softVisitor: boolean;
}) {
  // Three modes:
  //   isOwner       → calm cream "your contact stays private" explainer
  //   softVisitor   → calm cream "this section is employer-only" notice
  //   otherwise     → original dark panel with sign-in / register-org CTAs
  if (isOwner) {
    return (
      <section
        aria-labelledby="gated-h"
        className="relative overflow-hidden rounded-2xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 md:p-12"
      >
        <SAChevron
          variant="signature"
          className="pointer-events-none absolute -right-20 -top-20 size-[420px] opacity-[0.04]"
        />

        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            What employers see  redacted
          </div>
          <h2
            id="gated-h"
            className="mt-3 font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-[color:var(--color-ink)]"
          >
            Your contact and documents stay private until you consent.
          </h2>
          <p className="mt-3 text-[color:var(--color-ink-soft)]">
            Verified employers see a locked panel where this section sits.
            Your email, mobile, un-redacted surname, CV and certificate
            files are revealed only after they request access and you
            approve  every reveal is audit-logged and surfaced back to
            you in your activity feed.
          </p>

          <ul className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <GatedItem
              tone="light"
              icon={<Lock className="size-3.5" />}
              title={t("locked.contact")}
              body="Email, mobile, response time."
            />
            <GatedItem
              tone="light"
              icon={<ShieldAlert className="size-3.5" />}
              title={t("locked.documents")}
              body="CV, qualifications, references."
            />
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit profile
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (softVisitor) {
    return (
      <section
        aria-labelledby="gated-h"
        className="relative overflow-hidden rounded-2xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 md:p-12"
      >
        <SAChevron
          variant="signature"
          className="pointer-events-none absolute -right-20 -top-20 size-[420px] opacity-[0.04]"
        />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <Lock className="size-3.5" aria-hidden="true" />
            Recorded access  employer-only
          </div>
          <h2
            id="gated-h"
            className="mt-3 font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-[color:var(--color-ink)]"
          >
            Contact reveals are an employer feature.
          </h2>
          <p className="mt-3 text-[color:var(--color-ink-soft)]">
            Verified employer accounts can request to reveal this candidate&rsquo;s
            contact details and documents, post-consent. Your account
            doesn&rsquo;t have that action  every reveal is audit-logged and
            surfaced back to the candidate in their activity feed.
          </p>

          <ul className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <GatedItem
              tone="light"
              icon={<Lock className="size-3.5" />}
              title={t("locked.contact")}
              body="Email, mobile, response time."
            />
            <GatedItem
              tone="light"
              icon={<ShieldAlert className="size-3.5" />}
              title={t("locked.documents")}
              body="CV, qualifications, references."
            />
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="gated-h"
      className="relative overflow-hidden rounded-2xl bg-[color:var(--color-ink)] p-8 text-[color:var(--color-paper)] md:p-12"
    >
      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -right-20 -top-20 size-[420px] opacity-[0.08]"
      />

      <div className="relative max-w-2xl">
        <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-accent)]">
          <Lock className="size-3.5" aria-hidden="true" />
          Recorded access
        </div>
        <h2
          id="gated-h"
          className="mt-3 font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight"
        >
          The rest of this dossier is locked.
        </h2>
        <p className="mt-3 text-[color:var(--color-paper)]/80">
          Contact details, document files, and the un-redacted surname are
          revealed only to verified employer accounts, post-consent. Every
          reveal is audit-logged and surfaced back to the candidate in their
          activity feed.
        </p>

        <ul className="mt-6 grid gap-3 text-sm md:grid-cols-2">
          <GatedItem
            icon={<Lock className="size-3.5" />}
            title={t("locked.contact")}
            body="Email, mobile, response time."
          />
          <GatedItem
            icon={<ShieldAlert className="size-3.5" />}
            title={t("locked.documents")}
            body="CV, qualifications, references."
          />
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/sign-in?as=employer"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-medium text-[color:var(--color-ink)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            Sign in as a verified employer
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/sign-up/employer"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-paper)] px-6 py-3 text-sm font-medium text-[color:var(--color-paper)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)]"
          >
            Register an organisation
          </Link>
        </div>
      </div>
    </section>
  );
}

function GatedItem({
  icon,
  title,
  body,
  tone = "dark",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  /** `dark` = on the black gated panel (visitor); `light` = on the cream owner panel. */
  tone?: "dark" | "light";
}) {
  if (tone === "light") {
    return (
      <li className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4">
        <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{body}</p>
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-[color:var(--color-paper)]/15 bg-[color:var(--color-paper)]/[0.04] p-4">
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm text-[color:var(--color-paper)]/85">{body}</p>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

function ProfileFooter({
  handle,
  t,
  isOwner,
}: {
  handle: string;
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>;
  isOwner: boolean;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-5 text-xs text-[color:var(--color-ink-soft)]">
      {isOwner ? (
        <span />
      ) : (
        <ReportProfileButton handle={handle} label={t("report")} />
      )}
      <span className="uppercase tracking-[0.18em]">
        Every reveal on this profile is audit-logged.
      </span>
    </footer>
  );
}

/**
 * Phase 9.22  format a YYYY-MM-DD role start date as "MMM YYYY".
 * Day precision is captured in the schema but we display month + year
 * only  the day rarely matters at the public-profile glance.
 */
function formatRoleStartedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
}
