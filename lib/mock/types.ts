// Mirrors the eventual Drizzle schema (Phase 4) but redaction-aware.
// Phase 4 swaps `lib/data/provider.ts` from mock → db with NO change to these types
// or to the UI components that consume them. That is the seam.

export type EmploymentStatus =
  | "employed"
  | "unemployed"
  | "self_employed"
  | "studying"
  | "open_to_work";

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type Seniority = "junior" | "intermediate" | "senior";

export type UserRole = "seeker" | "employer" | "admin" | "gov";

export type FreshnessBand = "fresh" | "ageing" | "stale";

/**
 * Phase 7.5  What kinds of work this person will take. Independent of
 * `EmploymentStatus`. Multi-select on the profile editor; published on
 * `/p/[handle]` + queryable on `/search`.
 */
export type WorkAvailabilityKind =
  | "casual"
  | "part_time"
  | "contract"
  | "full_time"
  // Phase 9.18  work-mode values share this enum with employment-type
  // values. Two axes, one field, simpler UX. See migration 0030 + the
  // operator-review note on the same phase.
  | "remote"
  | "hybrid"
  // Phase 9.21  seasonal work pattern. Distinct from casual (ad-hoc,
  // irregular) and contract (fixed-term, often years): seasonal is
  // recurring + tied to a calendar window. The window itself lives on
  // the vacancy (`SeasonalWindow`); the seeker chip is just "yes to
  // this work pattern."
  | "seasonal";

export const WORK_AVAILABILITY_KINDS: WorkAvailabilityKind[] = [
  "casual",
  // Phase 9.21  position between casual and remote groups the
  // "non-traditional employment patterns" together (casual /
  // seasonal / remote / hybrid).
  "seasonal",
  "part_time",
  "contract",
  "full_time",
  "remote",
  "hybrid",
];

/**
 * Phase 9.21  vacancy-side season window. Both month values are
 * 1-12 (1 = January). `startMonth > endMonth` means the window wraps
 * the year (D4 in the plan, e.g. NovFeb is `{start: 11, end: 2}`).
 * `recurringAnnually` defaults true; the rare one-off seasonal role
 * sets it false.
 *
 * NEVER present in any read with one month set and the other NULL;
 * the action layer treats "one set, one NULL" the same as "neither
 * set" so the public payload is always either complete or absent.
 */
export interface SeasonalWindow {
  startMonth: number;
  endMonth: number;
  /**
   * Optional anchor years for each endpoint. Lets employers express
   * "Nov 2026  Feb 2027" unambiguously (the lifeguard / hospitality
   * summer-season case spans years). For recurring vacancies, year =
   * the FIRST occurrence; display rolls forward. Nullable so existing
   * month-only rows keep working unchanged.
   */
  startYear?: number | null;
  endYear?: number | null;
  recurringAnnually: boolean;
}

export interface SkillRef {
  name: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
  /**
   * Phase 9.9  Years of experience with this skill. Nullable
   * self-declared by the seeker; UI clamps 0..60. NULL renders as
   * the skill name + proficiency only; non-NULL renders as
   * "TypeScript · 5 yrs". 0 displays as "<1 yr".
   */
  yearsOfExperience?: number | null;
}

/**
 * What the public/search payload CAN expose.
 * Redaction Rule (TO_START_EVERY_SESSION.md §5): never include ID, documents,
 * or raw contact details here  even for verified employers. Contact reveal is
 * a separate, audit-logged code path (Phase 5).
 */
export interface PublicProfile {
  handle: string;
  /** Surname is redacted in public/search payloads (e.g. "Thandeka M."). */
  displayName: string;
  /**
   * Optional profile photo URL. Phase 3+: stored in Supabase Storage with signed-URL access;
   * the public payload only surfaces a small/thumbnail variant. When null, the
   * Avatar component renders a sophisticated SA-palette initials block.
   */
  profilePhotoUrl?: string | null;
  profession: string;
  seniority: Seniority | null;
  city: string;
  province: string;
  /** Shown, optionally filterable. NEVER a gate. Location-Not-Nationality Rule. */
  nationality: string | null;
  /** Drives optional "highlight" UI only. Never used to exclude. */
  isCitizen: boolean;
  topSkills: SkillRef[];
  /** One-paragraph bio for the profile page (still PII-light). */
  bio?: string;
  status: EmploymentStatus;
  /** ISO timestamp. Freshness band derives from this  see helpers.freshnessBand(). */
  statusConfirmedAt: string;
  /**
   * Phase 7.5  Work-availability dimension. Decoupled from `status`:
   * a `studying` person can be `["casual"]`; a `full_time` employee
   * can be `["contract"]`. Empty = no signal. Publicly readable, never
   * a sensitive attribute  it's a self-set preference.
   */
  workAvailability: WorkAvailabilityKind[];
  verification: VerificationStatus;
  /** 0–100. Drives ProfileCompleteness component + ranking. */
  completeness: number;
  /**
   * Phase 9.9  Total years of professional experience. Nullable
   * self-declared by the seeker; UI clamps 0..60. NULL renders as
   * the seniority chip unchanged; non-NULL composes
   * "Senior · 8 yrs". 0 displays as "<1 yr".
   */
  yearsExperience?: number | null;
  /** When the profile joined Sebenza (for "member since"). */
  memberSince: string;
  experience?: ExperienceItem[];
  qualifications?: QualificationItem[];
  /**
   * Active or recent academic enrolment. Optional  only set for student seekers.
   * Surfaces Student mode in the dashboard + Career compass.
   */
  academic?: AcademicProfile;
  /**
   * Phase 9.22  current employer name. Only surfaced when the
   * underlying org is picker-visible (sebenza_registered OR verified
   * seeker_named); a pending seeker_named org never reaches the
   * public payload. NULL otherwise.
   */
  currentEmployerName?: string | null;
  /**
   * Phase 9.22  the origin badge for the current employer. Drives the
   * UI label on /p/[handle] + the search row: "Sebenza employer" vs
   * "Listed by N seekers". NULL when no employer is shown.
   */
  currentEmployerBadge?: "sebenza_registered" | "seeker_named_verified" | null;
  /** Phase 9.22  ISO yyyy-mm-dd start date of the current role.
   *  Only meaningful when `currentEmployerName` is set. */
  currentRoleStartedAt?: string | null;
  /**
   * Phase 9.23  the date the seeker's employment-at-current-employer
   * was verified by a contact via the one-shot email flow. NULL when
   * not verified, or when the verification has aged past the 12-month
   * badge lifetime (D6). When set, the public renderer surfaces an
   * "Employer-verified · MMM YYYY" badge alongside the existing
   * "Currently at" line.
   */
  employmentVerifiedAt?: string | null;
  /**
   * Phase 11.5.1  voluntary "open to" tags. Independent of `status`
   * (a fully-employed senior can still be open to mentorship). Empty
   * array when the seeker hasn't selected any.
   */
  openToTags?: OpenToTag[];
}

/**
 * Phase 11.5.1  canonical "open to" tag set. Independent of
 * employment status. The seeker opts in per tag from the profile
 * editor; employers can filter `/search` by tag with `?open_to=`.
 *
 * The four tags capture real SA professional behaviour the binary
 * employed/looking status misses:
 *   - mentorship       informal coaching of juniors in the seeker's field
 *   - freelance        bounded freelance / consulting work
 *   - contract_gigs    short-term contract gigs (weekends / between roles)
 *   - public_speaking  conference talks, panels, podcasts
 */
export const OPEN_TO_TAGS = [
  "mentorship",
  "freelance",
  "contract_gigs",
  "public_speaking",
] as const;

export type OpenToTag = (typeof OPEN_TO_TAGS)[number];

export const OPEN_TO_TAG_LABEL: Record<OpenToTag, string> = {
  mentorship: "Mentorship",
  freelance: "Freelance",
  contract_gigs: "Contract gigs",
  public_speaking: "Public speaking",
};

export const OPEN_TO_TAG_HINT: Record<OpenToTag, string> = {
  mentorship:
    "Mentor a junior in your field once a month  usually unpaid.",
  freelance:
    "Bounded freelance or consulting work alongside your day job.",
  contract_gigs:
    "Short-term contract gigs on weekends or between roles.",
  public_speaking:
    "Conference talks, panels, podcasts, internal company sessions.",
};

export function isOpenToTag(v: string): v is OpenToTag {
  return (OPEN_TO_TAGS as readonly string[]).includes(v);
}

export interface ExperienceItem {
  role: string;
  organization: string;
  city: string;
  /** ISO yyyy-mm. */
  startedAt: string;
  /** ISO yyyy-mm or null for current. */
  endedAt: string | null;
  description?: string;
}

export interface QualificationItem {
  title: string;
  institution: string;
  /** ISO yyyy. */
  awardedYear: number | null;
  verification: VerificationStatus;
}

/**
 * NQF (National Qualifications Framework) levels per SAQA.
 * 4 = Matric / National Certificate, 6 = Diploma, 7 = Bachelor's, 8 = Honours,
 * 9 = Master's, 10 = Doctorate.
 */
export type NqfLevel = 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type InstitutionKind =
  | "university"
  | "uot" // University of Technology
  | "tvet" // Public TVET college
  | "distance" // UNISA, distance-learning specialised
  | "indlela" // National Artisan Moderation Body
  | "private";

/**
 * Active academic enrolment. Only present when the seeker is (or recently was)
 * a student. Status-Freshness Rule still applies: `expectedGraduation` is the
 * freshness anchor here  past it = profile needs an update.
 */
export interface AcademicProfile {
  institutionSlug: string;
  institutionLabel: string;
  institutionKind: InstitutionKind;
  programme: string;
  /** Free-text discipline (will become a controlled taxonomy in Phase 7). */
  fieldOfStudy: string;
  nqfLevel: NqfLevel;
  /** 1, 2, 3, 4, 5  academic year of study. null for postgrad without year structure. */
  currentYear: number | null;
  /** ISO yyyy-mm  expected graduation. Drives freshness for student profiles. */
  expectedGraduation: string;
  /** True if studying via NSFAS-funded route. Shown as a chip for context. */
  nsfas: boolean;
  /** Verification state of the enrolment record itself. Defaults `unverified`. */
  verification: VerificationStatus;
  /** Whether the seeker is actively looking for internships / graduate programmes. Opt-in. */
  openToInternships: boolean;
  /** Whether the seeker is actively looking for full graduate-track roles. Opt-in. */
  openToGraduateProgrammes: boolean;
  /**
   * Phase 13.1  current-semester module list. Free-text strings; the
   * matcher fuzzy-matches them against the editorial `module_skills`
   * catalogue. Empty array when not declared. Max 8 entries enforced
   * at the action boundary.
   */
  currentModules: string[];
  /**
   * Phase 13.1  elective the student picked when they had options.
   * Only meaningful from year 2. NULL when not declared.
   */
  electiveChosen: string | null;
  /**
   * Phase 13.1  3rd/4th-year project / dissertation topic. 200-char
   * cap enforced at the action boundary. NULL when not declared.
   */
  projectTopic: string | null;
}

export const STUDENT_MODULES_MAX = 8;
export const STUDENT_PROJECT_TOPIC_MAX = 200;
export const STUDENT_ELECTIVE_MAX = 100;

export interface SearchFilters {
  query?: string;
  /** Exact profession-label filter. Used by the /insights heatmap deep-link
   *  so cell clicks are robust against FTS-tokenization quirks + casing
   *  drift in stored profession strings. Pass the canonical label
   *  ("Software Developer"), NOT the slug. Case-insensitive at query time. */
  profession?: string | null;
  province?: string | null;
  city?: string | null;
  status?: EmploymentStatus | null;
  seniority?: Seniority | null;
  verification?: VerificationStatus | null;
  highlightCitizens?: boolean;
  /** Phase 6: scope to seekers whose `academic_profiles.openToInternships`
      is true. Surfaces the student-mode pool for graduate-programme intake. */
  openToInternships?: boolean;
  /** Phase 6: scope to seekers open to a full graduate-track role. */
  openToGraduateProgrammes?: boolean;
  /**
   * Phase 7.5: multi-select work-availability filter. Empty array =
   * no filter applied. Matches via `&&` array containment.
   */
  availableFor?: WorkAvailabilityKind[];
  /**
   * Phase 9.19  hard floor on the seeker's total years of experience.
   * NULL / omitted = no constraint; the matcher does not check this
   * axis at all. Seekers whose `yearsExperience` is NULL never pass
   * a non-null floor (Phase 9.19 D2: "unknown is not a pass").
   */
  minYearsExperience?: number | null;
  /**
   * Phase 9.19  minimum NQF level on the seeker's HIGHEST academic
   * record. NULL / omitted = no NQF check at all; every seeker
   * passes regardless of whether they hold a credential (Phase 9.19
   * D3: SA roles in trades / hospitality / casual labour / sales
   * rarely require formal qualifications).
   */
  minNqfLevel?: number | null;
  /**
   * Phase 11.3.2  caller's org id (when the search is run by a
   * verified employer). When set, profiles that have blocked the org
   * are silently excluded via `seeker_blocked_employers`. Always null
   * for anonymous / non-employer searches  no block enforcement.
   */
  callerOrgId?: string | null;
  /**
   * Phase 11.5.1  filter by "open to" tag overlap. Empty array (or
   * absent) means no constraint; a profile matches when ANY of its
   * `openToTags` overlaps with the requested set (array overlap via
   * `&&`). Backed by the GIN index on `profiles.open_to_tags`.
   */
  openTo?: OpenToTag[];
}

export interface SearchResult {
  total: number;
  profiles: PublicProfile[];
}

export interface AnalyticsSnapshot {
  totalActive: number;
  confirmedHiresThisMonth: number;
  byStatus: Record<
    EmploymentStatus,
    { count: number; freshnessConfidence: number }
  >;
  demandBySkill: { skill: string; searches: number; matches: number }[];
  trend: { month: string; registrations: number; placements: number }[];
}

export interface TaxonomyEntry {
  slug: string;
  label: string;
}

export interface Province extends TaxonomyEntry {
  cities: TaxonomyEntry[];
}
