/**
 * Phase 10.1  Employer help article view.
 *
 * Renders one article's body inside the DashboardShell. Surfaces:
 *
 *   - Breadcrumb (Help center  Category  Title)
 *   - Article body (the default export of the article module)
 *   - "Try it now " CTA when meta.surfaceLink is set
 *   - Related articles strip (resolves slug references; ignores
 *     broken ones silently)
 *
 * 404 on unknown slug; uses Next.js's built-in notFound() so we
 * inherit the shared not-found shell.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  findArticleBySlug,
  EMPLOYER_HELP_ARTICLES,
} from "@/content/help/employer/_index";
import { EMPLOYER_HELP_CATEGORIES } from "@/content/help/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 0;

export default async function EmployerHelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();

  const article = findArticleBySlug(slug);
  if (!article) notFound();

  const categoryLabel =
    EMPLOYER_HELP_CATEGORIES.find((c) => c.value === article.meta.category)
      ?.label ?? article.meta.category;

  // Resolve related-article references. Broken slugs (typos in the
  // meta.related list) drop out silently; self-references are also
  // filtered out so an article can list its own slug without
  // duplicating itself in the strip.
  const relatedArticles = article.meta.related
    .filter((s) => s !== article.meta.slug)
    .map((s) => EMPLOYER_HELP_ARTICLES.find((a) => a.meta.slug === s))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  const Body = article.Article;

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="help"
      pageEyebrow={categoryLabel}
      pageTitle={article.meta.title}
      pageSubtitle={article.meta.shortDescription}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/employer/help"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Help center
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <Link
          href={`/employer/help#${article.meta.category}`}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          {categoryLabel}
        </Link>
      </div>

      <article className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8">
        <Body />
        <p className="mt-10 border-t border-dashed border-[color:var(--color-hairline)] pt-4 text-xs text-[color:var(--color-ink-soft)]">
          Last updated{" "}
          {new Date(article.meta.updatedAt).toLocaleDateString("en-ZA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          .
        </p>
      </article>

      {relatedArticles.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg text-[color:var(--color-ink)]">
            Related
          </h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {relatedArticles.map((r) => {
              const rCat =
                EMPLOYER_HELP_CATEGORIES.find(
                  (c) => c.value === r.meta.category,
                )?.label ?? r.meta.category;
              return (
                <li key={r.meta.slug}>
                  <Link
                    href={`/employer/help/${r.meta.slug}` as never}
                    className="group flex h-full items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 no-underline transition-colors hover:border-[color:var(--color-ink)]"
                  >
                    <div className="flex-1">
                      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                        {rCat}
                      </p>
                      <p className="mt-1 font-display text-base leading-tight text-[color:var(--color-ink)]">
                        {r.meta.title}
                      </p>
                      <p className="mt-1 text-[0.85rem] text-[color:var(--color-ink-soft)]">
                        {r.meta.shortDescription}
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-1 size-4 shrink-0 text-[color:var(--color-ink-soft)] transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </DashboardShell>
  );
}
