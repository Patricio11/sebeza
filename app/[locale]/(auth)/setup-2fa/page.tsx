import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { TwoFactorSetupForm } from "@/components/feature/auth/TwoFactorSetupForm";
import { getSessionUser } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/guard";

export const metadata = { title: "Set up two-factor authentication" };

export default async function SetupTwoFactorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.twoFactorEnabled) redirect(roleHome(user.role));

  return (
    <AuthShell
      eyebrow="Two-factor authentication"
      heading="Lock down your account"
      subhead="Sebenza enforces 2FA for employer and administrator workspaces. The whole flow takes about a minute."
      rightAside={<SetupDossier />}
    >
      <TwoFactorSetupForm email={user.email} postSetupHref={roleHome(user.role)} />
    </AuthShell>
  );
}

function SetupDossier() {
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        Why we require this
      </div>
      <ul className="mt-3 space-y-4 text-sm">
        <DossierItem
          n="01"
          title="PII access deserves a second factor"
          body="Every contact reveal, document download, and verification decision is audit-logged. The second factor keeps that ledger honest."
        />
        <DossierItem
          n="02"
          title="One-time backup codes, hashed at rest"
          body="If you lose your device you can sign in with a backup code; we store hashes only and a code is invalidated the moment it's used."
        />
        <DossierItem
          n="03"
          title="Total recovery"
          body="If you lose both your device and your backup codes, a Sebenza administrator can reset your 2FA after verifying your identity."
        />
      </ul>
    </>
  );
}

function DossierItem({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3">
      <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
        {n}
      </span>
      <div>
        <div className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </div>
        <p className="text-[color:var(--color-ink-soft)]">{body}</p>
      </div>
    </li>
  );
}
