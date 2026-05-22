import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import {
  TextField,
  TextareaField,
  SelectField,
  EncryptedBadge,
} from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { dataProvider } from "@/lib/data/provider";
import {
  PROVINCES,
  PROFESSIONS,
  INSTITUTIONS,
  INSTITUTION_KIND_LABEL,
  NQF_LEVELS,
} from "@/lib/mock/taxonomy";
import { GraduationCap, X } from "lucide-react";

const MOCK_HANDLE = "andile-z";

export default async function ProfileEditorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await dataProvider.getProfile(MOCK_HANDLE);
  if (!me) return null;

  const t = await getTranslations("seekerDash.profileEditor");
  const tAcademic = await getTranslations("seekerDash.profileEditor.academic");
  const academic = me.academic;

  return (
    <DashboardShell
      role="seeker"
      workspaceLabel={me.displayName}
      workspaceEyebrow="Job seeker · workspace"
      nav={SEEKER_NAV}
      activeKey="profile"
      pageEyebrow="Profile editor"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <div className="flex items-center gap-3">
          <ProfileCompleteness value={me.completeness} />
          <Button variant="primary" size="md">
            {t("saveButton")}
          </Button>
        </div>
      }
    >
      <form className="grid gap-10 md:grid-cols-[240px_1fr] md:gap-16">
        {/* Sticky section nav */}
        <aside className="hidden md:block md:sticky md:top-6 md:self-start">
          <div className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 text-[0.7rem] uppercase tracking-[0.22em]">
            Sections
          </div>
          <ul className="space-y-1.5 text-sm">
            <li><a href="#identity" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Identity basics</a></li>
            <li><a href="#location" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Location</a></li>
            <li><a href="#professional" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Professional summary</a></li>
            {academic && (
              <li>
                <a
                  href="#academic"
                  className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
                >
                  Studies
                </a>
              </li>
            )}
            <li><a href="#skills" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Skills</a></li>
          </ul>
          <p className="mt-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-ink-soft)]">
            {t("savedHint")}
          </p>
        </aside>

        <div className="space-y-12">
          {/* Identity */}
          <section id="identity">
            <SectionHeading
              eyebrow="01"
              title={t("sections.identity")}
              hint="Captured once, encrypted on save, never displayed back."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                id="fullName"
                label={t("fields.fullName")}
                defaultValue={`Lerato Nkosi`}
                autoComplete="name"
              />
              <TextField
                id="displayName"
                label={t("fields.displayName")}
                defaultValue={me.displayName}
                hint={t("fields.displayNameHelp")}
              />
              <TextField
                id="nationalId"
                label={t("fields.nationalId")}
                placeholder="•••• •••• •••• •"
                badge={<EncryptedBadge />}
                hint={t("fields.nationalIdHelp")}
              />
              <TextField
                id="dob"
                label={t("fields.dob")}
                type="date"
                defaultValue="1992-06-12"
              />
              <SelectField
                id="nationality"
                label={t("fields.nationality")}
                defaultValue={me.nationality ?? "South African"}
              >
                <option>South African</option>
                <option>Nigerian</option>
                <option>Zimbabwean</option>
                <option>Mozambican</option>
                <option>Other</option>
              </SelectField>
              <label className="mt-2 inline-flex items-center gap-2 text-sm md:mt-auto md:pb-3">
                <input
                  type="checkbox"
                  defaultChecked={me.isCitizen}
                  className="size-4"
                />
                {t("fields.citizen")}
              </label>
            </div>
          </section>

          {/* Location */}
          <section id="location">
            <SectionHeading
              eyebrow="02"
              title={t("sections.locationTitle")}
              hint="Where you live and want to work. Sebenza matches by location + skill — never by nationality."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                id="province"
                label={t("fields.province")}
                defaultValue="gauteng"
              >
                {PROVINCES.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
              <SelectField id="city" label={t("fields.city")} defaultValue="johannesburg">
                {(PROVINCES.find((p) => p.slug === "gauteng")?.cities ?? []).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </SelectField>
              <label className="mt-2 inline-flex items-center gap-2 text-sm md:col-span-2">
                <input type="checkbox" className="size-4" />
                {t("fields.willingToRelocate")}
              </label>
            </div>
          </section>

          {/* Professional */}
          <section id="professional">
            <SectionHeading
              eyebrow="03"
              title={t("sections.professional")}
              hint="What employers see first in your dossier."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                id="profession"
                label={t("fields.profession")}
                defaultValue="software-developer"
              >
                {PROFESSIONS.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="seniority"
                label={t("fields.seniority")}
                defaultValue={me.seniority ?? "intermediate"}
              >
                <option value="junior">Junior</option>
                <option value="intermediate">Intermediate</option>
                <option value="senior">Senior</option>
              </SelectField>
              <TextField
                id="headline"
                label={t("fields.headline")}
                defaultValue="Full-stack engineer · low-bandwidth & accessibility-first"
                className="md:col-span-2"
              />
              <TextareaField
                id="bio"
                label={t("fields.bio")}
                defaultValue={me.bio}
                hint={t("fields.bioHelp")}
                className="md:col-span-2"
              />
            </div>
          </section>

          {/* Studies — student mode */}
          {academic && (
            <section id="academic">
              <SectionHeading
                eyebrow="04"
                title={tAcademic("heading")}
                hint={tAcademic("subhead")}
              />

              <div className="mb-5 flex flex-wrap items-center gap-2">
                <VerificationBadge state={academic.verification} />
                <span className="text-xs text-[color:var(--color-ink-soft)]">
                  {tAcademic("verificationNote")}
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <SelectField
                  id="academic-institution"
                  label={tAcademic("institution")}
                  defaultValue={academic.institutionSlug}
                  hint={tAcademic("kindHint")}
                  badge={
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                      <GraduationCap className="size-3" aria-hidden="true" />
                      {INSTITUTION_KIND_LABEL[academic.institutionKind]}
                    </span>
                  }
                >
                  {INSTITUTIONS.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.label}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id="academic-programme"
                  label={tAcademic("programme")}
                  defaultValue={academic.programme}
                />

                <TextField
                  id="academic-field"
                  label={tAcademic("field")}
                  defaultValue={academic.fieldOfStudy}
                />

                <SelectField
                  id="academic-nqf"
                  label={tAcademic("nqfLevel")}
                  defaultValue={String(academic.nqfLevel)}
                >
                  {NQF_LEVELS.map((n) => (
                    <option key={n.level} value={n.level}>
                      {n.label} · {n.band}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="academic-year"
                  label={tAcademic("year")}
                  defaultValue={academic.currentYear ? String(academic.currentYear) : ""}
                >
                  <option value="">N/A (postgrad)</option>
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id="academic-graduation"
                  label={tAcademic("graduation")}
                  type="month"
                  defaultValue={academic.expectedGraduation}
                />

                <label className="mt-2 inline-flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    defaultChecked={academic.nsfas}
                    className="size-4"
                  />
                  {tAcademic("nsfas")}
                </label>

                <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    defaultChecked={academic.openToInternships}
                    className="mt-1 size-4"
                  />
                  <span>{tAcademic("openToInternships")}</span>
                </label>

                <label className="inline-flex items-start gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    defaultChecked={academic.openToGraduateProgrammes}
                    className="mt-1 size-4"
                  />
                  <span>{tAcademic("openToGraduateProgrammes")}</span>
                </label>
              </div>
            </section>
          )}

          {/* Skills */}
          <section id="skills">
            <SectionHeading
              eyebrow="05"
              title={t("sections.skillsTitle")}
              hint="Skills must come from our controlled taxonomy — keeps search and analytics clean."
            />
            <ul className="grid gap-3 md:grid-cols-2">
              {me.topSkills.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3"
                >
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-[color:var(--color-ink-soft)]">
                      {t("fields.proficiency")}: {s.proficiency}/5
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="size-2 rounded-full"
                          style={{
                            background:
                              i < s.proficiency
                                ? "var(--color-brand)"
                                : "var(--color-hairline)",
                          }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      aria-label={t("fields.removeSkill")}
                      className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button type="button" variant="secondary" size="sm">
                {t("fields.addSkill")}
              </Button>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] p-5">
            <div>
              <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                {t("completenessLive")}
              </div>
              <ProfileCompleteness value={me.completeness} />
            </div>
            <Button type="submit" variant="primary" size="md">
              {t("saveButton")}
            </Button>
          </div>
        </div>
      </form>
    </DashboardShell>
  );
}

function SectionHeading({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="mb-5 border-b-2 border-[color:var(--color-ink)] pb-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
          {eyebrow}
        </span>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {hint && (
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{hint}</p>
      )}
    </header>
  );
}
