import {
  LayoutDashboard,
  ShieldCheck,
  Flag,
  Library,
  ScrollText,
  Users,
  Bell,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import type { DashboardNavItem } from "./DashboardShell";

export const ADMIN_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { key: "verifications", label: "Verification queue", href: "/admin/verifications", icon: ShieldCheck },
  { key: "moderation", label: "Moderation", href: "/admin/moderation", icon: Flag },
  { key: "taxonomy", label: "Taxonomy", href: "/admin/taxonomy", icon: Library },
  { key: "auditLog", label: "Audit log", href: "/admin/audit-log", icon: ScrollText },
  { key: "users", label: "Users", href: "/admin/users", icon: Users },
  { key: "notifications", label: "Notifications", href: "/admin/notifications", icon: Bell },
  { key: "settings", label: "Platform settings", href: "/admin/settings", icon: SlidersHorizontal },
  { key: "account", label: "My account", href: "/admin/account", icon: UserCog },
];

export const MOCK_ADMIN = {
  fullName: "Sebenza · Admin",
  role: "Compliance & Trust",
  email: "admin@sebenza.co.za",
};
