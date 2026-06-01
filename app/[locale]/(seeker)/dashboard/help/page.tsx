/**
 * Phase 10.2 — seeker help center index.
 *
 * Mirrors the employer help index (`/employer/help`) but for the
 * (seeker) route group. Auth-gated by `verifyRole("seeker")`. Hero
 * search bar (client island) on top, then 7 category sections in the
 * order declared in `SEEKER_HELP_CATEGORIES`. URL state (`?q=`) is
 * read server-side so deep-links / refresh / share-link preserve the
 * search.
 *
 * Lessons from Phase 10.1 baked in (see PHASE_10_1_COMPLETE doc):
 *   - HelpSearchIsland is role-agnostic; we pass basePath + labels.
 *   - The article page wraps content in `max-w-3xl` at the page level
 *     (no double-constraint inside HelpProse).
 *   - No `updatedAt` is rendered in the article view.
 */

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { verifyRole } from "@/lib/auth/dal";
import { getMyProfile } from "@/lib/profile/me";
import {
  SEEKER_HELP_ARTICLES,
  articlesByCategory,
  visibleSeekerArticles,
} from "@/content/help/seeker/_index";
import { SEEKER_HELP_CATEGORIES } from "@/content/help/types";
import { HelpSearchIsland } from "@/components/feature/help/HelpSearchIsland";
import { ChevronRight, ArrowUpRight } from "lucide-react";

export const revalidate = 0;

export default async function SeekerHelpIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("seeker");
  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/help");
  const { q } = await searchParams;
  const initialQuery = q?.trim() ?? "";

  // Phase 13.7 follow-up  audience-gated visibility. Student-only
  // articles (Phase 13.1 modules / Phase 13.4 progression timeline)
  // never reach a seeker who isn't a student. The same predicate
  // narrows the search-island's input list so a student article
  // can't be searched into either.
  const isStudent = !!me.academic;
  const visibleArticles = visibleSeekerArticles(SEEKER_HELP_ARTICLES, {
    isStudent,
  });
  const visibleSlugs = new Set(visibleArticles.map((a) => a.meta.slug));

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName ?? "Your profile"}
      workspaceEyebrow="Seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="help"
      pageEyebrow="Documentation"
      pageTitle="Help center"
      pageSubtitle="Everything you can do as a job seeker on Sebenza  laid out by category, searchable, with deep-links back to the dashboard surfaces they cover. English only at v1; translations follow."
    >
      <HelpSearchIsland
        articles={visibleArticles.map((a) => a.meta)}
        initialQuery={initialQuery}
        basePath="/dashboard/help"
        categoryLabels={Object.fromEntries(
          SEEKER_HELP_CATEGORIES.map((c) => [c.value, c.label]),
        )}
        placeholder="Search the seeker help center"
      />

      {/* Categories appear only when no search is active  the search
          island handles the "results" state above. */}
      {initialQuery.length === 0 && (
        <div className="space-y-12">
          {SEEKER_HELP_CATEGORIES.map((cat) => {
            const arts = articlesByCategory(cat.value).filter((a) =>
              visibleSlugs.has(a.meta.slug),
            );
            if (arts.length === 0) return null;
            return (
              <section key={cat.value} id={cat.value}>
                <header className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-3">
                  <h2 className="font-display text-2xl text-[color:var(--color-ink)]">
                    {cat.label}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
                    {cat.description}
                  </p>
                </header>
                <ul className="grid gap-3 md:grid-cols-2">
                  {arts.map((art) => (
                    <li key={art.meta.slug}>
                      <Link
                        href={`/dashboard/help/${art.meta.slug}` as never}
                        className="group flex h-full items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 no-underline transition-colors hover:border-[color:var(--color-ink)]"
                      >
                        <div className="flex-1">
                          <p className="font-display text-base leading-tight text-[color:var(--color-ink)]">
                            {art.meta.title}
                          </p>
                          <p className="mt-1 text-[0.85rem] text-[color:var(--color-ink-soft)]">
                            {art.meta.shortDescription}
                          </p>
                          {art.meta.surfaceLink && (
                            <p className="mt-2 inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                              <ArrowUpRight
                                className="size-3"
                                aria-hidden="true"
                              />
                              {dashboardLabelFor(art.meta.surfaceLink)}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className="mt-1 size-4 shrink-0 text-[color:var(--color-ink-soft)] transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-12 text-xs italic text-[color:var(--color-ink-soft)]">
        Admin + government help centres land in Phase 10.3 / 10.4.
        Translations to isiZulu, isiXhosa + Afrikaans follow once the
        seeker surface is proven  POPIA / consent copy is
        human-translated only.
      </p>
    </DashboardShell>
  );
}

/**
 * Phase 10.2 — short label for the "Try it" chip on each article
 * card. Maps the most-common seeker surfaces to human labels. Unknown
 * paths fall back to the path itself (shouldn't happen in normal
 * authoring).
 */
function dashboardLabelFor(surface: string): string {
  if (surface === "/dashboard") return "Overview";
  if (surface === "/dashboard/profile") return "Profile editor";
  if (surface === "/dashboard/experience") return "Experience";
  if (surface === "/dashboard/qualifications") return "Qualifications";
  if (surface === "/dashboard/invitations") return "Vacancy invites";
  if (surface === "/dashboard/grow") return "Career compass";
  if (surface === "/dashboard/activity") return "Activity";
  if (surface === "/dashboard/notifications") return "Notifications";
  if (surface === "/dashboard/privacy") return "Privacy & consent";
  if (surface === "/dashboard/account") return "Account";
  return surface;
}
