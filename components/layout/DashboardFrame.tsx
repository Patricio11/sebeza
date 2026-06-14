import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SebenzaLogo } from "@/components/ui/SebenzaLogo";
import { SignOutButton } from "@/components/feature/auth/SignOutButton";
import { cn } from "@/lib/utils";
import {
  BellSlot,
  ROLE_ACCENT,
  type DashboardNavItem,
  type DashboardRole,
} from "./dashboardChrome";
import { DashboardNavLink } from "./DashboardNavLink";

interface Props {
  role: DashboardRole;
  /** Display name for the workspace label. */
  workspaceLabel: string;
  /** A short eyebrow above the workspace name (e.g. "Job seeker · workspace"). */
  workspaceEyebrow: string;
  nav: DashboardNavItem[];
  /** The page content — masthead + main, rendered into the main column. */
  children: React.ReactNode;
}

/**
 * Persistent Civic Editorial dashboard frame: the sidebar (desktop) + top tab
 * strip (mobile) that stay mounted across navigation. Rendered from the route
 * group's `layout.tsx`, NOT from each page — so navigating between pages only
 * swaps the `{children}` (the masthead + main), and the sidebar never
 * unmounts or flashes a skeleton.
 *
 * The active nav item is derived from the pathname by `DashboardNavLink`
 * (the section root matches exactly; deeper routes match by prefix).
 */
export function DashboardFrame({
  role,
  workspaceLabel,
  workspaceEyebrow,
  nav,
  children,
}: Props) {
  const roleAccent = ROLE_ACCENT[role];
  const rootHref = nav[0]?.href;

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-[color:var(--color-brand)] focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      {/* `print:block` drops the sidebar column so print-CSS pages (e.g. the
          seeker CV builder, the gov brief) print full-width with no chrome. */}
      <div className="md:grid md:grid-cols-[272px_1fr] print:block">
        {/* Sidebar (desktop) — sticky to viewport; only the main column scrolls */}
        <aside
          aria-label={`${workspaceLabel} navigation`}
          className="hidden border-r border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto print:hidden"
        >
          {/* Top flag band over the sidebar */}
          <div aria-hidden="true" className="flex h-[3px] w-full">
            <div className="flex-[3] bg-[color:var(--color-brand)]" />
            <div className="flex-[2] bg-[color:var(--color-accent)]" />
            <div className="flex-[1] bg-[color:var(--color-danger)]" />
          </div>

          <div className="relative flex items-center gap-3 border-b border-[color:var(--color-hairline)] px-6 py-5">
            <span
              aria-hidden="true"
              className={cn("absolute inset-y-0 left-0 w-1", roleAccent.strip)}
            />
            <Link href="/" aria-label="Sebenza — home" className="flex items-center">
              <SebenzaLogo width={120} />
            </Link>
          </div>

          <div className="border-b border-[color:var(--color-hairline)] px-6 py-4">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              {workspaceEyebrow}
            </div>
            <div className="font-display text-base">{workspaceLabel}</div>
          </div>

          <nav className="flex-1 px-3 py-4">
            <ul className="space-y-0.5">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <DashboardNavLink
                      href={item.href}
                      exact={item.href === rootHref}
                      className="group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-surface-sunk)] aria-[current=page]:bg-[color:var(--color-ink)] aria-[current=page]:text-[color:var(--color-paper)]"
                    >
                      <Icon
                        className="size-4 text-[color:var(--color-ink-soft)] group-hover:text-[color:var(--color-ink)] group-aria-[current=page]:text-[color:var(--color-paper)]"
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </DashboardNavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto space-y-3 border-t border-[color:var(--color-hairline)] px-6 py-4">
            <LocaleSwitcher />
            <Link
              href="/"
              className="block text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              ← Back to public site
            </Link>
            <SignOutButton
              label="Sign out"
              className="w-full justify-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] px-3 py-2 text-sm hover:border-[color:var(--color-ink)]"
            />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-h-screen flex-col">
          {/* Mobile top strip */}
          <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:hidden print:hidden">
            <div aria-hidden="true" className="flex h-[3px] w-full">
              <div className="flex-[3] bg-[color:var(--color-brand)]" />
              <div className="flex-[2] bg-[color:var(--color-accent)]" />
              <div className="flex-[1] bg-[color:var(--color-danger)]" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <Link href="/" aria-label="Sebenza — home" className="flex items-center">
                <SebenzaLogo width={110} />
              </Link>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "hidden text-[0.62rem] uppercase tracking-[0.24em] min-[400px]:inline",
                    roleAccent.text,
                  )}
                >
                  {workspaceEyebrow}
                </span>
                <BellSlot role={role} />
                {/* Always-visible sign-out tap target on mobile */}
                <SignOutButton iconOnly />
              </div>
            </div>
            <nav
              aria-label={`${workspaceLabel} navigation`}
              className="relative overflow-x-auto border-t border-[color:var(--color-hairline)]"
            >
              <ul className="flex min-w-max">
                {nav.map((item) => (
                  <li key={item.key}>
                    <DashboardNavLink
                      href={item.href}
                      exact={item.href === rootHref}
                      className="block min-h-11 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] aria-[current=page]:border-[color:var(--color-ink)] aria-[current=page]:text-[color:var(--color-ink)]"
                    >
                      {item.label}
                    </DashboardNavLink>
                  </li>
                ))}
              </ul>
              {/* Fade-edge cue — signals there's more to scroll */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[color:var(--color-surface)] to-transparent"
              />
            </nav>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
