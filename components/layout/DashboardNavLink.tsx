"use client";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Active-aware navigation link for the persistent dashboard sidebar. Because
 * the sidebar now lives in a `layout.tsx` (so it survives navigation), the
 * active item can no longer be passed as an `activeKey` prop from each page 
 * it's derived from the current pathname instead.
 *
 * Sets `aria-current="page"` when active; all visual styling is driven from
 * the caller's `className` via `aria-[current=page]:` / `group-aria-[current=page]:`
 * Tailwind variants, so this stays a tiny client island over a static tree.
 *
 * `usePathname` from next-intl returns the locale-stripped path, matching the
 * locale-less hrefs in the nav config.
 */
export function DashboardNavLink({
  href,
  exact = false,
  className,
  children,
}: {
  href: string;
  /** Match the path exactly (used for the section root, e.g. `/admin`). */
  exact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
