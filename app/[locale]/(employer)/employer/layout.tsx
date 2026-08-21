import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { employerNav } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";

// Phase 33 (33.6)  belt to the robots.txt braces: robots.txt only
// prevents CRAWLING; a leaked/linked workspace URL could still be
// indexed by reference. This meta makes the whole group non-indexable.
export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Employer route-group layout. Renders the persistent <DashboardFrame> once,
 * around every employer page, so navigation only swaps the content column 
 * the sidebar stays mounted (Part A pattern, mirrors the admin layout).
 *
 * Guards with `verifyEmployer()`  the WEAK employer guard (role + session +
 * 2FA), which provides `orgName` but does NOT redirect unverified orgs to
 * onboarding. That's deliberate: onboarding lives under `/employer`, so a
 * stronger `verifyOrgVerified()` here would loop. Pages that need a verified
 * org keep calling `verifyOrgVerified()` themselves.
 */
export default async function EmployerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const tNav = await getTranslations("employerDash.nav");

  return (
    <DashboardFrame
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={employerNav((k) => tNav(k))}
    >
      {children}
    </DashboardFrame>
  );
}
