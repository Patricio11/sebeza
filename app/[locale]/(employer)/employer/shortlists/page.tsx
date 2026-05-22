import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EMPLOYER_NAV, MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { OrgVerificationBanner } from "@/components/layout/OrgVerificationBanner";
import { Button } from "@/components/ui/Button";
import { verifyRole } from "@/lib/auth/dal";
import { Plus, Users2, Share2 } from "lucide-react";

interface Pool {
  name: string;
  members: number;
  detail: string;
  city: string;
  updated: string;
}

const POOLS: Pool[] = [
  { name: "Q2 engineering hires", members: 6, detail: "Senior · Gauteng + remote", city: "Gauteng", updated: "Yesterday" },
  { name: "Pastry pop-up · Sea Point", members: 3, detail: "Open to work · 8 weeks", city: "Western Cape", updated: "3 days ago" },
  { name: "Trade test electricians", members: 12, detail: "Verified · INDLELA", city: "National", updated: "1 week ago" },
];

export default async function ShortlistsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyRole("employer");
  const t = await getTranslations("employerDash.shortlists");
  const tOuter = await getTranslations("employerDash");

  return (
    <DashboardShell
      role="employer"
      workspaceLabel={MOCK_EMPLOYER.orgName}
      workspaceEyebrow="Employer · workspace"
      nav={EMPLOYER_NAV}
      activeKey="shortlists"
      pageEyebrow="Curated"
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
      <ul className="grid gap-4 md:grid-cols-2">
        {POOLS.map((p, i) => (
          <li
            key={i}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
          >
            <header className="flex items-baseline justify-between">
              <h2 className="font-display text-xl">{p.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                <Users2 className="size-3" aria-hidden="true" />
                {t("members", { n: p.members })}
              </span>
            </header>
            <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
              {p.detail} · {p.city}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Last updated {p.updated}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Button variant="secondary" size="sm">{t("open")}</Button>
              <Button variant="ghost" size="sm">
                <Share2 className="size-4" aria-hidden="true" />
                {t("share")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
