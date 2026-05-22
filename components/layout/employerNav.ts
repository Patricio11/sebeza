import {
  LayoutDashboard,
  Search,
  Bookmark,
  Users2,
  CheckCircle2,
  Building2,
  UsersRound,
  Settings,
} from "lucide-react";
import type { DashboardNavItem } from "./DashboardShell";

export const EMPLOYER_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/employer", icon: LayoutDashboard },
  { key: "search", label: "Search talent", href: "/search", icon: Search },
  { key: "savedSearches", label: "Saved searches", href: "/employer/saved-searches", icon: Bookmark },
  { key: "shortlists", label: "Talent pools", href: "/employer/shortlists", icon: Users2 },
  { key: "placements", label: "Placements", href: "/employer/placements", icon: CheckCircle2 },
  { key: "organisation", label: "Organisation", href: "/employer/organisation", icon: Building2 },
  { key: "team", label: "Team", href: "/employer/team", icon: UsersRound },
  { key: "account", label: "Account", href: "/employer/account", icon: Settings },
];

export interface MockEmployer {
  orgName: string;
  orgVerified: boolean;
  industry: string;
  size: string;
  registration: string;
  city: string;
  country: string;
  user: {
    fullName: string;
    role: string;
    email: string;
  };
}

export const MOCK_EMPLOYER: MockEmployer = {
  orgName: "Discovery Bank",
  orgVerified: false,
  industry: "Financial services",
  size: "1 001+",
  registration: "1996/004593/06",
  city: "Sandton",
  country: "South Africa",
  user: {
    fullName: "Naledi Khumalo",
    role: "Head of Talent Acquisition",
    email: "naledi.khumalo@discovery.co.za",
  },
};
