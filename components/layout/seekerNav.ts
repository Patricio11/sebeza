import {
  LayoutDashboard,
  UserPen,
  Briefcase,
  GraduationCap,
  Compass,
  Activity,
  Bell,
  ShieldCheck,
  Settings,
} from "lucide-react";
import type { DashboardNavItem } from "./DashboardShell";

export const SEEKER_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { key: "profile", label: "Profile editor", href: "/dashboard/profile", icon: UserPen },
  { key: "experience", label: "Experience", href: "/dashboard/experience", icon: Briefcase },
  { key: "qualifications", label: "Qualifications", href: "/dashboard/qualifications", icon: GraduationCap },
  { key: "grow", label: "Career compass", href: "/dashboard/grow", icon: Compass },
  { key: "activity", label: "Activity", href: "/dashboard/activity", icon: Activity },
  { key: "notifications", label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { key: "privacy", label: "Privacy & consent", href: "/dashboard/privacy", icon: ShieldCheck },
  { key: "account", label: "Account", href: "/dashboard/account", icon: Settings },
];
