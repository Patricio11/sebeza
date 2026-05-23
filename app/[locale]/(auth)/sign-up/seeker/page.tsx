import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { SeekerSignUpForm } from "@/components/feature/auth/SeekerSignUpForm";
import { getProfessions } from "@/lib/taxonomy/query";

export const metadata = { title: "Create a seeker profile" };

export default async function SeekerSignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.seekerSignUp");
  const professions = await getProfessions();

  return (
    <AuthShell
      eyebrow="Create your account"
      heading={t("step1.heading")}
      subhead="Three steps: identity, consent, then your first profile fields. You can edit everything later from your dashboard."
      rightAside={<SeekerSignUpDossier />}
    >
      <SeekerSignUpForm professions={professions} />
    </AuthShell>
  );
}

function SeekerSignUpDossier() {
  const items = [
    {
      n: "01",
      title: "Identity, encrypted",
      body: "Your full name and ID number are captured once, encrypted on save with AES-256-GCM, and never displayed back — even to you, even to admins.",
    },
    {
      n: "02",
      title: "Consent is a contract",
      body: "Your profile isn't searchable until you grant searchability consent. We record the version of the consent text you saw and the timestamp.",
    },
    {
      n: "03",
      title: "Just the start",
      body: "After these three fields, your full profile editor lives in the dashboard — experience, qualifications, skills, headline, bio.",
    },
  ];
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        How sign-up works
      </div>
      <ul className="mt-3 space-y-4 text-sm">
        {items.map((item) => (
          <li
            key={item.n}
            className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3"
          >
            <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
              {item.n}
            </span>
            <div>
              <div className="font-display text-base">{item.title}</div>
              <p className="text-[color:var(--color-ink-soft)]">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
