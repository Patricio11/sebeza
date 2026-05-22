import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/Button";
import { MailCheck } from "lucide-react";

export const metadata = { title: "Check your inbox" };

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("auth.verify");
  const email = sp.email ?? "you@example.co.za";

  return (
    <AuthShell
      eyebrow="Verification"
      heading={t("heading")}
      subhead={t("subhead", { email })}
    >
      <div className="flex flex-col items-start gap-6">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
          <MailCheck className="size-8" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="md">
            {t("resend")}
          </Button>
          <Link
            href="/sign-up"
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-ink)]"
          >
            {t("wrongEmail")} {t("wrongEmailLink")}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
