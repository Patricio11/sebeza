/**
 * Phase 11.4.2  /dashboard/following  the seeker's private follow
 * list. Shows every employer they've heart-clicked + current
 * open-vacancy counts + a tap-through to /p/{org-handle} (once that
 * route ships) or the existing search by org name.
 *
 * Empty-state copy explains the pattern so a brand-new seeker who
 * arrives via the nav entry isn't confused.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { getMyProfile } from "@/lib/profile/me";
import { listMyFollows } from "@/lib/seeker/follows";
import { FollowEmployerButton } from "@/components/feature/seeker/FollowEmployerButton";
import { EmployerVerificationChip } from "@/components/feature/seeker/invitations/EmployerVerificationChip";
import { HelpLink } from "@/components/feature/help/HelpLink";
import { Building2, Heart, Briefcase } from "lucide-react";

export const revalidate = 0;

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/following");

  const follows = await listMyFollows();
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <DashboardMasthead
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="following"
      pageEyebrow="Following"
      pageTitle="Employers you follow"
      pageSubtitle="Private warm-intent list. The employer isn't told. You'll get a quiet bell ping when a followed employer opens a role in your profession + province."
    >
      {/* Phase 11.4.2  help deep-links. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="following-employers" label="How following works" />
        <HelpLink role="seeker" slug="discovering-employers" label="Recommended employers" />
      </div>

      {follows.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center md:p-12">
          <Heart
            className="mx-auto size-8 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
          <h2 className="mt-4 font-display text-xl">
            Nothing on your follow list yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--color-ink-soft)]">
            On a search result or employer profile, tap the heart icon
            to start following. They&rsquo;re never told. You&rsquo;ll
            get a quiet bell when they open a role you could be a fit
            for  no email, no chase.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {follows.map((f) => (
            <li
              key={f.followId}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2
                      className="size-4 text-[color:var(--color-ink-soft)]"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-lg text-[color:var(--color-ink)]">
                      {f.orgName}
                    </h3>
                    <EmployerVerificationChip state={f.orgVerification} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-ink-soft)]">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase
                        className="size-3"
                        aria-hidden="true"
                      />
                      {f.openVacancyCount} open vacanc
                      {f.openVacancyCount === 1 ? "y" : "ies"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Following since {fmt.format(new Date(f.followedAt))}</span>
                  </div>
                </div>
                <FollowEmployerButton
                  orgId={f.orgId}
                  initialFollowing
                  variant="icon"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardMasthead>
  );
}
