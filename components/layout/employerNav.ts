import {
  LayoutDashboard,
  Search,
  Bookmark,
  Briefcase,
  Users2,
  CheckCircle2,
  Building2,
  UsersRound,
  UserPlus,
  Bell,
  HelpCircle,
  Settings,
} from "lucide-react";
import type { DashboardNavItem } from "./dashboardChrome";

export const EMPLOYER_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/employer", icon: LayoutDashboard },
  { key: "search", label: "Search talent", href: "/search", icon: Search },
  { key: "savedSearches", label: "Saved searches", href: "/employer/saved-searches", icon: Bookmark },
  // Phase 9.8  vacancies sit between saved searches (passive
  // monitoring) and talent pools (manual shortlisting) because they
  // are the active reverse-matching workflow that bridges the two.
  { key: "vacancies", label: "Vacancies", href: "/employer/vacancies", icon: Briefcase },
  // Phase 9.17  invited seekers (roster-building flow). Sits next to
  // Vacancies because both are outbound-from-employer workflows;
  // Vacancies invites EXISTING seekers, Invites onboards NEW ones.
  { key: "invites", label: "Invites", href: "/employer/invites", icon: UserPlus },
  { key: "shortlists", label: "Talent pools", href: "/employer/shortlists", icon: Users2 },
  // Phase 9.20 D11  the URL stays /employer/placements so every
  // historic deep link (audit log meta, notification emails, ISR
  // cache keys) keeps resolving. The label is the recruiter's
  // mental model: "Employees", not the platform's internal noun.
  { key: "placements", label: "Employees", href: "/employer/placements", icon: CheckCircle2 },
  { key: "organisation", label: "Organisation", href: "/employer/organisation", icon: Building2 },
  { key: "team", label: "Team", href: "/employer/team", icon: UsersRound },
  { key: "notifications", label: "Notifications", href: "/employer/notifications", icon: Bell },
  // Phase 10.1  in-product help center. Sits between Notifications
  // and Account so the most-used surfaces stay above the fold on a
  // 360px viewport + Help is reachable in one scroll on phones.
  { key: "help", label: "Help", href: "/employer/help", icon: HelpCircle },
  { key: "account", label: "Account", href: "/employer/account", icon: Settings },
];
