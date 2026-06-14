import { setRequestLocale } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";

/**
 * Seeker route-group layout. Renders the persistent <DashboardFrame> once, so
 * navigation only swaps the content column — the sidebar stays mounted
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

  return (
    <DashboardFrame
      role="seeker"
      workspaceLabel={profile?.displayName ?? session.name}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
    >
      {children}
    </DashboardFrame>
  );
}
