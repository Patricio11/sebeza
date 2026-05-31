/**
 * Drizzle schema  Phase 0 + Phase 4 sketch.
 *
 * Phase 1 does not run migrations. This file exists so:
 *  1. The shape of the eventual DB is in the repo from commit one.
 *  2. The mock dataProvider stays type-aligned with the real one.
 *
 * POPIA columns are present from day one (consents, auditLog, deletedAt,
 * nationalIdEnc)  never retrofitted. See TO_START_EVERY_SESSION.md §4.
 */
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Postgres `tsvector`  full-text search column. Read-only from the app's
 * perspective; populated by the trigger declared in
 * `db/migrations/0001_phase4_search.sql`.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const employmentStatus = pgEnum("employment_status", [
  "employed",
  "unemployed",
  "self_employed",
  "studying",
  "open_to_work",
]);

export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

/**
 * Phase 9.16  Identity document kind discriminator on `profiles`. SA
 * ID is the common case; passport supports non-SA residents per the
 * Citizen-Visibility Rule. The encrypted ID text in `national_id_enc`
 * is kind-agnostic; this enum tells the application which validation
 * + UI flow applies.
 */
export const idDocumentKind = pgEnum("id_document_kind", [
  "sa_id",
  "passport",
]);

// Phase 9  added `gov` for the government / policy / SETA-partner
// workspace. Admins promote a user to `gov` from the admin users surface.
export const userRole = pgEnum("user_role", [
  "seeker",
  "employer",
  "admin",
  "gov",
]);

export const consentPurpose = pgEnum("consent_purpose", [
  "searchability",
  "contact_reveal",
  "document_sharing",
  "analytics_aggregate",
  // Phase 7.5  opt-in inclusion in the longitudinal education-to-
  // employment outcomes dataset. Optional, default-off, non-degrading:
  // withholding it must NOT weaken job-search in any way.
  "outcomes_research",
  // Phase 9.8.3  opt-in to receive vacancy invitations from verified
  // employers (an employer flags a seeker for a SPECIFIC named role,
  // not generic outreach). Optional, default-off, non-degrading: a
  // seeker who has NOT granted this is still searchable + contactable
  // exactly as today; they simply don't receive vacancy invites. The
  // 9.8.4 invite action checks this consent at the boundary and the
  // bulk-invite skip path records the actual reason in the audit log
  // (per D5  the per-seeker reason is never surfaced in UI).
  "vacancy_matching",
  // Phase 11.4.4 D2  per-channel opt-in for SMS + WhatsApp critical
  // notifications. Optional, default-off; even when granted, the
  // dispatch layer ALSO requires the admin-controlled platform flag
  // + an allowlist row + phone verification. Multi-gate by design
  // we never spend without explicit operator approval.
  "messaging_channel_sms",
  "messaging_channel_whatsapp",
]);

export const consentState = pgEnum("consent_state", [
  "none",
  "granted",
  "revoked",
]);

export const institutionKind = pgEnum("institution_kind", [
  "university",
  "uot",
  "tvet",
  "distance",
  "indlela",
  "private",
]);

export const orgMemberRole = pgEnum("organization_member_role", [
  "owner",
  "recruiter",
  "viewer",
]);

/** Phase 7  moderation reasons. Reporter chooses one when filing. */
export const reportReason = pgEnum("report_reason", [
  "fake_identity",
  "inappropriate",
  "harassment",
  "spam",
  "other",
  // Phase 11.3.3  invitation-specific reasons (used when the report
  // points at a vacancy invitation rather than a profile).
  "irrelevant_role",
  "bad_faith_company",
  "off_platform_contact_request",
]);

/** Phase 7  moderation lifecycle. */
export const reportStatus = pgEnum("report_status", [
  "open",
  "closed_no_action",
  "actioned",
]);

/**
 * Phase 7.5  Work-availability dimension. Decoupled from
 * `employmentStatus` so a `studying` person can signal `casual`, and a
 * `full_time` employee can signal `contract`. Status answers "what is
 * your situation"; availability answers "what work will you take."
 */
export const workAvailabilityKind = pgEnum("work_availability_kind", [
  "casual",
  "part_time",
  "contract",
  "full_time",
  // Phase 9.18  work-mode values added to the same enum as
  // employment-type values. The two axes are orthogonal in theory
  // (you can be "full-time remote") but the picker treats them as a
  // single "what work are you open to" set for UX simplicity.
  "remote",
  "hybrid",
  // Phase 9.21  seasonal work pattern. Distinct from `casual`
  // (irregular ad-hoc) and `contract` (fixed-term, often years):
  // seasonal is RECURRING + tied to a calendar window. Lodges in
  // Dec-Feb, citrus pickers May-Oct, Christmas retail trade. The
  // vacancy carries the actual window (seasonal_window_* cols on
  // vacancies); the seeker chip is "yes to this work pattern."
  "seasonal",
]);

/**
 * Phase 7.5  Placement source. Splits employer-confirmed hires
 * (the Phase-5 default, the only signal that counts in official
 * analytics + government rollups) from softer seeker self-reports
 * (clearly flagged, excluded from aggregate stats).
 */
export const placementSource = pgEnum("placement_source", [
  "employer_confirmed",
  "seeker_reported",
]);

/**
 * Phase 8  SAQA verification job lifecycle. Admin clicks Approve on
 * `/admin/verifications`; when `feature_flag_saqa_worker` is on, the
 * action enqueues a row instead of flipping the qualification directly.
 * The cron worker claims `queued` rows, POSTs to SAQA, and writes the
 * result back.
 */
export const qualificationKycStatus = pgEnum("qualification_kyc_status", [
  "queued",
  "in_flight",
  "verified",
  "mismatch",
  "error",
]);

// ---------- Users / roles (Better Auth-compatible) ----------

/**
 * The auth user table. Maps to Better Auth's `user` model via the
 * `tables: { user: { modelName: "app_user" } }` config in `lib/auth/server.ts`.
 * Required Better Auth columns (id, name, email, emailVerified, image,
 * createdAt, updatedAt) sit alongside our Sebenza-specific columns (role,
 * deletedAt) on the same row.
 */
export const appUser = pgTable("app_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("seeker"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  /** Phase 7  admin moderation. Suspended users are bounced at sign-in
      with a clear "your account is suspended" message; the row stays
      so we have an audit trail of who suspended whom and when. */
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  suspendedByUserId: text("suspended_by_user_id"),
  /** Phase 7 (Task 7.6)  per-kind notification preferences. JSONB shape:
      `{ "contact.revealed": { inApp: true, email: false }, … }`. Missing
      entries fall back to the catalog defaults in lib/notifications. */
  notificationPrefs: jsonb("notification_prefs"),
  /** Phase 7 (Task 7.2)  managed by Better Auth's `twoFactor` plugin.
      Flips true once a user verifies their initial TOTP code; gates the
      `verify-2fa` step on sign-in and the forced-setup redirect for
      employer/admin accounts. */
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  /** Phase 8  per-kind email rate-limit clock.
      Shape: `{ "contact.revealed": "2026-05-23T12:14:00.000Z", … }`.
      `createNotification` uses this to enforce 1 email per kind per 60 s
      so a burst of dossier views can't spam an inbox. NULL = never sent. */
  notificationEmailLastSentAt: jsonb("notification_email_last_sent_at"),
  /** Phase 8  Home Affairs / KYC SaaS transaction id. Populated after
      a successful verify; cleared on revoke. The provider's id is what
      makes a "verified" badge auditable. */
  kycTransactionId: text("kyc_transaction_id"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  /**
   * Phase 11.4.3  seeker-side data-saver preference. Default OFF; the
   * visual experience is unchanged for existing users. The CSS
   * `prefers-reduced-data` media query is the floor; this column is
   * the ceiling  if the browser signals reduced-data, we downgrade
   * regardless of this column.
   */
  dataSaverMode: boolean("data_saver_mode").notNull().default(false),
  /**
   * Phase 11.4.4  AES-256-GCM-encrypted E.164 phone number. NEVER
   * stored in plaintext. NULL when no phone is on file. Wrapped by
   * the existing lib/crypto encryptField helper (Phase 0).
   */
  phoneE164Enc: text("phone_e164_enc"),
  /**
   * Phase 11.4.4  set once the seeker entered the 6-digit verification
   * code we SMS'd them. NULL means the phone is not yet trusted; the
   * dispatch layer refuses sends to unverified phones. Both SMS and
   * WhatsApp share this verification (one phone, two channels).
   */
  phoneVerifiedAt: timestamp("phone_verified_at"),
  /**
   * Phase 11.4.4  per-channel seeker opt-in. Default OFF. Even when
   * true, an admin must additionally flip the platform-wide
   * `feature_flag_sms_channel_enabled` / `_whatsapp_channel_enabled`
   * AND the seeker must be in `seeker_sms_allowlist` AND
   * `phone_verified_at` must be non-null before any provider call
   * actually fires. Zero spend by default.
   */
  smsChannelEnabled: boolean("sms_channel_enabled").notNull().default(false),
  whatsappChannelEnabled: boolean("whatsapp_channel_enabled")
    .notNull()
    .default(false),
});

/**
 * Better Auth session table. One row per active session per device.
 * `token` is the unique session identifier carried in the auth cookie.
 */
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Better Auth account table. Stores the credential record per user  for
 * email-and-password, this is where the bcrypt-hashed password lives
 * (`providerId = 'credential'`). For future OAuth providers, the access
 * + refresh tokens land here too.
 */
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Better Auth verification table. Used for email-verification tokens
 * and password-reset tokens. `identifier` = email; `value` = token;
 * `expiresAt` = TTL.
 */
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Phase 7 (Task 7.2)  Better Auth `twoFactor` plugin storage.
 *
 * One row per user once 2FA has been enabled. `secret` is the TOTP
 * seed (encrypted by Better Auth); `backupCodes` is a JSON array of
 * one-time recovery codes hashed at rest. `verified = true` after the
 * user confirms their first TOTP code.
 *
 * Schema matches the plugin's expectations exactly  Drizzle's role
 * here is just to surface the table for our own queries (e.g. the
 * admin `reset2faForUser` action).
 */
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").notNull().default(true),
});

// ---------- Profiles ----------

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  fullSurname: text("full_surname"), // never selected in public reads
  /** Object key in Supabase Storage. Public bucket access is OFF; reads use a
      server-issued signed URL with short TTL. */
  profilePhotoUrl: text("profile_photo_url"),
  profession: text("profession").notNull(),
  seniority: text("seniority"),
  city: text("city").notNull(),
  province: text("province").notNull(),
  nationality: text("nationality"),
  isCitizen: boolean("is_citizen").notNull().default(false),
  bio: text("bio"),
  status: employmentStatus("status").notNull().default("open_to_work"),
  statusConfirmedAt: timestamp("status_confirmed_at").notNull().defaultNow(),
  /**
   * Phase 7.5  What kinds of work this person is open to, independent
   * of `status`. Empty = no signal (default). Multi-select. Publicly
   * readable on `/p/[handle]` and `/search` filters  it's the point
   * of the field, never a sensitive attribute.
   */
  workAvailability: workAvailabilityKind("work_availability")
    .array()
    .notNull()
    .default(sql`'{}'::work_availability_kind[]`),
  /**
   * DISPLAY ONLY  never gate access on this column.
   *
   * Derived from `qualifications.verification` via the Phase 9.14
   * roll-up (`lib/profile/verification-rollup.ts`)  the SOLE writer.
   * The roll-up runs after every qualification approve / reject /
   * upload / delete, and on the one-time backfill migration `0022`.
   *
   * UX contract:
   *   verified   ⇔ ≥1 qualification.verification = 'verified'
   *   pending    ⇔ no verified, but ≥1 pending
   *   unverified ⇔ otherwise
   *   rejected   ⇔ NEVER auto-applied (per-doc rejection isn't a
   *                per-seeker judgement; Verification-Honesty Rule)
   *
   * If a future Server Action needs to gate on "this seeker has
   * documented evidence of X", DO NOT read `profiles.verification`
   * here  query `qualifications.verification` directly so the gate
   * names exactly what it's checking. Re-coupling display to access
   * via this column makes the system harder to reason about.
   *
   * Compliance assertion `profile-verification-matches-rollup` on
   * `/api/admin/outcomes-compliance` is the structural pin against
   * the roll-up drifting from this column.
   */
  verification: verificationStatus("verification").notNull().default("unverified"),
  completeness: integer("completeness").notNull().default(0),
  /**
   * Phase 9.9  Total years of professional experience. Nullable;
   * self-declared by the seeker on the profile editor. UI clamps
   * 0..60. NULL = "rather not say." Public  shipped in the
   * PublicProfile shape, visible on /search, /p/[handle], employer
   * dossier. Differs from DOB (out of scope per PHASE_9_9_PLAN.md).
   */
  yearsExperience: integer("years_experience"),
  /**
   * Phase 9.16  Date of birth. Typed `date` (no time component).
   * NULLABLE so existing rows pre-9.16 back-fill cleanly. Self-
   * declared at sign-up; editable on the profile editor. Powers
   * youth-unemployment analytics + YEI / ECD / internship
   * programme-eligibility checks. NEVER returned on PublicProfile
   * (the compliance assertion `dob-never-in-public-payload` pins
   * this structurally).
   */
  dateOfBirth: date("date_of_birth"),
  /**
   * Phase 9.16  identity document kind. SA ID is the common case;
   * passport supports non-SA residents (Citizen-Visibility Rule).
   * Defaults to 'sa_id' so pre-9.16 rows back-fill correctly.
   */
  idDocumentKind: idDocumentKind("id_document_kind").notNull().default("sa_id"),
  /**
   * Phase 9.16  passport-issuing country (ISO 3166-1 alpha-2).
   * Required when `idDocumentKind = 'passport'`, enforced
   * application-side (D3 in PHASE_9_16_PLAN.md). NULL when SA ID.
   */
  passportCountry: text("passport_country"),
  /** Encrypted (AES-GCM). NEVER selected on any public read path.
   *  Phase 9.16 broadens the semantics: carries either SA ID or
   *  passport text; the encryption is kind-agnostic. Column kept
   *  as-is (not renamed to `id_document_enc`) to avoid rippling to
   *  too many sites. The `idDocumentKind` column above is the
   *  discriminator. */
  nationalIdEnc: text("national_id_enc"),
  /**
   * Phase 9.16  ID document upload slot for admin-mediated review.
   * Mirrors the qualifications.documentStorageKey pattern. Storage
   * path: `{userId}/id-document/{id}.{ext}` via Supabase Storage.
   * NEVER returned on PublicProfile; only signed URLs minted server-
   * side for the seeker themselves or admin reviewers can yield the
   * document. Cleared on admin reject; the seeker re-uploads.
   */
  idDocumentStorageKey: text("id_document_storage_key"),
  idDocumentUploadedAt: timestamp("id_document_uploaded_at"),
  /** Phase 9.16  admin's rejection note shown to the seeker on the
   *  KycPanel after a reject. Populated alongside clearing
   *  `idDocumentStorageKey` so the seeker sees why + can re-upload. */
  idDocumentRejectionReason: text("id_document_rejection_reason"),
  /**
   * Phase 9.22  current employer linkage. Surfaces on the public
   * profile + employer dossier when the org is verified (either
   * `sebenza_registered` or `seeker_named + verification='verified'`).
   * NULL = the seeker hasn't declared where they work, or their
   * declared org is still pending admin review (the pending org row
   * is the only place the seeker's text lives in that case  see
   * Phase 9.15's "user data is never lost" contract).
   *
   * ON DELETE SET NULL  if the org is removed (rare; usually merged
   * by admin), the seeker's profile keeps surfacing as "employer not
   * declared" until they re-pick.
   */
  currentEmployerOrgId: text("current_employer_org_id").references(
    (): AnyPgColumn => organizations.id,
    { onDelete: "set null" },
  ),
  /** Phase 9.22  day-precision start date for the current role.
   *  Form captures year + month; day defaults to 01. NULL when
   *  the seeker hasn't told us. */
  currentRoleStartedAt: date("current_role_started_at"),
  /** Phase 9.22  city for the current role. Can diverge from
   *  `profiles.city` (the seeker's residence) for cross-province
   *  commuters. NULL falls back to `profiles.city` in the public
   *  renderer. */
  currentRoleCity: text("current_role_city"),
  /** Materialised tsvector. Populated by the trigger in
      `db/migrations/0001_phase4_search.sql` from
      profession + seniority + bio + city + province + skills_aggregated.
      App code never writes to it directly; queries use `@@` against this. */
  searchVector: tsvector("search_vector"),
  memberSince: timestamp("member_since").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  /** Phase 8  last time the status-stale nudge cron sent
      `status.stale.warning` for this profile. NULL = never sent.
      Idempotency anchor so we don't spam on every nightly run. */
  statusStaleLastSentAt: timestamp("status_stale_last_sent_at"),
  /**
   * Phase 11.5.1  voluntary secondary-intent tags. Independent of
   * `status`  a fully-employed seeker can be open to mentorship
   * without changing employment status. Validated against
   * `OPEN_TO_TAGS` in the action layer; only stored values match the
   * canonical set. GIN-indexed for `&&` overlap filter on /search.
   */
  openToTags: text("open_to_tags").array().notNull().default(sql`'{}'::text[]`),
  /**
   * Phase 11.5.2  personal CV backup. The file lives in the Supabase
   * private bucket under `{userId}/cvs/{id}.pdf`. PRIVATE TO THE
   * SEEKER (D3): never returned in any public projection, never
   * referenced by employer-facing surfaces, never indexed for search.
   * Admin access only via the existing POPIA data-export flow.
   */
  cvStorageKey: text("cv_storage_key"),
  cvUploadedAt: timestamp("cv_uploaded_at"),
  cvFilename: text("cv_filename"),
});

/** Active or recent academic enrolment. Optional 1:1 with profiles.
    Powers Student mode + the Career compass student lane.
    SAQA / institution verification flips `verification` in Phase 8. */
export const academicProfiles = pgTable("academic_profiles", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  institutionSlug: text("institution_slug")
    .notNull()
    .references(() => institutions.slug),
  programme: text("programme").notNull(),
  fieldOfStudy: text("field_of_study").notNull(),
  nqfLevel: integer("nqf_level").notNull(), // 4..10 per SAQA
  currentYear: integer("current_year"), // null for postgrad without year structure
  expectedGraduation: text("expected_graduation").notNull(), // ISO yyyy-mm
  nsfas: boolean("nsfas").notNull().default(false),
  verification: verificationStatus("verification").notNull().default("unverified"),
  openToInternships: boolean("open_to_internships").notNull().default(false),
  openToGraduateProgrammes: boolean("open_to_graduate_programmes")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
});

/**
 * Phase 9.12  Provenance honesty contract (D1 in PHASE_9_12_PLAN.md).
 * Together with `profile_skills.verified_at`, the UI rule is:
 *
 *   render "Verified"  ⇔  provenance = 'verified_provider' AND verified_at IS NOT NULL
 *
 * Anything else  including `self_attested_learning` rows that arrived
 * via 9.12.4's completion path  reads as "Self-attested" with a
 * provenance-specific qualifier ("via learning" / "imported" / etc.).
 */
export const skillProvenance = pgEnum("skill_provenance", [
  "self_attested",
  "self_attested_learning",
  "imported",
  "verified_provider",
]);

export const profileSkills = pgTable("profile_skills", {
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  skillSlug: text("skill_slug")
    .notNull()
    .references(() => skills.slug),
  proficiency: integer("proficiency").notNull(),
  /**
   * Phase 9.9  Per-skill years of experience. Nullable; self-
   * declared by the seeker on the SkillsEditor. UI clamps 0..60.
   * NULL = "rather not say." Public  shipped in the SkillRef
   * shape, visible on /search top-skills + /p/[handle] + employer
   * dossier. Phase 9.9.3 (OPTIONAL per D6) wires the value into
   * the Phase 4 ranking blend as a bounded multiplier; 9.9.1
   * just stores it.
   */
  yearsOfExperience: integer("years_of_experience"),
  /** Phase 9.12  honesty contract; see `skillProvenance` doc above. */
  provenance: skillProvenance("provenance").notNull().default("self_attested"),
  /** Phase 9.12  set by the dormant Phase 8 SAQA/provider adapter. */
  verifiedAt: timestamp("verified_at"),
});

export const experiences = pgTable("experiences", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  organization: text("organization").notNull(),
  city: text("city"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  description: text("description"),
});

// ---------- Phase 9.12  the learning loop ----------
/**
 * One row per (seeker, accepted-recommendation) instance. The seeker's
 * own audit trail of "I tried to learn X." Aggregated by 9.13 into the
 * "why learners stall" + curriculum-vs-demand intelligence; never shown
 * on any public / employer surface (seeker-private).
 */
export const learningState = pgEnum("learning_state", [
  "interested",
  "accepted",
  "in_progress",
  "completed",
  "abandoned",
]);

export const abandonReason = pgEnum("abandon_reason", [
  "too_expensive",
  "no_time",
  "course_quality",
  "access_transport",
  "changed_direction",
  "too_difficult",
  "other",
]);

export const learningItems = pgTable(
  "learning_items",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skills.slug),
    title: text("title").notNull(),
    provider: text("provider").notNull(),
    resourceUrl: text("resource_url"),
    /** "seta" | "tvet" | "indlela" | "free" | "other"  free text by
     *  design so 9.13's stall analytics can aggregate without an enum
     *  rev when a new provider category appears. Never aggregated by
     *  provider per D5; resource_kind is the dimension used. */
    resourceKind: text("resource_kind").notNull(),
    isFree: boolean("is_free").notNull().default(false),
    state: learningState("state").notNull().default("accepted"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    abandonedAt: timestamp("abandoned_at"),
    abandonReason: abandonReason("abandon_reason"),
    /** Optional 200-char note. PII-flagged in audit + future exports. */
    abandonNote: text("abandon_note"),
    /** 9.12.6 cron idempotency anchor (mirrors statusStaleLastSentAt). */
    nudgeLastSentAt: timestamp("nudge_last_sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    profileStateIdx: index("learning_items_profile_state_idx").on(
      t.profileId,
      t.state,
    ),
    skillStateIdx: index("learning_items_skill_state_idx").on(
      t.skillSlug,
      t.state,
    ),
  }),
);

export const qualifications = pgTable("qualifications", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  institution: text("institution").notNull(),
  awardedYear: integer("awarded_year"),
  verification: verificationStatus("verification").notNull().default("unverified"),
  documentStorageKey: text("document_storage_key"), // object key in Supabase Storage; signed URL only on audited reveal
});

// ---------- Organisations + placements (employer side) ----------

/**
 * Phase 9.22  origin axis on organisations.
 *
 *   sebenza_registered  the org signed up via the employer flow,
 *                        carries the Phase 9.10 KYC lifecycle.
 *   seeker_named        the org was created from a seeker's "Other"
 *                        submission on the employer picker. Carries
 *                        the Phase 9.22 admin review lifecycle on the
 *                        existing `verification` column.
 */
export const organizationOrigin = pgEnum("organization_origin", [
  "sebenza_registered",
  "seeker_named",
]);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number"),
  industry: text("industry"),
  sizeBand: text("size_band"),
  city: text("city"),
  country: text("country").notNull().default("South Africa"),
  /**
   * Phase 9.22  the lifecycle column. For sebenza_registered orgs
   * the Phase 9.10 semantics hold (unverified -> pending -> verified
   * / rejected). For seeker_named orgs the semantics are
   * unverified (just submitted, awaiting admin review) -> verified
   * (admin approved + edited) or rejected. The `origin` column
   * disambiguates; the picker filter is
   *   WHERE origin = 'sebenza_registered' OR verification = 'verified'
   * which surfaces every recruiting employer + every verified
   * seeker-named org.
   */
  verification: verificationStatus("verification").notNull().default("unverified"),
  /**
   * Phase 9.10  the org vetting lifecycle columns. NULL until the
   * admin reviews the submission:
   *   - verifiedAt        : timestamp of admin approval
   *   - verifiedByUserId  : the admin who approved (audit trail)
   *   - rejectionReason   : free text shown to the org owner when
   *                         verification = 'rejected'
   *   - adminNote         : free text shown as a yellow banner on
   *                         the onboarding form when admin clicked
   *                         "Request Changes". Cleared on resubmit.
   *   - companyAddress    : physical address (captured at onboarding,
   *                         not at signup  signup stays low-friction)
   *   - vatNumber         : optional, captured at onboarding
   */
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: text("verified_by_user_id").references((): AnyPgColumn => appUser.id),
  rejectionReason: text("rejection_reason"),
  adminNote: text("admin_note"),
  companyAddress: text("company_address"),
  vatNumber: text("vat_number"),
  /**
   * Phase 9.22  origin axis. Existing rows default to
   * `sebenza_registered` since every pre-9.22 org came through the
   * employer signup path. Seeker-submitted "Other" orgs are inserted
   * with `seeker_named`.
   */
  origin: organizationOrigin("origin").notNull().default("sebenza_registered"),
  /**
   * Phase 9.22  denormalised count of profiles with this org as
   * their `current_employer_org_id`. Powers the "Listed by N seekers"
   * badge on verified seeker-named orgs without a per-render JOIN.
   * Maintained by the updateCurrentEmployment + suggestion-promote /
   * merge / reject paths; a nightly cron is the backstop for drift.
   */
  listedBySeekerCount: integer("listed_by_seeker_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Phase 9.10  org document enum + table.
 *
 * The four required SA-standard KYC documents are baked into the
 * enum (D1 in PHASE_9_10_PLAN.md): admin-managed-requirements CRUD
 * is deferred post-launch. `other` allows a single optional
 * supporting doc (e.g. SARB licence for a financial-services org).
 */
export const orgDocumentKind = pgEnum("org_document_kind", [
  "company_reg_cert",   // CIPC / CK1 / CK2 document
  "tax_clearance",      // SARS pin or letter
  "proof_of_address",   //  3 months old
  "bank_confirmation",  // bank letter
  "other",              // optional supporting doc
]);

export const organizationDocuments = pgTable("organization_documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references((): AnyPgColumn => organizations.id, { onDelete: "cascade" }),
  kind: orgDocumentKind("kind").notNull(),
  originalName: text("original_name").notNull(),
  /** Supabase Storage object key: `{userId}/org-documents/{id}.{ext}` */
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedByUserId: text("uploaded_by_user_id")
    .notNull()
    .references((): AnyPgColumn => appUser.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

/** Per-employer team membership. Each member's PII access is audit-logged
    separately. Suspending a member instantly revokes their reveal capability. */
export const organizationMembers = pgTable("organization_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  role: orgMemberRole("role").notNull().default("recruiter"),
  twoFactorActive: boolean("two_factor_active").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  suspendedAt: timestamp("suspended_at"),
});

/**
 * Phase 9.20  placement lifecycle state. `active` is the default for
 * any new hire; `departed` is set by the Tier 3 markPlacementDeparted
 * action; `unknown` is reserved for legacy / imported rows where the
 * employer never told us either way (and we don't want to assume).
 */
export const placementLifecycleStatus = pgEnum(
  "placement_lifecycle_status",
  ["active", "departed", "unknown"],
);

/**
 * Phase 9.20 Tier 3 D4  SA labour-relations vocabulary for *why* a
 * placement ended. Categorical fact only; the *reason* (performance,
 * misconduct, etc.) is deliberately NOT captured. Recording the
 * reason would make Sebenza a record-of-truth for LRA / CCMA
 * disputes  D0 territory.
 */
export const placementDepartureCategory = pgEnum(
  "placement_departure_category",
  [
    "resigned",
    "contract_ended",
    "dismissed",
    "retrenched",
    "moved_internally",
    "mutual_separation",
    "other",
  ],
);

export const placements = pgTable(
  "placements",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    /** Who clicked "Mark as hired". Null for legacy seeded rows; required
        going forward for accountability. */
    actorUserId: text("actor_user_id").references(() => appUser.id),
    role: text("role").notNull(),
    city: text("city").notNull(),
    hiredAt: timestamp("hired_at").notNull().defaultNow(),
    /** Optional salary band (kept private  never in public reads). */
    salaryBand: text("salary_band"),
    /**
     * Phase 7.5  Placement-Truth refinement. `employer_confirmed` (the
     * Phase 5 default, gated by the 30-day reveal window) is the only
     * source that counts in national/government analytics. `seeker_reported`
     * is a softer self-declared signal, shown on the seeker's own profile
     * flagged as such, and excluded from official aggregates.
     */
    source: placementSource("source").notNull().default("employer_confirmed"),
    /**
     * Phase 9.8  optional vacancy linkage. A placement may be logged
     * directly (Phase 5 flow, vacancy_id NULL) or tied to a specific
     * vacancy whose pipeline produced the hire. ON DELETE SET NULL so
     * deleting a vacancy never breaks Placement-Truth history.
     *
     * Cardinality: 1 vacancy : 0..N placements (an employer might hire
     * multiple chefs from one posting); 1 placement : 0..1 vacancy
     * (the pre-9.8 placement flow continues unchanged). No UNIQUE
     * constraint  asserted by FK shape.
     *
     * NB: the migration `0015_phase9_8_vacancies.sql` already created
     * the actual FK in Postgres; this `.references(...)` keeps the
     * Drizzle schema honest with the DB so future migration diffs
     * don't try to re-add the constraint.
     */
    vacancyId: text("vacancy_id").references((): AnyPgColumn => vacancies.id, {
      onDelete: "set null",
    }),
    /**
     * Phase 9.20  lifecycle denormalisation (D5). The latest check-in
     * outcome lives on this row so the "Active employees" list reads
     * are a single-table scan; the per-event ledger
     * (`placement_status_checks`) carries the full history.
     */
    currentStatus: placementLifecycleStatus("current_status")
      .notNull()
      .default("active"),
    lastCheckAt: timestamp("last_check_at"),
    lastCheckByUserId: text("last_check_by_user_id").references(
      () => appUser.id,
    ),
    /** Phase 9.20 Tier 3  date the seeker left this placement. Set
     *  by markPlacementDeparted; NULL while currentStatus='active'. */
    departureDate: date("departure_date"),
    /** Phase 9.20 Tier 3  categorical fact only. NULL while
     *  currentStatus='active'. See `placementDepartureCategory` for
     *  why the *reason* lives nowhere on this row. */
    departureCategory: placementDepartureCategory("departure_category"),
    /** Phase 9.20  org-private free-text context. Capped at 1000
     *  chars in the action layer; never seeker-visible. PII-flagged
     *  in audit exports (Phase 9.17 pattern). */
    internalNote: text("internal_note"),
  },
  (t) => ({
    // Phase 9.20  hot path for the Active-employees list + the
    // check-in-due cron. Drizzle's basic index() doesn't carry the
    // WHERE current_status='active' clause; the migration's CREATE
    // INDEX … WHERE is what actually lands. This plain index keeps
    // the introspection round-trip quiet.
    activeCheckDueIdx: index("placements_active_check_due_idx").on(
      t.organizationId,
      t.lastCheckAt,
      t.hiredAt,
    ),
  }),
);

/**
 * Phase 9.20  per-event check-in ledger. One row per "Is X still
 * employed?" confirmation. Denormalised onto `placements` for the
 * list-view read path; this table carries the durable trail.
 *
 * The Tier 2 action `confirmPlacementStillEmployed` writes here +
 * updates the parent's `last_check_at` / `last_check_by_user_id`
 * in the same transaction. The detail page lists rows in
 * `checked_at DESC` order.
 */
export const placementStatusChecks = pgTable(
  "placement_status_checks",
  {
    id: text("id").primaryKey(),
    placementId: text("placement_id")
      .notNull()
      .references(() => placements.id, { onDelete: "cascade" }),
    checkedByUserId: text("checked_by_user_id")
      .notNull()
      .references(() => appUser.id),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
    /** The single-question outcome. A `false` answer is the path into
     *  Tier 3's departure capture flow. */
    stillEmployed: boolean("still_employed").notNull(),
    /** Optional 500-char check-time note (validated by the action).
     *  Free-form context for THIS check; durable org-private notes
     *  live on `placements.internalNote`. PII-flagged in audit. */
    note: text("note"),
  },
  (t) => ({
    placementAtIdx: index("placement_status_checks_placement_at_idx").on(
      t.placementId,
      t.checkedAt,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.8  Vacancies & demand-driven matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vacancy lifecycle:
 *   draft   employer is drafting; not yet visible to anyone (incl. team)
 *   open    accepting invitations + responses; visible to org members
 *   closed  no new invites; pipeline preserved (was-not-filled signal)
 *   filled  a placement was logged for this vacancy
 */
export const vacancyStatus = pgEnum("vacancy_status", [
  "draft",
  "open",
  "closed",
  "filled",
]);

/**
 * Phase 9.8.4  invitation lifecycle.
 *
 * `invited`               employer sent the invite; awaiting seeker.
 * `accepted`              seeker said yes; available now (D1).
 * `accepted_with_notice`  seeker said yes but needs to serve out a notice
 *                          period (D1)  counts as a yes everywhere
 *                          except the "available now" filter; NEVER as a
 *                          decline. Asserted by 9.8.8 check (e).
 * `declined`              seeker said no (with optional reason in
 *                          `decline_reason` + 200-char note per D3).
 * `reconsidering`         a declined seeker changed their mind (the
 *                          change-of-mind path in 9.8.5; fires
 *                          `vacancy.reconsider` notification to employer).
 * `withdrawn`             employer pulled the invite (seeker notified,
 *                          audited as `vacancy.invite.withdraw`).
 * `expired`               nightly cron flipped past `expires_at` without
 *                          a seeker response. Audited as
 *                          `vacancy.invite.expire`; two notifications
 *                          fire (`vacancy.invite.expired` seeker;
 *                          `vacancy.invite.unanswered` employer).
 */
export const invitationState = pgEnum("invitation_state", [
  "invited",
  "accepted",
  "accepted_with_notice",
  "declined",
  "reconsidering",
  "withdrawn",
  "expired",
]);

/**
 * Phase 9.8.5  decline reason taxonomy.
 *
 * Six work-related reasons from the plan + `other` (which requires a
 * note per D3). The 200-char free-text note lives in
 * `vacancy_invitations.decline_note`. Enum stays additive: a seventh
 * ("commute / transport") or eighth ("hours don't suit") may surface
 * from real-traffic `other` notes and would land via migration.
 *
 * Schema-shipped in 9.8.4 (with the table) so 9.8.5's seeker-facing
 * action UI can store responses immediately without a follow-up
 * migration. The action surface is 9.8.5; the column is 9.8.4.
 */
export const declineReason = pgEnum("decline_reason", [
  "already_employed",
  "salary_not_competitive",
  "location_not_feasible",
  "skills_mismatch",
  "role_not_what_im_looking_for",
  "other",
]);

/**
 * Vacancies are STRICTLY ORG-PRIVATE. No vacancy field is exposed on any
 * public route, /p/[handle], /search, sitemap, or to a non-member of
 * `organizationId`. Salary band, like Phase 5 placements, never leaves the
 * org workspace. Enforced by the read functions in
 * `lib/employer/vacancies.ts` (every read filters by orgId) + a 9.8.8
 * compliance assertion that confirms no public/seeker surface imports
 * the table.
 */
export const vacancies = pgTable(
  "vacancies",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Member who created the vacancy. References app_user for auditability;
        vacancy persists if the creator later leaves the org. */
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => appUser.id),
    title: text("title").notNull(),
    professionSlug: text("profession_slug")
      .notNull()
      .references(() => professions.slug),
    provinceSlug: text("province_slug")
      .notNull()
      .references(() => provinces.slug),
    /** City refinement is optional  some vacancies are province-wide. */
    citySlug: text("city_slug").references(() => cities.slug),
    /** Free-form skill slugs from the controlled vocabulary. Stored as a
        Postgres text[] so filter-shape matches `SearchFilters.skills`. */
    skillSlugs: text("skill_slugs").array().notNull().default(sql`'{}'::text[]`),
    /** Free text for now; could enum (junior/intermediate/senior) later. */
    seniority: text("seniority"),
    /**
     * PRIVATE  never on any seeker-facing surface (consistent with the
     * Phase 5 placements.salary_band rule). Visible to Owners + Recruiters
     * inside the org; suppressed for Viewers.
     */
    salaryBand: text("salary_band"),
    description: text("description"),
    /** Document refs (e.g. "drivers_licence", "trade_certificate"). Stored
        as a Postgres text[] so the qualification taxonomy stays additive. */
    documentsRequired: text("documents_required")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: vacancyStatus("status").notNull().default("draft"),
    /**
     * Phase 9.8.4  per-vacancy invite expiry window (employer-set per D2).
     * NULL = "invites never expire on this vacancy." When non-null, the
     * /api/cron/vacancy-invite-expiry job computes expires_at on each
     * vacancy_invitations row at send time.
     */
    inviteExpiryDays: integer("invite_expiry_days"),
    /**
     * Phase 9.19  vacancy-side match enrichment. All three columns
     * follow the D0 "vacancy is the source of truth" principle: empty
     * array / NULL = the matcher does NOT constrain on that axis.
     *
     * workAvailability mirrors the seeker column's enum 1:1 (the same
     * Phase 9.18 work_availability_kind values: casual / part_time /
     * contract / full_time / remote / hybrid) so the array-overlap
     * match operates against identical types. Empty = "any work mode
     * / employment type" (matcher ignores the axis entirely).
     *
     * minYearsExperience is a hard floor on profiles.years_experience.
     * NULL = no floor.
     *
     * minNqfLevel is a hard floor on MAX(academic_profiles.nqf_level)
     * per profile. NULL = no floor. Many SA roles (trades, hospitality,
     * casual labour, sales) genuinely don't require a credential  the
     * field is optional precisely so those vacancies don't have to
     * fabricate a number.
     */
    workAvailability: workAvailabilityKind("work_availability")
      .array()
      .notNull()
      .default(sql`'{}'::work_availability_kind[]`),
    minYearsExperience: integer("min_years_experience"),
    minNqfLevel: integer("min_nqf_level"),
    /**
     * Phase 9.21  optional season window when the vacancy has
     * picked `seasonal` from work_availability. Months are 1-12;
     * start > end means the window wraps the year (D4 in the plan,
     * e.g. start=11, end=2 = NovFeb). Both NULL = "seasonal work,
     * timing TBD" (D0  blank means no constraint). NEVER one set
     * without the other (the Zod schema enforces this; SQL is
     * permissive so a partial state doesn't make the row invalid
     * pre-migration).
     */
    seasonalWindowStartMonth: integer("seasonal_window_start_month"),
    seasonalWindowEndMonth: integer("seasonal_window_end_month"),
    /**
     * Phase 9.21 follow-up  optional anchor year for each endpoint.
     * Lets employers express &ldquo;Nov 2026  Feb 2027&rdquo;
     * unambiguously (the lifeguard / hospitality summer-season case
     * spans years). When the vacancy is recurring annually, the year
     * is the FIRST occurrence; downstream display can roll forward.
     * Nullable to keep Phase 9.21-era rows working; the form copy
     * guides users that year is optional but recommended.
     */
    seasonalWindowStartYear: integer("seasonal_window_start_year"),
    seasonalWindowEndYear: integer("seasonal_window_end_year"),
    /** Phase 9.21  most seasonal roles repeat annually; the boolean
     *  lets the rare one-off (e.g. Dec 2026 World Cup pop-up) opt
     *  out. NULL when the window itself is NULL. */
    seasonalWindowRecurringAnnually: boolean(
      "seasonal_window_recurring_annually",
    ),
    /**
     * Phase 9.19 D8  follow-up nudges are opt-in per vacancy. When true,
     * a nightly cron looks for `invited`-state invitations older than 7
     * days and fires a single dedupe-keyed notification per invite per
     * cron run. Capped at 1 nudge per invite ever (re-nudging is
     * harassment). Default false; today no seeker expects a follow-up,
     * so on-by-default would feel like spam.
     */
    followUpNudgesEnabled: boolean("follow_up_nudges_enabled")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    closedAt: timestamp("closed_at"),
  },
  (t) => ({
    // Common query: list this org's vacancies grouped by status.
    orgStatusIdx: index("vacancies_org_status_idx").on(
      t.organizationId,
      t.status,
    ),
    // Phase 9.19  partial index on the years floor. Drizzle's
    // index() doesn't accept WHERE; the migration's CREATE INDEX … WHERE
    // is what actually lands in the database. This plain index keeps
    // the introspection round-trip quiet.
    minYearsIdx: index("vacancies_min_years_idx").on(t.minYearsExperience),
  }),
);

/**
 * Phase 9.8.4  vacancy invitations.
 *
 * Persistent (vacancy × seeker) pipeline rows. Opposite of saved
 * searches' `searchSnapshot ≠ result-set` rule: here the membership
 * IS the artefact  the employer's pipeline of who they've reached
 * out to about a specific role and how those people responded.
 *
 * Privacy invariant: like `vacancies`, every read filters via the
 * parent vacancy's organisation (no read function in
 * `lib/employer/invitations.ts` returns rows from another org). The
 * seeker's view is filtered through `profileId` matching the caller's
 * own profile, so cross-seeker leakage is structurally impossible.
 *
 * Consent gate: a row is only ever written when the seeker had
 * `vacancy_matching` consent in `state='granted'` at write time. The
 * bulk-invite Server Action splits selections into eligible + skipped
 * via `hasVacancyMatchingConsent()`; skipped seekers get an
 * `vacancy.invite.skip` audit-log row each (with the actual reason
 * never exposed to the employer UI to avoid leaking consent state, per
 * D5). The compliance assertion (b) in 9.8.8 walks this contract.
 *
 * Audit: every state transition fires a `vacancy.invite[.subkind]`
 * audit-log row through `lib/audit/index.ts` (reserved in 9.8.1).
 */
export const vacancyInvitations = pgTable(
  "vacancy_invitations",
  {
    id: text("id").primaryKey(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Org member who sent the invite. References app_user so the
        attribution survives the member later leaving the org. */
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => appUser.id),
    invitedAt: timestamp("invited_at").notNull().defaultNow(),
    /**
     * D2  computed at send time from `vacancy.invite_expiry_days`:
     * `expires_at = invited_at + N days` (NULL when the vacancy has no
     * expiry policy). The cron uses `WHERE state='invited' AND
     * expires_at IS NOT NULL AND expires_at < now()` to flip stale
     * rows to `expired`.
     */
    expiresAt: timestamp("expires_at"),
    state: invitationState("state").notNull().default("invited"),
    respondedAt: timestamp("responded_at"),
    /** D1  populated only when state is `accepted_with_notice`. NULL
        otherwise. Months because that's the dominant unit in SA notice
        cultures (1-month / 3-month). */
    noticePeriodMonths: integer("notice_period_months"),
    /** 9.8.5  set when state=`declined`. The structured enum keeps
        the "why roles go unfilled" aggregate honest; the free-text
        note lives in `decline_note` below. */
    declineReason: declineReason("decline_reason"),
    /** D3  200-char cap enforced at the action boundary too. Treated
        as PII in exports + audit-log meta (the seeker may inadvertently
        include identifying detail despite the on-screen reminder). */
    declineNote: text("decline_note"),
    /**
     * Phase 11.3.4  vacancy spec frozen at invitation-send time. The
     * seeker sees what the employer published when they sent the invite,
     * even if the vacancy is later edited. Pre-migration invitations
     * have NULL; the UI falls back to live-querying with a "may have
     * changed" annotation. Shape mirrors a subset of `vacancies`
     * columns (title, description, skillSlugs, workAvailability, season
     * window, salary band, profession + province + city). Stored as
     * jsonb so future spec additions don't need a column rev.
     */
    vacancySnapshot: jsonb("vacancy_snapshot"),
  },
  (t) => ({
    /**
     * One invitation per (vacancy, profile). Re-inviting the same
     * person on the same vacancy is a no-op; the bulk-invite action
     * surfaces this as the `already_invited` skip reason in the audit
     * log (UI shows the soft summary only).
     */
    uniqueInvite: uniqueIndex("vacancy_invitations_vacancy_profile_uq").on(
      t.vacancyId,
      t.profileId,
    ),
    /** Employer detail page: list this vacancy's pipeline grouped by state. */
    vacancyStateIdx: index("vacancy_invitations_vacancy_state_idx").on(
      t.vacancyId,
      t.state,
    ),
    /** Seeker inbox: list this seeker's invitations grouped by state. */
    profileStateIdx: index("vacancy_invitations_profile_state_idx").on(
      t.profileId,
      t.state,
    ),
    /** Cron sweep: find `invited` rows past their `expires_at`. Partial-
        index-like discipline via WHERE in the query (Drizzle's basic
        index() doesn't accept a WHERE clause; the index still helps
        the cron's range scan). */
    expiryIdx: index("vacancy_invitations_expires_at_idx").on(t.expiresAt),
  }),
);

/**
 * Phase 9.19 Tier 2  per-(vacancy, profile) bookmark surface used on
 * the match page. Scope is the **vacancy**, not the user (D5): two
 * team-mates editing the same vacancy work off the same shortlist.
 * Per-user cross-vacancy shortlists already live in `shortlistPools`
 * below; this table is the lighter "save for later on THIS vacancy"
 * affordance.
 *
 * Not a consent surface  removing is symmetric to adding, no audit
 * kind required. Cascades on both parent rows (vacancy + profile)
 * keep the table tidy without a separate sweeper.
 */
export const vacancyShortlists = pgTable(
  "vacancy_shortlists",
  {
    id: text("id").primaryKey(),
    vacancyId: text("vacancy_id")
      .notNull()
      .references(() => vacancies.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Member who added the row. References app_user so the
        attribution survives the member later leaving the org. */
    addedByUserId: text("added_by_user_id")
      .notNull()
      .references(() => appUser.id),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => ({
    /** One row per (vacancy, profile)  toggling is an upsert/delete. */
    vacancyProfileUq: uniqueIndex("vacancy_shortlists_vacancy_profile_uniq").on(
      t.vacancyId,
      t.profileId,
    ),
    /** Hot path: match-page render loads the whole vacancy's shortlist. */
    vacancyIdx: index("vacancy_shortlists_vacancy_idx").on(t.vacancyId),
  }),
);

/** Saved-search definitions per organisation. Stored filters get re-run
    by `runSavedSearch` to update `newMatchesCount`  we don't snapshot
    result rows. Cross-team within an org: every member sees the org's
    saved searches. */
export const savedSearches = pgTable("saved_searches", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => appUser.id),
  name: text("name").notNull(),
  /** Same shape as `SearchFilters` in `lib/mock/types.ts`  kept as JSONB
      so the schema doesn't need a migration every time we add a filter. */
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastRunAt: timestamp("last_run_at"),
  newMatchesCount: integer("new_matches_count").notNull().default(0),
  /** Phase 8  SHA-1 hash of the sorted profile-id set returned by the
      last cron run. The cron diffs the current set against this to find
      genuinely new matches (any id not in the previous set), rather than
      re-firing for the same matches every night. */
  lastMatchHash: text("last_match_hash"),
});

/** Talent pools = an org's shortlists. Phase 5 keeps them simple:
    name + description + members. Phase 6 may add stage/notes per member. */
export const shortlistPools = pgTable("shortlist_pools", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => appUser.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Many-to-many: which profiles are in which pools. Adding/removing a
    member is audit-logged (kind=profile.shortlist.add/.remove). */
export const shortlistMembers = pgTable(
  "shortlist_members",
  {
    poolId: text("pool_id")
      .notNull()
      .references(() => shortlistPools.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    addedByUserId: text("added_by_user_id")
      .notNull()
      .references(() => appUser.id),
    addedAt: timestamp("added_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.poolId, t.profileId] }),
  }),
);

// ---------- Search analytics (skills-gap signal) ----------

export const searchEvents = pgTable("search_events", {
  id: text("id").primaryKey(),
  terms: text("terms"),
  filters: jsonb("filters"),
  resultCount: integer("result_count").notNull(),
  actorOrgId: text("actor_org_id"),
  at: timestamp("at").notNull().defaultNow(),
});

// ---------- POPIA: consents + audit log ----------

export const consents = pgTable("consents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  purpose: consentPurpose("purpose").notNull(),
  state: consentState("state").notNull().default("none"),
  /** Catalog version of the consent copy the user actually saw. */
  version: text("version").notNull(),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  // Phase 11.3.1  pause-searchability columns. `pausedUntil` is the
  // canonical signal: state='granted' AND pausedUntil > now() means
  // paused. The nightly cron clears expired pauses; `pausedAt` +
  // `pausedReason` are historical context for the audit trail.
  pausedUntil: timestamp("paused_until"),
  pausedAt: timestamp("paused_at"),
  pausedReason: text("paused_reason"),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  actor: text("actor").notNull(),
  subject: text("subject"),
  meta: jsonb("meta"),
  at: timestamp("at").notNull().defaultNow(),
});

/**
 * Phase 7  moderation reports. Filed from the public `/p/[handle]`
 * Report button (`flagProfile`); resolved on `/admin/moderation` by an
 * admin's `closeReport` or `suspendUser` action.
 *
 * Anonymous reports allowed (`reporter_user_id` nullable)  public users
 * shouldn't have to sign in to flag a bad actor.
 */
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  // Phase 11.3.3  subjectProfileId now nullable; an invite report
  // points at an org + invitation, not a profile. Legacy profile
  // reports keep the column populated.
  subjectProfileId: text("subject_profile_id").references(
    () => profiles.id,
    { onDelete: "cascade" },
  ),
  // Phase 11.3.3  invite reports populate these two columns. Either
  // (subject_profile_id) or (subject_org_id, subject_invitation_id)
  // is set; the admin queue surfaces whichever path was used.
  subjectOrgId: text("subject_org_id").references((): AnyPgColumn => organizations.id, {
    onDelete: "cascade",
  }),
  subjectInvitationId: text("subject_invitation_id").references(
    (): AnyPgColumn => vacancyInvitations.id,
    { onDelete: "set null" },
  ),
  reporterUserId: text("reporter_user_id"),
  reason: reportReason("reason").notNull(),
  note: text("note"),
  status: reportStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  closedByUserId: text("closed_by_user_id"),
  closedReason: text("closed_reason"),
});

/**
 * Phase 7  platform settings as a key/value JSONB store. Replaces the
 * hardcoded constants the ranking SQL + freshness band engine carry.
 *
 * Read via `getSetting(key)` with a 5-min module-scope cache so we don't
 * hammer the DB. Write via the admin Server Action which invalidates the
 * cache on update.
 */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedByUserId: text("updated_by_user_id"),
});

/**
 * Phase 7 (Task 7.6)  in-app notifications.
 *
 * Notifications are UX state, NOT the system of record. The audit log
 * remains authoritative for any PII access; deleting a notifications
 * row only clears the user-facing bell badge.
 *
 * `kind` mirrors a subset of `AuditKind` (catalog in
 * docs/PHASE_7_PLAN.md §C.7). `meta` carries display-only context
 *  never raw PII beyond what the user has already consented to share
 * (org name, role title). Email addresses, ID numbers, document keys
 * never appear in this table.
 */
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => appUser.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  meta: jsonb("meta"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Time-series snapshots of the skills-gap signal. Captured by
 * `captureSkillGapSnapshot()` (run nightly by the Phase 8 cron; in the
 * meantime triggerable manually from the Phase 7 admin surface).
 *
 * Each capture writes one row per skill in the top-N gap list, so
 * comparing two captures by `captured_at` yields the week-over-week
 * (or month-over-month) delta arrows on `/insights`.
 *
 * Province scope: NULL = national snapshot; otherwise the lowercased
 * province label.
 */
export const skillGapSnapshots = pgTable("skill_gap_snapshots", {
  id: text("id").primaryKey(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  skill: text("skill").notNull(),
  searches: integer("searches").notNull(),
  matches: integer("matches").notNull(),
  freshMatches: text("fresh_matches").notNull(), // store as text so numeric precision survives the round-trip
  gap: integer("gap").notNull(),
  province: text("province"), // NULL = national
});

/**
 * Phase 8  Time-series snapshots of the longitudinal outcomes
 * dataset (Phase 7.5.4 hand-off). One row per cohort cell that
 * cleared the suppression floor at capture time. Diffing two
 * snapshots by `captured_at` yields the year-over-year placement-
 * rate trend the policy view wants.
 */
export const outcomeSnapshots = pgTable("outcome_snapshots", {
  id: text("id").primaryKey(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  programme: text("programme").notNull(),
  institution: text("institution").notNull(),
  province: text("province").notNull(),
  graduationYear: integer("graduation_year").notNull(),
  cohortSize: integer("cohort_size").notNull(),
  placed: integer("placed").notNull(),
  /** Float in [0,1], stored as text to avoid PG numeric rounding drift. */
  placementRate: text("placement_rate").notNull(),
  medianTimeToHireDays: integer("median_time_to_hire_days"),
  topDestinationProfession: text("top_destination_profession"),
  /** k value applied at capture  for honesty when the floor changes later. */
  minCohortSize: integer("min_cohort_size").notNull(),
});

/**
 * Phase 9.20 Tier 3 D8  retention snapshot. Nightly aggregate of
 * placements by (profession × province × milestone window),
 * k-thresholded at the read site (existing Phase 9.7 LMI floor of
 * k ≥ 10). Drives the /insights retention surface.
 *
 * The aggregate captures "how many made it to milestone N" against
 * the cohort eligible at capture date  it's a historical retention
 * figure, not a "still active today" snapshot. The cron writes one
 * row per (profession, province, milestone, capture date) tuple; the
 * UI reads the latest capture per cell.
 */
export const placementRetentionSnapshots = pgTable(
  "placement_retention_snapshots",
  {
    id: text("id").primaryKey(),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
    professionSlug: text("profession_slug").notNull(),
    provinceSlug: text("province_slug").notNull(),
    milestoneMonths: integer("milestone_months").notNull(),
    hiredInCohort: integer("hired_in_cohort").notNull(),
    stillActiveAtMilestone: integer("still_active_at_milestone").notNull(),
  },
  (t) => ({
    lookupIdx: index("placement_retention_snapshots_lookup_idx").on(
      t.professionSlug,
      t.provinceSlug,
      t.milestoneMonths,
      t.capturedAt,
    ),
  }),
);

/**
 * Phase 9  Sebenza Labour Market Index time-series.
 *
 * One row per snapshot. The composite `value` is stored as text so
 * PG numeric rounding doesn't drift the index across the wire. The
 * three component scores are kept alongside so anyone questioning the
 * index can drill into what moved.
 */
export const lmiSnapshots = pgTable("lmi_snapshots", {
  id: text("id").primaryKey(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
  value: text("value").notNull(),
  freshnessRatio: text("freshness_ratio").notNull(),
  metDemand: text("met_demand").notNull(),
  placementVelocity: text("placement_velocity").notNull(),
});

/**
 * Phase 8  SAQA verification job queue. Admin clicks Approve on
 * `/admin/verifications` and (when `feature_flag_saqa_worker` is on)
 * a row lands here in `queued`. The cron worker claims rows + POSTs to
 * SAQA + writes the result back.
 *
 * When the SAQA flag is OFF, this table is unused  admin Approve
 * flips `qualifications.verification = 'verified'` directly (Phase 7
 * behaviour). The flag flip is the partnership-confirmation gate.
 */
export const qualificationKycJobs = pgTable("qualification_kyc_jobs", {
  id: text("id").primaryKey(),
  qualificationId: text("qualification_id")
    .notNull()
    .references(() => qualifications.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  submittedByUserId: text("submitted_by_user_id").notNull(),
  status: qualificationKycStatus("status").notNull().default("queued"),
  /** Provider raw response  kept for the admin diagnostics surface. */
  resultJson: jsonb("result_json"),
  /** Provider transaction id (when the call landed). */
  providerTransactionId: text("provider_transaction_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  completedAt: timestamp("completed_at"),
});

// ---------- Reference / taxonomy ----------

export const provinces = pgTable("provinces", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
});

export const cities = pgTable("cities", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  provinceSlug: text("province_slug")
    .notNull()
    .references(() => provinces.slug),
});

export const professions = pgTable("professions", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
});

/** SA tertiary institutions  public universities + universities of technology +
    UNISA (distance) + public TVET colleges + INDLELA (artisan training).
    Phase 7 admin taxonomy extends this. Phase 8 SAQA integration verifies
    `academic_profiles.verification` for enrolments here. */
export const institutions = pgTable("institutions", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  kind: institutionKind("kind").notNull(),
  city: text("city").notNull(),
  provinceSlug: text("province_slug")
    .notNull()
    .references(() => provinces.slug),
  /** Phase 9.15  free-text "Other" entries land here with is_pending=true
   *  until an admin promotes or merges them via /admin/taxonomy/suggestions.
   *  Pickers filter `WHERE NOT is_pending AND deleted_at IS NULL`. */
  isPending: boolean("is_pending").notNull().default(false),
  /** Phase 9.15  admin soft-delete; preserves FK integrity for
   *  academic_profiles already linked to the row. */
  deletedAt: timestamp("deleted_at"),
});

// ──────────────────────────────────────────────────────────────────────
// Phase 9.15  taxonomy suggestion queue
// ──────────────────────────────────────────────────────────────────────

export const taxonomySuggestionKind = pgEnum("taxonomy_suggestion_kind", [
  "profession",
  "institution",
  // Phase 9.22  seeker-named organisation. Submitted when the seeker
  // picks "Other" on the employer combobox at sign-up / dashboard
  // edit. Admin queue at /admin/taxonomy/suggestions reviews + edits +
  // promotes; the pending organizations row carries the user data.
  "organisation",
  // Phase 10 follow-up  seeker- or employer-suggested skill from the
  // multi-select skill combobox. Same promote / merge / reject
  // lifecycle as profession. Admin queue at /admin/taxonomy/suggestions
  // groups by lowercased custom_text + kind so the existing UI
  // handles both kinds without further changes.
  "skill",
]);

export const taxonomySuggestionState = pgEnum("taxonomy_suggestion_state", [
  "pending",
  "promoted",
  "merged",
  "rejected",
]);

/**
 * One row per user submission of a free-text "Other" value. Admin queue
 * at `/admin/taxonomy/suggestions` groups by `(kind, lower(custom_text))`
 * so duplicates cluster + frequency is visible. Lifecycle:
 *
 *   pending  ──► promoted   (admin adds to canonical taxonomy + backfills)
 *            ├─► merged     (admin links to existing canonical entry + backfills)
 *            └─► rejected   (spam / joke  user data is NEVER mutated)
 *
 * For institution suggestions, `pendingInstitutionSlug` carries the FK
 * to the institutions row created at submit time with is_pending=true.
 * That's the row the admin merge / promote / reject actions need to
 * clean up.
 */
export const taxonomySuggestions = pgTable(
  "taxonomy_suggestions",
  {
    id: text("id").primaryKey(),
    kind: taxonomySuggestionKind("kind").notNull(),
    customText: text("custom_text").notNull(),
    submittedByUserId: text("submitted_by_user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    state: taxonomySuggestionState("state").notNull().default("pending"),
    targetSlug: text("target_slug"),
    resolvedByUserId: text("resolved_by_user_id").references(() => appUser.id),
    resolvedAt: timestamp("resolved_at"),
    adminNote: text("admin_note"),
    pendingInstitutionSlug: text("pending_institution_slug").references(
      () => institutions.slug,
      { onDelete: "set null" },
    ),
    /**
     * Phase 9.22  for `kind='organisation'` suggestions, the FK to
     * the pending `organizations` row created at submit time
     * (`origin='seeker_named'`, `verification='unverified'`). NULL
     * for profession + institution kinds. Admin promote flips the
     * org's verification to 'verified'; merge re-points seeker
     * profiles + deletes the pending row.
     */
    pendingOrganisationId: text("pending_organisation_id").references(
      (): AnyPgColumn => organizations.id,
      { onDelete: "set null" },
    ),
  },
  (t) => ({
    stateKindIdx: index("taxonomy_suggestions_state_kind_idx").on(
      t.state,
      t.kind,
    ),
  }),
);

/**
 * Phase 9.13  Curriculum-vs-demand mapping. Hand-curated at ship time
 * per D4 in PHASE_9_13_PLAN.md; admits future SAQA-feed expansion
 * without a schema change. `weight` (1..10) carries how strongly the
 * programme's curriculum maps to this skill so 9.13.3's gap analysis
 * weights core outcomes over tangential touches.
 *
 * `programme` is free text matching the shape of
 * `academic_profiles.programme`  9.13.3 does ILIKE matching to bridge
 * programme-name variants ("BSc Computer Science" vs
 * "Bachelor of Science in Computer Science"). Known compromise; see
 * PHASE_9_13_PLAN.md risk #2.
 */
export const programmeSkills = pgTable(
  "programme_skills",
  {
    institutionSlug: text("institution_slug")
      .notNull()
      .references(() => institutions.slug),
    programme: text("programme").notNull(),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skills.slug),
    weight: integer("weight").notNull().default(5),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.institutionSlug, t.programme, t.skillSlug],
    }),
    skillIdx: index("programme_skills_skill_idx").on(t.skillSlug),
    instProgIdx: index("programme_skills_inst_prog_idx").on(
      t.institutionSlug,
      t.programme,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.17  employer-initiated seeker invites.
//
// Single-invite-at-a-time roster-building flow for verified-org
// employers. The invitation does NOT tie to a vacancy (D3); once the
// seeker signs up via the token, the existing Phase 9.8 vacancy-
// invitation flow handles role-specific outreach.
//
// Lifecycle:
//   pending     row created, email queued
//   accepted    seeker completed sign-up via the token
//   declined    seeker explicitly clicked "Not interested" on the
//                landing page (with optional reason)
//   withdrawn   employer cancelled before any response
//   expired     nightly cron flipped past expires_at
// ─────────────────────────────────────────────────────────────────────────────

export const seekerInvitationState = pgEnum("seeker_invitation_state", [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

export const seekerInvitations = pgTable(
  "seeker_invitations",
  {
    id: text("id").primaryKey(),
    /** The verified org doing the inviting. FK to organizations.id. */
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    /** Which member of the org clicked Invite. Audit-trail anchor. */
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => appUser.id),
    /** Recipient email. Stored case-as-typed; lookups + uniqueness use
     *  lower(email). Validation: must be a syntactically valid email. */
    email: text("email").notNull(),
    /** Optional pre-fill for the seeker's sign-up form. */
    name: text("name"),
    /** Optional pre-fill for the seeker's profession (Step 3 of sign-up). */
    profession: text("profession"),
    /** Optional 200-char personal note from the inviter. Verbatim in
     *  the email body. PII territory: anything that quotes the
     *  recipient's life is personal info under POPIA, so the audit
     *  log meta.note is flagged for any future data-export sweep. */
    personalNote: text("personal_note"),
    state: seekerInvitationState("state").notNull().default("pending"),
    /** When the seeker clicked Decline. Free-text reason  optional. */
    declineReason: text("decline_reason"),
    /** Linked profile id when state = accepted. Mirrors Phase 9.8's
     *  invite-to-profile link pattern. */
    acceptedProfileId: text("accepted_profile_id").references(
      () => profiles.id,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    /** When the seeker accepted / declined / when the cron expired
     *  the row / when the employer withdrew it. */
    respondedAt: timestamp("responded_at"),
  },
  (t) => ({
    orgStateIdx: index("seeker_invites_org_state_idx").on(
      t.organizationId,
      t.state,
    ),
    /* Email lookup index for the D4 dedupe check + D7.2 cooldown
       check. Uses lower(email) via the migration's explicit
       CREATE INDEX  Drizzle's index() doesn't accept a SQL
       expression, so the migration owns the lowercase index + this
       schema-side `index()` is the plain version. The query layer
       always wraps the column in lower() when comparing  see
       lib/employer/seeker-invitations.ts. */
    emailOrgIdx: index("seeker_invites_email_org_idx").on(
      t.email,
      t.organizationId,
    ),
    /* Partial index on expires_at for the cron sweep (state =
       'pending' only). Drizzle's index() doesn't accept a WHERE
       clause, so we duplicate the index name; the migration's
       CREATE INDEX … WHERE is what actually lands on the database.
       The plain index here keeps the introspection round-trip
       quiet. */
    expiryIdx: index("seeker_invites_expires_idx").on(t.expiresAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Phase 9.23  opt-in employment verification (consent + one-shot
// email). The contact's email lives at most 14 days in encrypted form;
// state changes (verified / declined / disputed / expired / superseded
// / withdrawn) immediately redact the encrypted email. The SHA-256
// hash stays for the per-(seeker, contact) rate-limit + the
// consent.grant audit proof; the raw email never lives in the durable
// record after the verification window.
// ──────────────────────────────────────────────────────────────────────

export const employmentVerificationState = pgEnum(
  "employment_verification_state",
  [
    "pending",
    "verified",
    "declined",
    "disputed",
    "expired",
    "superseded",
    "withdrawn",
  ],
);

export const employmentVerifications = pgTable(
  "employment_verifications",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "cascade" }),
    employerOrgId: text("employer_org_id")
      .notNull()
      .references((): AnyPgColumn => organizations.id, { onDelete: "cascade" }),
    /** Contact's display name. Stays durable  identifies the consent
     *  context + is shown to the contact in the verify email. */
    contactName: text("contact_name").notNull(),
    /** AES-GCM-encrypted contact email. Cleared (NULL) on response or
     *  expiry per D4. Never displayed back to the seeker. */
    contactEmailEnc: text("contact_email_enc"),
    /** SHA-256 hex of the contact email at submit time. Stays durable
     *  for the consent.grant proof + the (seeker, contact-hash)
     *  rate-limit (D8). */
    contactEmailHash: text("contact_email_hash").notNull(),
    state: employmentVerificationState("state").notNull().default("pending"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    respondedAt: timestamp("responded_at"),
    /** Fixed 14-day window per D3. Cron flips pending  expired past
     *  this timestamp. */
    expiresAt: timestamp("expires_at").notNull(),
    /** URL-safe random token. Cleared on response/expiry so the link
     *  can't be replayed. Unique index ensures one row per token. */
    verificationToken: text("verification_token"),
    /** Reserved for future "this was replaced by verification id X"
     *  lineage. Unused on the initial ship; state='superseded' is
     *  written without setting this. */
    supersededById: text("superseded_by_id").references(
      (): AnyPgColumn => employmentVerifications.id,
      { onDelete: "set null" },
    ),
  },
  (t) => ({
    profileStateIdx: index(
      "employment_verifications_profile_state_idx",
    ).on(t.profileId, t.state),
    /** Token lookup for the verify landing page. Drizzle's basic
     *  unique() can't carry a partial WHERE; the migration's
     *  CREATE UNIQUE INDEX … WHERE is the authoritative version. */
    tokenIdx: uniqueIndex("employment_verifications_token_uniq").on(
      t.verificationToken,
    ),
    expiryIdx: index("employment_verifications_expiry_idx").on(t.expiresAt),
    dedupeIdx: index("employment_verifications_dedupe_idx").on(
      t.profileId,
      t.contactEmailHash,
      t.requestedAt,
    ),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Phase 11.1.4  seeker achievement badges
// ──────────────────────────────────────────────────────────────────────

/**
 * Six honest milestones surfaced as small medallions on /dashboard.
 * Each derived from existing audit-log data (no new event source).
 * Awarded by a nightly cron via idempotent insert  the UNIQUE
 * constraint catches re-runs. Never auto-revoked  badges accumulate
 * across a profile's lifetime.
 *
 * Slugs are open string + validated client-side against the canonical
 * list in `lib/seeker/badge-catalog.ts`; storing as text (not enum)
 * keeps adding a new slug a code-only change with no migration.
 */
export const seekerBadges = pgTable(
  "seeker_badges",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    awardedAt: timestamp("awarded_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seeker_badges_profile_slug_uniq").on(
      t.profileId,
      t.slug,
    ),
    byProfile: index("idx_seeker_badges_by_profile").on(
      t.profileId,
      t.awardedAt,
    ),
  }),
);

/**
 * Phase 11.4.2  seeker-private "follow this employer" list.
 *
 * Privacy invariant (mirrors 11.3.2 block list): the employer is NEVER
 * notified + never sees a follower count. The follow is a warm-intent
 * capture surface for the seeker only. The followed-employer cron
 * intersects this table with new `vacancies` rows in the seeker's
 * profession + province to fire `employer.opened_vacancy.in_your_pool`
 * notifications  the only side-effect the employer can ever observe
 * is that the seeker shows up on the invite list when they search.
 */
export const seekerFollowedEmployers = pgTable(
  "seeker_followed_employers",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    followedAt: timestamp("followed_at").notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("seeker_followed_employers_profile_org_uq").on(
      t.profileId,
      t.orgId,
    ),
    byProfile: index("idx_followed_employers_by_profile").on(t.profileId),
    byOrg: index("idx_followed_employers_by_org").on(t.orgId),
  }),
);

/**
 * Phase 11.4.4  admin-managed allowlist for SMS / WhatsApp dispatch.
 *
 * Presence of a row here means an admin has approved this seeker for
 * the real-provider dispatch path. Absence means the dispatcher
 * console-logs the intent + writes an audit row, but does NOT call
 * the external provider  zero spend by default.
 *
 * Multi-gate (per D5 + the operator constraint): the dispatch layer
 * fires only when ALL of these are simultaneously true:
 *   1. `feature_flag_sms_channel_enabled` (admin-controlled platform flag)
 *   2. seeker's `messaging_channel_sms` consent granted
 *   3. seeker's `app_user.sms_channel_enabled = true`
 *   4. seeker's `phone_verified_at IS NOT NULL`
 *   5. row exists in this table for the seeker
 *
 * Same five gates for WhatsApp with the parallel column / flag.
 */
export const seekerSmsAllowlist = pgTable(
  "seeker_sms_allowlist",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    enabledAt: timestamp("enabled_at").notNull().defaultNow(),
    /** Admin who flipped the flag; nullable for system-grants. */
    enabledBy: text("enabled_by").references(() => appUser.id),
    /** Optional admin-side note (private  PII-flagged). */
    note: text("note"),
  },
  (t) => ({
    uniq: uniqueIndex("seeker_sms_allowlist_user_uq").on(t.userId),
    byUser: index("idx_sms_allowlist_by_user").on(t.userId),
  }),
);

/**
 * Phase 11.3.2  seeker-private employer block list.
 *
 * D2 invariant: the employer NEVER reads this table. Only the seeker's
 * own surfaces + the search/invite enforcement paths read. UNIQUE on
 * (profile_id, org_id) dedupes  re-block is a no-op. Cascading delete
 * on both FKs keeps the table consistent when either side is erased
 * (profile soft-deletion happens elsewhere; the row stays until hard-
 * delete, by design).
 */
export const seekerBlockedEmployers = pgTable(
  "seeker_blocked_employers",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    blockedAt: timestamp("blocked_at").notNull().defaultNow(),
    /** Optional free-text  PII-flagged in audit + exports. Capped 200
     *  at the action boundary; never surfaced to the employer (privacy
     *  invariant D2). */
    reason: text("reason"),
  },
  (t) => ({
    uniq: uniqueIndex("seeker_blocked_employers_profile_org_uq").on(
      t.profileId,
      t.orgId,
    ),
    byProfile: index("idx_blocked_employers_by_profile").on(t.profileId),
    byOrg: index("idx_blocked_employers_by_org").on(t.orgId),
  }),
);
