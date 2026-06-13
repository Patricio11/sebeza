/**
 * Phase 15.3.2  "Get work-ready" entry.
 *
 * A calm, progressive entry into the Phase 15.1 readiness collection +
 * the CV builder. Surfaces the 2-3 most relevant guides for this seeker
 * (D4: right moment, never a content dump), then a "see all" into the
 * `work_ready` help category. Two variants:
 *
 *   full     dashboard card (eyebrow + Fraunces heading + lead + cards)
 *   compact  a lighter strip for /dashboard/grow beside the Student lane
 *
 * Server component: resolves article titles/descriptions from the seeker
 * help registry (one source of truth  no duplicated copy). Relevance is
 * deterministic from lightweight profile context.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, BriefcaseBusiness, ChevronRight } from "lucide-react";
import { findArticleBySlug } from "@/content/help/seeker/_index";

export interface WorkReadyContext {
  /** Seeker has ≥1 open/pending vacancy invitation. */
  hasPendingInvites: boolean;
  /** Seeker has an academic record (student lane). */
  isStudent: boolean;
  /** Number of skills on the profile  thin profiles get the
   *  "skills you're still learning" nudge. */
  skillCount: number;
}

function pickSlugs(ctx: WorkReadyContext): string[] {
  // Everyone benefits from a CV; it leads.
  const out = ["build-your-cv"];
  if (ctx.hasPendingInvites) {
    out.push("prepare-for-an-interview", "spotting-job-scams");
  } else if (ctx.isStudent) {
    out.push("your-first-day", "skills-youre-still-learning");
  } else if (ctx.skillCount < 4) {
    out.push("skills-youre-still-learning", "prepare-for-an-interview");
  } else {
    out.push("prepare-for-an-interview", "workplace-rights-basics");
  }
  return out;
}

export async function GetWorkReadyCard({
  context,
  variant = "full",
}: {
  context: WorkReadyContext;
  variant?: "full" | "compact";
}) {
  const t = await getTranslations("seekerDash.workReady");
  const limit = variant === "compact" ? 2 : 3;
  const articles = pickSlugs(context)
    .map((slug) => findArticleBySlug(slug))
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .slice(0, limit);

  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="work-ready-h"
      className={
        variant === "full"
          ? "rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
          : "rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-5"
      }
    >
      <header className="mb-3">
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
          {t("eyebrow")}
        </p>
        <h2
          id="work-ready-h"
          className={
            variant === "full"
              ? "mt-1 font-display text-xl text-[color:var(--color-ink)]"
              : "mt-1 font-display text-lg text-[color:var(--color-ink)]"
          }
        >
          {t("title")}
        </h2>
        {variant === "full" && (
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {t("lead")}
          </p>
        )}
      </header>

      <ul className="divide-y divide-[color:var(--color-hairline)]">
        {articles.map((a) => {
          const href =
            a.meta.slug === "build-your-cv"
              ? "/dashboard/cv"
              : `/dashboard/help/${a.meta.slug}`;
          return (
            <li key={a.meta.slug}>
              <Link
                href={href as never}
                className="group flex min-h-[44px] items-center justify-between gap-3 py-3 no-underline"
              >
                <div className="min-w-0">
                  <p className="font-display text-[0.98rem] leading-tight text-[color:var(--color-ink)]">
                    {a.meta.title}
                  </p>
                  {variant === "full" && (
                    <p className="mt-0.5 line-clamp-2 text-[0.82rem] text-[color:var(--color-ink-soft)]">
                      {a.meta.shortDescription}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-[color:var(--color-ink-soft)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/dashboard/help#work_ready"
        className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[color:var(--color-brand-strong)] no-underline hover:underline"
      >
        {t("seeAll")}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
