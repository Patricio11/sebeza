import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetPasswordForm } from "@/components/feature/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password" };

/**
 * Better Auth's `requestPasswordReset` sends a link like:
 *   /reset-password?token=<one-time>
 * (path with `redirectTo: "/reset-password"` config in `lib/auth/server.ts`).
 *
 * We pull `?token=` from the search params and pass it to the form action.
 */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell
        eyebrow="Reset password"
        heading="That link is missing a token."
        subhead="Request a fresh password-reset email from the sign-in page."
      >
        <p className="text-[color:var(--color-ink-soft)]">
          The reset link in your email should look like{" "}
          <code className="rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] px-1.5 py-0.5">
            /reset-password?token=…
          </code>
          . If you arrived here without one, the link may have expired or been
          stripped. Try again from{" "}
          {/* Phase 12 lint triage: was a plain <a>, which dropped the
              active locale on navigation (bounced through the default-
              locale redirect). The i18n-aware Link preserves it. */}
          <Link
            href="/forgot-password"
            className="text-[color:var(--color-brand)] hover:underline"
          >
            Forgot password
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      heading="Pick a new password."
      subhead="Once set, you'll be signed out of any other devices. Sign back in with the new password."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
