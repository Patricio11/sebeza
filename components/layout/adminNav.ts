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
  HelpCircle,
  BookOpen,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import type { DashboardNavItem } from "./dashboardChrome";

export const ADMIN_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/admin", icon: LayoutDashboard },
  { key: "verifications", label: "Verification queue", href: "/admin/verifications", icon: ShieldCheck },
  { key: "moderation", label: "Moderation", href: "/admin/moderation", icon: Flag },
  { key: "taxonomy", label: "Taxonomy", href: "/admin/taxonomy", icon: Library },
  // Phase 13.3  module → skill curation queue + bulk syllabus
  // import. Sits next to taxonomy because they are the same kind of
  // editorial work over different tables.
  { key: "curriculum", label: "Curriculum", href: "/admin/curriculum", icon: BookOpen },
  // Phase 18.2 ("Living Learning Catalog")  editorial + freshness admin for the
  // learning-path catalog. Sits with curriculum: same editorial-over-a-table work.
  { key: "learningPaths", label: "Learning paths", href: "/admin/learning-paths", icon: GraduationCap },
  // Phase 13.3  LLM provider configuration. Above audit-log because
  // every action here writes to it; the admin should be one click away.
  { key: "llm", label: "LLM providers", href: "/admin/llm", icon: Sparkles },
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
  // Phase 10.3  admin help center. Sits between Notifications and
  // Platform settings so it's reachable without scrolling through
  // settings; mirrors the placement on seeker / employer sides.
  { key: "help", label: "Help", href: "/admin/help", icon: HelpCircle },
  { key: "settings", label: "Platform settings", href: "/admin/settings", icon: SlidersHorizontal },
  { key: "account", label: "My account", href: "/admin/account", icon: UserCog },
];
