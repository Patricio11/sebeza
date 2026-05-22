import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { UserRound, Building2, ShieldCheck } from "lucide-react";

export const metadata = { title: "Get started" };

export default async function SignUpRoleChooserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.signUp");

  return (
    <AuthShell
      eyebrow={t("eyebrow")}
      heading={t("heading")}
      subhead={t("subhead")}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <RoleCard
          icon={<UserRound className="size-6" aria-hidden="true" />}
          eyebrow={t("seekerCard.eyebrow")}
          title={t("seekerCard.title")}
          body={t("seekerCard.body")}
          cta={t("seekerCard.cta")}
          href="/sign-up/seeker"
          tone="paper"
        />
        <RoleCard
          icon={<Building2 className="size-6" aria-hidden="true" />}
          eyebrow={t("employerCard.eyebrow")}
          title={t("employerCard.title")}
          body={t("employerCard.body")}
          cta={t("employerCard.cta")}
          href="/sign-up/employer"
          tone="ink"
        />
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] p-4 text-sm">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-[color:var(--color-ink)]"
          aria-hidden="true"
        />
        <p className="text-[color:var(--color-ink-soft)]">
          {t("adminNotice")}
        </p>
      </div>

      <p className="mt-8 text-sm text-[color:var(--color-ink-soft)]">
        {t("haveAccount")}{" "}
        <Link
          href="/sign-in"
          className="font-medium text-[color:var(--color-brand)] hover:underline"
        >
          {t("signInLink")}
        </Link>
      </p>
    </AuthShell>
  );
}

function RoleCard({
  icon,
  eyebrow,
  title,
  body,
  cta,
  href,
  tone,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: "/sign-up/seeker" | "/sign-up/employer";
  tone: "paper" | "ink";
}) {
  const dark = tone === "ink";
  return (
    <Link
      href={href}
      className={
        "group flex flex-col gap-4 rounded-[var(--radius-md)] border-2 p-6 transition-colors " +
        (dark
          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)] hover:bg-[color:var(--color-brand-strong)]"
          : "border-[color:var(--color-ink)] bg-[color:var(--color-paper)] hover:bg-[color:var(--color-surface-sunk)]")
      }
    >
      <span
        className={
          "inline-flex size-10 items-center justify-center rounded-full " +
          (dark
            ? "bg-[color:var(--color-accent)] text-[color:var(--color-ink)]"
            : "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]")
        }
      >
        {icon}
      </span>
      <div>
        <div
          className={
            "text-[0.7rem] uppercase tracking-[0.24em] " +
            (dark
              ? "text-[color:var(--color-accent)]"
              : "text-[color:var(--color-ink-soft)]")
          }
        >
          {eyebrow}
        </div>
        <div className="mt-1 font-display text-2xl">{title}</div>
      </div>
      <p
        className={
          dark
            ? "text-[color:var(--color-paper)]/80"
            : "text-[color:var(--color-ink-soft)]"
        }
      >
        {body}
      </p>
      <span
        className={
          "mt-auto inline-flex items-center gap-2 text-sm font-medium " +
          (dark
            ? "text-[color:var(--color-paper)]"
            : "text-[color:var(--color-brand)]")
        }
      >
        {cta}
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
