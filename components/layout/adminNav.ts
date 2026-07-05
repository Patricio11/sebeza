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
  Workflow,
  LifeBuoy,
  MessageSquareQuote,
  Plug,
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
  // Phase 19.2 ("Custom Skills")  taxonomy-growth leaderboard: promote the
  // most-requested seeker-described skills into the searchable taxonomy.
  { key: "customSkills", label: "Custom skills", href: "/admin/custom-skills", icon: Sparkles },
  // Phase 20 ("Skill Prerequisites")  curate the skill dependency graph that
  // sequences compass recommendations.
  { key: "skillPrereqs", label: "Skill prerequisites", href: "/admin/skill-prereqs", icon: Workflow },
  // Phase 13.3  LLM provider configuration. Above audit-log because
  // every action here writes to it; the admin should be one click away.
  // Phase 25  every external integration on one surface (channel creds
  // encrypted in DB, health for DB/storage, bulk announcements).
  { key: "integrations", label: "Integrations", href: "/admin/integrations", icon: Plug },
  { key: "llm", label: "LLM providers", href: "/admin/llm", icon: Sparkles },
  // Phase 22.2 ("AI Coach — crisis pathway")  verified crisis-support resources
  // shown to a seeker in distress. Sits by the LLM/AI integration config.
  { key: "crisisResources", label: "Crisis resources", href: "/admin/crisis-resources", icon: LifeBuoy },
  // Phase 24  testimonial collection + curation (landing-rail source of truth).
  { key: "testimonials", label: "Testimonials", href: "/admin/testimonials", icon: MessageSquareQuote },
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
