import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { SignInForm } from "@/components/feature/auth/SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthShell
      eyebrow={t("signIn.eyebrow")}
      heading={t("signIn.heading")}
      subhead={t("signIn.subhead")}
      rightAside={<SignInDossier />}
    >
      <SignInForm next={next} />
    </AuthShell>
  );
}

function SignInDossier() {
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        How sign-in works
      </div>
      <ul className="mt-3 space-y-4 text-sm">
        <DossierItem
          n="01"
          title="Email + password"
          body="We identify your account from your credentials and take you to the right workspace automatically."
        />
        <DossierItem
          n="02"
          title="Email verification, mandatory"
          body="New accounts must verify their email before signing in. The link is good for 24 hours."
        />
        <DossierItem
          n="03"
          title="Every session, audit-logged"
          body="Sign-in is itself an audit event. You can revoke devices any time from your account settings."
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
