import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SebenzaLogo } from "@/components/ui/SebenzaLogo";
import { MobileNav } from "@/components/layout/MobileNav";

/**
 * Landing-only header. Distinct from `SiteHeader` (used by all other pages)
 * so the new design can ship for review without disturbing the rest of the app.
 *
 * Editorial wordmark gets a small SA-flag chevron mark  quiet, confident,
 * national identity without flag-T-shirt energy.
 */
export function LandingHeader() {
  const t = useTranslations("nav");

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-[color:var(--color-sa-green-deep)] focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        {t("skipToContent")}
      </a>

      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 md:px-10">
        <Link
          href="/"
          aria-label="Sebenza  home"
          className="group flex items-center rounded-sm focus-visible:outline-none"
        >
          <SebenzaLogo width={170} />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-9 text-[0.78rem] uppercase tracking-[0.22em] text-[color:var(--color-sa-charcoal)] md:flex"
        >
          <Link
            href="/search"
            className="rounded-sm transition-colors hover:text-[color:var(--color-sa-green)]"
          >
            {t("findTalent")}
          </Link>
          <Link
            href="/insights"
            className="rounded-sm transition-colors hover:text-[color:var(--color-sa-green)]"
          >
            {t("insights")}
          </Link>
          <Link
            href="/dashboard"
            className="rounded-sm transition-colors hover:text-[color:var(--color-sa-green)]"
          >
            {t("createProfile")}
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>
          <Link
            href="/sign-in"
            className="hidden md:inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-[color:var(--color-sa-charcoal)] transition-colors hover:bg-[color:var(--color-sa-green-tint)]"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/sign-up"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-[color:var(--color-sa-charcoal)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-sa-cream)] shadow-press transition-transform hover:translate-y-[-1px]"
          >
            {t("signUp")}
            <span aria-hidden="true">↗</span>
          </Link>
          <MobileNav tone="hero" />
        </div>
      </div>
    </header>
  );
}
