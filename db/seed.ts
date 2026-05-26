/**
 * Seed script  turns the mock data into Postgres rows.
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
 * Seed credentials (dev only  NEVER deploy these):
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
// `dotenv/config` would only auto-load .env  we need .env.local too.
loadEnv({ path: ".env.local" });
loadEnv();
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

// Match the runtime client (`db/client.ts`) so the seed runs against the
// same Pool-backed driver  the transactional inserts here (cohort
// fixtures, vacancy lifecycle) would otherwise hit the same "no
// transactions" error users saw on /sign-up/seeker.
neonConfig.webSocketConstructor = ws;
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

const db = drizzle(new Pool({ connectionString: url }), { schema });

// Tiny helper for human-readable, deterministic IDs.
const id = (prefix: string, slug: string) => `${prefix}_${slug}`;

// ────────────────────────────────────────────────────────────────────────────
// Steps
// ────────────────────────────────────────────────────────────────────────────

async function truncate() {
  console.log("⌫  Truncating tables…");
  // Order respects FK dependencies. RESTART IDENTITY is harmless here.
  // We deliberately DO NOT truncate `platform_settings`  the migration
  // seeds default values that should survive a re-seed, and the schema
  // doesn't reference any user-scoped data here.
  await db.execute(sql`
    TRUNCATE TABLE
      reports,
      audit_log,
      taxonomy_suggestions,
      consents,
      vacancy_invitations,
      vacancies,
      organization_documents,
      placements,
      organization_members,
      organizations,
      search_events,
      academic_profiles,
      qualifications,
      experiences,
      learning_items,
      programme_skills,
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

  // Hash the dev password once  all seeded accounts share it.
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

  // Better Auth credential accounts  one per user, holding the password hash.
  await db.insert(schema.account).values(
    userRows.map((u) => ({
      id: `acc_${u.id}`,
      accountId: u.id, // Better Auth pattern: accountId = userId for credentials
      providerId: "credential",
      userId: u.id,
      password: pwHash,
    })),
  );

  // Profiles (seekers only  admin + employer-owner don't have public profiles).
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
      // Phase 9.9  total years of experience. Per D1, leave NULL
      // for any mock profile that doesn't declare it (the value
      // lands when the seeker first edits their profile). The
      // mock catalog populates `yearsExperience` on a handful of
      // seekers so the dev demo isn't all empty.
      yearsExperience: p.yearsExperience ?? null,
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
          // Skill not in the controlled vocab  Phase 7 admin would add it
          // before allowing it on a profile. For the seed, skip it (the
          // canonical mock profiles use known slugs).
          return null;
        }
        return {
          profileId: id("prof", p.handle),
          skillSlug: slug,
          proficiency: s.proficiency,
          // Phase 9.9  per-skill years of experience. NULL for
          // mock profiles that don't declare it (per D1, no
          // back-fill); the value lands when the seeker first
          // edits their skill row.
          yearsOfExperience: s.yearsOfExperience ?? null,
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

  console.log("🤝 Placements (illustrative  match the landing outcomes)…");
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
  // Phase 7.5  the two final-year BSc CS students (andile-z, lerato-n)
  // are seeded with `outcomes_research` granted, paired with the synthetic
  // cohort below so the dataset actually demos something on /insights.
  //
  // Phase 9.8.8  a curated subset grants `vacancy_matching` so the
  // bulk-invite demo on /employer/vacancies/[id]/match has real
  // candidates to invite (and the compliance assertion (b) "invite
  // requires consent" has live rows to walk). NB: we keep most of the
  // pool *without* this consent so the bulk-invite "soft summary"
  // ("N invites sent · M not eligible") demos a non-zero skip count
  // too  the audit-log only path for the per-seeker reason matters.
  const outcomesGranters = new Set(["andile-z", "lerato-n", "zinhle-m"]);
  const vacancyGranters = new Set([
    "andile-z",
    "lerato-n",
    "sipho-k",
    "thandeka-m",
  ]);
  await db.insert(schema.consents).values(
    mockProfiles.flatMap((p) =>
      CONSENT_PURPOSES.map((purpose) => {
        const isGranted =
          purpose === "searchability" ||
          (purpose === "outcomes_research" && outcomesGranters.has(p.handle)) ||
          (purpose === "vacancy_matching" && vacancyGranters.has(p.handle));
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
  console.log("🎓 Phase 7.5  synthetic graduate cohort for /insights outcomes…");
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
      profession: "Software Developer",
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

  // consents  searchability + outcomes_research granted; rest 'none'.
  // Phase 9.8.8  cohort members 0407 also grant `vacancy_matching`
  // (they're open-to-work post-graduation in late 2026). 0103 are
  // already employed via the historical placements below  no
  // invitations make sense for them. 0812 stay un-consented for the
  // bulk-invite skip demo.
  const vacancyInviteCohortHandles = new Set(
    cohortHandles.slice(3, 7), // 04..07 (0-indexed 3..6)
  );
  await db.insert(schema.consents).values(
    cohortHandles.flatMap((handle) =>
      CONSENT_PURPOSES.map((purpose) => {
        const isGranted =
          purpose === "searchability" ||
          purpose === "outcomes_research" ||
          (purpose === "vacancy_matching" &&
            vacancyInviteCohortHandles.has(handle));
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

/**
 * Phase 9.7.9 demo data. Without this, every nationality-related
 * /gov surface (status mix split, Justification Index, Opportunity
 * Map, employer-mix lookup) renders blank because the existing
 * cohort is 100% SA-citizen and there's no demand signal from
 * verified employer searches.
 *
 * Adds:
 *   - 3 foreign-national profiles: Zimbabwean welder (Gauteng),
 *     Nigerian software developer (Gauteng), Kenyan chef (Western
 *     Cape). Each grants searchability so they show up in /search.
 *   - 2 foreign-national placements at Discovery Bank so the per-
 *     employer mix lookup has a non-trivial sa_citizen / foreign-
 *     national breakdown at the floor (5 confirmed placements: 3
 *     SA citizens from the BSc cohort + 2 foreign nationals).
 *   - ~15 synthetic employer-search events with distinct actor_org_id
 *     values driving demand_score >= 1.0 for the (Software developer,
 *     Gauteng) cell. With the 12-strong BSc CS cohort as SA supply,
 *     that cell classifies as "Local supply available" on
 *     /gov/shortage and /gov/opportunity out of the box.
 *
 * Genuine "Local shortage" classifications need more diverse
 * employer-confirmed placement data than is reasonable to seed
 * synthetically; those emerge organically as real employers log
 * hires across more professions.
 */
async function seedPhase9_7NationalityDemo() {
  console.log("🌍 Phase 9.7  foreign-national profiles + demand seeds…");
  const pwHash = await hashPassword(SEED_PASSWORD);
  const discoveryOrgId = id("org", "discovery-bank");
  const memberSince = new Date("2024-02-01");

  const foreignProfiles = [
    {
      handle: "tendai-m",
      displayName: "Tendai M.",
      profession: "Welder",
      city: "Johannesburg",
      province: "Gauteng",
      nationality: "Zimbabwean",
      status: "open_to_work" as const,
    },
    {
      handle: "chiamaka-o",
      displayName: "Chiamaka O.",
      profession: "Software Developer",
      city: "Johannesburg",
      province: "Gauteng",
      nationality: "Nigerian",
      status: "employed" as const,
    },
    {
      handle: "kemi-a",
      displayName: "Kemi A.",
      profession: "Software Developer",
      city: "Johannesburg",
      province: "Gauteng",
      nationality: "Nigerian",
      status: "employed" as const,
    },
    {
      handle: "aisha-k",
      displayName: "Aisha K.",
      profession: "Chef",
      city: "Cape Town",
      province: "Western Cape",
      nationality: "Kenyan",
      status: "open_to_work" as const,
    },
  ];

  // app_user + credential account
  await db.insert(schema.appUser).values(
    foreignProfiles.map((p) => ({
      id: id("user", p.handle),
      name: p.displayName,
      email: `${p.handle}@example.co.za`,
      emailVerified: true,
      role: "seeker" as const,
    })),
  );
  await db.insert(schema.account).values(
    foreignProfiles.map((p) => ({
      id: `acc_${id("user", p.handle)}`,
      accountId: id("user", p.handle),
      providerId: "credential",
      userId: id("user", p.handle),
      password: pwHash,
    })),
  );

  // profiles
  await db.insert(schema.profiles).values(
    foreignProfiles.map((p) => ({
      id: id("prof", p.handle),
      userId: id("user", p.handle),
      handle: p.handle,
      displayName: p.displayName,
      profession: p.profession,
      seniority: null,
      city: p.city,
      province: p.province,
      nationality: p.nationality,
      isCitizen: false,
      bio: null,
      status: p.status,
      statusConfirmedAt: new Date("2026-05-15"),
      workAvailability: ["full_time" as const],
      verification: "unverified" as const,
      completeness: 45,
      memberSince,
    })),
  );

  // consents  searchability granted so they appear in /search;
  // outcomes_research not granted (not students). Phase 9.8.8
  // chiamaka-o + kemi-a also grant `vacancy_matching` so the
  // bulk-invite demo can include foreign-national candidates
  // structurally proving §CRITICAL "highlight, not gate" (compliance
  // check (c)).
  const foreignVacancyGranters = new Set(["chiamaka-o", "kemi-a"]);
  await db.insert(schema.consents).values(
    foreignProfiles.flatMap((p) =>
      CONSENT_PURPOSES.map((purpose) => {
        const isGranted =
          purpose === "searchability" ||
          (purpose === "vacancy_matching" &&
            foreignVacancyGranters.has(p.handle));
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

  // 2 foreign-national placements at Discovery Bank. Combined with
  // the 3 BSc CS cohort placements already seeded, Discovery sits
  // at exactly the employer_mix_min_placements floor (default 5),
  // so the /gov per-employer lookup demo returns a real split: 3
  // SA citizens (60%) + 2 foreign nationals (40%).
  await db.insert(schema.placements).values([
    {
      id: id("plc", "chiamaka-o"),
      profileId: id("prof", "chiamaka-o"),
      organizationId: discoveryOrgId,
      actorUserId: id("user", "naledi-k"),
      role: "Full-stack developer",
      city: "Sandton",
      hiredAt: new Date("2026-03-20"),
      salaryBand: "R 480k600k",
      source: "employer_confirmed" as const,
    },
    {
      id: id("plc", "kemi-a"),
      profileId: id("prof", "kemi-a"),
      organizationId: discoveryOrgId,
      actorUserId: id("user", "naledi-k"),
      role: "Junior backend developer",
      city: "Sandton",
      hiredAt: new Date("2026-04-22"),
      salaryBand: "R 360k480k",
      source: "employer_confirmed" as const,
    },
  ]);

  // Demand seeds: 12 distinct synthetic actor_org_id values, each
  // searching for "Software developer" in Gauteng in the trailing
  // 30 days. demand_score = 12 / 10 = 1.2, above lmi_demand_floor.
  // With the 12-strong BSc CS cohort as SA supply,
  // local_supply_ratio comfortably >= 1.0  the cell classifies
  // as "Local supply available" out of the box.
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  await db.insert(schema.searchEvents).values(
    Array.from({ length: 12 }, (_, i) => ({
      id: id("srch", `demo-sw-gauteng-${String(i + 1).padStart(2, "0")}`),
      terms: "software developer",
      filters: { province: "Gauteng" } as Record<string, unknown>,
      resultCount: 12,
      actorOrgId: `org_demo_employer_${String(i + 1).padStart(3, "0")}`,
      at: new Date(now - (i + 1) * oneDayMs),
    })),
  );
}

/**
 * Phase 9.8.8  vacancies + invitation pipeline + retroactively-
 * linked placements. Lands real (suppressed) rows on:
 *
 *   /employer/vacancies                 list + decline-reason card
 *   /employer/vacancies/[id]            pipeline panel + placements panel
 *   /employer/vacancies/[id]/match      bulk-invite candidate list
 *   /dashboard/invitations              seeker inbox (per recipient)
 *   /gov/shortage#why-roles-go-unfilled cross-market decline aggregate
 *   /api/admin/outcomes-compliance      every 9.8.8 assertion has rows
 *                                       to walk
 *
 * The fixture set:
 *   V1  "Senior Software Engineer" (Gauteng, open). Invitations:
 *        - wits-bsc-cs-2026-04        → accepted
 *        - wits-bsc-cs-2026-05        → declined (salary_not_competitive,
 *                                       with a 200-char note flagged
 *                                       seekerAuthoredFreeText: true)
 *        - chiamaka-o                 → accepted_with_notice (3 months)
 *                                       (foreign-national  proves the
 *                                       "highlight, not gate" rule by
 *                                       construction)
 *   V2  "Backend Developer" (Western Cape, open). Invitations:
 *        - wits-bsc-cs-2026-06        → still invited (pending)
 *        - wits-bsc-cs-2026-07        → expired (backdated expires_at)
 *   V3  "Graduate Software Developer Programme" (Gauteng, filled)
 *        synthetic vacancy whose only purpose is to retroactively
 *        link the three pre-existing BSc CS cohort placements
 *        (01, 02, 03) so the vacancyplacement loop has real
 *        history immediately. No invitations on this one.
 *
 * Audit-log rows mirror what the production action handlers would
 * write (vacancy.create, vacancy.invite, vacancy.response with the
 * variant in meta.responseKind, vacancy.invite.expire for the
 * cron'd row).
 */
async function seedPhase9_8Vacancies() {
  console.log("📝 Phase 9.8.8  vacancies + invitations + linked placements…");
  const orgId = id("org", "discovery-bank");
  const recruiterUserId = id("user", "naledi-k");
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const v1 = id("vac", "senior-software-engineer");
  const v2 = id("vac", "backend-developer");
  const v3 = id("vac", "grad-sw-dev-programme");

  await db.insert(schema.vacancies).values([
    {
      id: v1,
      organizationId: orgId,
      createdByUserId: recruiterUserId,
      title: "Senior Software Engineer",
      professionSlug: "software-developer",
      provinceSlug: "gauteng",
      citySlug: null,
      skillSlugs: ["typescript", "postgres"],
      seniority: "Senior",
      salaryBand: "R 720k900k",
      description:
        "Senior individual contributor. You'll own a slice of the platform end-to-end. SQL fluency + production TypeScript expected. Private to Discovery Bank.",
      documentsRequired: [],
      status: "open" as const,
      inviteExpiryDays: 14,
      createdAt: new Date(now - 10 * day),
    },
    {
      id: v2,
      organizationId: orgId,
      createdByUserId: recruiterUserId,
      title: "Backend Developer",
      professionSlug: "software-developer",
      provinceSlug: "western-cape",
      citySlug: null,
      skillSlugs: ["typescript", "postgres"],
      seniority: "Intermediate",
      salaryBand: "R 480k600k",
      description: "Backend role on the payments platform. Cape Town team.",
      documentsRequired: [],
      status: "open" as const,
      inviteExpiryDays: 7,
      createdAt: new Date(now - 14 * day),
    },
    {
      id: v3,
      organizationId: orgId,
      createdByUserId: recruiterUserId,
      title: "Graduate Software Developer Programme",
      professionSlug: "software-developer",
      provinceSlug: "gauteng",
      citySlug: null,
      skillSlugs: [],
      seniority: "Junior",
      salaryBand: "R 300k360k",
      description:
        "12-month graduate rotation through the platform team. Open to recent BSc CS / IT grads.",
      documentsRequired: [],
      status: "filled" as const,
      inviteExpiryDays: 14,
      createdAt: new Date(now - 60 * day),
      closedAt: new Date(now - 7 * day),
    },
  ]);

  // Retroactively link the three BSc CS cohort placements (01, 02,
  // 03) to V3  closes the vacancyplacement loop with real
  // history. The placements themselves were seeded earlier; we
  // patch the vacancy_id column here.
  await db.execute(sql`
    UPDATE placements
    SET vacancy_id = ${v3}
    WHERE id IN (
      ${id("plc", "wits-bsc-cs-2026-01")},
      ${id("plc", "wits-bsc-cs-2026-02")},
      ${id("plc", "wits-bsc-cs-2026-03")}
    )
  `);

  // Invitations  one of each lifecycle state across V1 + V2.
  const inv1Accepted = id("inv", "v1-cohort-04");
  const inv1Declined = id("inv", "v1-cohort-05");
  const inv1WithNotice = id("inv", "v1-chiamaka");
  const inv2Invited = id("inv", "v2-cohort-06");
  const inv2Expired = id("inv", "v2-cohort-07");

  await db.insert(schema.vacancyInvitations).values([
    // V1  accepted (5 days ago)
    {
      id: inv1Accepted,
      vacancyId: v1,
      profileId: id("prof", "wits-bsc-cs-2026-04"),
      invitedByUserId: recruiterUserId,
      invitedAt: new Date(now - 7 * day),
      expiresAt: new Date(now + 7 * day),
      state: "accepted" as const,
      respondedAt: new Date(now - 5 * day),
    },
    // V1  declined with reason + note (3 days ago)
    {
      id: inv1Declined,
      vacancyId: v1,
      profileId: id("prof", "wits-bsc-cs-2026-05"),
      invitedByUserId: recruiterUserId,
      invitedAt: new Date(now - 7 * day),
      expiresAt: new Date(now + 7 * day),
      state: "declined" as const,
      respondedAt: new Date(now - 3 * day),
      declineReason: "salary_not_competitive" as const,
      declineNote:
        "Comparing to a competing offer; band needs to move ~15 % for me to seriously consider.",
    },
    // V1  accepted with 3-month notice (foreign-national  highlight-not-gate)
    {
      id: inv1WithNotice,
      vacancyId: v1,
      profileId: id("prof", "chiamaka-o"),
      invitedByUserId: recruiterUserId,
      invitedAt: new Date(now - 7 * day),
      expiresAt: new Date(now + 7 * day),
      state: "accepted_with_notice" as const,
      respondedAt: new Date(now - 2 * day),
      noticePeriodMonths: 3,
    },
    // V2  still invited
    {
      id: inv2Invited,
      vacancyId: v2,
      profileId: id("prof", "wits-bsc-cs-2026-06"),
      invitedByUserId: recruiterUserId,
      invitedAt: new Date(now - 2 * day),
      expiresAt: new Date(now + 5 * day),
      state: "invited" as const,
    },
    // V2  expired (backdated expires_at; cron would have flipped it)
    {
      id: inv2Expired,
      vacancyId: v2,
      profileId: id("prof", "wits-bsc-cs-2026-07"),
      invitedByUserId: recruiterUserId,
      invitedAt: new Date(now - 14 * day),
      expiresAt: new Date(now - 7 * day),
      state: "expired" as const,
      respondedAt: new Date(now - 7 * day),
    },
  ]);

  // Audit log  one row per significant state change, mirroring what
  // the production action handlers + the cron write. The
  // assertDeclineNoteFlaggedPII compliance check walks these rows.
  await db.insert(schema.auditLog).values([
    {
      id: id("aud", "v1-create"),
      kind: "vacancy.create",
      actor: recruiterUserId,
      subject: v1,
      meta: {
        orgId,
        title: "Senior Software Engineer",
        profession: "software-developer",
        province: "gauteng",
      },
      at: new Date(now - 10 * day),
    },
    {
      id: id("aud", "v2-create"),
      kind: "vacancy.create",
      actor: recruiterUserId,
      subject: v2,
      meta: {
        orgId,
        title: "Backend Developer",
        profession: "software-developer",
        province: "western-cape",
      },
      at: new Date(now - 14 * day),
    },
    // Invitations + responses
    {
      id: id("aud", inv1Accepted + "-invite"),
      kind: "vacancy.invite",
      actor: recruiterUserId,
      subject: inv1Accepted,
      meta: {
        orgId,
        vacancyId: v1,
        profileId: id("prof", "wits-bsc-cs-2026-04"),
      },
      at: new Date(now - 7 * day),
    },
    {
      id: id("aud", inv1Accepted + "-response"),
      kind: "vacancy.response",
      actor: id("user", "wits-bsc-cs-2026-04"),
      subject: inv1Accepted,
      meta: {
        responseKind: "accept",
        vacancyId: v1,
        orgId,
      },
      at: new Date(now - 5 * day),
    },
    {
      id: id("aud", inv1Declined + "-invite"),
      kind: "vacancy.invite",
      actor: recruiterUserId,
      subject: inv1Declined,
      meta: {
        orgId,
        vacancyId: v1,
        profileId: id("prof", "wits-bsc-cs-2026-05"),
      },
      at: new Date(now - 7 * day),
    },
    {
      id: id("aud", inv1Declined + "-response"),
      kind: "vacancy.response",
      actor: id("user", "wits-bsc-cs-2026-05"),
      subject: inv1Declined,
      meta: {
        responseKind: "decline",
        vacancyId: v1,
        orgId,
        declineReason: "salary_not_competitive",
        declineNote:
          "Comparing to a competing offer; band needs to move ~15 % for me to seriously consider.",
        // 9.8.8 (f) contract: PII flag on every decline-note row.
        seekerAuthoredFreeText: true,
      },
      at: new Date(now - 3 * day),
    },
    {
      id: id("aud", inv1WithNotice + "-invite"),
      kind: "vacancy.invite",
      actor: recruiterUserId,
      subject: inv1WithNotice,
      meta: {
        orgId,
        vacancyId: v1,
        profileId: id("prof", "chiamaka-o"),
      },
      at: new Date(now - 7 * day),
    },
    {
      id: id("aud", inv1WithNotice + "-response"),
      kind: "vacancy.response",
      actor: id("user", "chiamaka-o"),
      subject: inv1WithNotice,
      meta: {
        responseKind: "accept_with_notice",
        vacancyId: v1,
        orgId,
      },
      at: new Date(now - 2 * day),
    },
    {
      id: id("aud", inv2Invited + "-invite"),
      kind: "vacancy.invite",
      actor: recruiterUserId,
      subject: inv2Invited,
      meta: {
        orgId,
        vacancyId: v2,
        profileId: id("prof", "wits-bsc-cs-2026-06"),
      },
      at: new Date(now - 2 * day),
    },
    {
      id: id("aud", inv2Expired + "-invite"),
      kind: "vacancy.invite",
      actor: recruiterUserId,
      subject: inv2Expired,
      meta: {
        orgId,
        vacancyId: v2,
        profileId: id("prof", "wits-bsc-cs-2026-07"),
      },
      at: new Date(now - 14 * day),
    },
    {
      id: id("aud", inv2Expired + "-expire"),
      kind: "vacancy.invite.expire",
      actor: "cron:vacancy-invite-expiry",
      subject: inv2Expired,
      meta: { orgId, vacancyId: v2 },
      at: new Date(now - 7 * day),
    },
  ]);
}

/**
 * Phase 9.10  three lifecycle org fixtures so the admin
 * organisations queue has something to demo + the compliance
 * assertions have rows to walk:
 *
 *   - Acme Logistics  PENDING REVIEW (submitted; 4 required docs
 *     uploaded; admin queue's primary actionable row)
 *   - Globex Industries  REJECTED (admin rejected with reason;
 *     shows the rejected-screen branch on the seeker side)
 *   - Initech  UNVERIFIED + emailVerified (draft state; admin
 *     queue's secondary "Drafts" group; Owner can resubmit)
 *
 * Discovery Bank (the original MOCK_EMPLOYER) stays seeded with
 * verification driven by `MOCK_EMPLOYER.orgVerified` (currently
 * false  i.e. unverified). Don't break the existing demo flow.
 *
 * Document storage keys are placeholders. The admin OrgReviewModal
 * fetches signed URLs at click time; for these seed rows the
 * Supabase storage object doesn't actually exist  the modal
 * shows "URL signing failed" gracefully instead of crashing.
 * Real uploads on actual onboarding flows will work normally.
 */
async function seedPhase9_10OrgVetting() {
  console.log("🛡  Phase 9.10  org vetting lifecycle fixtures…");
  const pwHash = await hashPassword(SEED_PASSWORD);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  interface Fixture {
    orgId: string;
    ownerHandle: string;
    ownerName: string;
    ownerEmail: string;
    orgName: string;
    registration: string;
    industry: string;
    country: string;
    city: string | null;
    companyAddress: string | null;
    vatNumber: string | null;
    verification: "unverified" | "pending" | "verified" | "rejected";
    rejectionReason: string | null;
    adminNote: string | null;
    createdAt: Date;
    docs: { kind: string; originalName: string }[];
  }

  const fixtures: Fixture[] = [
    {
      orgId: "org_acme-logistics",
      ownerHandle: "acme-owner",
      ownerName: "Themba Khumalo",
      ownerEmail: "owner@acme-logistics.example",
      orgName: "Acme Logistics",
      registration: "2019/123456/07",
      industry: "Logistics",
      country: "South Africa",
      city: "Johannesburg",
      companyAddress:
        "12 Industrial Avenue, Aeroton, Johannesburg, Gauteng, 2013",
      vatNumber: "4123456789",
      verification: "pending",
      rejectionReason: null,
      adminNote: null,
      createdAt: new Date(now - 2 * day),
      docs: [
        { kind: "company_reg_cert", originalName: "CK1-Acme.pdf" },
        { kind: "tax_clearance", originalName: "SARS-pin-Acme.pdf" },
        { kind: "proof_of_address", originalName: "Eskom-bill-2026-04.pdf" },
        { kind: "bank_confirmation", originalName: "FNB-confirmation.pdf" },
      ],
    },
    {
      orgId: "org_globex-industries",
      ownerHandle: "globex-owner",
      ownerName: "Sarah van der Merwe",
      ownerEmail: "owner@globex-industries.example",
      orgName: "Globex Industries",
      registration: "2018/987654/07",
      industry: "Manufacturing",
      country: "South Africa",
      city: "Cape Town",
      companyAddress: "Building 4, Black River Park, Observatory, Cape Town, 7925",
      vatNumber: null,
      verification: "rejected",
      rejectionReason:
        "CIPC certificate is for a different legal entity than the registration number on file. Please upload the certificate matching reg 2018/987654/07 and resubmit.",
      adminNote: null,
      createdAt: new Date(now - 10 * day),
      docs: [
        { kind: "company_reg_cert", originalName: "CK1-Globex-wrong.pdf" },
        { kind: "tax_clearance", originalName: "Tax-clearance.pdf" },
        { kind: "proof_of_address", originalName: "Lease.pdf" },
        { kind: "bank_confirmation", originalName: "Standard-Bank.pdf" },
      ],
    },
    {
      orgId: "org_initech",
      ownerHandle: "initech-owner",
      ownerName: "Peter Gibbons",
      ownerEmail: "owner@initech.example",
      orgName: "Initech",
      registration: "2024/555111/07",
      industry: "Information technology",
      country: "South Africa",
      city: null,
      companyAddress: null,
      vatNumber: null,
      verification: "unverified",
      rejectionReason: null,
      adminNote: null,
      createdAt: new Date(now - day),
      docs: [],
    },
  ];

  // Users + better-auth accounts for each Owner.
  await db.insert(schema.appUser).values(
    fixtures.map((f) => ({
      id: id("user", f.ownerHandle),
      name: f.ownerName,
      email: f.ownerEmail,
      emailVerified: true,
      role: "employer" as const,
    })),
  );
  await db.insert(schema.account).values(
    fixtures.map((f) => ({
      id: `acc_${id("user", f.ownerHandle)}`,
      accountId: id("user", f.ownerHandle),
      providerId: "credential",
      userId: id("user", f.ownerHandle),
      password: pwHash,
    })),
  );

  // Orgs + memberships.
  await db.insert(schema.organizations).values(
    fixtures.map((f) => ({
      id: f.orgId,
      name: f.orgName,
      registrationNumber: f.registration,
      industry: f.industry,
      sizeBand: "11  50",
      city: f.city,
      country: f.country,
      verification: f.verification,
      rejectionReason: f.rejectionReason,
      adminNote: f.adminNote,
      companyAddress: f.companyAddress,
      vatNumber: f.vatNumber,
      verifiedAt: null,
      verifiedByUserId: null,
      createdAt: f.createdAt,
    })),
  );
  await db.insert(schema.organizationMembers).values(
    fixtures.map((f) => ({
      id: id("orgmem", f.ownerHandle),
      organizationId: f.orgId,
      userId: id("user", f.ownerHandle),
      role: "owner" as const,
      twoFactorActive: false,
    })),
  );

  // Documents (placeholder storage keys  signed-URL fetch will
  // fail gracefully in the admin modal). Only fixtures that have
  // submitted will have docs here.
  const docRows = fixtures.flatMap((f) =>
    f.docs.map((d, idx) => ({
      id: id("orgdoc", `${f.ownerHandle}-${d.kind}-${idx}`),
      organizationId: f.orgId,
      kind: d.kind as "company_reg_cert" | "tax_clearance" | "proof_of_address" | "bank_confirmation" | "other",
      originalName: d.originalName,
      storageKey: `${id("user", f.ownerHandle)}/org-documents/${id("orgdoc", `${f.ownerHandle}-${d.kind}-${idx}`)}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1_234_567,
      uploadedByUserId: id("user", f.ownerHandle),
      uploadedAt: f.createdAt,
    })),
  );
  if (docRows.length > 0) {
    await db.insert(schema.organizationDocuments).values(docRows);
  }
}

/**
 * Phase 9.12  Three learning items on one Wits BSc CS cohort member
 * (wits-bsc-cs-2026-08, unused by the 9.8 vacancy seed) so the My
 * Learning section on /dashboard/grow renders a real Active +
 * Recent split out of the box, AND 9.13's "why learners stall"
 * aggregate has a real (suppressed) row to work against:
 *
 *   - react       → in_progress     (started 10d ago)
 *   - typescript  → completed       (started 30d, completed 5d ago)
 *                                    + profile_skills row with
 *                                    provenance='self_attested_learning'
 *                                    (the 9.12.4 honesty contract in seed form)
 *   - postgres    → abandoned       (reason=too_expensive, 3d ago)
 *                                    → D3 free-alt chip lights up on
 *                                    the compass on next render
 *
 * Audit rows mirror what the action handlers + abandon modal write.
 */
async function seedPhase9_12LearningLoop() {
  console.log("📚 Phase 9.12  learning-loop fixtures (Wits cohort 08)…");
  const profileId = id("prof", "wits-bsc-cs-2026-08");
  const userId = id("user", "wits-bsc-cs-2026-08");
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const lrnReact = id("lrn", "wits08-react");
  const lrnTs = id("lrn", "wits08-typescript");
  const lrnPg = id("lrn", "wits08-postgres");

  await db.insert(schema.learningItems).values([
    {
      id: lrnReact,
      profileId,
      skillSlug: "react",
      title: "Build a React app from scratch  freeCodeCamp",
      provider: "freeCodeCamp",
      resourceUrl: "https://www.freecodecamp.org/learn/front-end-development-libraries/",
      resourceKind: "free",
      isFree: true,
      state: "in_progress",
      startedAt: new Date(now - 10 * day),
    },
    {
      id: lrnTs,
      profileId,
      skillSlug: "typescript",
      title: "TypeScript fundamentals  TVET short course",
      provider: "Tshwane North TVET",
      resourceUrl: null,
      resourceKind: "tvet",
      isFree: false,
      state: "completed",
      startedAt: new Date(now - 30 * day),
      completedAt: new Date(now - 5 * day),
    },
    {
      id: lrnPg,
      profileId,
      skillSlug: "postgres",
      title: "PostgreSQL for backend  paid bootcamp",
      provider: "Codespace SA",
      resourceUrl: null,
      resourceKind: "other",
      isFree: false,
      state: "abandoned",
      startedAt: new Date(now - 14 * day),
      abandonedAt: new Date(now - 3 * day),
      abandonReason: "too_expensive",
      abandonNote:
        "Bursary application timed out and the upfront fee is more than I can cover this semester.",
    },
  ]);

  // Profile-skill upsert for the completed item  the 9.12.4 honesty
  // contract baked into seed: provenance='self_attested_learning',
  // verifiedAt=NULL, yearsOfExperience=NULL ("<1 yr" honest).
  await db
    .insert(schema.profileSkills)
    .values({
      profileId,
      skillSlug: "typescript",
      proficiency: 3,
      yearsOfExperience: null,
      provenance: "self_attested_learning",
      verifiedAt: null,
    })
    .onConflictDoNothing();

  await db.insert(schema.auditLog).values([
    {
      id: id("aud", lrnReact + "-accept"),
      kind: "learning.accept",
      actor: userId,
      subject: lrnReact,
      meta: { skillSlug: "react" },
      at: new Date(now - 11 * day),
    },
    {
      id: id("aud", lrnReact + "-start"),
      kind: "learning.start",
      actor: userId,
      subject: lrnReact,
      meta: { skillSlug: "react", from: "accepted" },
      at: new Date(now - 10 * day),
    },
    {
      id: id("aud", lrnTs + "-accept"),
      kind: "learning.accept",
      actor: userId,
      subject: lrnTs,
      meta: { skillSlug: "typescript" },
      at: new Date(now - 31 * day),
    },
    {
      id: id("aud", lrnTs + "-start"),
      kind: "learning.start",
      actor: userId,
      subject: lrnTs,
      meta: { skillSlug: "typescript", from: "accepted" },
      at: new Date(now - 30 * day),
    },
    {
      id: id("aud", lrnTs + "-complete"),
      kind: "learning.complete",
      actor: userId,
      subject: lrnTs,
      meta: { skillSlug: "typescript", attachedToProfile: true },
      at: new Date(now - 5 * day),
    },
    {
      id: id("aud", lrnPg + "-accept"),
      kind: "learning.accept",
      actor: userId,
      subject: lrnPg,
      meta: { skillSlug: "postgres" },
      at: new Date(now - 15 * day),
    },
    {
      id: id("aud", lrnPg + "-abandon"),
      kind: "learning.abandon",
      actor: userId,
      subject: lrnPg,
      meta: {
        skillSlug: "postgres",
        from: "in_progress",
        reason: "too_expensive",
        seekerAuthoredFreeText: true,
      },
      at: new Date(now - 3 * day),
    },
  ]);
}

/**
 * Phase 9.13  Hand-curated programme × skill mapping. D4 in
 * PHASE_9_13_PLAN.md says: 8-12 institutions × 2-3 programmes each ×
 * 6-10 skills per programme, sized small + honest as an SAQA-feed
 * approximation. Programmes match `academic_profiles.programme` text
 * conventions (e.g. "BSc Computer Science"). Weight scale:
 *
 *   9..10  core / required outcome
 *   6..8   strong elective coverage
 *   3..5   common adjacency
 *   1..2   rare / circumstantial overlap
 *
 * Skills used reference real entries in `lib/mock/taxonomy.ts` SKILLS:
 * react, node, typescript, postgres, payroll, ifrs, plating, prep,
 * pastry, kitchen-mgmt, grill, menu-design, wiring, industrial-wiring,
 * pdi. The seed deliberately covers (a) CS programmes at multiple
 * institutions, (b) accounting/finance, (c) hospitality/culinary,
 * (d) artisan/electrical so 9.13.3 has cross-cell variation to render.
 */
/**
 * Phase 9.13.5  Seeded stall-cell fixtures so the gov-side
 * /gov/shortage stall-reasons card has one real (unsuppressed) cell
 * at ship time, alongside the typeahead of "limited data" empty
 * states that genuinely sparse cells render. Without this, every
 * cell would suppress on day 1 and reviewers wouldn't see the query
 * working.
 *
 * Pattern: 10 of the 12 BSc CS cohort members (Wits, Gauteng, all
 * already opted in to outcomes_research via seedPhase7_5OutcomesCohort)
 * get an abandoned learning_item on `postgres` with reason
 * `too_expensive`. That puts (postgres × gauteng × too_expensive)
 * exactly at k=10, the floor, which means it survives suppression
 * (count >= k is the rule, not count > k).
 *
 * Note: the existing wits08 abandoned-postgres row from
 * seedPhase9_12LearningLoop is one of the 10; we use cohort 03 + 09..16
 * to round out (skipping 04/05/06/07 which are already entangled in
 * vacancy invitations + 01/02 which we leave as "clean" non-stall
 * fixtures for variety).
 */
async function seedPhase9_13StallFixtures() {
  console.log("📉 Phase 9.13  stall-cell fixtures (10 BSc CS · postgres abandoned)…");
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  // Cohort members to add stall fixtures for (10 total, excluding
  // wits08 which already has one from 9.12). Combined this gives k=11
  // on the (postgres × gauteng × too_expensive) cell  comfortably
  // above the floor of 10.
  const cohortIds = [
    "wits-bsc-cs-2026-01",
    "wits-bsc-cs-2026-02",
    "wits-bsc-cs-2026-03",
    "wits-bsc-cs-2026-09",
    "wits-bsc-cs-2026-10",
    "wits-bsc-cs-2026-11",
    "wits-bsc-cs-2026-12",
  ];
  // 7 fixtures + 1 already-existing (wits08) + 2 other = need 3 more
  // to clear k=10. Add 3 with reason `course_quality` to demonstrate
  // a second reason variant (one row per cohort 04/05 needs to stay
  // out of vacancy entanglements; cohort 06/07 same. So we use the
  // remaining slots: extending the above list keeps stack readable.)
  const courseQualityIds = [
    "wits-bsc-cs-2026-04",
    "wits-bsc-cs-2026-05",
    "wits-bsc-cs-2026-06",
  ];

  const rows = [
    ...cohortIds.map((handle, i) => ({
      id: id("lrn", `${handle}-postgres-stall`),
      profileId: id("prof", handle),
      skillSlug: "postgres",
      title: "PostgreSQL for backend  paid bootcamp",
      provider: "Codespace SA",
      resourceUrl: null,
      resourceKind: "other",
      isFree: false,
      state: "abandoned" as const,
      startedAt: new Date(now - (20 + i) * day),
      abandonedAt: new Date(now - (5 + i) * day),
      abandonReason: "too_expensive" as const,
      abandonNote: null,
    })),
    ...courseQualityIds.map((handle, i) => ({
      id: id("lrn", `${handle}-postgres-stall-q`),
      profileId: id("prof", handle),
      skillSlug: "postgres",
      title: "PostgreSQL for backend  bootcamp",
      provider: "Codespace SA",
      resourceUrl: null,
      resourceKind: "other",
      isFree: false,
      state: "abandoned" as const,
      startedAt: new Date(now - (25 + i) * day),
      abandonedAt: new Date(now - (8 + i) * day),
      abandonReason: "course_quality" as const,
      abandonNote: null,
    })),
  ];
  await db.insert(schema.learningItems).values(rows);
  console.log(`   inserted ${rows.length} stall-fixture rows`);
}

async function seedPhase9_13ProgrammeSkills() {
  console.log("🏛️  Phase 9.13  programme_skills hand-curated mapping…");

  type PSRow = {
    institutionSlug: string;
    programme: string;
    skillSlug: string;
    weight: number;
  };

  const rows: PSRow[] = [
    // ── BSc Computer Science  research universities ──────────────────
    ...csRows("wits"),
    ...csRows("uct"),
    ...csRows("up"),
    ...csRows("ukzn"),

    // ── BCom Accounting / Finance ────────────────────────────────────
    ...comAccountingRows("stellenbosch"),
    ...comAccountingRows("uj"),
    ...comAccountingRows("nwu"),

    // ── National Diploma Information Technology (UoTs) ────────────────
    ...itDiplomaRows("tut"),
    ...itDiplomaRows("cput"),

    // ── National Certificate Hospitality (TVET) ───────────────────────
    ...hospitalityRows("tvet-false-bay"),
    ...hospitalityRows("tvet-tshwane-north"),

    // ── National Certificate Electrical (INDLELA + TVET) ──────────────
    ...electricalRows("indlela"),
    ...electricalRows("tvet-ekurhuleni-west"),
  ];

  await db.insert(schema.programmeSkills).values(rows);
  console.log(`   inserted ${rows.length} programme_skills rows`);

  function csRows(slug: string): PSRow[] {
    const programme = "BSc Computer Science";
    return [
      { institutionSlug: slug, programme, skillSlug: "typescript", weight: 8 },
      { institutionSlug: slug, programme, skillSlug: "node", weight: 7 },
      { institutionSlug: slug, programme, skillSlug: "react", weight: 6 },
      { institutionSlug: slug, programme, skillSlug: "postgres", weight: 7 },
    ];
  }
  function comAccountingRows(slug: string): PSRow[] {
    const programme = "BCom Accounting";
    return [
      { institutionSlug: slug, programme, skillSlug: "ifrs", weight: 10 },
      { institutionSlug: slug, programme, skillSlug: "payroll", weight: 6 },
    ];
  }
  function itDiplomaRows(slug: string): PSRow[] {
    const programme = "National Diploma Information Technology";
    return [
      { institutionSlug: slug, programme, skillSlug: "typescript", weight: 7 },
      { institutionSlug: slug, programme, skillSlug: "react", weight: 7 },
      { institutionSlug: slug, programme, skillSlug: "node", weight: 6 },
      { institutionSlug: slug, programme, skillSlug: "postgres", weight: 6 },
    ];
  }
  function hospitalityRows(slug: string): PSRow[] {
    const programme = "National Certificate Hospitality";
    return [
      { institutionSlug: slug, programme, skillSlug: "kitchen-mgmt", weight: 9 },
      { institutionSlug: slug, programme, skillSlug: "prep", weight: 9 },
      { institutionSlug: slug, programme, skillSlug: "plating", weight: 7 },
      { institutionSlug: slug, programme, skillSlug: "grill", weight: 6 },
      { institutionSlug: slug, programme, skillSlug: "pastry", weight: 5 },
      { institutionSlug: slug, programme, skillSlug: "menu-design", weight: 4 },
    ];
  }
  function electricalRows(slug: string): PSRow[] {
    const programme = "National Certificate Electrical";
    return [
      { institutionSlug: slug, programme, skillSlug: "wiring", weight: 9 },
      { institutionSlug: slug, programme, skillSlug: "industrial-wiring", weight: 8 },
      { institutionSlug: slug, programme, skillSlug: "pdi", weight: 4 },
    ];
  }
}

/**
 * Phase 9.15  Three demo taxonomy suggestions so /admin/taxonomy/suggestions
 * renders real content immediately. Demonstrates the full lifecycle:
 *
 *   1. PENDING profession  "Game Ranger" submitted by a cohort student.
 *      Admin can promote / merge / reject. Shows the simplest path.
 *
 *   2. PENDING institution  "Damelin College" with the matching
 *      `institutions` pending row already inserted (is_pending=true,
 *      slug = other--damelin-college-<rand>). Admin can promote (flip
 *      is_pending to false) or merge (link to existing canonical).
 *      Shows the institution flow with the pending FK row in place.
 *
 *   3. REJECTED  "asdfasdf" spam submission. Demonstrates the
 *      rejection lifecycle  the suggestion is in state='rejected'
 *      but the submitter's profile (if any) is untouched.
 */
async function seedPhase9_15TaxonomySuggestions() {
  console.log("📥 Phase 9.15  taxonomy suggestion fixtures…");
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // (1) Pending profession  Game Ranger
  await db.insert(schema.taxonomySuggestions).values({
    id: id("tx", "game-ranger"),
    kind: "profession",
    customText: "Game Ranger",
    submittedByUserId: id("user", "wits-bsc-cs-2026-09"),
    submittedAt: new Date(now - 2 * day),
    state: "pending",
  });

  // (2) Pending institution  Damelin College
  // First insert the pending institutions row that the suggestion FKs to.
  const damelinSlug = "other--damelin-college-seed01";
  await db.insert(schema.institutions).values({
    slug: damelinSlug,
    label: "Damelin College",
    kind: "private",
    city: "Pending",
    provinceSlug: "gauteng",
    isPending: true,
  });
  await db.insert(schema.taxonomySuggestions).values({
    id: id("tx", "damelin"),
    kind: "institution",
    customText: "Damelin College",
    submittedByUserId: id("user", "wits-bsc-cs-2026-10"),
    submittedAt: new Date(now - 3 * day),
    state: "pending",
    pendingInstitutionSlug: damelinSlug,
  });

  // (3) Rejected  "asdfasdf" spam demonstration
  await db.insert(schema.taxonomySuggestions).values({
    id: id("tx", "spam-rejected"),
    kind: "profession",
    customText: "asdfasdf",
    submittedByUserId: id("user", "wits-bsc-cs-2026-11"),
    submittedAt: new Date(now - 10 * day),
    state: "rejected",
    resolvedByUserId: id("user", "sebenza-admin"),
    resolvedAt: new Date(now - 9 * day),
    adminNote: "Not a real profession  spam submission.",
  });

  // Audit log entries mirroring what the production write paths produce.
  await db.insert(schema.auditLog).values([
    {
      id: id("aud", "tx-game-ranger-submit"),
      kind: "taxonomy.suggestion.submit",
      actor: id("user", "wits-bsc-cs-2026-09"),
      subject: id("tx", "game-ranger"),
      meta: { kind: "profession", customText: "Game Ranger" },
      at: new Date(now - 2 * day),
    },
    {
      id: id("aud", "tx-damelin-submit"),
      kind: "taxonomy.suggestion.submit",
      actor: id("user", "wits-bsc-cs-2026-10"),
      subject: id("tx", "damelin"),
      meta: {
        kind: "institution",
        customText: "Damelin College",
        pendingInstitutionSlug: damelinSlug,
      },
      at: new Date(now - 3 * day),
    },
    {
      id: id("aud", "tx-spam-submit"),
      kind: "taxonomy.suggestion.submit",
      actor: id("user", "wits-bsc-cs-2026-11"),
      subject: id("tx", "spam-rejected"),
      meta: { kind: "profession", customText: "asdfasdf" },
      at: new Date(now - 10 * day),
    },
    {
      id: id("aud", "tx-spam-reject"),
      kind: "taxonomy.suggestion.reject",
      actor: id("user", "sebenza-admin"),
      subject: id("tx", "spam-rejected"),
      meta: {
        kind: "profession",
        customText: "asdfasdf",
        reason: "Not a real profession  spam submission.",
      },
      at: new Date(now - 9 * day),
    },
  ]);
}

async function seedPhase7Reports() {
  console.log("🚩 Phase 7 sample reports (open + closed  for /admin/moderation)…");
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
  console.log("🌱 Sebenza seed  Phase 2 starting database\n");

  await truncate();
  await seedTaxonomy();
  await seedUsersAndProfiles();
  await seedProfileChildren();
  await seedAcademicProfiles();
  await seedOrgsAndPlacements();
  await seedConsents();
  await seedPhase7Reports();
  // Phase 7.5  synthetic cohort that clears the k=10 floor so the
  // /insights outcomes section renders a real row in the dev demo.
  // Runs after seedOrgsAndPlacements because it inserts placements
  // referencing the Discovery Bank org id.
  await seedPhase7_5OutcomesCohort();
  // Phase 9.7  foreign-national profiles + demand seeds so the
  // nationality + Justification Index surfaces render real (suppressed)
  // rows in the dev demo. Runs last because it depends on the BSc CS
  // cohort being present (uses one cohort handle as the placeholder
  // profile for the second foreign-fill placement at Discovery).
  await seedPhase9_7NationalityDemo();
  // Phase 9.8.8  vacancies + invitations + retroactively-linked
  // placements. Runs LAST because it needs the BSc CS cohort
  // (recipients of most invitations), the foreign-national profiles
  // (chiamaka-o invitation), AND the consent rows from seedConsents
  // / seedPhase7_5OutcomesCohort / seedPhase9_7NationalityDemo (the
  // vacancy_matching consent gate the invite action enforces).
  await seedPhase9_8Vacancies();
  // Phase 9.10  lifecycle org fixtures so the admin organisations
  // queue + the OrgReviewModal have realistic rows to demo. Runs
  // after the Phase 9.8 vacancies seed so the org-id namespace is
  // settled. Adds three new (org, owner-user) pairs alongside the
  // existing Discovery Bank seed.
  await seedPhase9_10OrgVetting();
  // Phase 9.12  learning-loop fixtures on Wits cohort 08 (3 items
  // across in_progress / completed / abandoned). Runs after the
  // cohort + Phase 9.8 vacancy seeds since it borrows a profile id +
  // the new schema columns from migration 0020. Gives 9.13's stall
  // analytics one real (suppressed) row to aggregate against from
  // day 1.
  await seedPhase9_12LearningLoop();
  // Phase 9.13  hand-curated programme × skill mapping (D4 in
  // PHASE_9_13_PLAN.md). Runs after the institution + skills seed
  // since it FK-references both. The 9.13.3 curriculum-vs-demand
  // query reads this table joined against academic_profiles +
  // skillDemandQuery.
  await seedPhase9_13ProgrammeSkills();
  // Phase 9.13.5  stall-cell fixtures so the gov stall-reasons card
  // has one real (unsuppressed) cell at ship time. The 7.5 cohort
  // already opted in to outcomes_research, so the consent gate
  // passes. Runs LAST because it relies on cohort + 9.12 schema.
  await seedPhase9_13StallFixtures();
  // Phase 9.15  taxonomy suggestion queue fixtures: three demo rows so
  // /admin/taxonomy/suggestions renders real content out of the box.
  // One pending profession ("Game Ranger"), one pending institution
  // ("Damelin College" with the matching pending institutions row),
  // one already-rejected suggestion to demonstrate the lifecycle.
  await seedPhase9_15TaxonomySuggestions();

  const ms = Date.now() - started;
  console.log(
    `\n✅ Seed complete in ${ms} ms  ${mockProfiles.length} profiles, ` +
      `${PROVINCES.length} provinces, ${PROFESSIONS.length} professions, ` +
      `${SKILLS.length} skills, ${INSTITUTIONS.length} institutions.`,
  );
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
