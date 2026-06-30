import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { getMyProfile } from "@/lib/profile/me";
import { getSetting } from "@/lib/admin/settings";
import { CoachPractice } from "@/components/feature/seeker/CoachPractice";

/**
 * Phase 17 ("AI Career Coach")  flag-gated seeker surface. When the flag is
 * OFF (the dark-ship default) the page 404s and the nav item is hidden, so
 * there's no dead link. When ON, it renders the interview-practice flow; the
 * dispatcher still gates on a configured + budgeted provider, degrading
 * gracefully (a clear "not available yet" message) when none is connected.
 */
export default async function CoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const coachOn = await getSetting<boolean>("feature_flag_seeker_ai_coach");
  if (!coachOn) notFound();

  const profile = await getMyProfile();

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow="Practice"
      pageTitle="AI interview coach"
      pageSubtitle="Practise realistic questions for a role you're aiming at. This is practice to help you prepare — never a guarantee of any job."
    >
      <CoachPractice defaultRole={profile?.profession ?? ""} />
    </DashboardMasthead>
  );
}
