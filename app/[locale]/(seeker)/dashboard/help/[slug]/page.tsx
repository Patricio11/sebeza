/**
 * Phase 10.2 — seeker help article view.
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
 *
 * Phase 10.1 post-ship fixes baked in:
 *   - Reading column wrapped in `mx-auto max-w-3xl` at the page
 *     level (HelpProse itself is width-agnostic).
 *   - Related strip is 2 columns at this width.
 *   - No `meta.updatedAt` rendered — kept in meta for editorial
 *     discipline only.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import {
  findArticleBySlug,
  SEEKER_HELP_ARTICLES,
  isArticleVisible,
} from "@/content/help/seeker/_index";
import { SEEKER_HELP_CATEGORIES } from "@/content/help/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const revalidate = 0;

export default async function SeekerHelpArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) redirect(`/sign-in?next=/dashboard/help/${slug}`);

  const article = findArticleBySlug(slug);
  if (!article) notFound();

  // Phase 13.7 follow-up  audience gate. A non-student seeker
  // direct-linked to a student-only article (Phase 13.1 modules /
  // Phase 13.4 progression timeline) lands on a 404 rather than an
  // article describing a surface they can't reach. Same notFound()
  // shape as an unknown slug so the trail doesn't leak the
  // article's existence to a viewer who can't see it.
  const ctx = { isStudent: !!me.academic };
  if (!isArticleVisible(article, ctx)) notFound();

  const categoryLabel =
    SEEKER_HELP_CATEGORIES.find((c) => c.value === article.meta.category)
      ?.label ?? article.meta.category;

  // Resolve related-article references. Broken slugs (typos in the
  // meta.related list) drop out silently; self-references are also
  // filtered out so an article can list its own slug without
  // duplicating itself in the strip. Audience-gated articles drop
  // out for non-matching viewers, mirroring the slug-page gate
  // above  the related strip never invites a viewer to a 404.
  const relatedArticles = article.meta.related
    .filter((s) => s !== article.meta.slug)
    .map((s) => SEEKER_HELP_ARTICLES.find((a) => a.meta.slug === s))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .filter((a) => isArticleVisible(a, ctx));

  const Body = article.Article;

  return (
    <DashboardMasthead
      role="seeker"
      workspaceLabel={me.displayName ?? "Your profile"}
      workspaceEyebrow="Seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="help"
      pageEyebrow={categoryLabel}
      pageTitle={article.meta.title}
      pageSubtitle={article.meta.shortDescription}
    >
      <div className="-mt-2 mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Help center
        </Link>
        <span aria-hidden="true" className="text-[color:var(--color-ink-soft)]">
          ·
        </span>
        <Link
          href={`/dashboard/help#${article.meta.category}`}
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
                  SEEKER_HELP_CATEGORIES.find(
                    (c) => c.value === r.meta.category,
                  )?.label ?? r.meta.category;
                return (
                  <li key={r.meta.slug}>
                    <Link
                      href={`/dashboard/help/${r.meta.slug}` as never}
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
