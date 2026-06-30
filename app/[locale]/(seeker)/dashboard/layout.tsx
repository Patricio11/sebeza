import { setRequestLocale } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import { getSetting } from "@/lib/admin/settings";

/**
 * Seeker route-group layout. Renders the persistent <DashboardFrame> once, so
 * navigation only swaps the content column  the sidebar stays mounted
 * (Part A pattern). `verifyRole("seeker")` guards (session + email-verified;
 * admins allowed; 2FA NOT forced for seekers); the workspace label uses the
 * profile display name, falling back to the account name.
 *
 * The frame's chrome is `print:hidden`, so the standalone print-CSS pages in
 * this group (e.g. `/dashboard/cv`) still print as clean, full-width documents.
 */
export default async function SeekerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyRole("seeker");
  const profile = await getMyProfile();

  // Phase 17 ("AI Career Coach")  the Coach nav item only appears when the
  // flag is on. Off (the dark-ship default) = the item is filtered out and the
  // /dashboard/coach page 404s, so there's no dead link.
  const coachOn = await getSetting<boolean>("feature_flag_seeker_ai_coach");
  const nav = coachOn
    ? SEEKER_NAV
    : SEEKER_NAV.filter((item) => item.key !== "coach");

  return (
    <DashboardFrame
      role="seeker"
      workspaceLabel={profile?.displayName ?? session.name}
      workspaceEyebrow="Job seeker · workspace"
      nav={nav}
    >
      {children}
    </DashboardFrame>
  );
}
