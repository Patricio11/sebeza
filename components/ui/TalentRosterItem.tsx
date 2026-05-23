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
          <VerificationBadge state={profile.verification} />
        </header>

        {/* Profession + city */}
        <p className="mt-0.5 text-[color:var(--color-ink-soft)]">
          {profile.seniority && (
            <span className="capitalize">{profile.seniority} </span>
          )}
          <span className="text-[color:var(--color-ink)]">{profile.profession}</span>
          <span aria-hidden="true"> · </span>
          <span>{profile.city}</span>
          {profile.nationality && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{profile.nationality}</span>
            </>
          )}
        </p>

        {/* Top skills */}
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          <span className="sr-only">{t("topSkills")}: </span>
          {profile.topSkills.map((s) => s.name).join(" · ")}
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
          <Link
            href={`/p/${profile.handle}`}
            className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-brand)] transition-colors hover:bg-[color:var(--color-brand-tint)]"
          >
            {t("viewProfile")}
            <span className="sr-only">  {profile.displayName}</span>
          </Link>
        </footer>
      </div>
    </article>
  );
}

