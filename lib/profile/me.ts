/**
 * Self-profile read path (Phase 3).
 *
 * `getMyProfile()` loads the signed-in user's profile + skills + experience +
 * qualifications + (optional) academic record from the database, shaped as
 * `PublicProfile` (the same type the rest of the app already understands).
 *
 * This is the **self-read** path. The public-read path goes through
 * `dataProvider.getProfile(handle)` which enforces redaction. Self-read can
 * surface fields the public payload omits (in Phase 3+ we may add e.g.
 * the encrypted-but-decryptable-by-self bits  for now `PublicProfile` is the
 * superset we need).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import type {
  PublicProfile,
  AcademicProfile,
  EmploymentStatus,
  Seniority,
  VerificationStatus,
  SkillRef,
  ExperienceItem,
  QualificationItem,
  WorkAvailabilityKind,
  OpenToTag,
} from "@/lib/mock/types";
import { isOpenToTag } from "@/lib/mock/types";
import { getSessionUser } from "@/lib/auth/guard";
import { INSTITUTIONS } from "@/lib/mock/taxonomy";

export type MyProfile = PublicProfile & {
  /** Row id (text/uuid in DB). Lets actions reference the profile without an extra lookup. */
  profileId: string;
  /** Whether a national ID is on file. Never echo back the value itself. */
  hasNationalId: boolean;
  /** Phase 8  KYC verification timestamp (ISO). null = not verified. */
  kycVerifiedAt: string | null;
  /** Phase 8  read-only email surfaced from the auth session. */
  email: string;
  /** Phase 9.16  ISO yyyy-mm-dd. Captured at sign-up + editable from
   *  /dashboard/profile. Null only for legacy accounts created before
   *  the column existed. */
  dateOfBirth: string | null;
  /** Phase 9.16  "sa_id" or "passport". Drives the KYC panel copy. */
  idDocumentKind: "sa_id" | "passport";
  /** Phase 9.16  ISO 3166 alpha-2 issuer; only set for passport. */
  passportCountry: string | null;
  /** Phase 9.16  truthy iff the seeker has uploaded a document for
   *  admin review. The KycPanel uses this to flip between
   *  "needs upload" and "pending review" states. */
  hasIdDocument: boolean;
  /** Phase 9.16  ISO when the latest document was attached. */
  idDocumentUploadedAt: string | null;
  /** Phase 9.16  admin's rejection note (if any). When set, the
   *  KycPanel shows the reason + a re-upload control. */
  idDocumentRejectionReason: string | null;
  /**
   * Phase 9.22  current employment block. Three nullable columns
   * mirror the database. The dashboard editor surfaces the three
   * (or shows blank inputs) so the seeker can declare / clear.
   *
   * `currentEmployerName` is the resolved org's name when the FK is
   * set, OR the free-text name from the pending row when the seeker's
   * employer is still awaiting admin review.
   */
  currentEmployerOrgId: string | null;
  currentEmployerName: string | null;
  /** True when the seeker's current employer is a pending seeker_named
   *  row (verification != 'verified'); the public profile renderer
   *  hides the badge in that case but the editor still shows the name
   *  so the seeker knows their text landed. */
  currentEmployerIsPending: boolean;
  currentRoleStartedAt: string | null;
  currentRoleCity: string | null;
  /**
   * Phase 11.5.2  personal CV backup. PRIVATE to the seeker (D3)
   * never returned in any public projection. The storage key here is
   * the value the seeker's own download path uses; do NOT leak it.
   */
  cvStorageKey: string | null;
  cvUploadedAt: string | null;
  cvFilename: string | null;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const session = await getSessionUser();
  if (!session) return null;
  return loadProfileForUser(session.id);
}

/**
 * Direct load by user id  used after sign-up flows where the session was just
 * minted and we want to bypass the cookie cache.
 */
export async function loadProfileForUser(userId: string): Promise<MyProfile | null> {
  const db = getDb();

  const profileRows = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  const p = profileRows[0];
  if (!p) return null;

  // Phase 8  surface email + KYC verification from app_user. Single
  // extra round-trip; the data is cheap and the seeker's account
  // surfaces depend on both.
  const userRows = await db
    .select({
      email: schema.appUser.email,
      kycVerifiedAt: schema.appUser.kycVerifiedAt,
    })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  const u = userRows[0];

  // Parallel: skills, experience, qualifications, academic.
  const [skillRows, expRows, qualRows, acadRows] = await Promise.all([
    db
      .select({
        skillSlug: schema.profileSkills.skillSlug,
        proficiency: schema.profileSkills.proficiency,
        yearsOfExperience: schema.profileSkills.yearsOfExperience,
        label: schema.skills.label,
      })
      .from(schema.profileSkills)
      .innerJoin(schema.skills, eq(schema.profileSkills.skillSlug, schema.skills.slug))
      .where(eq(schema.profileSkills.profileId, p.id)),
    db
      .select()
      .from(schema.experiences)
      .where(eq(schema.experiences.profileId, p.id))
      .orderBy(desc(schema.experiences.startedAt)),
    db
      .select()
      .from(schema.qualifications)
      .where(eq(schema.qualifications.profileId, p.id))
      .orderBy(asc(schema.qualifications.awardedYear)),
    db
      .select()
      .from(schema.academicProfiles)
      .where(eq(schema.academicProfiles.profileId, p.id))
      .limit(1),
  ]);

  const topSkills: SkillRef[] = skillRows.map((s) => ({
    name: s.label,
    proficiency: clampProficiency(s.proficiency),
    yearsOfExperience: s.yearsOfExperience,
  }));

  const experience: ExperienceItem[] = expRows.map((e) => ({
    role: e.role,
    organization: e.organization,
    city: e.city ?? "",
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    description: e.description ?? undefined,
  }));

  const qualifications: QualificationItem[] = qualRows.map((q) => ({
    title: q.title,
    institution: q.institution,
    awardedYear: q.awardedYear,
    verification: q.verification as VerificationStatus,
  }));

  // Phase 9.22  resolve the current employer (name + pending flag).
  // Single round trip; the FK may be null + the row could be either
  // verified or pending. The dashboard editor needs the name even for
  // pending rows so the seeker can see their submitted text.
  let currentEmployerName: string | null = null;
  let currentEmployerIsPending = false;
  if (p.currentEmployerOrgId) {
    const orgRows = await db
      .select({
        name: schema.organizations.name,
        origin: schema.organizations.origin,
        verification: schema.organizations.verification,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, p.currentEmployerOrgId))
      .limit(1);
    const org = orgRows[0];
    if (org) {
      currentEmployerName = org.name;
      currentEmployerIsPending = !(
        org.origin === "sebenza_registered" || org.verification === "verified"
      );
    }
  }

  let academic: AcademicProfile | undefined;
  const a = acadRows[0];
  if (a) {
    const inst = INSTITUTIONS.find((i) => i.slug === a.institutionSlug);
    academic = {
      institutionSlug: a.institutionSlug,
      institutionLabel: inst?.label ?? a.institutionSlug,
      institutionKind: (inst?.kind ?? "university") as AcademicProfile["institutionKind"],
      programme: a.programme,
      fieldOfStudy: a.fieldOfStudy,
      nqfLevel: a.nqfLevel as AcademicProfile["nqfLevel"],
      currentYear: a.currentYear,
      expectedGraduation: a.expectedGraduation,
      nsfas: a.nsfas,
      verification: a.verification as VerificationStatus,
      openToInternships: a.openToInternships,
      openToGraduateProgrammes: a.openToGraduateProgrammes,
    };
  }

  return {
    profileId: p.id,
    hasNationalId: !!p.nationalIdEnc,
    email: u?.email ?? "",
    kycVerifiedAt: u?.kycVerifiedAt?.toISOString() ?? null,
    dateOfBirth: p.dateOfBirth ?? null,
    idDocumentKind: (p.idDocumentKind ?? "sa_id") as "sa_id" | "passport",
    passportCountry: p.passportCountry ?? null,
    hasIdDocument: !!p.idDocumentStorageKey,
    idDocumentUploadedAt: p.idDocumentUploadedAt?.toISOString() ?? null,
    idDocumentRejectionReason: p.idDocumentRejectionReason ?? null,
    handle: p.handle,
    displayName: p.displayName,
    profilePhotoUrl: p.profilePhotoUrl,
    profession: p.profession,
    seniority: (p.seniority as Seniority | null) ?? null,
    city: p.city,
    province: p.province,
    nationality: p.nationality,
    isCitizen: p.isCitizen,
    bio: p.bio ?? undefined,
    status: p.status as EmploymentStatus,
    statusConfirmedAt: p.statusConfirmedAt.toISOString(),
    workAvailability: (p.workAvailability ?? []) as WorkAvailabilityKind[],
    verification: p.verification as VerificationStatus,
    completeness: p.completeness,
    yearsExperience: p.yearsExperience,
    memberSince: p.memberSince.toISOString(),
    topSkills,
    experience,
    qualifications,
    academic,
    // Phase 9.22  current employment block.
    currentEmployerOrgId: p.currentEmployerOrgId ?? null,
    currentEmployerName,
    currentEmployerIsPending,
    currentRoleStartedAt: p.currentRoleStartedAt ?? null,
    currentRoleCity: p.currentRoleCity ?? null,
    // Phase 11.5.1  voluntary secondary-intent tags. The unknown-
    // value guard keeps the union honest if the DB ever holds an
    // out-of-set value (rare; older data, post-rollback shapes).
    openToTags: ((p.openToTags ?? []) as string[]).filter(isOpenToTag) as OpenToTag[],
    // Phase 11.5.2  CV backup. Storage key + filename are seeker-only;
    // never returned in PublicProfile or any /search projection.
    cvStorageKey: p.cvStorageKey ?? null,
    cvUploadedAt: p.cvUploadedAt?.toISOString() ?? null,
    cvFilename: p.cvFilename ?? null,
  };
}

function clampProficiency(n: number): SkillRef["proficiency"] {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as SkillRef["proficiency"];
}
