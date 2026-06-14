/**
 * Phase 10.4 — gov help center index.
 *
 * Mirrors the employer / seeker / admin help indexes for the (gov)
 * route group. Auth-gated by `verifyGov()`. Hero search bar (client
 * island) on top, then 7 category sections in the order declared in
 * `GOV_HELP_CATEGORIES`. URL state (`?q=`) is read server-side so
 * deep-links / refresh / share-link preserve the search.
 *
 * Phase 10.1 post-ship fixes baked in: role-agnostic search island,
 * `max-w-3xl` reading column at the page level, no `updatedAt`
 * rendered in the article view.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";
import {
  GOV_HELP_ARTICLES,
  articlesByCategory,
} from "@/content/help/gov/_index";
import { GOV_HELP_CATEGORIES } from "@/content/help/types";
import { HelpSearchIsland } from "@/components/feature/help/HelpSearchIsland";
import { ChevronRight, ArrowUpRight } from "lucide-react";

export const revalidate = 0;

export default async function GovHelpIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyGov();
  const { q } = await searchParams;
  const initialQuery = q?.trim() ?? "";

  return (
    <DashboardMasthead
      role="gov"
      workspaceLabel={session.name ?? "Government workspace"}
      workspaceEyebrow="Government · analyst access"
      nav={GOV_NAV}
      activeKey="help"
      pageEyebrow="Documentation"
      pageTitle="Government help center"
      pageSubtitle="Everything a gov user can do on Sebenza  laid out by category, searchable, with deep-links back to the analytics surfaces they cover. Aggregate-only data; no individual seeker PII anywhere on this platform for gov users."
    >
      <HelpSearchIsland
        articles={GOV_HELP_ARTICLES.map((a) => a.meta)}
        initialQuery={initialQuery}
        basePath="/gov/help"
        categoryLabels={Object.fromEntries(
          GOV_HELP_CATEGORIES.map((c) => [c.value, c.label]),
        )}
        placeholder="Search the government help center"
      />

      {initialQuery.length === 0 && (
        <div className="space-y-12">
          {GOV_HELP_CATEGORIES.map((cat) => {
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
                        href={`/gov/help/${art.meta.slug}` as never}
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
        Phase 10.4 closes the four-role help-centre suite. Translation
        to isiZulu, isiXhosa + Afrikaans is deferred  the gov
        workspace is English-only in v1, and POPIA-grade copy is
        human-translated only.
      </p>
    </DashboardMasthead>
  );
}

function dashboardLabelFor(surface: string): string {
  if (surface === "/gov") return "Overview · LMI";
  if (surface === "/gov/provinces") return "Provinces";
  if (surface === "/gov/shortage") return "Shortage justification";
  if (surface === "/gov/opportunity") return "Local-hiring opportunity";
  if (surface === "/gov/curriculum") return "Curriculum vs demand";
  if (surface === "/gov/employer-lookup") return "Per-employer lookup";
  if (surface === "/gov/exports") return "Exports";
  if (surface === "/gov/brief") return "Policy brief";
  if (surface === "/gov/account") return "My account";
  return surface;
}
