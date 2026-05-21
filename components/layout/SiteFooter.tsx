import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";

/**
 * Editorial multi-column footer with a thick top rule. Civic tone — a
 * national platform reads its credits like a public document.
 */
export function SiteFooter() {
  const t = useTranslations("landing.footer");
  const tMeta = useTranslations("meta");

  return (
    <footer className="mt-24 border-t-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-x-8 gap-y-10 px-5 py-12 md:grid-cols-4 md:px-8">
        <div className="col-span-2 md:col-span-1">
          <div className="font-display text-2xl leading-none text-[color:var(--color-ink)]">
            Sebenza
          </div>
          <p className="mt-3 max-w-xs text-sm text-[color:var(--color-ink-soft)]">
            {tMeta("description")}
          </p>
        </div>

        <FooterColumn heading={t("privacy")}>
          <FooterLink href="/privacy">{t("privacy")}</FooterLink>
          <FooterLink href="/paia">{t("paia")}</FooterLink>
          <FooterLink href="/terms">{t("terms")}</FooterLink>
          <FooterLink href="/accessibility">{t("accessibility")}</FooterLink>
        </FooterColumn>

        <FooterColumn heading="Platform">
          <FooterLink href="/search">Find talent</FooterLink>
          <FooterLink href="/dashboard">For seekers</FooterLink>
          <FooterLink href="/employer">For employers</FooterLink>
          <FooterLink href="/insights">Insights</FooterLink>
        </FooterColumn>

        <FooterColumn heading={t("language")}>
          <LocaleSwitcher />
          <p className="mt-3 text-[0.72rem] leading-snug text-[color:var(--color-ink-soft)]">
            Tier 1 launch locales. Tier 2 &amp; 3 follow per ROADMAP §10. Legal
            copy is professionally translated — never machine-translated.
          </p>
        </FooterColumn>
      </div>

      <div className="border-t border-[color:var(--color-hairline)]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-[color:var(--color-ink-soft)] md:px-8">
          <span>{t("rights")}</span>
          <span className="uppercase tracking-[0.18em]">
            POPIA · WCAG 2.2 AA · No-Flash
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
    <div>
      <h2 className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
        {heading}
      </h2>
      <ul className="mt-3 space-y-2 text-sm text-[color:var(--color-ink-soft)]">
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
      className="rounded-sm hover:text-[color:var(--color-ink)] hover:underline"
    >
      {children}
    </Link>
  );
}
