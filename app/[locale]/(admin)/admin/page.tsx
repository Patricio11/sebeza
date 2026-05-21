import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { recentAuditEvents } from "@/lib/audit";
import { ShieldCheck } from "lucide-react";

// Phase 7 fills this out: verification queue, taxonomy, audit-log viewer.
// Phase 1 shows a credible scaffold with the audit-log viewer hooked to the
// in-memory ring buffer — so the demo proves PII access really IS being logged.
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const events = recentAuditEvents(30);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <header className="border-b-2 border-[color:var(--color-ink)]">
          <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8 md:py-14">
            <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Administrators only · 2FA required (Phase 7)
            </div>
            <h1 className="mt-2 font-display text-3xl md:text-5xl">{t("title")}</h1>
            <p className="mt-3 max-w-2xl text-[color:var(--color-ink-soft)]">
              {t("comingSoon")}
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
            Audit log · last 30 events
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              No PII access has happened yet this session. Visit /search or a
              profile and reload — every event will appear here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="py-2 font-normal">When</th>
                  <th className="py-2 font-normal">Kind</th>
                  <th className="py-2 font-normal">Actor</th>
                  <th className="py-2 font-normal">Subject</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr
                    key={i}
                    className="border-t border-[color:var(--color-hairline)] align-top"
                  >
                    <td className="py-2 text-xs text-[color:var(--color-ink-soft)]">
                      {new Date(e.at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="py-2 font-mono text-xs">{e.kind}</td>
                    <td className="py-2 text-xs">{e.actor}</td>
                    <td className="py-2 text-xs">{e.subject ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
