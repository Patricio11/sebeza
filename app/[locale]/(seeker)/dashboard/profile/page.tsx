import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SEEKER_NAV } from "@/components/layout/seekerNav";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { getMyProfile } from "@/lib/profile/me";
import {
  PROFESSIONS,
  INSTITUTIONS,
  INSTITUTION_KIND_LABEL,
  NQF_LEVELS,
} from "@/lib/mock/taxonomy";
import { SKILLS } from "@/lib/mock/taxonomy";
import { GraduationCap } from "lucide-react";
import { ProfileBasicsForm } from "@/components/feature/profile/ProfileBasicsForm";
import { SkillsEditor } from "@/components/feature/profile/SkillsEditor";
import { WorkAvailabilityEditor } from "@/components/feature/profile/WorkAvailabilityEditor";
import { NationalIdControls } from "@/components/feature/profile/NationalIdControls";
import { AvatarEditor } from "@/components/feature/profile/AvatarEditor";
import { signedPhotoUrl } from "@/lib/storage/signed";
import { isStorageConfigured } from "@/lib/storage/supabase";
import {
  TextField,
  SelectField,
} from "@/components/ui/FormField";

export default async function ProfileEditorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/profile");

  const t = await getTranslations("seekerDash.profileEditor");
  const tAcademic = await getTranslations("seekerDash.profileEditor.academic");
  const academic = me.academic;

  // Map the live `topSkills` (labels) back to slug+label so the SkillsEditor
  // can validate against the controlled taxonomy.
  const slugByLabel = new Map(SKILLS.map((s) => [s.label, s.slug]));
  const initialSkills = me.topSkills
    .map((s) => {
      const slug = slugByLabel.get(s.name);
      if (!slug) return null;
      return { slug, label: s.name, proficiency: s.proficiency };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Mint a short-lived signed URL for the current photo, if any. The page
  // re-renders on every nav so this stays fresh.
  const photoUrl =
    me.profilePhotoUrl && isStorageConfigured()
      ? await signedPhotoUrl(me.profilePhotoUrl)
      : null;

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
        </div>
      }
    >
      <div className="grid gap-10 md:grid-cols-[240px_1fr] md:gap-16">
        {/* Sticky section nav */}
        <aside className="hidden md:block md:sticky md:top-6 md:self-start">
          <div className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 text-[0.7rem] uppercase tracking-[0.22em]">
            Sections
          </div>
          <ul className="space-y-1.5 text-sm">
            <li><a href="#avatar" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Photo</a></li>
            <li><a href="#identity" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Identity basics</a></li>
            <li><a href="#location" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Location</a></li>
            <li><a href="#professional" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Professional summary</a></li>
            <li><a href="#skills" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Skills</a></li>
            <li><a href="#national-id" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">National ID</a></li>
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
          </ul>
          <p className="mt-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-ink-soft)]">
            {t("savedHint")}
          </p>
        </aside>

        <div className="space-y-12">
          {/* Avatar — sits above the editorial numbered sections */}
          <section id="avatar" aria-labelledby="avatar-h">
            <header className="mb-5 border-b-2 border-[color:var(--color-ink)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
                  00
                </span>
                <h2 id="avatar-h" className="font-display text-2xl">
                  Photo
                </h2>
              </div>
              <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
                Optional. A real photo lifts profile completeness; initials still look great.
              </p>
            </header>
            <AvatarEditor name={me.displayName} initialUrl={photoUrl} />
          </section>

          <ProfileBasicsForm
            initial={{
              displayName: me.displayName,
              profession: me.profession,
              seniority: me.seniority,
              city: me.city,
              province: me.province,
              nationality: me.nationality,
              isCitizen: me.isCitizen,
              bio: me.bio ?? "",
              completeness: me.completeness,
            }}
            professions={PROFESSIONS}
            identityHeading={
              <SectionHeading
                eyebrow="01"
                title={t("sections.identity")}
                hint="Display name + nationality. ID number lives in its own section below — encrypted, never displayed back."
              />
            }
            locationHeading={
              <SectionHeading
                eyebrow="02"
                title={t("sections.locationTitle")}
                hint="Where you live and want to work. Sebenza matches by location + skill — never by nationality."
              />
            }
            professionalHeading={
              <SectionHeading
                eyebrow="03"
                title={t("sections.professional")}
                hint="What employers see first in your dossier."
              />
            }
            labels={{
              displayName: t("fields.displayName"),
              displayNameHelp: t("fields.displayNameHelp"),
              province: t("fields.province"),
              city: t("fields.city"),
              willingToRelocate: t("fields.willingToRelocate"),
              profession: t("fields.profession"),
              seniority: t("fields.seniority"),
              bio: t("fields.bio"),
              bioHelp: t("fields.bioHelp"),
              saveButton: t("saveButton"),
              completenessLive: t("completenessLive"),
              citizen: t("fields.citizen"),
              nationality: t("fields.nationality"),
            }}
          />

          {/* Skills */}
          <section id="skills">
            <SectionHeading
              eyebrow="04"
              title={t("sections.skillsTitle")}
              hint="Skills must come from our controlled taxonomy — keeps search and analytics clean."
            />
            <SkillsEditor initial={initialSkills} />
          </section>

          {/* Work availability (Phase 7.5) */}
          <section id="work-availability">
            <SectionHeading
              eyebrow="05"
              title="Work availability"
              hint="What kinds of work you're open to — independent of your current employment status."
            />
            <WorkAvailabilityEditor initialValues={me.workAvailability ?? []} />
          </section>

          {/* National ID */}
          <section id="national-id">
            <SectionHeading
              eyebrow="06"
              title="National ID"
              hint="Captured once, encrypted on save, never displayed back. POPIA special-category data."
            />
            <NationalIdControls hasNationalId={me.hasNationalId} />
          </section>

          {/* Studies — student mode (read-only display for now;
              dedicated academic actions wire in Phase 8 alongside SAQA). */}
          {academic && (
            <section id="academic">
              <SectionHeading
                eyebrow="07"
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
                  disabled
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
                  disabled
                />

                <TextField
                  id="academic-field"
                  label={tAcademic("field")}
                  defaultValue={academic.fieldOfStudy}
                  disabled
                />

                <SelectField
                  id="academic-nqf"
                  label={tAcademic("nqfLevel")}
                  defaultValue={String(academic.nqfLevel)}
                  disabled
                >
                  {NQF_LEVELS.map((n) => (
                    <option key={n.level} value={n.level}>
                      {n.label} · {n.band}
                    </option>
                  ))}
                </SelectField>
              </div>
              <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-ink-soft)]">
                Studies are read-only for now. Editing wires up in Phase 8 alongside the SAQA + institution verification integration.
              </p>
            </section>
          )}
        </div>
      </div>
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
