import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField, SelectField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Register your organisation" };

export default async function EmployerSignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.employerSignUp");
  const tCommon = await getTranslations("auth.common");

  return (
    <AuthShell
      eyebrow="Get started · Employer"
      heading={t("heading")}
      subhead={t("subhead")}
      rightAside={<EmployerSignUpDossier />}
    >
      <form action="/employer" method="get" className="flex flex-col gap-6">
        <section className="flex flex-col gap-5">
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Organisation
          </div>
          <TextField
            id="orgName"
            name="orgName"
            label={t("orgName")}
            required
            autoComplete="organization"
          />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              id="registrationNumber"
              name="registrationNumber"
              label={t("registrationNumber")}
              placeholder="2020/123456/07"
              required
            />
            <SelectField id="industry" name="industry" label={t("industry")} required>
              <option value="">Select…</option>
              <option>Financial services</option>
              <option>Hospitality</option>
              <option>Construction</option>
              <option>Healthcare</option>
              <option>Information technology</option>
              <option>Manufacturing</option>
              <option>Retail</option>
              <option>Mining</option>
              <option>Public sector</option>
              <option>Other</option>
            </SelectField>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField id="size" name="size" label={t("size")} required>
              <option value="">Select…</option>
              <option>1 – 10</option>
              <option>11 – 50</option>
              <option>51 – 200</option>
              <option>201 – 1 000</option>
              <option>1 001+</option>
            </SelectField>
            <SelectField id="country" name="country" label={t("country")} required defaultValue="ZA">
              <option value="ZA">South Africa</option>
              <option value="OTHER">Other (operates in SA)</option>
            </SelectField>
          </div>
        </section>

        <hr className="hairline" />

        <section className="flex flex-col gap-5">
          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            {t("youAs")}
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              id="fullName"
              name="fullName"
              label={tCommon("fullName")}
              required
              autoComplete="name"
            />
            <TextField
              id="yourRole"
              name="yourRole"
              label={t("yourRole")}
              placeholder="Head of People"
              required
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              id="email"
              name="email"
              label={tCommon("email")}
              type="email"
              required
              autoComplete="email"
            />
            <TextField
              id="phone"
              name="phone"
              label={tCommon("phone")}
              type="tel"
              autoComplete="tel"
            />
          </div>
          <TextField
            id="password"
            name="password"
            label={tCommon("password")}
            type="password"
            autoComplete="new-password"
            required
          />
        </section>

        <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
          {t("twoFactorNote")}
        </p>

        <Button type="submit" variant="primary" size="lg">
          {t("submit")}
        </Button>
      </form>
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
          body="The moment your account is created, you can search the live talent register and build talent pools — even before verification."
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
