import { SAChevron } from "@/components/ui/SAChevron";
import { cn } from "@/lib/utils";
import { BellSlot, ROLE_ACCENT, type DashboardRole } from "./dashboardChrome";

interface Props {
  role: DashboardRole;
  /** Page-level title rendered in the editorial masthead. */
  pageTitle: string;
  pageEyebrow?: string;
  /** Optional subtitle / explanation line under the page title. */
  pageSubtitle?: string;
  /** Optional right-aligned actions in the masthead. */
  pageActions?: React.ReactNode;
  /** Optional persistent banner above the masthead (e.g. org-unverified). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Per-page editorial masthead + main content region. Rendered as the page's
 * content root, it slots into the main column of the persistent
 * <DashboardFrame> (supplied by the route-group `layout.tsx`). On navigation
 * only this part is replaced — the sidebar stays mounted.
 */
export function DashboardMasthead({
  role,
  pageTitle,
  pageEyebrow,
  pageSubtitle,
  pageActions,
  banner,
  children,
}: Props) {
  const roleAccent = ROLE_ACCENT[role];

  return (
    <>
      {banner}

      {/* Masthead */}
      <header className="relative border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
        {/* Faint chevron motif — clipped to the masthead by its OWN wrapper so
            the header can stay overflow-visible and not clip descendant
            popovers (e.g. the notifications dropdown). */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <SAChevron
            variant="signature"
            className="absolute -right-24 -top-12 size-[360px] opacity-[0.05]"
          />
        </div>
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
          <div className="flex flex-wrap items-center gap-3">
            {/* Desktop-only bell — mobile uses the frame's top strip placement. */}
            <div className="hidden md:block">
              <BellSlot role={role} />
            </div>
            {pageActions}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 px-5 py-8 md:px-12 md:py-10">
        {children}
      </main>
    </>
  );
}
