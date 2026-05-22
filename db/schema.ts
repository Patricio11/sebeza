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
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

// ---------- Users / roles (Better Auth fills the auth side in Phase 2) ----------

export const appUser = pgTable("app_user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: userRole("role").notNull().default("seeker"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
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
  verification: verificationStatus("verification").notNull().default("unverified"),
  completeness: integer("completeness").notNull().default(0),
  /** Encrypted (AES-GCM). NEVER selected on any public read path. */
  nationalIdEnc: text("national_id_enc"),
  /** Materialised TSVECTOR in Phase 4; placeholder here. */
  searchVector: text("search_vector"),
  memberSince: timestamp("member_since").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
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
  role: text("role").notNull(),
  city: text("city").notNull(),
  hiredAt: timestamp("hired_at").notNull().defaultNow(),
});

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
