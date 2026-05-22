import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField, SelectField, EncryptedBadge } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import {
  PROVINCES,
  PROFESSIONS,
  INSTITUTIONS,
  NQF_LEVELS,
} from "@/lib/mock/taxonomy";
import { CONSENT_PURPOSES, REQUIRED_FOR_SEARCHABILITY, type ConsentPurpose } from "@/lib/consent";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Create a seeker profile" };

type Step = 1 | 2 | 3;

export default async function SeekerSignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const step: Step = (sp.step === "2" ? 2 : sp.step === "3" ? 3 : 1);
  const t = await getTranslations("auth.seekerSignUp");
  const tCommon = await getTranslations("auth.common");

  return (
    <AuthShell
      eyebrow={t("stepLabel", { n: step })}
      heading={
        step === 1
          ? t("step1.heading")
          : step === 2
            ? t("step2.heading")
            : t("step3.heading")
      }
      subhead={
        step === 1
          ? t("step1.subhead")
          : step === 2
            ? t("step2.subhead")
            : t("step3.subhead")
      }
      rightAside={<SeekerSignUpDossier step={step} />}
    >
      <Stepper current={step} />
      {step === 1 && <StepOne />}
      {step === 2 && <StepTwo />}
      {step === 3 && <StepThree />}
    </AuthShell>
  );

  async function StepOne() {
    return (
      <form
        action="/sign-up/seeker"
        method="get"
        className="mt-2 flex flex-col gap-6"
      >
        <input type="hidden" name="step" value="2" />
        <TextField
          id="fullName"
          name="fullName"
          label={tCommon("fullName")}
          autoComplete="name"
          required
          hint={t("stepHints.name")}
        />
        <TextField
          id="email"
          name="email"
          label={tCommon("email")}
          type="email"
          autoComplete="email"
          required
        />
        <TextField
          id="phone"
          name="phone"
          label={tCommon("phone")}
          type="tel"
          autoComplete="tel"
          placeholder="+27 …"
        />
        <TextField
          id="nationalId"
          name="nationalId"
          label="South African ID number (or passport)"
          required
          badge={<EncryptedBadge />}
          hint={t("stepHints.id")}
        />
        <TextField
          id="password"
          name="password"
          label={tCommon("password")}
          type="password"
          autoComplete="new-password"
          required
        />
        <Button type="submit" variant="primary" size="lg">
          {t("step1.next")}
        </Button>
      </form>
    );
  }

  async function StepTwo() {
    return (
      <form
        action="/sign-up/seeker"
        method="get"
        className="mt-2 flex flex-col gap-6"
      >
        <input type="hidden" name="step" value="3" />
        <ul className="space-y-3">
          {CONSENT_PURPOSES.map((purpose) => (
            <ConsentRow key={purpose} purpose={purpose} />
          ))}
        </ul>
        <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
          Granted consents are stored with the catalog version you saw and the
          timestamp. You can revoke any of them from your privacy centre.
        </p>
        <Button type="submit" variant="primary" size="lg">
          {t("step2.next")}
        </Button>
      </form>
    );
  }

  async function StepThree() {
    const tStatus = await getTranslations("status");
    const tAcademic = await getTranslations("auth.seekerSignUp.step3.academic");
    return (
      <form action="/dashboard" method="get" className="mt-2 flex flex-col gap-6">
        <SelectField
          id="profession"
          name="profession"
          label={t("step3.professionLabel")}
          required
        >
          <option value="">Select…</option>
          {PROFESSIONS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="province"
          name="province"
          label={t("step3.locationLabel")}
          required
        >
          <option value="">Select province…</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="status"
          name="status"
          label={t("step3.statusLabel")}
          required
          defaultValue="open_to_work"
        >
          {(
            ["open_to_work", "employed", "self_employed", "studying", "unemployed"] as const
          ).map((s) => (
            <option key={s} value={s}>
              {tStatus(s)}
            </option>
          ))}
        </SelectField>

        {/* Student toggle — collapsible academic capture */}
        <details className="group rounded-[var(--radius-md)] border-2 border-dashed border-[color:var(--color-ink)] bg-[color:var(--color-surface-sunk)] open:border-solid open:bg-[color:var(--color-surface)]">
          <summary className="flex cursor-pointer items-start gap-3 p-5 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
            <input
              type="checkbox"
              name="isStudent"
              className="mt-0.5 size-4"
              aria-hidden="true"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium">
                <GraduationCap
                  className="size-4 text-[color:var(--color-accent)]"
                  aria-hidden="true"
                />
                {t("step3.studentToggle")}
              </div>
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                {t("step3.studentToggleHint")}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="text-[color:var(--color-ink-soft)] group-open:hidden"
            >
              ▾
            </span>
            <span
              aria-hidden="true"
              className="hidden text-[color:var(--color-ink)] group-open:inline"
            >
              ▴
            </span>
          </summary>

          <div className="border-t border-[color:var(--color-hairline)] p-5">
            <div className="mb-4 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
              {tAcademic("heading")}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                id="academic-institution"
                name="academic-institution"
                label={tAcademic("institutionLabel")}
              >
                <option value="">Select…</option>
                {INSTITUTIONS.map((i) => (
                  <option key={i.slug} value={i.slug}>
                    {i.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="academic-programme"
                name="academic-programme"
                label={tAcademic("programmeLabel")}
                placeholder="e.g. BSc Computer Science"
              />
              <TextField
                id="academic-field"
                name="academic-field"
                label={tAcademic("fieldLabel")}
                placeholder="e.g. Computer Science"
              />
              <SelectField
                id="academic-nqf"
                name="academic-nqf"
                label={tAcademic("nqfLabel")}
                defaultValue="7"
              >
                {NQF_LEVELS.map((n) => (
                  <option key={n.level} value={n.level}>
                    {n.label} · {n.band}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="academic-year"
                name="academic-year"
                label={tAcademic("yearLabel")}
                defaultValue=""
              >
                <option value="">Select…</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="academic-graduation"
                name="academic-graduation"
                label={tAcademic("graduationLabel")}
                type="month"
              />
              <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" name="academic-nsfas" className="size-4" />
                {tAcademic("nsfasLabel")}
              </label>
              <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  name="academic-open-internships"
                  defaultChecked
                  className="mt-1 size-4"
                />
                <span>{tAcademic("openToInternships")}</span>
              </label>
              <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  name="academic-open-grad"
                  defaultChecked
                  className="mt-1 size-4"
                />
                <span>{tAcademic("openToGraduateProgrammes")}</span>
              </label>
            </div>
          </div>
        </details>

        <Button type="submit" variant="primary" size="lg">
          {t("step3.next")}
        </Button>
      </form>
    );
  }

  async function ConsentRow({ purpose }: { purpose: ConsentPurpose }) {
    const required = REQUIRED_FOR_SEARCHABILITY.includes(purpose);
    const t2 = await getTranslations("auth.seekerSignUp.step2.purposes");
    return (
      <li className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name={`consent-${purpose}`}
            defaultChecked={required}
            disabled={required}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-medium text-[color:var(--color-ink)]">
              {t2(purpose)}
            </span>
            {required && (
              <span className="ml-2 inline-block rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                Required
              </span>
            )}
            {required && (
              <span className="mt-1 block text-xs text-[color:var(--color-ink-soft)]">
                {t("step2.required")}
              </span>
            )}
          </span>
        </label>
      </li>
    );
  }
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-8 flex items-center gap-2">
      {[1, 2, 3].map((n) => {
        const isActive = n === current;
        const isPast = n < current;
        return (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={
                "flex size-7 items-center justify-center rounded-full border text-xs font-display tabular " +
                (isActive
                  ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                  : isPast
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-paper)]"
                    : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]")
              }
            >
              {n}
            </span>
            {n < 3 && (
              <span
                aria-hidden="true"
                className={
                  "h-px flex-1 " +
                  (isPast
                    ? "bg-[color:var(--color-brand)]"
                    : "bg-[color:var(--color-hairline)]")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SeekerSignUpDossier({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    {
      n: "01",
      title: "Identity basics, encrypted",
      body: "Your full name and ID number are captured once, encrypted on save with AES-256-GCM, and never displayed back — even to you, even to admins.",
    },
    {
      n: "02",
      title: "Consent is a contract",
      body: "Your profile is not searchable until you grant searchability consent. We record the version of the consent text you saw and the timestamp.",
    },
    {
      n: "03",
      title: "Just the start of your profile",
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
            className={
              "grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3 " +
              (parseInt(item.n, 10) === step ? "" : "opacity-60")
            }
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
