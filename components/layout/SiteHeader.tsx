import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SebenzaLogo } from "@/components/ui/SebenzaLogo";
import { MobileNav } from "@/components/layout/MobileNav";

interface Props {
  variant?: "default" | "minimal";
}

/**
 * Internal-pages header. Carries the same SA-flag-derived chrome as the
 * landing: a slim flag band at the very top, then a sticky editorial bar
 * with the chevron-marked wordmark.
 */
export function SiteHeader({ variant = "default" }: Props) {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-30 bg-[color:var(--color-paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-paper)]/80">
      {/* Top flag band */}
      <div aria-hidden="true" className="flex h-[3px] w-full">
        <div className="flex-[3] bg-[color:var(--color-brand)]" />
        <div className="flex-[2] bg-[color:var(--color-accent)]" />
        <div className="flex-[1] bg-[color:var(--color-danger)]" />
      </div>

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-[color:var(--color-brand)] focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <div className="border-b border-[color:var(--color-hairline)]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-5 py-3 md:px-8">
          <Link
            href="/"
            aria-label="Sebenza  home"
            className="group flex items-center rounded-sm focus-visible:outline-none"
          >
            <SebenzaLogo width={140} />
          </Link>

          {variant === "default" && (
            <nav
              aria-label="Primary"
              className="hidden items-center gap-9 text-[0.78rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)] md:flex"
            >
              <Link
                href="/search"
                className="rounded-sm transition-colors hover:text-[color:var(--color-brand)]"
              >
                {t("findTalent")}
              </Link>
              <Link
                href="/insights"
                className="rounded-sm transition-colors hover:text-[color:var(--color-brand)]"
              >
                {t("insights")}
              </Link>
              <Link
                href="/dashboard"
                className="rounded-sm transition-colors hover:text-[color:var(--color-brand)]"
              >
                {t("createProfile")}
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:block">
              <LocaleSwitcher />
            </div>
            <Link
              href="/sign-in"
              className="hidden md:inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-brand-tint)]"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/sign-up"
              className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
            >
              {t("signUp")}
              <span aria-hidden="true">↗</span>
            </Link>
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
