CREATE TYPE "public"."consent_purpose" AS ENUM('searchability', 'contact_reveal', 'document_sharing', 'analytics_aggregate');--> statement-breakpoint
CREATE TYPE "public"."consent_state" AS ENUM('none', 'granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('employed', 'unemployed', 'self_employed', 'studying', 'open_to_work');--> statement-breakpoint
CREATE TYPE "public"."institution_kind" AS ENUM('university', 'uot', 'tvet', 'distance', 'indlela', 'private');--> statement-breakpoint
CREATE TYPE "public"."organization_member_role" AS ENUM('owner', 'recruiter', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('seeker', 'employer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "academic_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"institution_slug" text NOT NULL,
	"programme" text NOT NULL,
	"field_of_study" text NOT NULL,
	"nqf_level" integer NOT NULL,
	"current_year" integer,
	"expected_graduation" text NOT NULL,
	"nsfas" boolean DEFAULT false NOT NULL,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"open_to_internships" boolean DEFAULT false NOT NULL,
	"open_to_graduate_programmes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_profiles_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'seeker' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"subject" text,
	"meta" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"province_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"state" "consent_state" DEFAULT 'none' NOT NULL,
	"version" text NOT NULL,
	"granted_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"role" text NOT NULL,
	"organization" text NOT NULL,
	"city" text,
	"started_at" text NOT NULL,
	"ended_at" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" "institution_kind" NOT NULL,
	"city" text NOT NULL,
	"province_slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "organization_member_role" DEFAULT 'recruiter' NOT NULL,
	"two_factor_active" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"suspended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration_number" text,
	"industry" text,
	"size_band" text,
	"city" text,
	"country" text DEFAULT 'South Africa' NOT NULL,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"city" text NOT NULL,
	"hired_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professions" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_skills" (
	"profile_id" text NOT NULL,
	"skill_slug" text NOT NULL,
	"proficiency" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"full_surname" text,
	"profile_photo_url" text,
	"profession" text NOT NULL,
	"seniority" text,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"nationality" text,
	"is_citizen" boolean DEFAULT false NOT NULL,
	"bio" text,
	"status" "employment_status" DEFAULT 'open_to_work' NOT NULL,
	"status_confirmed_at" timestamp DEFAULT now() NOT NULL,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"completeness" integer DEFAULT 0 NOT NULL,
	"national_id_enc" text,
	"search_vector" text,
	"member_since" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"title" text NOT NULL,
	"institution" text NOT NULL,
	"awarded_year" integer,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"document_storage_key" text
);
--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" text PRIMARY KEY NOT NULL,
	"terms" text,
	"filters" jsonb,
	"result_count" integer NOT NULL,
	"actor_org_id" text,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_profiles" ADD CONSTRAINT "academic_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_profiles" ADD CONSTRAINT "academic_profiles_institution_slug_institutions_slug_fk" FOREIGN KEY ("institution_slug") REFERENCES "public"."institutions"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_slug_provinces_slug_fk" FOREIGN KEY ("province_slug") REFERENCES "public"."provinces"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_province_slug_provinces_slug_fk" FOREIGN KEY ("province_slug") REFERENCES "public"."provinces"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_skill_slug_skills_slug_fk" FOREIGN KEY ("skill_slug") REFERENCES "public"."skills"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;