import { NotificationBell } from "@/components/feature/notifications/NotificationBell";
import { listForUser, unreadCount } from "@/lib/notifications/query";

/**
 * Shared dashboard chrome  the pieces both the persistent `DashboardFrame`
 * (sidebar + mobile strip, rendered in the route-group `layout.tsx`) and the
 * per-page `DashboardMasthead` need. Extracted so the sidebar can live in a
 * layout (persisting across navigation) while the masthead stays per-page.
 *
 * `DashboardShell` (the legacy all-in-one shell still used by seeker/employer/
 * gov until they're migrated) re-exports the two types from here so the nav
 * config files keep importing them from `./DashboardShell` unchanged.
 */

export type DashboardRole = "seeker" | "employer" | "admin" | "gov";

export interface DashboardNavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Phase 28  promoted to the floating mobile bottom bar (max 4 per role;
      everything else lives in the "More" sheet). */
  mobilePrimary?: boolean;
  /** Phase 28  short label for the bottom-bar tab where the sidebar label
      is too long for a 360px-wide fifth. Falls back to `label`. */
  mobileLabel?: string;
}

export const NOTIFICATIONS_HREF: Record<DashboardRole, string> = {
  seeker: "/dashboard/notifications",
  employer: "/employer/notifications",
  admin: "/admin/notifications",
  // Phase 9  gov shares the admin notifications surface for now (same
  // catalog of relevant kinds). Promote to its own page when gov-only
  // kinds appear.
  gov: "/admin/notifications",
};

export const ROLE_ACCENT: Record<DashboardRole, { strip: string; text: string }> = {
  seeker: {
    strip: "bg-[color:var(--color-brand)]",
    text: "text-[color:var(--color-brand)]",
  },
  employer: {
    strip: "bg-[color:var(--color-accent)]",
    text: "text-[color:var(--color-accent)]",
  },
  admin: {
    strip: "bg-[color:var(--color-ink)]",
    text: "text-[color:var(--color-ink)]",
  },
  // Phase 9  distinct accent for the gov workspace (deeper green than the
  // brand to differentiate from seeker, lighter than admin).
  gov: {
    strip: "bg-[color:var(--color-brand-strong)]",
    text: "text-[color:var(--color-brand-strong)]",
  },
};

/**
 * Fetches the initial bell state on the server so the first paint is accurate.
 * Returns `null` if the read fails (suspended user, DB hiccup)  the bell
 * silently disappears rather than erroring out the entire dashboard.
 */
export async function BellSlot({ role }: { role: DashboardRole }) {
  try {
    const [count, items] = await Promise.all([unreadCount(), listForUser({ limit: 10 })]);
    return (
      <NotificationBell
        fullPageHref={NOTIFICATIONS_HREF[role]}
        initialUnreadCount={count}
        initialItems={items}
      />
    );
  } catch {
    return null;
  }
}
