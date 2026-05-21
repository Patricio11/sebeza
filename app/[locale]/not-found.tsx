import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="main" className="mx-auto max-w-[760px] px-5 py-24 md:py-32">
        <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          404 · Page not found
        </div>
        <h1 className="mt-2 font-display text-5xl leading-tight md:text-7xl">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-4 max-w-md text-[color:var(--color-ink-soft)]">
          {t("notFoundBody")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          {t("home")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
