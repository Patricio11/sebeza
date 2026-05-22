import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SAChevron } from "@/components/ui/SAChevron";
import { cn } from "@/lib/utils";

export type DashboardRole = "seeker" | "employer" | "admin";

export interface DashboardNavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Props {
  role: DashboardRole;
  /** Display name for the wordmark / workspace label. */
  workspaceLabel: string;
  /** A short eyebrow above the workspace name (e.g. "Job seeker · workspace"). */
  workspaceEyebrow: string;
  nav: DashboardNavItem[];
  activeKey: string;
  /** Page-level title rendered in the editorial masthead. */
  pageTitle: string;
  pageEyebrow?: string;
  /** Optional subtitle / explanation line under the page title. */
  pageSubtitle?: string;
  /** Optional right-aligned actions in the masthead. */
  pageActions?: React.ReactNode;
  /** Optional persistent banner above the content (e.g. org-unverified). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Civic Editorial dashboard shell. Sidebar on desktop, top tab strip on mobile.
 * Role accent strip down the left edge of the sidebar makes the workspace
 * unmistakeably one of the three user types — no generic SaaS sidebar.
 */
export function DashboardShell({
  role,
  workspaceLabel,
  workspaceEyebrow,
  nav,
  activeKey,
  pageTitle,
  pageEyebrow,
  pageSubtitle,
  pageActions,
  banner,
  children,
}: Props) {
  const roleAccent = ROLE_ACCENT[role];

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-[color:var(--color-brand)] focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      <div className="md:grid md:grid-cols-[272px_1fr]">
        {/* Sidebar (desktop) */}
        <aside
          aria-label={`${workspaceLabel} navigation`}
          className="hidden border-r border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:flex md:min-h-screen md:flex-col"
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
            <Link href="/" className="flex items-baseline gap-2">
              <SAChevron variant="mark" className="size-3 translate-y-[1px]" />
              <span className="font-display text-xl leading-none">Sebenza</span>
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
                ZA
              </span>
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
                const isActive = item.key === activeKey;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                          : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-surface-sunk)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          isActive
                            ? ""
                            : "text-[color:var(--color-ink-soft)] group-hover:text-[color:var(--color-ink)]",
                        )}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </Link>
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
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-h-screen flex-col">
          {/* Mobile top strip */}
          <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:hidden">
            <div aria-hidden="true" className="flex h-[3px] w-full">
              <div className="flex-[3] bg-[color:var(--color-brand)]" />
              <div className="flex-[2] bg-[color:var(--color-accent)]" />
              <div className="flex-[1] bg-[color:var(--color-danger)]" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <Link href="/" className="flex items-baseline gap-1.5">
                <SAChevron variant="mark" className="size-3 translate-y-[1px]" />
                <span className="font-display text-lg">Sebenza</span>
              </Link>
              <span
                className={cn(
                  "text-[0.62rem] uppercase tracking-[0.24em]",
                  roleAccent.text,
                )}
              >
                {workspaceEyebrow}
              </span>
            </div>
            <nav
              aria-label={`${workspaceLabel} navigation`}
              className="overflow-x-auto border-t border-[color:var(--color-hairline)]"
            >
              <ul className="flex min-w-max">
                {nav.map((item) => {
                  const isActive = item.key === activeKey;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block whitespace-nowrap px-4 py-2.5 text-xs uppercase tracking-[0.18em]",
                          isActive
                            ? "border-b-2 border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
                            : "border-b-2 border-transparent text-[color:var(--color-ink-soft)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {banner}

          {/* Masthead */}
          <header className="relative overflow-hidden border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
            {/* Faint chevron motif in the top-right of every dashboard masthead */}
            <SAChevron
              variant="signature"
              className="pointer-events-none absolute -right-24 -top-12 size-[360px] opacity-[0.05]"
            />
            <div className="relative flex flex-col gap-4 px-5 py-8 md:flex-row md:items-end md:justify-between md:px-12 md:py-10">
              <div>
                {pageEyebrow && (
                  <div
                    className={cn(
                      "flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em]",
                      roleAccent.text,
                    )}
                  >
                    <SAChevron variant="mark" className="size-3" />
                    {pageEyebrow}
                  </div>
                )}
                <h1 className="mt-2 font-display text-3xl leading-tight md:text-5xl">
                  {pageTitle}
                </h1>
                {pageSubtitle && (
                  <p className="mt-2 max-w-2xl text-[color:var(--color-ink-soft)]">
                    {pageSubtitle}
                  </p>
                )}
              </div>
              {pageActions && (
                <div className="flex flex-wrap items-center gap-3">
                  {pageActions}
                </div>
              )}
            </div>
          </header>

          <main id="main" className="flex-1 px-5 py-8 md:px-12 md:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

const ROLE_ACCENT: Record<
  DashboardRole,
  { strip: string; text: string }
> = {
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
};
