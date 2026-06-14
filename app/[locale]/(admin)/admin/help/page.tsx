/**
 * Phase 10.3 — admin help center index.
 *
 * Mirrors the employer + seeker help indexes for the (admin) route
 * group. Auth-gated by `verifyAdmin()`. Hero search bar (client
 * island) on top, then 7 category sections in the order declared in
 * `ADMIN_HELP_CATEGORIES`. URL state (`?q=`) is read server-side so
 * deep-links / refresh / share-link preserve the search.
 *
 * All three Phase 10.1 post-ship fixes baked in (see
 * PHASE_10_1_COMPLETE doc): role-agnostic search island via
 * basePath + categoryLabels props; max-w-3xl reading column at the
 * page level (article view); no `updatedAt` rendered.
 */

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  ADMIN_HELP_ARTICLES,
  articlesByCategory,
} from "@/content/help/admin/_index";
import { ADMIN_HELP_CATEGORIES } from "@/content/help/types";
import { HelpSearchIsland } from "@/components/feature/help/HelpSearchIsland";
import { ChevronRight, ArrowUpRight } from "lucide-react";

export const revalidate = 0;

export default async function AdminHelpIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const { q } = await searchParams;
  const initialQuery = q?.trim() ?? "";

  return (
    <DashboardMasthead
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="help"
      pageEyebrow="Documentation"
      pageTitle="Admin help center"
      pageSubtitle="Everything an admin can do on the platform  laid out by category, searchable, with deep-links back to the console surfaces they cover. Internal-only; never reachable from public routes."
    >
      <HelpSearchIsland
        articles={ADMIN_HELP_ARTICLES.map((a) => a.meta)}
        initialQuery={initialQuery}
        basePath="/admin/help"
        categoryLabels={Object.fromEntries(
          ADMIN_HELP_CATEGORIES.map((c) => [c.value, c.label]),
        )}
        placeholder="Search the admin help center"
      />

      {initialQuery.length === 0 && (
        <div className="space-y-12">
          {ADMIN_HELP_CATEGORIES.map((cat) => {
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
                        href={`/admin/help/${art.meta.slug}` as never}
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
        Government help centre lands in Phase 10.4. Translations to
        isiZulu, isiXhosa + Afrikaans are deliberately deferred for
        admin docs  the console is English-only for trained staff,
        and POPIA / consent copy is human-translated only.
      </p>
    </DashboardMasthead>
  );
}

function dashboardLabelFor(surface: string): string {
  if (surface === "/admin") return "Overview";
  if (surface === "/admin/verifications") return "Verification queue";
  if (surface === "/admin/moderation") return "Moderation";
  if (surface === "/admin/taxonomy") return "Taxonomy";
  if (surface === "/admin/taxonomy/suggestions") return "Suggestion queue";
  if (surface === "/admin/audit-log") return "Audit log";
  if (surface === "/admin/oversight") return "Oversight log";
  if (surface === "/admin/users") return "Users";
  if (surface === "/admin/notifications") return "Notifications";
  if (surface === "/admin/settings") return "Platform settings";
  if (surface === "/admin/account") return "My account";
  return surface;
}
