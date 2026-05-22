import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { dataProvider } from "@/lib/data/provider";
import { Plus, Pencil, GripVertical } from "lucide-react";

const MOCK_HANDLE = "andile-z";

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;

  const t = await getTranslations("seekerDash.experience");
  const items = me.experience ?? [];

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="experience"
      pageEyebrow="Track record"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <Button variant="primary" size="md">
          <Plus className="size-4" aria-hidden="true" />
          {t("add")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title={t("empty")}
          action={
            <Button variant="primary" size="md">
              <Plus className="size-4" aria-hidden="true" />
              {t("add")}
            </Button>
          }
        />
      ) : (
        <ol className="space-y-6">
          {items.map((e, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr_auto] items-start gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
            >
              <span className="mt-1 text-[color:var(--color-ink-soft)]">
                <GripVertical className="size-4" aria-hidden="true" />
              </span>
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  {e.startedAt} {t("to")}{" "}
                  {e.endedAt ?? (
                    <span className="text-[color:var(--color-accent)]">
                      {t("current")}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-display text-xl">{e.role}</div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {e.organization} · {e.city}
                </div>
                {e.description && (
                  <p className="mt-2 text-sm">{e.description}</p>
                )}
              </div>
              <button
                type="button"
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] p-2 text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
                aria-label="Edit experience"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </DashboardShell>
  );
}
