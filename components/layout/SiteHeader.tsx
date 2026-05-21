import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";

interface Props {
  variant?: "default" | "minimal";
}

/**
 * Editorial masthead. Wordmark in Fraunces sits on a thin hairline rule; nav
 * links sit in small-caps Hanken with letterspacing. Deliberately not a chunky
 * "SaaS navbar".
 */
export function SiteHeader({ variant = "default" }: Props) {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-paper)]/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-[color:var(--color-brand)] focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-5 py-3 md:px-8">
        <Link
          href="/"
          className="group flex items-baseline gap-2 rounded-sm focus-visible:outline-none"
        >
          <Wordmark />
        </Link>

        {variant === "default" && (
          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 text-[0.78rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] md:flex"
          >
            <Link
              href="/search"
              className="rounded-sm hover:text-[color:var(--color-ink)]"
            >
              {t("findTalent")}
            </Link>
            <Link
              href="/insights"
              className="rounded-sm hover:text-[color:var(--color-ink)]"
            >
              {t("insights")}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-sm hover:text-[color:var(--color-ink)]"
            >
              {t("createProfile")}
            </Link>
          </nav>
        )}

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
          >
            {t("signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-display text-[1.6rem] leading-none tracking-tight text-[color:var(--color-ink)]">
        Sebenza
      </span>
      <span
        aria-hidden="true"
        className="inline-block size-1.5 translate-y-[-2px] rounded-full bg-[color:var(--color-accent)]"
      />
      <span className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        ZA
      </span>
    </span>
  );
}
