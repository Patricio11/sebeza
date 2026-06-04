import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { PublicProfile } from "@/lib/mock/types";
import { StatusChip } from "./StatusChip";
import { VerificationBadge } from "./VerificationBadge";
import { ProfileCompleteness } from "./ProfileCompleteness";
import { Avatar } from "./Avatar";
import { WorkAvailabilityChips } from "@/components/feature/profile/WorkAvailabilityChips";

interface Props {
  profile: PublicProfile;
  locale?: string;
  /** When true, draw a subtle "citizen highlight" treatment (per Citizen-Visibility Rule). */
  highlightCitizen?: boolean;
  /**
   * Phase 9.16.1  threaded through from the parent server page which
   * reads the platform-level `feature_flag_verification_badges_visible`
   * setting. When false, both the badge pill and the avatar ring are
   * hidden. Defaults true so existing callers stay unchanged.
   */
  verificationVisible?: boolean;
  /**
   * Phase 13.8  optional action node rendered alongside the
   * "View profile" CTA in the row footer. Used by /search to inject
   * the employer-only "Invite to vacancy" client island. The slot is
   * intentionally a generic ReactNode so the roster row stays free
   * of any employer/seeker conditional rendering  the parent server
   * page passes `null` (default) or a pre-rendered island.
   */
  trailingAction?: ReactNode;
  className?: string;
}

/**
 * The signature search-result row. Editorial list (NOT a card grid)  the
 * product's defining layout. See UX_UI_SPEC §2.2.
 *
 * Redaction Rule: no ID number, no documents, no raw contact details here.
 * `displayName` already arrives redacted from the dataProvider.
 */
export function TalentRosterItem({
  profile,
  locale = "en",
  highlightCitizen = false,
  verificationVisible = true,
  trailingAction = null,
  className,
}: Props) {
  const t = useTranslations("search.rosterItem");
  const showCitizenHighlight = highlightCitizen && profile.isCitizen;

  return (
    <article
      className={cn(
        "group relative grid grid-cols-[auto_1fr] gap-4 border-b border-[color:var(--color-hairline)] py-5",
        showCitizenHighlight &&
          "border-l-2 border-l-[color:var(--color-brand)] pl-4",
        className,
      )}
    >
      <Avatar
        name={profile.displayName}
        photoUrl={profile.profilePhotoUrl}
        verification={profile.verification}
        size="md"
        showRing={verificationVisible}
      />

      <div className="min-w-0">
        {/* Top line: name + verification */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-display text-xl text-[color:var(--color-ink)]">
            <Link
              href={`/p/${profile.handle}`}
              className="rounded-sm hover:underline focus-visible:outline-none"
            >
              {profile.displayName}
            </Link>
          </h3>
          <VerificationBadge state={profile.verification} visible={verificationVisible} />
        </header>

        {/* Profession + city  Phase 9.9 appends years experience after
            profession when declared. NULL renders unchanged. */}
        <p className="mt-0.5 text-[color:var(--color-ink-soft)]">
          {profile.seniority && (
            <span className="capitalize">{profile.seniority} </span>
          )}
          <span className="text-[color:var(--color-ink)]">{profile.profession}</span>
          {profile.yearsExperience != null && (
            <>
              <span aria-hidden="true"> · </span>
              <span>
                {profile.yearsExperience === 0
                  ? "<1 yr"
                  : `${profile.yearsExperience} yr${profile.yearsExperience === 1 ? "" : "s"}`}
              </span>
            </>
          )}
          <span aria-hidden="true"> · </span>
          <span>{profile.city}</span>
          {profile.nationality && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{profile.nationality}</span>
            </>
          )}
        </p>

        {/* Top skills  Phase 9.9 appends years per skill when declared
            (e.g. "TypeScript (5 yrs) · React (3 yrs) · Python"). */}
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          <span className="sr-only">{t("topSkills")}: </span>
          {profile.topSkills
            .map((s) =>
              s.yearsOfExperience != null
                ? `${s.name} (${s.yearsOfExperience === 0 ? "<1 yr" : `${s.yearsOfExperience} yr${s.yearsOfExperience === 1 ? "" : "s"}`})`
                : s.name,
            )
            .join(" · ")}
        </p>

        {/* Status + completeness + availability + CTA */}
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip
              status={profile.status}
              confirmedAt={profile.statusConfirmedAt}
              locale={locale}
            />
            <ProfileCompleteness value={profile.completeness} />
            <WorkAvailabilityChips
              values={profile.workAvailability}
              variant="compact"
            />
          </div>
          {/* Phase 13.8  CTA cluster. Mobile stacks the optional
              trailing action UNDER View profile so each tap target
              keeps its full width; md+ inlines them side-by-side. */}
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Link
              href={`/p/${profile.handle}`}
              className="inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-brand)] transition-colors hover:bg-[color:var(--color-brand-tint)]"
            >
              {t("viewProfile")}
              <span className="sr-only">  {profile.displayName}</span>
            </Link>
            {trailingAction}
          </div>
        </footer>
      </div>
    </article>
  );
}

