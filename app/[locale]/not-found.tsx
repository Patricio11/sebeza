import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SAChevron } from "@/components/ui/SAChevron";
import { getLocale, getTranslations } from "next-intl/server";
import { localePath } from "@/lib/seo";
import type { AppLocale } from "@/i18n/routing";
import { Search, ArrowUpRight } from "lucide-react";

/**
 * The branded 404 (docs/ERROR_PAGES_404_PLAN.md).
 *
 * Civic-Editorial in full voice: the giant Fraunces numerals ARE the
 * design, with the flag stripe and bulletin eyebrow keeping it
 * unmistakably Sebenza. A lost visitor gets the platform's most useful
 * action right here: a ZERO-JS search form (plain GET to /search, so
 * it works before hydration, on 3G, always) plus quick links to the
 * places people actually mean to go.
 *
 * Reached by every unknown path via the `[...rest]` catch-all, so no
 * URL shape ever falls through to a plain default page.
 */
export default async function NotFound() {
  const t = await getTranslations("errors");
  const locale = await getLocale();

  return (
    <>
      <SiteHeader variant="minimal" />
      <main
        id="main"
        className="relative overflow-hidden bg-[color:var(--color-paper)]"
      >
        {/* Flag stripe: even the dead ends carry the colours. */}
        <div aria-hidden="true" className="flex h-[3px] w-full">
          <div className="flex-[3] bg-[color:var(--color-brand)]" />
          <div className="flex-[2] bg-[color:var(--color-accent)]" />
          <div className="flex-[1] bg-[color:var(--color-danger)]" />
        </div>

        <SAChevron
          variant="signature"
          className="pointer-events-none absolute -right-32 -top-16 size-[600px] opacity-[0.07]"
        />

        <div className="relative mx-auto max-w-[860px] px-5 py-16 md:py-24">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <SAChevron variant="mark" className="size-3" />
            {t("notFoundEyebrow")}
          </div>

          {/* The numerals are the artwork: paper, ink, one italic accent. */}
          <p
            aria-hidden="true"
            className="mt-2 font-display text-[clamp(6rem,22vw,13rem)] leading-[0.85] tracking-[-0.04em] text-[color:var(--color-ink)]"
          >
            4<span className="italic text-[color:var(--color-accent)]">0</span>4
          </p>

          <h1 className="mt-4 font-display text-3xl leading-[1.05] tracking-[-0.015em] md:text-4xl">
            {t("notFoundTitle")}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[color:var(--color-ink-soft)]">
            {t("notFoundBody")}
          </p>

          {/* The most useful thing on a dead end: the register itself.
              Plain GET form: zero JS, works before hydration, on 3G. */}
          <form
            action={localePath(locale as AppLocale, "/search")}
            method="get"
            className="mt-8 flex max-w-lg items-stretch overflow-hidden rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] focus-within:ring-2 focus-within:ring-[color:var(--color-brand)]/30"
          >
            <label htmlFor="nf-q" className="sr-only">
              {t("notFoundSearchLabel")}
            </label>
            <input
              id="nf-q"
              name="q"
              type="search"
              placeholder={t("notFoundSearchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent px-5 py-3 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-soft)] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-[color:var(--color-ink)] px-5 text-sm font-medium text-[color:var(--color-paper)] transition-colors hover:bg-[color:var(--color-brand-strong)]"
            >
              <Search className="size-4" aria-hidden="true" />
              {t("notFoundSearchCta")}
            </button>
          </form>

          {/* Where people usually meant to go. */}
          <div className="mt-10 border-t border-[color:var(--color-hairline)] pt-6">
            <p className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              {t("notFoundLinksLabel")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { href: "/", label: t("home") },
                  { href: "/search", label: t("notFoundLinkSearch") },
                  { href: "/insights", label: t("notFoundLinkInsights") },
                  { href: "/sign-up/seeker", label: t("notFoundLinkSignUp") },
                  { href: "/marketing", label: t("notFoundLinkAbout") },
                ] as const
              ).map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href as never}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-2 text-sm text-[color:var(--color-ink)] transition-colors hover:border-[color:var(--color-ink)]"
                  >
                    {l.label}
                    <ArrowUpRight
                      className="size-3.5 text-[color:var(--color-brand-strong)]"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
