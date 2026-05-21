import { Home, User, Activity, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface TabItem {
  href: "/dashboard" | "/p/me" | "/dashboard/activity" | "/dashboard/account";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  /** Path key for the currently-active tab. */
  active?: "home" | "profile" | "activity" | "account";
}

/**
 * Thumb-reachable bottom tab bar for seeker contexts on mobile (UX_UI_SPEC §2.4).
 * Desktop ignores this entirely — use the sidebar.
 */
export function MobileTabBar({ active = "home" }: Props) {
  const items: (TabItem & { key: Props["active"] })[] = [
    { key: "home", href: "/dashboard", label: "Home", icon: Home },
    { key: "profile", href: "/p/me", label: "Profile", icon: User },
    { key: "activity", href: "/dashboard/activity", label: "Activity", icon: Activity },
    { key: "account", href: "/dashboard/account", label: "Account", icon: Settings },
  ];

  return (
    <nav
      aria-label="Account sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-2.5 text-[0.68rem] uppercase tracking-[0.18em]"
                style={{
                  color: isActive
                    ? "var(--color-ink)"
                    : "var(--color-ink-soft)",
                }}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
