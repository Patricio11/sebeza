import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TalentRosterItem } from "@/components/ui/TalentRosterItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataProvider } from "@/lib/data/provider";
import { Bookmark, ShieldCheck, Users2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Mock employer dashboard. Phase 5 wires real orgs + verification + reveal flows.
const ORG_VERIFIED = false; // demo: show the unverified banner state

export default async function EmployerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("dashboard.employer");
  const search = await dataProvider.searchProfiles({
    query: "developer",
    province: "gauteng",
    highlightCitizens: false,
  });
  const recent = search.profiles.slice(0, 2);

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Masthead */}
        <header className="border-b-2 border-[color:var(--color-ink)]">
          <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
            <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
              Employer portal · Discovery Bank
            </div>
            <h1 className="mt-2 font-display text-3xl md:text-5xl">
              {t("title")}
            </h1>
          </div>
        </header>

        {!ORG_VERIFIED && (
          <div className="border-b border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)]">
            <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
              <div className="flex items-start gap-2 md:items-center">
                <ShieldCheck
                  className="size-5 shrink-0 text-[color:var(--color-accent)]"
                  aria-hidden="true"
                />
                <p className="text-sm">
                  <span className="font-medium">Organisation not verified.</span>{" "}
                  {t("orgUnverifiedBanner")}
                </p>
              </div>
              <button
                type="button"
                className="self-start rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-paper)] md:self-auto"
              >
                {t("orgUnverifiedCta")}
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-10 px-5 py-10 md:grid-cols-[280px_1fr] md:gap-12 md:px-8">
          {/* Sidebar: saved searches + shortlists */}
          <aside className="space-y-8">
            <section aria-labelledby="saved-h">
              <header className="mb-3 flex items-center gap-2 border-b-2 border-[color:var(--color-ink)] pb-1.5">
                <Bookmark className="size-4 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
                <h2 id="saved-h" className="font-display text-lg">
                  {t("savedSearches")}
                </h2>
              </header>
              <ul className="space-y-2 text-sm">
                <SavedSearch
                  query="Software Developer"
                  filters={{ q: "developer", province: "gauteng" }}
                  detail="Senior · Verified · Gauteng"
                />
                <SavedSearch
                  query="Chef"
                  filters={{ q: "chef", province: "western-cape", status: "open_to_work" }}
                  detail="Open to work · Western Cape"
                />
                <SavedSearch
                  query="Electrician"
                  filters={{ q: "electrician", verification: "verified" }}
                  detail="Verified · trade-tested"
                />
              </ul>
            </section>

            <section aria-labelledby="lists-h">
              <header className="mb-3 flex items-center gap-2 border-b-2 border-[color:var(--color-ink)] pb-1.5">
                <Users2 className="size-4 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
                <h2 id="lists-h" className="font-display text-lg">
                  {t("shortlists")}
                </h2>
              </header>
              <ul className="space-y-2 text-sm">
                <Shortlist name="Q2 engineering hires" count={6} />
                <Shortlist name="Pastry pop-up" count={3} />
              </ul>
            </section>
          </aside>

          {/* Main: recent matches with "mark as hired" lever */}
          <section aria-labelledby="match-h">
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
              <h2 id="match-h" className="font-display text-2xl">
                Recent matches — Software Developer, Gauteng
              </h2>
              <Link
                href={{ pathname: "/search", query: { q: "developer", province: "gauteng" } }}
                className="text-sm text-[color:var(--color-brand)] hover:underline"
              >
                Refine in search →
              </Link>
            </header>

            {recent.length === 0 ? (
              <EmptyState
                title="No matches in this saved search"
                body="Broaden your filters, or save the gap — we feed it into national skills-gap analytics."
              />
            ) : (
              <ol className="border-t border-[color:var(--color-hairline)]">
                {recent.map((p) => (
                  <li key={p.handle}>
                    <TalentRosterItem profile={p} locale={locale} />
                    <PlacementNudge />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function SavedSearch({
  query,
  filters,
  detail,
}: {
  query: string;
  filters: Record<string, string>;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={{ pathname: "/search", query: filters }}
        className="block rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 hover:border-[color:var(--color-ink)]"
      >
        <div className="font-display text-base">{query}</div>
        <div className="text-xs text-[color:var(--color-ink-soft)]">{detail}</div>
      </Link>
    </li>
  );
}

function Shortlist({ name, count }: { name: string; count: number }) {
  return (
    <li className="flex items-baseline justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3">
      <span className="font-display">{name}</span>
      <span className="font-display tabular text-[color:var(--color-ink-soft)]">
        {count}
      </span>
    </li>
  );
}

function PlacementNudge() {
  return (
    <div className="-mt-2 mb-4 ml-16 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-3 py-2 text-sm">
      <span className="text-[color:var(--color-brand-strong)]">
        Hired this candidate? Help map SA&apos;s job market — confirming hires
        keeps national data honest.
      </span>
      <button
        type="button"
        className="rounded-[var(--radius-pill)] bg-[color:var(--color-brand)] px-3 py-1 text-xs font-medium text-white"
      >
        Mark as hired
      </button>
    </div>
  );
}
