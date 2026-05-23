import { setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { TwoFactorVerifyForm } from "@/components/feature/auth/TwoFactorVerifyForm";

export const metadata = { title: "Verify it's you" };

export default async function VerifyTwoFactorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow="Two-factor authentication"
      heading="One more step"
      subhead="Your password is correct. Hand over the second factor to finish signing in."
    >
      <TwoFactorVerifyForm next={next} />
    </AuthShell>
  );
}
