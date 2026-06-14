/**
 * Phase 10.1  Employer help center index.
 *
 * Auth-gated like every other /employer/* surface. Hero search bar
 * (client island) on top, then 7 category sections rendered in the
 * order declared in `EMPLOYER_HELP_CATEGORIES`. URL state (`?q=`) is
 * read server-side so deep-links / refresh / share-link preserve the
 * search.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { verifyEmployer } from "@/lib/auth/dal";
import {
  EMPLOYER_HELP_ARTICLES,
  articlesByCategory,
} from "@/content/help/employer/_index";
import { EMPLOYER_HELP_CATEGORIES } from "@/content/help/types";
import { HelpSearchIsland } from "@/components/feature/help/HelpSearchIsland";
import { ChevronRight, ArrowUpRight } from "lucide-react";

export const revalidate = 0;

export default async function EmployerHelpIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyEmployer();
  const { q } = await searchParams;
  const initialQuery = q?.trim() ?? "";

  return (
    <DashboardMasthead
      role="employer"
      workspaceLabel={session.orgName ?? "Your organisation"}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="help"
      pageEyebrow="Documentation"
      pageTitle="Help center"
      pageSubtitle="Everything you can do as an employer on Sebenza  laid out by category, searchable, with deep-links back to the dashboard surfaces they cover. English only at v1; translations follow."
    >
      <HelpSearchIsland
        articles={EMPLOYER_HELP_ARTICLES.map((a) => a.meta)}
        initialQuery={initialQuery}
        basePath="/employer/help"
        categoryLabels={Object.fromEntries(
          EMPLOYER_HELP_CATEGORIES.map((c) => [c.value, c.label]),
        )}
        placeholder="Search the employer help center"
      />

      {/* Categories appear only when no search is active  the search
          island handles the "results" state above. */}
      {initialQuery.length === 0 && (
        <div className="space-y-12">
          {EMPLOYER_HELP_CATEGORIES.map((cat) => {
            const arts = articlesByCategory(cat.value);
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
                        href={`/employer/help/${art.meta.slug}` as never}
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
        Seeker, admin + government help centres land in Phase 10.2 / 10.3 / 10.4.
        Translations to isiZulu, isiXhosa + Afrikaans follow once the
        employer surface is proven  POPIA / consent copy is
        human-translated only.
      </p>
    </DashboardMasthead>
  );
}

/**
 * Phase 10.1  short label for the &ldquo;Try it&rdquo; chip on each
 * article card. We don&rsquo;t want raw URLs in the UI; this maps the
 * most-common surfaces to human labels. Unknown paths fall back to
 * the path itself (shouldn&rsquo;t happen in normal authoring).
 */
function dashboardLabelFor(surface: string): string {
  if (surface === "/employer") return "Overview";
  if (surface === "/employer/vacancies") return "Vacancies";
  if (surface === "/employer/vacancies/new") return "New vacancy form";
  if (surface === "/employer/placements") return "Employees";
  if (surface === "/employer/invites") return "Invites";
  if (surface === "/employer/saved-searches") return "Saved searches";
  if (surface === "/employer/shortlists") return "Talent pools";
  if (surface === "/employer/organisation") return "Organisation";
  if (surface === "/employer/onboarding") return "Onboarding";
  if (surface === "/employer/team") return "Team";
  if (surface === "/employer/notifications") return "Notifications";
  if (surface === "/employer/account") return "Account";
  if (surface === "/search") return "Talent search";
  return surface;
}
