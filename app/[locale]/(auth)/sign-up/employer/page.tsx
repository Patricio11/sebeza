import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { EmployerSignUpForm } from "@/components/feature/auth/EmployerSignUpForm";

export const metadata = { title: "Register your organisation" };

export default async function EmployerSignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.employerSignUp");

  return (
    <AuthShell
      eyebrow="Get started · Employer"
      heading={t("heading")}
      subhead={t("subhead")}
      rightAside={<EmployerSignUpDossier />}
    >
      <EmployerSignUpForm />
    </AuthShell>
  );
}

function EmployerSignUpDossier() {
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        What happens next
      </div>
      <ol className="mt-3 space-y-4 text-sm">
        <DossierStep
          n="01"
          title="You can search talent immediately"
          body="The moment your account is created, you can search the live talent register and build talent pools  even before verification."
        />
        <DossierStep
          n="02"
          title="Contact + documents stay locked"
          body="Until your organisation is verified, candidate contact details and uploaded documents stay sealed. This protects job seekers."
        />
        <DossierStep
          n="03"
          title="Verification via partner KYC"
          body="We verify your CIPC registration and identity through a pluggable KYC partner. Typically completes within one business day."
        />
        <DossierStep
          n="04"
          title="Confirmed hires earn analytics credits"
          body='Logging a placement via "Mark as hired" feeds national analytics and earns your organisation small free analytics credits.'
        />
      </ol>
    </>
  );
}

function DossierStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3">
      <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
        {n}
      </span>
      <div>
        <div className="font-display text-base">{title}</div>
        <p className="text-[color:var(--color-ink-soft)]">{body}</p>
      </div>
    </li>
  );
}
