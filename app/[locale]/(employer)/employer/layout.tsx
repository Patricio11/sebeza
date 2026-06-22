import { setRequestLocale } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { EMPLOYER_NAV } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";

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

  return (
    <DashboardFrame
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
    >
      {children}
    </DashboardFrame>
  );
}
