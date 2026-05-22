import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { ForgotPasswordForm } from "@/components/feature/auth/ForgotPasswordForm";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.forgot");

  return (
    <AuthShell
      eyebrow="Account recovery"
      heading={t("heading")}
      subhead={t("subhead")}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
