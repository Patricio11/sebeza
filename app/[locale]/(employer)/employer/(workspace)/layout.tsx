import { redirect } from "next/navigation";
import { verifyEmployer } from "@/lib/auth/dal";

/**
 * The verified-workspace gate (2026-08, founder decision).
 *
 * Everything inside this route group is the employer WORKSPACE: the
 * dashboard, talent dossiers, vacancies, invites, placements, shortlists,
 * saved searches, organisation and team pages. None of it is reachable
 * until the organisation has cleared KYC review: an unverified, pending,
 * or rejected org is server-redirected to /employer/onboarding, whose
 * five status-aware views tell them exactly where they stand.
 *
 * Deliberately OUTSIDE this group (still reachable pre-verification):
 *   - /employer/onboarding      the verification flow itself
 *   - /employer/account         password / 2FA / sessions
 *   - /employer/notifications   review decisions arrive here
 *   - /employer/help            self-service answers during the wait
 *
 * This gate is defence-in-depth ON TOP of `verifyOrgVerified()`, which
 * individual reveal/invite/document paths keep calling: the group gate
 * handles navigation; the per-action guard handles direct endpoint hits.
 */
export default async function VerifiedWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyEmployer();
  if (session.verification !== "verified") {
    redirect("/employer/onboarding");
  }
  return <>{children}</>;
}
