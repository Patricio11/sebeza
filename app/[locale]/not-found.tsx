import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SAChevron } from "@/components/ui/SAChevron";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <>
      <SiteHeader variant="minimal" />
      <main
        id="main"
        className="relative overflow-hidden bg-[color:var(--color-paper)]"
      >
        <SAChevron
          variant="signature"
          className="pointer-events-none absolute -right-32 -top-16 size-[600px] opacity-[0.07]"
        />
        <div className="relative mx-auto max-w-[860px] px-5 py-24 md:py-36">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <SAChevron variant="mark" className="size-3" />
            404 · Page not found
          </div>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.98] tracking-[-0.02em]">
            {t("notFoundTitle")}
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[color:var(--color-ink-soft)]">
            {t("notFoundBody")}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-3 text-sm font-medium text-[color:var(--color-paper)] shadow-press transition-transform hover:-translate-y-0.5"
          >
            {t("home")}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
