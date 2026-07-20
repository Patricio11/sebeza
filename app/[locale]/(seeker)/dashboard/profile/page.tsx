import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ProfileCompleteness } from "@/components/ui/ProfileCompleteness";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { getMyProfile } from "@/lib/profile/me";
import {
  PROFESSIONS,
  INSTITUTIONS,
  INSTITUTION_KIND_LABEL,
  NQF_LEVELS,
} from "@/lib/mock/taxonomy";
import { getSkills } from "@/lib/taxonomy/query";
import { GraduationCap } from "lucide-react";
import { ProfileBasicsForm } from "@/components/feature/profile/ProfileBasicsForm";
import { SkillsEditor } from "@/components/feature/profile/SkillsEditor";
import { CustomSkillsEditor } from "@/components/feature/profile/CustomSkillsEditor";
import {
  listCustomSkills,
  MAX_CUSTOM_SKILLS,
} from "@/db/queries/custom-skills";
import { WorkAvailabilityEditor } from "@/components/feature/profile/WorkAvailabilityEditor";
import { CurrentEmploymentEditor } from "@/components/feature/profile/CurrentEmploymentEditor";
import { EmploymentVerificationPanel } from "@/components/feature/profile/EmploymentVerificationPanel";
import { listEmployerOptions } from "@/lib/profile/employment";
import { getMyEmploymentVerification } from "@/lib/profile/employment-verification";
import { NationalIdControls } from "@/components/feature/profile/NationalIdControls";
import { KycPanel } from "@/components/feature/profile/KycPanel";
import { DateOfBirthEditor } from "@/components/feature/profile/DateOfBirthEditor";
import { getSetting } from "@/lib/admin/settings";
import { AvatarEditor } from "@/components/feature/profile/AvatarEditor";
import { ShareProfileLink } from "@/components/feature/profile/ShareProfileLink";
import { ShareMyProfileModal } from "@/components/feature/profile/ShareMyProfileModal";
import { OpenToTagsEditor } from "@/components/feature/profile/OpenToTagsEditor";
import { CvBackupEditor } from "@/components/feature/profile/CvBackupEditor";
import { MobileSectionJumpNav } from "@/components/feature/profile/MobileSectionJumpNav";
import { StudentContextEditor } from "@/components/feature/profile/StudentContextEditor";
import { signedPhotoUrl } from "@/lib/storage/signed";
import { isStorageConfigured } from "@/lib/storage/supabase";
import {
  TextField,
  SelectField,
} from "@/components/ui/FormField";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function ProfileEditorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const me = await getMyProfile();
  if (!me) redirect("/sign-in?next=/dashboard/profile");
  const kycProviderEnabled = await getSetting<boolean>("feature_flag_kyc_provider");
  // Phase 31 (data minimisation)  ID/passport COLLECTION is dormant by
  // default. When OFF, the ID controls + KYC panel render ONLY if the
  // seeker already holds ID data (remove/status affordances  data-subject
  // rights never switch off); otherwise the section is Date of birth only.
  const idCollectionEnabled = await getSetting<boolean>(
    "feature_flag_id_verification_enabled",
  );
  const verificationVisible = await getSetting<boolean>(
    "feature_flag_verification_badges_visible",
  );
  // Phase 19.1 ("Custom Skills")  flag-gated escape hatch below the picker.
  const customSkillsEnabled = await getSetting<boolean>(
    "feature_flag_seeker_custom_skills",
  );
  const customSkills = customSkillsEnabled
    ? await listCustomSkills(me.profileId)
    : [];
  // Phase 9.22  picker-visible employers for the new editor.
  const employerOptions = await listEmployerOptions("");
  // Phase 9.23  most recent verification record for the new panel.
  const verification = await getMyEmploymentVerification();

  const t = await getTranslations("seekerDash.profileEditor");
  const tAcademic = await getTranslations("seekerDash.profileEditor.academic");
  const academic = me.academic;

  // Phase 23.4  the LIVE skill catalogue (skills table) is the authority, so
  // admin-added + Phase-19 canonicalized skills appear in the picker AND map
  // back into the editor's initial state. The constant is only the empty-DB
  // fallback inside getSkills().
  const skillCatalogue = await getSkills();

  // Map the live `topSkills` (labels) back to slug+label so the SkillsEditor
  // can validate against the controlled taxonomy.
  const slugByLabel = new Map(skillCatalogue.map((s) => [s.label, s.slug]));
  const initialSkills = me.topSkills
    .map((s) => {
      const slug = slugByLabel.get(s.name);
      if (!slug) return null;
      return {
        slug,
        label: s.name,
        proficiency: s.proficiency,
        yearsOfExperience: s.yearsOfExperience ?? null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Mint a short-lived signed URL for the current photo, if any. The page
  // re-renders on every nav so this stays fresh.
  const photoUrl =
    me.profilePhotoUrl && isStorageConfigured()
      ? await signedPhotoUrl(me.profilePhotoUrl)
      : null;

  return (
    <DashboardMasthead
      role="seeker"
      pageEyebrow="Profile editor"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
      pageActions={
        <div className="flex items-center gap-3">
          <ProfileCompleteness value={me.completeness} />
        </div>
      }
    >
      {/* Phase 10.2  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="seeker" slug="setting-up-your-profile-photo" label="Profile photo guide" />
        <HelpLink role="seeker" slug="adding-skills-from-the-taxonomy" label="Adding skills" />
        <HelpLink role="seeker" slug="employment-history-entry" label="Work history" />
        <HelpLink role="seeker" slug="open-to-tags" label="Open-to tags" />
        <HelpLink role="seeker" slug="secondary-professions-and-cross-training" label="Secondary professions" />
        <HelpLink role="seeker" slug="cv-backup" label="CV backup" />
        <HelpLink role="seeker" slug="build-your-cv" label="Build your CV" />
        <HelpLink role="seeker" slug="sharing-your-profile" label="Sharing your profile" />
        <HelpLink role="seeker" slug="achievements" label="Achievement badges" />
      </div>

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
            <li><a href="#open-to" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">Open to</a></li>
            <li><a href="#cv-backup" className="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]">CV backup</a></li>
          </ul>
          <p className="mt-6 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-3 text-xs text-[color:var(--color-ink-soft)]">
            {t("savedHint")}
          </p>
        </aside>

        <div className="space-y-12">
          {/* Phase 11.5.3  mobile jump-to-section picker. Hidden on
              md+ where the sidebar nav already serves. */}
          <MobileSectionJumpNav hasAcademic={!!academic} />

          {/* Share-your-profile  sits above the editorial sections so
              the seeker can grab their public URL without scrolling. */}
          <ShareProfileLink handle={me.handle} />

          {/* Phase 11.4.1  rich-preview share modal. WhatsApp +
              LinkedIn deep-links + Copy. Recipients see the
              /p/{handle}/card PNG on link unfurl. */}
          <div className="flex flex-wrap items-center justify-end">
            <ShareMyProfileModal
              handle={me.handle}
              displayName={me.displayName}
              profession={me.profession}
            />
          </div>

          {/* Avatar  sits above the editorial numbered sections */}
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

          {/* Phase 8  surface the user's email (read-only, from session)
              so it's obvious where notifications + reset links go. */}
          <section
            aria-labelledby="email-h"
            className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  Sign-in email
                </div>
                <div id="email-h" className="mt-1 font-mono text-sm">
                  {me.email}
                </div>
              </div>
              <p className="text-xs text-[color:var(--color-ink-soft)]">
                Read-only. Email change wires up in Phase 9 alongside the
                domain-verified Resend campaign domain.
              </p>
            </div>
          </section>

          <ProfileBasicsForm
            initial={{
              displayName: me.displayName,
              profession: me.profession,
              // Phase 13.10  secondary professions array (cap 3,
              // labels not slugs). Empty array on legacy rows.
              secondaryProfessions: me.secondaryProfessions ?? [],
              seniority: me.seniority,
              city: me.city,
              province: me.province,
              nationality: me.nationality,
              isCitizen: me.isCitizen,
              bio: me.bio ?? "",
              completeness: me.completeness,
              yearsExperience: me.yearsExperience ?? null,
            }}
            professions={PROFESSIONS}
            identityHeading={
              <SectionHeading
                eyebrow="01"
                title={t("sections.identity")}
                hint="Display name + citizenship. Sebenza matches by location and skill  citizenship is analytics + highlight only, never a gate."
              />
            }
            locationHeading={
              <SectionHeading
                eyebrow="02"
                title={t("sections.locationTitle")}
                hint="Where you live and want to work. Sebenza matches by location + skill  never by nationality."
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
              hint="Skills must come from our controlled taxonomy  keeps search and analytics clean."
            />
            <SkillsEditor
              initial={initialSkills}
              professionSlug={me.profession}
              skillOptions={skillCatalogue}
            />
            {customSkillsEnabled && (
              <CustomSkillsEditor
                initial={customSkills}
                max={MAX_CUSTOM_SKILLS}
              />
            )}
          </section>

          {/* Work availability (Phase 7.5) */}
          <section id="work-availability">
            <SectionHeading
              eyebrow="05"
              title="Work availability"
              hint="What kinds of work you're open to  independent of your current employment status."
            />
            <WorkAvailabilityEditor initialValues={me.workAvailability ?? []} />
          </section>

          {/* Phase 9.22  Current employment. Always shown (the seeker
              might be employed without `status='employed'`; we keep
              the editor available rather than gating on status to
              avoid surprise hides on status changes). */}
          <section id="current-employment">
            <SectionHeading
              eyebrow="05a"
              title="Current employment"
              hint="Where you work right now. Optional. Visible on your public profile when the employer is verified."
            />
            <CurrentEmploymentEditor
              initial={{
                currentEmployerOrgId: me.currentEmployerOrgId,
                currentEmployerName: me.currentEmployerName,
                currentRoleStartedAt: me.currentRoleStartedAt,
                currentRoleCity: me.currentRoleCity,
              }}
              options={employerOptions}
              pendingEmployerName={
                me.currentEmployerIsPending ? me.currentEmployerName : null
              }
            />
            {/* Phase 9.23  opt-in verification panel. Renders only
                when status='employed' (D2); hidden otherwise. The
                panel handles its own three states (none / pending /
                resolved). */}
            <div className="mt-4">
              <EmploymentVerificationPanel
                current={verification}
                status={me.status}
                currentEmployerOrgId={me.currentEmployerOrgId}
                currentEmployerName={me.currentEmployerName}
              />
            </div>
          </section>

          {/* National ID  Phase 31: collection dormant by default. The
              ID/KYC panels appear ONLY when collection is ON, or when the
              seeker already holds ID data (then in status/remove-only
              mode  erasure never switches off). */}
          <section id="national-id">
            <SectionHeading
              eyebrow="06"
              title={
                idCollectionEnabled || me.hasNationalId || me.hasIdDocument || me.kycVerifiedAt
                  ? "National ID"
                  : "Date of birth"
              }
              hint={
                idCollectionEnabled || me.hasNationalId || me.hasIdDocument || me.kycVerifiedAt
                  ? "Captured once, encrypted on save, never displayed back. POPIA special-category data."
                  : "Used only for the age check at sign-up. Sebenza does not ask for ID or passport numbers."
              }
            />
            <div className="mb-3">
              <DateOfBirthEditor initialValue={me.dateOfBirth} />
            </div>
            {(idCollectionEnabled || me.hasNationalId) && (
              <NationalIdControls
                hasNationalId={me.hasNationalId}
                collectionEnabled={idCollectionEnabled}
              />
            )}
            {(idCollectionEnabled ||
              me.hasIdDocument ||
              Boolean(me.kycVerifiedAt)) && (
              <div className="mt-4">
                <KycPanel
                  hasNationalId={me.hasNationalId}
                  kycVerifiedAt={me.kycVerifiedAt}
                  realProviderEnabled={kycProviderEnabled}
                  hasIdDocument={me.hasIdDocument}
                  idDocumentUploadedAt={me.idDocumentUploadedAt}
                  idDocumentRejectionReason={me.idDocumentRejectionReason}
                  idDocumentKind={me.idDocumentKind}
                  collectionEnabled={idCollectionEnabled}
                />
              </div>
            )}
          </section>

          {/* Studies  student mode (read-only display for now;
              dedicated academic actions wire in Phase 8 alongside SAQA). */}
          {academic && (
            <section id="academic">
              <SectionHeading
                eyebrow="07"
                title={tAcademic("heading")}
                hint={tAcademic("subhead")}
              />

              <div className="mb-5 flex flex-wrap items-center gap-2">
                <VerificationBadge state={academic.verification} visible={verificationVisible} />
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
                Institution + programme + NQF level stay read-only
                until Phase 8 wires the SAQA + institution
                verification integration. The current-semester
                context below is editable any time.
              </p>

              {/* Phase 13.1  current-semester context editor.
                  Independent of the credential-shaped fields above
                  (no SAQA verification involvement). The matcher
                  uses these to tighten skill suggestions beyond
                  programme-level inference. */}
              <div className="mt-6 border-t border-[color:var(--color-hairline)] pt-6">
                <h3 className="font-display text-lg text-[color:var(--color-ink)]">
                  Current studies (this semester)
                </h3>
                <div className="mt-4">
                  <StudentContextEditor
                    initialModules={academic.currentModules}
                    initialElective={academic.electiveChosen}
                    initialProject={academic.projectTopic}
                    currentYear={academic.currentYear}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Phase 11.5.1  voluntary "open to" tags. Independent of
              employment status; secondary intent only. */}
          <section id="open-to" aria-labelledby="open-to-h" className="scroll-mt-20">
            <header className="mb-5 border-b-2 border-[color:var(--color-ink)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
                  07
                </span>
                <h2 id="open-to-h" className="font-display text-2xl">
                  Open to
                </h2>
              </div>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                Optional secondary intent  doesn&rsquo;t change your
                employment status.
              </p>
            </header>
            <OpenToTagsEditor initial={me.openToTags ?? []} />
          </section>

          {/* Phase 11.5.2  personal CV backup. Private to the seeker;
              never exposed to employers. */}
          <section id="cv-backup" aria-labelledby="cv-h" className="scroll-mt-20">
            <header className="mb-5 border-b-2 border-[color:var(--color-ink)] pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
                  08
                </span>
                <h2 id="cv-h" className="font-display text-2xl">
                  Personal CV backup
                </h2>
              </div>
              <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
                Private to you. We don&rsquo;t share this with
                employers; it&rsquo;s a personal backup copy.
              </p>
            </header>
            <CvBackupEditor
              filename={me.cvFilename}
              uploadedAt={me.cvUploadedAt}
              locale={locale}
            />
          </section>
        </div>
      </div>
    </DashboardMasthead>
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
