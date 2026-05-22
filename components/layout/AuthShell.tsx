import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SAChevron } from "@/components/ui/SAChevron";
import { cn } from "@/lib/utils";

interface Props {
  /** Eyebrow above the page headline (small caps). */
  eyebrow: string;
  /** Editorial heading (Fraunces). */
  heading: string;
  /** Optional muted subhead beneath the heading. */
  subhead?: string;
  /** Right-side dossier composition (kept editorial, sat below a thick rule). */
  rightAside?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Mzansi National auth shell. Flag stripe at the top, chevron mark in the
 * wordmark, faint chevron motif anchored to the right side of the page so
 * even single-form pages feel national. Demo-mode banner under the stripe
 * keeps the Phase 1.5 mock honest.
 */
export function AuthShell({
  eyebrow,
  heading,
  subhead,
  rightAside,
  children,
}: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--color-paper)]">
      {/* Flag stripe — same as the site header */}
      <div aria-hidden="true" className="flex h-[3px] w-full">
        <div className="flex-[3] bg-[color:var(--color-brand)]" />
        <div className="flex-[2] bg-[color:var(--color-accent)]" />
        <div className="flex-[1] bg-[color:var(--color-danger)]" />
      </div>

      {/* Faint chevron motif bleeding off the right edge of the page */}
      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -right-32 top-20 hidden size-[640px] opacity-[0.06] md:block"
      />

      <DemoBanner />

      {/* Wordmark bar */}
      <div className="relative border-b border-[color:var(--color-hairline)]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 md:px-10">
          <Link
            href="/"
            className="group flex items-baseline gap-2 rounded-sm focus-visible:outline-none"
          >
            <SAChevron variant="mark" className="size-3.5 translate-y-[1px]" />
            <span className="font-display text-[1.6rem] leading-none tracking-tight text-[color:var(--color-ink)]">
              Sebenza
            </span>
            <span className="text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              ZA
            </span>
          </Link>
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      <main className="relative mx-auto max-w-[1320px] px-5 py-12 md:px-10 md:py-20">
        <div
          className={cn(
            "grid grid-cols-1 gap-12 md:gap-20",
            rightAside ? "md:grid-cols-[1.05fr_0.95fr]" : "md:max-w-2xl",
          )}
        >
          <section className="anim-rise-soft">
            <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              {eyebrow}
            </div>
            <h1 className="mt-3 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.02em] text-[color:var(--color-ink)]">
              {heading}
            </h1>
            {subhead && (
              <p className="mt-4 max-w-md text-lg text-[color:var(--color-ink-soft)]">
                {subhead}
              </p>
            )}

            <div className="mt-10">{children}</div>
          </section>

          {rightAside && (
            <aside className="anim-rise-soft anim-delay-3 md:pt-10">
              <div className="border-t-2 border-[color:var(--color-ink)] pt-6">
                {rightAside}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="border-b border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent-tint)]">
      <div className="mx-auto flex max-w-[1320px] items-center gap-2 px-5 py-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)] md:justify-center md:px-10">
        <SAChevron variant="mark" className="size-3" />
        Demo mode · Phase 1.5 — no credentials are stored. Better Auth wires up
        in Phase 2.
      </div>
    </div>
  );
}
