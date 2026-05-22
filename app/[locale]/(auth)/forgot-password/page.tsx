import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.forgot");
  const tCommon = await getTranslations("auth.common");

  return (
    <AuthShell
      eyebrow="Account recovery"
      heading={t("heading")}
      subhead={t("subhead")}
    >
      <form action="/verify-email" method="get" className="flex flex-col gap-6">
        <TextField
          id="email"
          name="email"
          label={tCommon("email")}
          type="email"
          autoComplete="email"
          required
        />
        <Button type="submit" variant="primary" size="lg">
          {t("submit")}
        </Button>
        <Link
          href="/sign-in"
          className="text-sm text-[color:var(--color-brand)] hover:underline"
        >
          ← {t("back")}
        </Link>
      </form>
    </AuthShell>
  );
}
