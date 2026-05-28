import {
  LayoutDashboard,
  ShieldCheck,
  ShieldAlert,
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
  // Phase 9.7.7  watch the watchers. Sits right after the general
  // audit log because it's a curated, sensitivity-focused slice of
  // the same underlying table.
  {
    key: "oversight",
    label: "Oversight log",
    href: "/admin/oversight",
    icon: ShieldAlert,
  },
  { key: "users", label: "Users", href: "/admin/users", icon: Users },
  { key: "notifications", label: "Notifications", href: "/admin/notifications", icon: Bell },
  { key: "settings", label: "Platform settings", href: "/admin/settings", icon: SlidersHorizontal },
  { key: "account", label: "My account", href: "/admin/account", icon: UserCog },
];

export const MOCK_ADMIN = {
  fullName: "Sebenza · Admin",
  role: "Compliance & Trust",
  email: "admin@sebenzasa.com",
};
