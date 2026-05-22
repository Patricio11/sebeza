import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Button } from "@/components/ui/Button";
import { verifyRole } from "@/lib/auth/dal";
import { Plus, Pencil, Trash2, Bell } from "lucide-react";

interface SavedSearch {
  name: string;
  query: Record<string, string>;
  lastRun: string;
  newMatches: number;
  detail: string;
}

const SAVED: SavedSearch[] = [
  {
    name: "Senior Software Developer · Gauteng",
    query: { q: "developer", province: "gauteng", seniority: "senior" },
    lastRun: "2 hours ago",
    newMatches: 4,
    detail: "Verified · TypeScript · React",
  },
  {
    name: "Pastry Chef · Western Cape",
    query: { q: "chef", province: "western-cape", status: "open_to_work" },
    lastRun: "Yesterday",
    newMatches: 2,
    detail: "Open to work · Pastry · Cape Town & George",
  },
  {
    name: "Trade-tested Electrician",
    query: { q: "electrician", verification: "verified" },
    lastRun: "3 days ago",
    newMatches: 0,
    detail: "Verified · INDLELA · National",
  },
  {
    name: "Paediatric Nurse · KZN",
    query: { q: "nurse", province: "kwazulu-natal", seniority: "senior" },
    lastRun: "1 week ago",
    newMatches: 1,
    detail: "Senior · Paediatrics · Durban",
  },
];

export default async function SavedSearchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("employer");
  const t = await getTranslations("employerDash.savedSearches");
  const tOuter = await getTranslations("employerDash");

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="savedSearches"
      pageEyebrow="Reusable filters"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      }
      banner={
        <OrgVerificationBanner
          message={tOuter("orgUnverifiedBanner")}
          cta={tOuter("orgUnverifiedCta")}
        />
      }
    >
      <ul className="space-y-3">
        {SAVED.map((s, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto_auto] md:items-center"
          >
            <div>
              <Link
                href={{ pathname: "/search", query: s.query }}
                className="font-display text-xl hover:underline"
              >
                {s.name}
              </Link>
              <div className="text-sm text-[color:var(--color-ink-soft)]">
                {s.detail}
              </div>
              <div className="mt-1.5 text-xs text-[color:var(--color-ink-soft)]">
                {t("lastRun", { when: s.lastRun })}
                {s.newMatches > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-[color:var(--color-accent)]">
                      {t("newMatches", { n: s.newMatches })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Link
              href={{ pathname: "/search", query: s.query }}
              className="text-sm text-[color:var(--color-brand)] hover:underline"
            >
              Run search →
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Alerts"
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
              >
                <Bell className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("edit")}
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("delete")}
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
