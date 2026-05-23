/**
 * Seed script — turns the mock data into Postgres rows.
 *
 * Reads from `lib/mock/*` (the same modules the running app uses today) so the
 * dataset stays single-sourced. Idempotent: truncates first, then inserts.
 *
 * **Rule of the seed** (per `docs/PHASE_2_PLAN.md`):
 *   The demo we have IS the starting database. Nothing is re-invented here.
 *
 * Usage:
 *   1. Set DATABASE_URL in `.env.local`
 *   2. `npm run db:generate` (drizzle-kit) and `npm run db:migrate`
 *   3. `npm run db:seed`
 *
 * Seed credentials (dev only — NEVER deploy these):
 *   - Password for every seeded account: "sebenza-dev-2026"
 *   - Admin: admin@sebenza.co.za
 *   - Employer (Discovery Bank owner): naledi.khumalo@discovery.co.za
 *   - Seekers: {handle}@example.co.za  (andile-z@example.co.za, etc.)
 *   - All seeded accounts have `email_verified = true` so sign-in works
 *     immediately. In production, sign-up flows require email verification
 *     via the link before sign-in succeeds.
 */
import { config as loadEnv } from "dotenv";
// Load .env.local first (developer overrides), then .env (committed defaults).
// `dotenv/config` would only auto-load .env — we need .env.local too.
loadEnv({ path: ".env.local" });
loadEnv();
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import * as schema from "./schema";
import {
  PROVINCES,
  PROFESSIONS,
  SKILLS,
  INSTITUTIONS,
} from "@/lib/mock/taxonomy";
import { mockProfiles } from "@/lib/mock/profiles";
import { MOCK_EMPLOYER } from "@/components/layout/employerNav";
import { MOCK_ADMIN } from "@/components/layout/adminNav";
import { CONSENT_PURPOSES } from "@/lib/consent";

// Every seeded account uses the same dev password. NEVER deploy this to prod.
// In production, Phase 2 sign-up creates accounts with user-chosen passwords.
const SEED_PASSWORD = "sebenza-dev-2026";

// ────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────────────────────

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "❌ DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

const db = drizzle(neon(url), { schema });

// Tiny helper for human-readable, deterministic IDs.
const id = (prefix: string, slug: string) => `${prefix}_${slug}`;

// ────────────────────────────────────────────────────────────────────────────
// Steps
// ────────────────────────────────────────────────────────────────────────────

async function truncate() {
  console.log("⌫  Truncating tables…");
  // Order respects FK dependencies. RESTART IDENTITY is harmless here.
  // We deliberately DO NOT truncate `platform_settings` — the migration
  // seeds default values that should survive a re-seed, and the schema
  // doesn't reference any user-scoped data here.
  await db.execute(sql`
    TRUNCATE TABLE
      reports,
      audit_log,
      consents,
      placements,
      organization_members,
      organizations,
      search_events,
      academic_profiles,
      qualifications,
      experiences,
      profile_skills,
      profiles,
      verification,
      session,
      account,
      app_user,
      institutions,
      cities,
      provinces,
      professions,
      skills
    RESTART IDENTITY CASCADE;
  `);
}

async function seedTaxonomy() {
  console.log("🌍 Provinces + cities…");
  await db
    .insert(schema.provinces)
    .values(PROVINCES.map((p) => ({ slug: p.slug, label: p.label })));
  await db.insert(schema.cities).values(
    PROVINCES.flatMap((p) =>
      p.cities.map((c) => ({
        slug: c.slug,
        label: c.label,
        provinceSlug: p.slug,
      })),
    ),
  );

  console.log("🧑‍🍳 Professions + skills…");
  await db.insert(schema.professions).values(PROFESSIONS);
  await db.insert(schema.skills).values(SKILLS);

  console.log("🎓 Institutions…");
  await db.insert(schema.institutions).values(
    INSTITUTIONS.map((i) => ({
      slug: i.slug,
      label: i.label,
      kind: i.kind,
      city: i.city,
      provinceSlug: provinceSlugByLabel(i.province),
    })),
  );
}

async function seedUsersAndProfiles() {
  console.log("👤 Users + Better Auth accounts (hashed passwords)…");

  // Hash the dev password once — all seeded accounts share it.
  const pwHash = await hashPassword(SEED_PASSWORD);

  // Admin + employer-owner + every seeker get a user + a credential account.
  const userRows = [
    {
      id: id("user", "sebenza-admin"),
      name: MOCK_ADMIN.fullName,
      email: MOCK_ADMIN.email,
      emailVerified: true,
      role: "admin" as const,
    },
    {
      id: id("user", "naledi-k"),
      name: MOCK_EMPLOYER.user.fullName,
      email: MOCK_EMPLOYER.user.email,
      emailVerified: true,
      role: "employer" as const,
    },
    ...mockProfiles.map((p) => ({
      id: id("user", p.handle),
      name: p.displayName,
      email: `${p.handle}@example.co.za`,
      emailVerified: true,
      role: "seeker" as const,
    })),
  ];

  await db.insert(schema.appUser).values(userRows);

  // Better Auth credential accounts — one per user, holding the password hash.
  await db.insert(schema.account).values(
    userRows.map((u) => ({
      id: `acc_${u.id}`,
      accountId: u.id, // Better Auth pattern: accountId = userId for credentials
      providerId: "credential",
      userId: u.id,
      password: pwHash,
    })),
  );

  // Profiles (seekers only — admin + employer-owner don't have public profiles).
  console.log("📄 Profiles…");
  await db.insert(schema.profiles).values(
    mockProfiles.map((p) => ({
      id: id("prof", p.handle),
      userId: id("user", p.handle),
      handle: p.handle,
      displayName: p.displayName,
      profilePhotoUrl: p.profilePhotoUrl ?? null,
      profession: p.profession,
      seniority: p.seniority,
      city: p.city,
      province: p.province,
      nationality: p.nationality,
      isCitizen: p.isCitizen,
      bio: p.bio,
      status: p.status,
      statusConfirmedAt: new Date(p.statusConfirmedAt),
      workAvailability: p.workAvailability,
      verification: p.verification,
      completeness: p.completeness,
      memberSince: new Date(p.memberSince),
    })),
  );
}

async function seedProfileChildren() {
  console.log("🪜 Profile skills + experience + qualifications…");

  // Profile skills (the join table). Looks up skill slugs by label.
  const skillSlugByLabel = new Map(SKILLS.map((s) => [s.label, s.slug]));
  const profileSkillRows = mockProfiles.flatMap((p) =>
    p.topSkills
      .map((s) => {
        const slug = skillSlugByLabel.get(s.name);
        if (!slug) {
          // Skill not in the controlled vocab — Phase 7 admin would add it
          // before allowing it on a profile. For the seed, skip it (the
          // canonical mock profiles use known slugs).
          return null;
        }
        return {
          profileId: id("prof", p.handle),
          skillSlug: slug,
          proficiency: s.proficiency,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
  );
  if (profileSkillRows.length > 0) {
    await db.insert(schema.profileSkills).values(profileSkillRows);
  }

  // Experiences
  const expRows = mockProfiles.flatMap((p, pi) =>
    (p.experience ?? []).map((e, ei) => ({
      id: id("exp", `${p.handle}-${ei}`),
      profileId: id("prof", p.handle),
      role: e.role,
      organization: e.organization,
      city: e.city,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      description: e.description,
    })),
  );
  if (expRows.length > 0) {
    await db.insert(schema.experiences).values(expRows);
  }

  // Qualifications
  const qualRows = mockProfiles.flatMap((p) =>
    (p.qualifications ?? []).map((q, qi) => ({
      id: id("qual", `${p.handle}-${qi}`),
      profileId: id("prof", p.handle),
      title: q.title,
      institution: q.institution,
      awardedYear: q.awardedYear,
      verification: q.verification,
    })),
  );
  if (qualRows.length > 0) {
    await db.insert(schema.qualifications).values(qualRows);
  }
}

async function seedAcademicProfiles() {
  console.log("🎓 Academic profiles (Student mode)…");
  const academicRows = mockProfiles
    .filter((p) => p.academic)
    .map((p) => {
      const a = p.academic!;
      return {
        id: id("acad", p.handle),
        profileId: id("prof", p.handle),
        institutionSlug: a.institutionSlug,
        programme: a.programme,
        fieldOfStudy: a.fieldOfStudy,
        nqfLevel: a.nqfLevel,
        currentYear: a.currentYear,
        expectedGraduation: a.expectedGraduation,
        nsfas: a.nsfas,
        verification: a.verification,
        openToInternships: a.openToInternships,
        openToGraduateProgrammes: a.openToGraduateProgrammes,
      };
    });
  if (academicRows.length > 0) {
    await db.insert(schema.academicProfiles).values(academicRows);
  }
}

async function seedOrgsAndPlacements() {
  console.log("🏢 Organisations + members…");
  const orgId = id("org", "discovery-bank");
  await db.insert(schema.organizations).values({
    id: orgId,
    name: MOCK_EMPLOYER.orgName,
    registrationNumber: MOCK_EMPLOYER.registration,
    industry: MOCK_EMPLOYER.industry,
    sizeBand: MOCK_EMPLOYER.size,
    city: MOCK_EMPLOYER.city,
    country: MOCK_EMPLOYER.country,
    verification: MOCK_EMPLOYER.orgVerified ? "verified" : "unverified",
  });
  await db.insert(schema.organizationMembers).values({
    id: id("orgmem", "naledi-k"),
    organizationId: orgId,
    userId: id("user", "naledi-k"),
    role: "owner",
    twoFactorActive: true,
  });

  console.log("🤝 Placements (illustrative — match the landing outcomes)…");
  await db.insert(schema.placements).values([
    {
      id: id("plc", "thandeka"),
      profileId: id("prof", "thandeka-m"),
      organizationId: orgId,
      role: "Senior Pastry Chef",
      city: "Cape Town",
      hiredAt: new Date("2026-05-04"),
    },
    {
      id: id("plc", "kabelo"),
      profileId: id("prof", "kabelo-m"),
      organizationId: orgId,
      role: "Site electrician",
      city: "Pretoria",
      hiredAt: new Date("2026-04-18"),
    },
  ]);
}

async function seedConsents() {
  console.log("✅ Consents (searchability granted for every seeker)…");
  // Every seeker who has a profile granted the base 'searchability' consent
  // so they show up in /search. Other purposes start as 'none'.
  //
  // Phase 7.5 — the two final-year BSc CS students (andile-z, lerato-n)
  // are seeded with `outcomes_research` granted, paired with the synthetic
  // cohort below so the dataset actually demos something on /insights.
  const outcomesGranters = new Set(["andile-z", "lerato-n", "zinhle-m"]);
  await db.insert(schema.consents).values(
    mockProfiles.flatMap((p) =>
      CONSENT_PURPOSES.map((purpose) => {
        const isGranted =
          purpose === "searchability" ||
          (purpose === "outcomes_research" && outcomesGranters.has(p.handle));
        return {
          id: id("cns", `${p.handle}-${purpose}`),
          userId: id("user", p.handle),
          purpose,
          state: (isGranted ? "granted" : "none") as "granted" | "none",
          version: "v2.1",
          grantedAt: isGranted ? new Date() : null,
          revokedAt: null,
        };
      }),
    ),
  );
}

/**
 * Phase 7.5.4 demo cohort. Without this, the longitudinal-outcomes
 * section on /insights renders only the empty-state copy because no
 * real cohort clears k=10 with the 8 named mock profiles.
 *
 * Generates 12 synthetic seekers all enrolled in BSc Computer Science
 * at the University of the Witwatersrand, expected graduation 2026-12,
 * Gauteng-based. 3 receive employer-confirmed placements at Discovery
 * Bank. All grant `outcomes_research`.
 *
 * Cohort cell that surfaces: (BSc Computer Science × Wits × Gauteng × 2026)
 * → size 12, placed 3, rate 25%.
 */
async function seedPhase7_5OutcomesCohort() {
  console.log("🎓 Phase 7.5 — synthetic graduate cohort for /insights outcomes…");
  const pwHash = await hashPassword(SEED_PASSWORD);
  const orgId = id("org", "discovery-bank");
  const institutionSlug = "wits";
  const cohortSize = 12;
  const placedCount = 3;
  const memberSince = new Date("2024-02-01");

  const cohortHandles = Array.from({ length: cohortSize }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `wits-bsc-cs-2026-${n}`;
  });

  // app_user + credential account
  await db.insert(schema.appUser).values(
    cohortHandles.map((handle) => ({
      id: id("user", handle),
      name: `BSc CS Cohort ${handle.slice(-2)}`,
      email: `${handle}@example.co.za`,
      emailVerified: true,
      role: "seeker" as const,
    })),
  );
  await db.insert(schema.account).values(
    cohortHandles.map((handle) => ({
      id: `acc_${id("user", handle)}`,
      accountId: id("user", handle),
      providerId: "credential",
      userId: id("user", handle),
      password: pwHash,
    })),
  );

  // profiles
  await db.insert(schema.profiles).values(
    cohortHandles.map((handle, i) => ({
      id: id("prof", handle),
      userId: id("user", handle),
      handle,
      displayName: `BSc CS Cohort ${handle.slice(-2)}`,
      profession: "Software developer",
      seniority: null,
      city: "Johannesburg",
      province: "Gauteng",
      nationality: "South African",
      isCitizen: true,
      bio: null,
      status: (i < placedCount ? "employed" : "open_to_work") as
        | "employed"
        | "open_to_work",
      statusConfirmedAt: new Date("2026-05-10"),
      workAvailability: [],
      verification: "unverified" as const,
      completeness: 30,
      memberSince,
    })),
  );

  // academic_profiles
  await db.insert(schema.academicProfiles).values(
    cohortHandles.map((handle) => ({
      id: id("acad", handle),
      profileId: id("prof", handle),
      institutionSlug,
      programme: "BSc Computer Science",
      fieldOfStudy: "Computer Science",
      nqfLevel: 7,
      currentYear: 3,
      expectedGraduation: "2026-12",
      nsfas: false,
      verification: "unverified" as const,
      openToInternships: true,
      openToGraduateProgrammes: true,
    })),
  );

  // consents — searchability + outcomes_research granted; rest 'none'.
  await db.insert(schema.consents).values(
    cohortHandles.flatMap((handle) =>
      CONSENT_PURPOSES.map((purpose) => {
        const isGranted =
          purpose === "searchability" || purpose === "outcomes_research";
        return {
          id: id("cns", `${handle}-${purpose}`),
          userId: id("user", handle),
          purpose,
          state: (isGranted ? "granted" : "none") as "granted" | "none",
          version: "v2.1",
          grantedAt: isGranted ? new Date() : null,
          revokedAt: null,
        };
      }),
    ),
  );

  // employer-confirmed placements for the first `placedCount` members
  await db.insert(schema.placements).values(
    cohortHandles.slice(0, placedCount).map((handle, i) => ({
      id: id("plc", handle),
      profileId: id("prof", handle),
      organizationId: orgId,
      actorUserId: id("user", "naledi-k"),
      role: ["Backend developer", "Data engineer", "Frontend developer"][i] ?? "Software developer",
      city: "Sandton",
      hiredAt: new Date(`2026-04-${10 + i * 3}`),
      salaryBand: "R 480k–600k",
      source: "employer_confirmed" as const,
    })),
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function provinceSlugByLabel(label: string): string {
  const p = PROVINCES.find((x) => x.label === label);
  if (!p) {
    throw new Error(
      `Province label "${label}" not found in PROVINCES. Update lib/mock/taxonomy.ts.`,
    );
  }
  return p.slug;
}

// ────────────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────────────

async function seedPhase7Reports() {
  console.log("🚩 Phase 7 sample reports (open + closed — for /admin/moderation)…");
  await db.insert(schema.reports).values([
    {
      id: id("rep", "amara-spam"),
      subjectProfileId: id("prof", "amara-o"),
      reporterUserId: null, // anonymous public report
      reason: "spam",
      note: "Profile bio matches three other recently-removed accounts; suspected mass-signup script.",
      status: "open",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
    {
      id: id("rep", "sipho-fake"),
      subjectProfileId: id("prof", "sipho-k"),
      reporterUserId: id("user", "naledi-k"),
      reason: "fake_identity",
      note: "Reporter claims qualifications copied from another LinkedIn profile.",
      status: "open",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    },
  ]);
}

async function main() {
  const started = Date.now();
  console.log("🌱 Sebenza seed — Phase 2 starting database\n");

  await truncate();
  await seedTaxonomy();
  await seedUsersAndProfiles();
  await seedProfileChildren();
  await seedAcademicProfiles();
  await seedOrgsAndPlacements();
  await seedConsents();
  await seedPhase7Reports();
  // Phase 7.5 — synthetic cohort that clears the k=10 floor so the
  // /insights outcomes section renders a real row in the dev demo.
  // Runs after seedOrgsAndPlacements because it inserts placements
  // referencing the Discovery Bank org id.
  await seedPhase7_5OutcomesCohort();

  const ms = Date.now() - started;
  console.log(
    `\n✅ Seed complete in ${ms} ms — ${mockProfiles.length} profiles, ` +
      `${PROVINCES.length} provinces, ${PROFESSIONS.length} professions, ` +
      `${SKILLS.length} skills, ${INSTITUTIONS.length} institutions.`,
  );
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
