import {
  LayoutDashboard,
  MapPin,
  Building2,
  Download,
  UserCog,
  Scale,
  Sprout,
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
  { key: "account", label: "My account", href: "/gov/account", icon: UserCog },
];
