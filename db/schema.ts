/**
 * Drizzle schema — Phase 0 + Phase 4 sketch.
 *
 * Phase 1 does not run migrations. This file exists so:
 *  1. The shape of the eventual DB is in the repo from commit one.
 *  2. The mock dataProvider stays type-aligned with the real one.
 *
 * POPIA columns are present from day one (consents, auditLog, deletedAt,
 * nationalIdEnc) — never retrofitted. See TO_START_EVERY_SESSION.md §4.
 */
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Postgres `tsvector` — full-text search column. Read-only from the app's
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

export const userRole = pgEnum("user_role", ["seeker", "employer", "admin"]);

export const consentPurpose = pgEnum("consent_purpose", [
  "searchability",
  "contact_reveal",
  "document_sharing",
  "analytics_aggregate",
  // Phase 7.5 — opt-in inclusion in the longitudinal education-to-
  // employment outcomes dataset. Optional, default-off, non-degrading:
  // withholding it must NOT weaken job-search in any way.
  "outcomes_research",
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

/** Phase 7 — moderation reasons. Reporter chooses one when filing. */
export const reportReason = pgEnum("report_reason", [
  "fake_identity",
  "inappropriate",
  "harassment",
  "spam",
  "other",
]);

/** Phase 7 — moderation lifecycle. */
export const reportStatus = pgEnum("report_status", [
  "open",
  "closed_no_action",
  "actioned",
]);

/**
 * Phase 7.5 — Work-availability dimension. Decoupled from
 * `employmentStatus` so a `studying` person can signal `casual`, and a
 * `full_time` employee can signal `contract`. Status answers "what is
 * your situation"; availability answers "what work will you take."
 */
export const workAvailabilityKind = pgEnum("work_availability_kind", [
  "casual",
  "part_time",
  "contract",
  "full_time",
]);

/**
 * Phase 7.5 — Placement source. Splits employer-confirmed hires
 * (the Phase-5 default, the only signal that counts in official
 * analytics + government rollups) from softer seeker self-reports
 * (clearly flagged, excluded from aggregate stats).
 */
export const placementSource = pgEnum("placement_source", [
  "employer_confirmed",
  "seeker_reported",
]);

/**
 * Phase 8 — SAQA verification job lifecycle. Admin clicks Approve on
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
  /** Phase 7 — admin moderation. Suspended users are bounced at sign-in
      with a clear "your account is suspended" message; the row stays
      so we have an audit trail of who suspended whom and when. */
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  suspendedByUserId: text("suspended_by_user_id"),
  /** Phase 7 (Task 7.6) — per-kind notification preferences. JSONB shape:
      `{ "contact.revealed": { inApp: true, email: false }, … }`. Missing
      entries fall back to the catalog defaults in lib/notifications. */
  notificationPrefs: jsonb("notification_prefs"),
  /** Phase 7 (Task 7.2) — managed by Better Auth's `twoFactor` plugin.
      Flips true once a user verifies their initial TOTP code; gates the
      `verify-2fa` step on sign-in and the forced-setup redirect for
      employer/admin accounts. */
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  /** Phase 8 — per-kind email rate-limit clock.
      Shape: `{ "contact.revealed": "2026-05-23T12:14:00.000Z", … }`.
      `createNotification` uses this to enforce 1 email per kind per 60 s
      so a burst of dossier views can't spam an inbox. NULL = never sent. */
  notificationEmailLastSentAt: jsonb("notification_email_last_sent_at"),
  /** Phase 8 — Home Affairs / KYC SaaS transaction id. Populated after
      a successful verify; cleared on revoke. The provider's id is what
      makes a "verified" badge auditable. */
  kycTransactionId: text("kyc_transaction_id"),
  kycVerifiedAt: timestamp("kyc_verified_at"),
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
 * Better Auth account table. Stores the credential record per user — for
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
 * Phase 7 (Task 7.2) — Better Auth `twoFactor` plugin storage.
 *
 * One row per user once 2FA has been enabled. `secret` is the TOTP
 * seed (encrypted by Better Auth); `backupCodes` is a JSON array of
 * one-time recovery codes hashed at rest. `verified = true` after the
 * user confirms their first TOTP code.
 *
 * Schema matches the plugin's expectations exactly — Drizzle's role
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
   * Phase 7.5 — What kinds of work this person is open to, independent
   * of `status`. Empty = no signal (default). Multi-select. Publicly
   * readable on `/p/[handle]` and `/search` filters — it's the point
   * of the field, never a sensitive attribute.
   */
  workAvailability: workAvailabilityKind("work_availability")
    .array()
    .notNull()
    .default(sql`'{}'::work_availability_kind[]`),
  verification: verificationStatus("verification").notNull().default("unverified"),
  completeness: integer("completeness").notNull().default(0),
  /** Encrypted (AES-GCM). NEVER selected on any public read path. */
  nationalIdEnc: text("national_id_enc"),
  /** Materialised tsvector. Populated by the trigger in
      `db/migrations/0001_phase4_search.sql` from
      profession + seniority + bio + city + province + skills_aggregated.
      App code never writes to it directly; queries use `@@` against this. */
  searchVector: tsvector("search_vector"),
  memberSince: timestamp("member_since").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
  /** Phase 8 — last time the status-stale nudge cron sent
      `status.stale.warning` for this profile. NULL = never sent.
      Idempotency anchor so we don't spam on every nightly run. */
  statusStaleLastSentAt: timestamp("status_stale_last_sent_at"),
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

export const profileSkills = pgTable("profile_skills", {
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  skillSlug: text("skill_slug")
    .notNull()
    .references(() => skills.slug),
  proficiency: integer("proficiency").notNull(),
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

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number"),
  industry: text("industry"),
  sizeBand: text("size_band"),
  city: text("city"),
  country: text("country").notNull().default("South Africa"),
  verification: verificationStatus("verification").notNull().default("unverified"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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

export const placements = pgTable("placements", {
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
  /** Optional salary band (kept private — never in public reads). */
  salaryBand: text("salary_band"),
  /**
   * Phase 7.5 — Placement-Truth refinement. `employer_confirmed` (the
   * Phase 5 default, gated by the 30-day reveal window) is the only
   * source that counts in national/government analytics. `seeker_reported`
   * is a softer self-declared signal, shown on the seeker's own profile
   * flagged as such, and excluded from official aggregates.
   */
  source: placementSource("source").notNull().default("employer_confirmed"),
});

/** Saved-search definitions per organisation. Stored filters get re-run
    by `runSavedSearch` to update `newMatchesCount` — we don't snapshot
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
  /** Same shape as `SearchFilters` in `lib/mock/types.ts` — kept as JSONB
      so the schema doesn't need a migration every time we add a filter. */
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastRunAt: timestamp("last_run_at"),
  newMatchesCount: integer("new_matches_count").notNull().default(0),
  /** Phase 8 — SHA-1 hash of the sorted profile-id set returned by the
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
 * Phase 7 — moderation reports. Filed from the public `/p/[handle]`
 * Report button (`flagProfile`); resolved on `/admin/moderation` by an
 * admin's `closeReport` or `suspendUser` action.
 *
 * Anonymous reports allowed (`reporter_user_id` nullable) — public users
 * shouldn't have to sign in to flag a bad actor.
 */
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  subjectProfileId: text("subject_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
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
 * Phase 7 — platform settings as a key/value JSONB store. Replaces the
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
 * Phase 7 (Task 7.6) — in-app notifications.
 *
 * Notifications are UX state, NOT the system of record. The audit log
 * remains authoritative for any PII access; deleting a notifications
 * row only clears the user-facing bell badge.
 *
 * `kind` mirrors a subset of `AuditKind` (catalog in
 * docs/PHASE_7_PLAN.md §C.7). `meta` carries display-only context
 * — never raw PII beyond what the user has already consented to share
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
 * Phase 8 — Time-series snapshots of the longitudinal outcomes
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
  /** k value applied at capture — for honesty when the floor changes later. */
  minCohortSize: integer("min_cohort_size").notNull(),
});

/**
 * Phase 8 — SAQA verification job queue. Admin clicks Approve on
 * `/admin/verifications` and (when `feature_flag_saqa_worker` is on)
 * a row lands here in `queued`. The cron worker claims rows + POSTs to
 * SAQA + writes the result back.
 *
 * When the SAQA flag is OFF, this table is unused — admin Approve
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
  /** Provider raw response — kept for the admin diagnostics surface. */
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

/** SA tertiary institutions — public universities + universities of technology +
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
});
