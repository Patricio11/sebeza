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
 * the encrypted-but-decryptable-by-self bits — for now `PublicProfile` is the
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
} from "@/lib/mock/types";
import { getSessionUser } from "@/lib/auth/guard";
import { INSTITUTIONS } from "@/lib/mock/taxonomy";

export type MyProfile = PublicProfile & {
  /** Row id (text/uuid in DB). Lets actions reference the profile without an extra lookup. */
  profileId: string;
  /** Whether a national ID is on file. Never echo back the value itself. */
  hasNationalId: boolean;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const session = await getSessionUser();
  if (!session) return null;
  return loadProfileForUser(session.id);
}

/**
 * Direct load by user id — used after sign-up flows where the session was just
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

  // Parallel: skills, experience, qualifications, academic.
  const [skillRows, expRows, qualRows, acadRows] = await Promise.all([
    db
      .select({
        skillSlug: schema.profileSkills.skillSlug,
        proficiency: schema.profileSkills.proficiency,
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
    memberSince: p.memberSince.toISOString(),
    topSkills,
    experience,
    qualifications,
    academic,
  };
}

function clampProficiency(n: number): SkillRef["proficiency"] {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as SkillRef["proficiency"];
}
