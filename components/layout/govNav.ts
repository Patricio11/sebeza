import {
  LayoutDashboard,
  MapPin,
  // Building2,  // Phase 9.9 sweep  uncomment when /gov/municipalities ships
  Download,
  UserCog,
  Scale,
  Sprout,
  FileSearch,
  FileText,
  GraduationCap,
} from "lucide-react";
import type { DashboardNavItem } from "./DashboardShell";

export const GOV_NAV: DashboardNavItem[] = [
  { key: "overview", label: "Overview", href: "/gov", icon: LayoutDashboard },
  {
    key: "provinces",
    label: "Provinces",
    href: "/gov/provinces",
    icon: MapPin,
  },
  {
    key: "shortage",
    label: "Shortage justification",
    href: "/gov/shortage",
    icon: Scale,
  },
  {
    key: "opportunity",
    label: "Local-hiring opportunity",
    href: "/gov/opportunity",
    icon: Sprout,
  },
  // Phase 9.13  curriculum-vs-demand cross-market analytics.
  {
    key: "curriculum",
    label: "Curriculum vs demand",
    href: "/gov/curriculum",
    icon: GraduationCap,
  },
  // Phase 9.7.6  ships dormant; the page itself renders an informative
  // notice when the feature flag is off, so the nav entry is honest about
  // platform capability without hiding it as "secret feature."
  {
    key: "employer-lookup",
    label: "Per-employer lookup",
    href: "/gov/employer-lookup",
    icon: FileSearch,
  },
  // Phase 9.9 sweep  /gov/municipalities is a "Coming soon" stub;
  // hidden from nav so the public-launch surface doesn't expose a
  // dead-end link. The route still exists (typed import + analytics
  // discoverable via direct URL) so the post-launch build can flip
  // it back in one line when the page actually ships.
  // {
  //   key: "municipalities",
  //   label: "Municipalities",
  //   href: "/gov/municipalities",
  //   icon: Building2,
  // },
  {
    key: "exports",
    label: "Exports",
    href: "/gov/exports",
    icon: Download,
  },
  {
    key: "brief",
    label: "Policy brief",
    href: "/gov/brief",
    icon: FileText,
  },
  { key: "account", label: "My account", href: "/gov/account", icon: UserCog },
];
