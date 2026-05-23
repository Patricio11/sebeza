import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SAChevron } from "@/components/ui/SAChevron";

/**
 * Editorial multi-column footer. Carries the same flag stripe at its top edge
 * that the SiteHeader does, with a faint chevron motif anchoring the wordmark
 * column on the right. A national platform reads its credits like a public
 * document.
 */
export function SiteFooter() {
  const t = useTranslations("landing.footer");
  const tMeta = useTranslations("meta");

  return (
    <footer className="relative mt-32 overflow-hidden bg-[color:var(--color-ink)] text-[color:var(--color-paper)]">
      {/* Flag stripe at the very top, matching the header */}
      <div aria-hidden="true" className="flex h-[3px] w-full">
        <div className="flex-[3] bg-[color:var(--color-brand)]" />
        <div className="flex-[2] bg-[color:var(--color-accent)]" />
        <div className="flex-[1] bg-[color:var(--color-danger)]" />
      </div>

      {/* Faint chevron watermark in the corner */}
      <SAChevron
        variant="signature"
        className="pointer-events-none absolute -right-24 -top-12 size-[420px] opacity-[0.08]"
      />

      <div className="relative mx-auto max-w-[1320px] px-5 py-16 md:px-10 md:py-20">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-5">
            <Link
              href="/"
              className="inline-flex items-baseline gap-2 rounded-sm focus-visible:outline-none"
            >
              <SAChevron variant="mark" className="size-3.5 translate-y-[1px]" />
              <span className="font-display text-[1.75rem] leading-none">
                Sebenza
              </span>
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-[color:var(--color-paper)]/60">
                ZA
              </span>
            </Link>
            <p className="mt-5 max-w-md text-[color:var(--color-paper)]/75">
              {tMeta("description")}
            </p>

            {/* Trust strip */}
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-paper)]/60">
              <li>POPIA-first</li>
              <li aria-hidden="true" className="text-[color:var(--color-paper)]/30">
                ·
              </li>
              <li>WCAG 2.2 AA</li>
              <li aria-hidden="true" className="text-[color:var(--color-paper)]/30">
                ·
              </li>
              <li>Works on 3G</li>
              <li aria-hidden="true" className="text-[color:var(--color-paper)]/30">
                ·
              </li>
              <li>4 launch languages</li>
            </ul>
          </div>

          {/* Privacy & legal */}
          <FooterColumn heading={t("privacy")}>
            <FooterLink href="/privacy">{t("privacy")}</FooterLink>
            <FooterLink href="/paia">{t("paia")}</FooterLink>
            <FooterLink href="/terms">{t("terms")}</FooterLink>
            <FooterLink href="/accessibility">{t("accessibility")}</FooterLink>
          </FooterColumn>

          {/* Platform */}
          <FooterColumn heading="Platform">
            <FooterLink href="/search">Find talent</FooterLink>
            <FooterLink href="/dashboard">For seekers</FooterLink>
            <FooterLink href="/employer">For employers</FooterLink>
            <FooterLink href="/insights">Insights</FooterLink>
          </FooterColumn>

          {/* Language */}
          <div className="col-span-2 md:col-span-3">
            <h2 className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              {t("language")}
            </h2>
            <div className="mt-4">
              <LocaleSwitcher />
            </div>
            <p className="mt-4 text-[0.72rem] leading-snug text-[color:var(--color-paper)]/60">
              Tier 1 launch locales. Tier 2 &amp; 3 follow per ROADMAP §10.
              Legal copy is professionally translated  never machine-translated.
            </p>
          </div>
        </div>

        {/* Bottom band */}
        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-paper)]/15 pt-6 text-xs text-[color:var(--color-paper)]/60">
          <span>{t("rights")}</span>
          <span className="font-display italic">
            South African talent. Visible. In real time.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-span-1 md:col-span-2">
      <h2 className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
        {heading}
      </h2>
      <ul className="mt-4 space-y-2.5 text-sm text-[color:var(--color-paper)]/80">
        {Array.isArray(children) ? (
          children.map((child, i) => <li key={i}>{child}</li>)
        ) : (
          <li>{children}</li>
        )}
      </ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-sm transition-colors hover:text-[color:var(--color-accent)] hover:underline"
    >
      {children}
    </Link>
  );
}
