import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { cn } from "@/lib/utils";

interface Props {
  /** Eyebrow above the page headline (small caps). */
  eyebrow: string;
  /** Editorial heading (Fraunces). */
  heading: string;
  /** Optional muted subhead beneath the heading. */
  subhead?: string;
  /** Mood — affects the right-hand "sidebar" composition. */
  rightAside?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Editorial auth shell. Two-up composition on desktop (form left, civic
 * dossier sidebar right), single column on mobile. Demo-mode banner sits at
 * the top so nobody confuses Phase 1.5 mock with real auth.
 */
export function AuthShell({
  eyebrow,
  heading,
  subhead,
  rightAside,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      {/* Slim top bar */}
      <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]/95">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3 md:px-8">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-xl leading-none">Sebenza</span>
            <span
              aria-hidden="true"
              className="inline-block size-1.5 translate-y-[-2px] rounded-full bg-[color:var(--color-accent)]"
            />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              ZA
            </span>
          </Link>
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      <DemoBanner />

      <main className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-20">
        <div
          className={cn(
            "grid grid-cols-1 gap-12 md:gap-20",
            rightAside ? "md:grid-cols-[1.05fr_0.95fr]" : "md:max-w-2xl",
          )}
        >
          <section>
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              {eyebrow}
            </div>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
              {heading}
            </h1>
            {subhead && (
              <p className="mt-3 max-w-md text-[color:var(--color-ink-soft)]">
                {subhead}
              </p>
            )}

            <div className="mt-10">{children}</div>
          </section>

          {rightAside && (
            <aside className="md:pt-12">
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
    <div className="border-b border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)]">
      <div className="mx-auto max-w-[1240px] px-5 py-2 text-center text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)] md:px-8">
        Demo mode · Phase 1.5 — no credentials are stored. Better Auth wires up
        in Phase 2.
      </div>
    </div>
  );
}
