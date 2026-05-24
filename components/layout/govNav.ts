import {
  LayoutDashboard,
  MapPin,
  Building2,
  Download,
  UserCog,
  Scale,
  Sprout,
  FileSearch,
  FileText,
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
  // Phase 9.7.6  ships dormant; the page itself renders an informative
  // notice when the feature flag is off, so the nav entry is honest about
  // platform capability without hiding it as "secret feature."
  {
    key: "employer-lookup",
    label: "Per-employer lookup",
    href: "/gov/employer-lookup",
    icon: FileSearch,
  },
  {
    key: "municipalities",
    label: "Municipalities",
    href: "/gov/municipalities",
    icon: Building2,
  },
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
