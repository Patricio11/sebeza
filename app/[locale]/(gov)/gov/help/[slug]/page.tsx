/**
 * Phase 10.4 — gov help article view.
 *
 * Renders one article's body inside the DashboardShell. Auth-gated
 * by `verifyGov()`. 404 on unknown slug.
 *
 * Phase 10.1 post-ship fixes baked in:
 *   - Reading column wrapped in `mx-auto max-w-3xl` at the page level
 *     (HelpProse stays width-agnostic).
 *   - Related strip is 2 columns at this width.
 *   - No `meta.updatedAt` rendered — kept in meta for editorial
 *     discipline only.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyGov } from "@/lib/auth/dal";
import {
  findArticleBySlug,
  GOV_HELP_ARTICLES,
} from "@/content/help/gov/_index";
import { GOV_HELP_CATEGORIES } from "@/content/help/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 0;

export default async function GovHelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await verifyGov();

  const article = findArticleBySlug(slug);
  if (!article) notFound();

  const categoryLabel =
    GOV_HELP_CATEGORIES.find((c) => c.value === article.meta.category)
      ?.label ?? article.meta.category;

  const relatedArticles = article.meta.related
    .filter((s) => s !== article.meta.slug)
    .map((s) => GOV_HELP_ARTICLES.find((a) => a.meta.slug === s))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  const Body = article.Article;

  return (
    <DashboardMasthead
      role="gov"
      pageEyebrow={categoryLabel}
      pageTitle={article.meta.title}
      pageSubtitle={article.meta.shortDescription}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/gov/help"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Gov help
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <Link
          href={`/gov/help#${article.meta.category}`}
          className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          {categoryLabel}
        </Link>
      </div>

      <div className="mx-auto max-w-3xl">
        <article className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 md:p-8">
          <Body />
        </article>

        {relatedArticles.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-lg text-[color:var(--color-ink)]">
              Related
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {relatedArticles.map((r) => {
                const rCat =
                  GOV_HELP_CATEGORIES.find(
                    (c) => c.value === r.meta.category,
                  )?.label ?? r.meta.category;
                return (
                  <li key={r.meta.slug}>
                    <Link
                      href={`/gov/help/${r.meta.slug}` as never}
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
      </div>
    </DashboardMasthead>
  );
}
