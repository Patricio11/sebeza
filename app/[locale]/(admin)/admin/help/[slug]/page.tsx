/**
 * Phase 10.3 — admin help article view.
 *
 * Renders one admin article's body inside the DashboardShell.
 * Auth-gated by `verifyAdmin()`. 404 on unknown slug.
 *
 * Phase 10.1 post-ship fixes baked in:
 *   - Reading column wrapped in `mx-auto max-w-3xl` at the page
 *     level (HelpProse itself is width-agnostic).
 *   - Related strip is 2 columns at this width.
 *   - No `meta.updatedAt` rendered — kept in meta for editorial
 *     discipline only.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  findArticleBySlug,
  ADMIN_HELP_ARTICLES,
} from "@/content/help/admin/_index";
import { ADMIN_HELP_CATEGORIES } from "@/content/help/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 0;

export default async function AdminHelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  const article = findArticleBySlug(slug);
  if (!article) notFound();

  const categoryLabel =
    ADMIN_HELP_CATEGORIES.find((c) => c.value === article.meta.category)
      ?.label ?? article.meta.category;

  const relatedArticles = article.meta.related
    .filter((s) => s !== article.meta.slug)
    .map((s) => ADMIN_HELP_ARTICLES.find((a) => a.meta.slug === s))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  const Body = article.Article;

  return (
    <DashboardMasthead
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="help"
      pageEyebrow={categoryLabel}
      pageTitle={article.meta.title}
      pageSubtitle={article.meta.shortDescription}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/help"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Admin help
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <Link
          href={`/admin/help#${article.meta.category}`}
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
                  ADMIN_HELP_CATEGORIES.find(
                    (c) => c.value === r.meta.category,
                  )?.label ?? r.meta.category;
                return (
                  <li key={r.meta.slug}>
                    <Link
                      href={`/admin/help/${r.meta.slug}` as never}
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
