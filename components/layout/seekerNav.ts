import {
  LayoutDashboard,
  UserPen,
  Briefcase,
  GraduationCap,
  Compass,
  Bot,
  Activity,
  Bell,
  Heart,
  Inbox,
  ShieldCheck,
  Settings,
  HelpCircle,
} from "lucide-react";
import type { DashboardNavItem } from "./dashboardChrome";

export const SEEKER_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { key: "profile", label: "Profile editor", href: "/dashboard/profile", icon: UserPen },
  { key: "experience", label: "Experience", href: "/dashboard/experience", icon: Briefcase },
  { key: "qualifications", label: "Qualifications", href: "/dashboard/qualifications", icon: GraduationCap },
  // Phase 9.8.5  vacancy invitations inbox; sits next to Notifications
  // because the two surfaces are conceptually related (a vacancy
  // invite IS a notification, but it has its own structured
  // response lifecycle).
  { key: "invitations", label: "Vacancy invites", href: "/dashboard/invitations", icon: Inbox },
  { key: "grow", label: "Career compass", href: "/dashboard/grow", icon: Compass },
  // Phase 17 ("AI Career Coach", flag-gated)  removed from the nav unless
  // `feature_flag_seeker_ai_coach` is ON (the seeker layout filters it). Sits
  // next to Career compass: both are growth / work-readiness surfaces.
  { key: "coach", label: "AI coach", href: "/dashboard/coach", icon: Bot },
  // Phase 11.4.2  private follow list. Sits next to Career compass
  // because both surfaces are about discovery + warm intent. The
  // employer is never told.
  { key: "following", label: "Following", href: "/dashboard/following", icon: Heart },
  { key: "activity", label: "Activity", href: "/dashboard/activity", icon: Activity },
  { key: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  // Phase 10.2  seeker help center. Sits between Notifications and
  // Privacy so it's reachable in one scroll on a 360px viewport;
  // mirrors the placement on the employer side (between Notifications
  // and Account).
  { key: "help", label: "Help", href: "/dashboard/help", icon: HelpCircle },
  { key: "privacy", label: "Privacy & consent", href: "/dashboard/privacy", icon: ShieldCheck },
  { key: "account", label: "Account", href: "/dashboard/account", icon: Settings },
];
