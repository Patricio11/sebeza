"use server";

/**
 * Phase 2 auth Server Actions.
 *
 * - signUpSeeker / signUpEmployer create the Better Auth user + the
 *   Sebenza-specific rows (profiles / academic / organizations / members /
 *   consents) in one transaction. On any failure, the whole signup rolls back.
 *
 * - signIn / signOut delegate to Better Auth.
 *
 * - requestPasswordReset is anti-enumeration  it always returns success even
 *   when the email isn't on file.
 *
 * - revokeConsent / regrantConsent flip the row in `consents` and write an
 *   audit-log entry.
 *
 * Every action that touches PII calls `logAccess()` so the audit trail is
 * complete from day one (POPIA §1).
 */

import { auth } from "./server";
import { roleHome } from "./guard";
import { isValidCountryCode, countryLabel } from "@/lib/taxonomy/countries";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { logAccess } from "@/lib/audit";
import { notifyAllAdmins } from "@/lib/notifications/server";
import { slug as slugify } from "@/lib/mock/helpers";
import {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  REQUIRED_FOR_SEARCHABILITY,
} from "@/lib/consent";
import { validateDob } from "@/lib/auth/id-validation";
import { safeInternalPath } from "@/lib/nav/safe-internal-path";
import { enforce, peek } from "@/lib/rate-limit";
import { clientIpKey, emailKey } from "@/lib/rate-limit/client-ip";
import { getSetting } from "@/lib/admin/settings";
import {
  defaultPrefFor,
  type NotificationPrefMap,
} from "@/lib/notifications/catalog";
import {
  loadSelfApplyVacancyByToken,
  recordSelfApplication,
} from "@/lib/vacancy/self-apply-internal";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

type SignUpRole = "seeker" | "employer";

async function createBetterAuthUser(opts: {
  email: string;
  password: string;
  name: string;
  role: SignUpRole;
}) {
  // sign-up via Better Auth  hashes the password, emits the verification email.
  const result = await auth.api.signUpEmail({
    body: {
      email: opts.email,
      password: opts.password,
      name: opts.name,
    },
    asResponse: false,
  });
  // Set the role server-side (input: false on the role field blocks client-set).
  const db = getDb();
  await db
    .update(schema.appUser)
    .set({ role: opts.role, updatedAt: new Date() })
    .where(eq(schema.appUser.id, result.user.id));
  return result;
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
function ok<T extends object>(extra?: T): { ok: true } & T {
  return { ok: true, ...(extra ?? ({} as T)) };
}

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// signUpSeeker  wires the 3-step seeker form
// ─────────────────────────────────────────────────────────────────────────────

const seekerSignUpSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().optional(),
  // Phase 9.16  ISO yyyy-mm-dd. Re-validated below against the 14100
  // age window. Storing this lets us run the LMI youth-cohort split
  // (15-24).
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Phase 31 final shape (operator, 2026-07-21): ONE familiar nationality
  // picker for everyone  no explicit "are you a citizen?" question, so
  // the form never reads as separating users into kinds. The two-class
  // `is_citizen` the analytics + Citizen-Visibility ranking consume is
  // DERIVED server-side (code === "ZA"), exactly the 9.16 approach. The
  // label displays on the public profile + search rows. Never a gate
  // (Location-Not-Nationality); non-SA users are first-class users.
  nationality: z.string().length(2),
  password: z.string().min(10).max(128),
  // Consent purposes the user granted in step 2.
  grantedConsents: z.array(z.enum(CONSENT_PURPOSES)).min(1),
  /** Terms-of-Service + Privacy Policy acceptance  a CONTRACT
   *  acceptance, distinct from the granular POPIA consents above
   *  (see docs/SIGNUP_CONSENT_REGROUP_PLAN.md). z.literal(true)
   *  means a bypassed-form payload without it is refused outright;
   *  acceptance evidence lands in the auth.signup audit meta. */
  termsAccepted: z.literal(true),
  /** Phase 35  a COMMUNICATION PREFERENCE, not a POPIA consent and
   *  not a contract term: "tell me on my phone when an employer
   *  invites me". Optional, defaults to false, and cannot by itself
   *  cause a single push: the browser still has to grant permission
   *  on a device. What it does is record the intent, so the dashboard
   *  can offer the one-tap finisher to people who asked for it and
   *  stay quiet for people who did not. */
  wantsPushNotifications: z.boolean().optional(),
  // Step 3  first profile fields
  profession: z.string().min(2),
  province: z.string().min(2),
  status: z.enum([
    "employed",
    "unemployed",
    "self_employed",
    "studying",
    "open_to_work",
  ]),
  // Phase 7.5  optional at sign-up (also editable later from
  // /dashboard/profile). Empty = no signal. Phase 9.21 adds
  // 'seasonal' to the enum without widening anything else.
  workAvailability: z
    .array(
      z.enum([
        "casual",
        "part_time",
        "contract",
        "full_time",
        "remote",
        "hybrid",
        "seasonal",
      ]),
    )
    .max(7)
    .optional(),
  // Optional academic block when "I'm a student" is on
  academic: z
    .object({
      institutionSlug: z.string(),
      programme: z.string().min(2),
      fieldOfStudy: z.string().min(2),
      nqfLevel: z.number().int().min(4).max(10),
      currentYear: z.number().int().min(1).max(5).nullable(),
      expectedGraduation: z.string().regex(/^\d{4}-\d{2}$/),
      nsfas: z.boolean(),
      openToInternships: z.boolean(),
      openToGraduateProgrammes: z.boolean(),
      // Phase 13.1  optional current-context fields. All three are
      // independent; a year-1 student can declare modules without an
      // elective; a postgrad can declare a project topic without
      // modules. Server-side .max() bounds match the constants in
      // lib/mock/types.ts.
      currentModules: z.array(z.string().min(1).max(80)).max(8).optional(),
      electiveChosen: z.string().max(100).nullable().optional(),
      projectTopic: z.string().max(200).nullable().optional(),
    })
    .nullable(),
  /**
   * Phase 9.22  optional current-employment block. Surfaces in the
   * form when status='employed' or 'self_employed'. The picker passes
   * either `currentEmployerOrgId` (the seeker picked from the
   * verified list) or `customCurrentEmployerName` (the seeker typed
   * "Other"; we create the pending org + suggestion inline). Mutually
   * exclusive  the action ignores the custom name when the id is set.
   */
  currentEmployerOrgId: z.string().min(1).nullable().optional(),
  customCurrentEmployerName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .optional(),
  customCurrentEmployerCity: z.string().trim().max(80).optional(),
  currentRoleStartedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
  currentRoleCity: z.string().trim().max(80).nullable().optional(),
  /**
   * Phase 34  Self Apply sign-up funnel (/sign-up/apply/[token]).
   * When present + valid (flag ON, per-vacancy toggle ON, vacancy
   * open), the application row is recorded AT SIGN-UP  the
   * acceptSeekerInvitation precedent  so nothing is lost before
   * email verification. Invalid/stale tokens degrade silently to a
   * plain sign-up: the account matters more than the application.
   */
  applyToken: z.string().min(16).max(128).optional(),
  /**
   * Phase 34  the "Skills for this role" one-tap chips. Validated
   * server-side against the vacancy's own skillSlugs (never a free
   * write path into profile_skills) and stored on the PROFILE, not
   * the application  the founder's "that info gets saved on their
   * profile" requirement.
   */
  applySkillSlugs: z.array(z.string().min(1).max(80)).max(12).optional(),
});

/**
 * Phase 32.3.9 (security remediation)  duplicate-email handling that
 * does not become an enumeration oracle.
 *
 * Sign-up used to answer "An account with this email already exists"
 * (and a `return e.message` fallthrough leaked Better Auth's own
 * `USER_ALREADY_EXISTS_...` string). That undid the careful
 * anti-enumeration work on the reset + resend paths, where sign-up was
 * simply the easier oracle.
 *
 * On a JOB platform this matters more than usual: confirming an address
 * has an account can reveal that a specific person is job-hunting 
 * exactly the inference a current employer should not be able to draw.
 *
 * So we return the SAME shape as a successful sign-up and email the
 * genuine owner instead. The honest user who forgot they had an account
 * still gets guidance, delivered to the address only they control; an
 * attacker learns nothing. Nothing here is fatal: a send failure must
 * not turn into a different response shape (that would restore the
 * oracle), so it is caught and logged.
 */
/**
 * Is this address already registered? Checked BEFORE calling Better
 * Auth, deterministically  not by pattern-matching an error message.
 *
 * Behaviour worth knowing (verified against Better Auth 1.6.25): a
 * duplicate `signUpEmail` does NOT throw. It returns a PHANTOM user
 * object carrying a brand-new id while persisting nothing, and leaves
 * the real account's password and role untouched (both verified). Our
 * sign-up then tried to insert a profile pointing at that non-existent
 * user id and failed with a FOREIGN-KEY violation  so the seeker saw a
 * baffling "a required field was missing" error, AND the response still
 * differed from a real sign-up, which is the oracle we are closing.
 * Checking first removes the guesswork entirely.
 */
async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .where(eq(schema.appUser.email, email))
    .limit(1);
  return rows.length > 0;
}

async function notifyExistingAccountHolder(email: string): Promise<void> {
  try {
    const { sendEmail } = await import("@/lib/email/send");
    const origin = (
      process.env.NEXT_PUBLIC_APP_ORIGIN ??
      process.env.BETTER_AUTH_URL ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
    await sendEmail({
      to: email,
      subject: "You already have a Sebenza account",
      html: `<p>Someone just tried to create a Sebenza account with this email address.</p>
<p>If that was you: you already have an account  just sign in instead.</p>
<p><a href="${origin}/sign-in">Sign in to Sebenza</a> ·
<a href="${origin}/forgot-password">Forgotten your password?</a></p>
<p style="color:#5a5249;font-size:13px;">If it wasn't you, you can ignore this email  no new account was created and nothing about your account has changed. We will never ask you for your password.</p>`,
    });
  } catch (err) {
    // Never surface this: a send failure must not change the response
    // shape, or the enumeration oracle comes straight back.
    console.error("[signUp] existing-account notice failed:", err);
  }
}

export async function signUpSeeker(
  input: z.infer<typeof seekerSignUpSchema>,
): Promise<ActionResult<{ next: string; applied?: boolean }>> {
  const parsed = seekerSignUpSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const v = parsed.data;

  // Phase 9.16  defence in depth: re-run the same validators the
  // client ran, so a tampered request can't bypass the 14100 age
  // gate or smuggle in a bogus country code. Trust the field, not
  // the form.
  const dobCheck = validateDob(v.dateOfBirth);
  if (!dobCheck.ok) return fail(dobCheck.message);
  if (!isValidCountryCode(v.nationality)) {
    return fail("That nationality isn't recognised  pick from the list.");
  }

  // Searchability must be granted before the profile becomes searchable
  // (Phase 2 acceptance criterion). We require it on the form too.
  if (
    !REQUIRED_FOR_SEARCHABILITY.every((p) => v.grantedConsents.includes(p))
  ) {
    return fail("Searchability consent is required to create a profile.");
  }

  // Phase 32.3.9 (security remediation)  duplicate address: respond
  // EXACTLY as for a real sign-up and tell the genuine owner by email.
  // Sign-up used to answer "An account with this email already exists",
  // which made it the easy enumeration oracle and undid the careful
  // anti-enumeration work on the reset + resend paths. On a job
  // platform that inference is unusually sensitive  it can reveal that
  // a named person is job-hunting, exactly what their current employer
  // must not be able to learn.
  if (await emailAlreadyRegistered(v.email)) {
    await notifyExistingAccountHolder(v.email);
    // Phase 34  mirror the `applied` field a genuine sign-up with this
    // token would return, or the Self Apply funnel becomes a fresh
    // enumeration oracle (applied:undefined here vs applied:true on a
    // real sign-up would distinguish registered addresses). No row is
    // written; only the response SHAPE is mirrored.
    let wouldApply = false;
    if (v.applyToken) {
      try {
        const flagOn = await getSetting<boolean>(
          "feature_flag_vacancy_self_apply",
        );
        const loaded = flagOn
          ? await loadSelfApplyVacancyByToken(v.applyToken)
          : null;
        wouldApply = Boolean(
          loaded && loaded.selfApplyEnabled && loaded.status === "open",
        );
      } catch {
        // Shape-mirroring is best-effort; never let it change the path.
      }
    }
    return ok({ next: "/verify-email", applied: wouldApply });
  }

  const db = getDb();

  try {
    // Better Auth: hash password, write user + account, send verification email.
    const { user } = await createBetterAuthUser({
      email: v.email,
      password: v.password,
      name: v.fullName,
      role: "seeker",
    });

    // Create profile + consents + (optional) academic in one transaction.
    const profileId = `prof_${user.id}`;
    const handle = await uniqueHandle(db, v.fullName);

    const displayName = redactSurname(v.fullName);
    // Phase 31 final shape  citizenship class DERIVED from the picked
    // country (SA = citizen-or-PR class for the 9.7 two-class analytics;
    // the same approximation 9.16 made). Refinable later from the editor.
    const isCitizen = v.nationality === "ZA";
    const nationalityLabel: string | null = countryLabel(v.nationality) || null;

    // Phase 9.15  resolve free-text "Other" entries BEFORE the transaction.
    // For institutions: the FK constraint on academic_profiles requires the
    // slug to exist. So if the user typed free-text, create the pending
    // institutions row here + remember the slug for the academic insert.
    // For professions: profiles.profession is plain text  no resolution
    // needed at insert time. The suggestion fires post-transaction.
    let resolvedInstitutionSlug: string | null = null;
    let institutionWasCustom = false;
    if (v.academic) {
      const slug = v.academic.institutionSlug.trim();
      const existing = await db
        .select({ slug: schema.institutions.slug })
        .from(schema.institutions)
        .where(eq(schema.institutions.slug, slug))
        .limit(1);
      if (existing[0]) {
        resolvedInstitutionSlug = slug;
      } else {
        // Free-text label  create a pending institutions row.
        const provinceSlugRows = await db
          .select({ slug: schema.provinces.slug })
          .from(schema.provinces)
          .where(sql`lower(${schema.provinces.label}) = lower(${v.province})`)
          .limit(1);
        const provinceSlug = provinceSlugRows[0]?.slug ?? "gauteng";
        const pendingSlug = `other--${slugify(slug)}-${randomUUID().slice(0, 6)}`;
        await db.insert(schema.institutions).values({
          slug: pendingSlug,
          label: slug,
          kind: "private",
          city: "Pending",
          provinceSlug,
          isPending: true,
        });
        resolvedInstitutionSlug = pendingSlug;
        institutionWasCustom = true;
      }
    }

    // Phase 9.15  determine if the profession was free-text (not in
    // canonical list).
    const canonicalProf = await db
      .select({ slug: schema.professions.slug })
      .from(schema.professions)
      .where(sql`lower(${schema.professions.label}) = lower(${v.profession})`)
      .limit(1);
    const professionWasCustom = !canonicalProf[0];

    // Phase 9.22  resolve the current-employer FK. Three paths:
    //   1) currentEmployerOrgId picked from the dropdown  verify
    //      picker-visible (Sebenza-registered OR verified seeker-named)
    //   2) customCurrentEmployerName  create a pending org now;
    //      the suggestion row is written post-transaction below so the
    //      same try/catch pattern as profession suggestions applies.
    //   3) Neither (or status is not employed/self_employed)  NULL.
    let resolvedEmployerOrgId: string | null = null;
    let pendingEmployerOrgId: string | null = null;
    let employerWasCustom = false;
    let employerCustomName: string | null = null;
    let employerCustomCity: string | null = null;
    if (v.status === "employed" || v.status === "self_employed") {
      if (v.currentEmployerOrgId) {
        const orgRows = await db
          .select({
            id: schema.organizations.id,
            origin: schema.organizations.origin,
            verification: schema.organizations.verification,
          })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, v.currentEmployerOrgId))
          .limit(1);
        const org = orgRows[0];
        // Silently null on unknown / not-picker-visible  same posture
        // as Phase 9.8.6 used for cross-org vacancyId smuggling. Don't
        // fail the sign-up; the seeker can re-pick from /dashboard.
        if (
          org &&
          (org.origin === "sebenza_registered" ||
            org.verification === "verified")
        ) {
          resolvedEmployerOrgId = org.id;
        }
      } else if (v.customCurrentEmployerName) {
        const customName = v.customCurrentEmployerName.trim();
        if (customName.length >= 2) {
          // Dedupe against picker-visible orgs (same check that
          // submitTaxonomySuggestion does inline). If a match exists,
          // attach to it without creating a new pending row.
          const existingRows = await db
            .select({
              id: schema.organizations.id,
            })
            .from(schema.organizations)
            .where(
              and(
                sql`lower(${schema.organizations.name}) = lower(${customName})`,
                sql`(${schema.organizations.origin} = 'sebenza_registered' OR ${schema.organizations.verification} = 'verified')`,
              ),
            )
            .limit(1);
          if (existingRows[0]) {
            resolvedEmployerOrgId = existingRows[0].id;
          } else {
            // Create the pending org row. Suggestion + audit go
            // post-transaction below.
            pendingEmployerOrgId = `org_${randomUUID()}`;
            employerCustomCity =
              v.customCurrentEmployerCity?.trim() ?? null;
            await db.insert(schema.organizations).values({
              id: pendingEmployerOrgId,
              name: customName,
              city:
                employerCustomCity && employerCustomCity.length > 0
                  ? employerCustomCity
                  : null,
              origin: "seeker_named",
              verification: "unverified",
              listedBySeekerCount: 0,
            });
            resolvedEmployerOrgId = pendingEmployerOrgId;
            employerWasCustom = true;
            employerCustomName = customName;
          }
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(schema.profiles).values({
        id: profileId,
        userId: user.id,
        handle,
        displayName,
        fullSurname: v.fullName.split(/\s+/).slice(1).join(" ") || null,
        profession: v.profession,
        city: "",
        province: v.province,
        // Phase 9.16  DOB captured at sign-up; ID number / passport
        // NOT collected here (added later from /dashboard/profile).
        // The id_document_kind column stays at its DB default ("sa_id")
        // until the seeker actually adds a document.
        dateOfBirth: v.dateOfBirth,
        // Phase 9.16 follow-up  nationality + citizenship class.
        // isCitizen drives the Phase 9.7 nationality_class analytics
        // + the Citizen-Visibility Rule's "highlight SA candidates"
        // affordance in employer search.
        nationality: nationalityLabel,
        isCitizen,
        status: v.status,
        statusConfirmedAt: new Date(),
        workAvailability: v.workAvailability ?? [],
        verification: "unverified",
        completeness: 20, // very basic profile at step 3
        memberSince: new Date(),
        // Phase 9.22  current-employment columns. NULL for
        // open_to_work / unemployed / studying.
        currentEmployerOrgId: resolvedEmployerOrgId,
        currentRoleStartedAt: v.currentRoleStartedAt ?? null,
        currentRoleCity:
          v.currentRoleCity && v.currentRoleCity.length > 0
            ? v.currentRoleCity
            : null,
      });

      // Consents  granted ones are 'granted', the rest are 'none'.
      await tx.insert(schema.consents).values(
        CONSENT_PURPOSES.map((purpose) => ({
          id: `cns_${user.id}_${purpose}`,
          userId: user.id,
          purpose,
          state: (v.grantedConsents.includes(purpose) ? "granted" : "none") as
            | "granted"
            | "none",
          version: "v2.1",
          grantedAt: v.grantedConsents.includes(purpose) ? new Date() : null,
          revokedAt: null,
        })),
      );

      // Optional academic
      if (v.academic && resolvedInstitutionSlug) {
        // Phase 13.1  defensively dedupe + trim the optional context
        // fields. Schema enforces NOT NULL on current_modules with
        // default '{}', so an absent value lands as an empty array.
        const modules = Array.from(
          new Set(
            (v.academic.currentModules ?? [])
              .map((m) => m.trim())
              .filter((m) => m.length > 0),
          ),
        ).slice(0, 8);
        const elective = (v.academic.electiveChosen ?? "").trim() || null;
        const project = (v.academic.projectTopic ?? "").trim() || null;
        await tx.insert(schema.academicProfiles).values({
          id: `acad_${user.id}`,
          profileId,
          institutionSlug: resolvedInstitutionSlug,
          programme: v.academic.programme,
          fieldOfStudy: v.academic.fieldOfStudy,
          nqfLevel: v.academic.nqfLevel,
          currentYear: v.academic.currentYear,
          expectedGraduation: v.academic.expectedGraduation,
          nsfas: v.academic.nsfas,
          verification: "unverified",
          openToInternships: v.academic.openToInternships,
          openToGraduateProgrammes: v.academic.openToGraduateProgrammes,
          // Phase 13.1
          currentModules: modules,
          electiveChosen: elective,
          projectTopic: project,
        });
      }
    });

    // Phase 9.15  post-transaction suggestion submissions. These are
    // auxiliary  if they fail (DB blip, notification system down), the
    // user account + profile + academic remain intact. Admin loses
    // visibility into one suggestion but the user is signed up cleanly.
    if (professionWasCustom) {
      try {
        const suggestionId = `tx_${randomUUID()}`;
        await db.insert(schema.taxonomySuggestions).values({
          id: suggestionId,
          kind: "profession",
          customText: v.profession,
          submittedByUserId: user.id,
        });
        await logAccess({
          kind: "taxonomy.suggestion.submit",
          actor: user.id,
          subject: suggestionId,
          meta: { kind: "profession", customText: v.profession, via: "signup" },
        });
        await notifyAllAdmins({
          kind: "taxonomy.suggestion.received",
          title: `New profession suggestion: ${v.profession}`,
          body: `A new user picked "Other" + entered "${v.profession}". Review on /admin/taxonomy.`,
          link: "/admin/taxonomy",
          dedupeKey: `profession::${v.profession.toLowerCase()}`,
          meta: { suggestionId, kind: "profession", customText: v.profession },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[signup] profession suggestion submit failed:", e);
      }
    }
    // Phase 9.22  organisation suggestion submit (mirror of the
    // institution path above). Auxiliary; failure doesn't tank the
    // signup. Also increments the resolved org's listed_by_seeker_count
    // (even when employer was picked from the dropdown  the count
    // maintenance happens regardless of how the FK was resolved).
    if (resolvedEmployerOrgId) {
      try {
        const cntRows = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(schema.profiles)
          .where(
            and(
              eq(schema.profiles.currentEmployerOrgId, resolvedEmployerOrgId),
              isNull(schema.profiles.deletedAt),
            ),
          );
        await db
          .update(schema.organizations)
          .set({ listedBySeekerCount: cntRows[0]?.count ?? 0 })
          .where(eq(schema.organizations.id, resolvedEmployerOrgId));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[signup] org seeker-count recount failed:", e);
      }
    }
    if (employerWasCustom && pendingEmployerOrgId && employerCustomName) {
      try {
        const suggestionId = `tx_${randomUUID()}`;
        await db.insert(schema.taxonomySuggestions).values({
          id: suggestionId,
          kind: "organisation",
          customText: employerCustomName,
          submittedByUserId: user.id,
          pendingOrganisationId: pendingEmployerOrgId,
        });
        await logAccess({
          kind: "taxonomy.suggestion.submit",
          actor: user.id,
          subject: suggestionId,
          meta: {
            kind: "organisation",
            customText: employerCustomName,
            orgCity: employerCustomCity,
            pendingOrganisationId: pendingEmployerOrgId,
            via: "signup",
          },
        });
        await notifyAllAdmins({
          kind: "taxonomy.suggestion.received",
          title: `New employer suggestion: ${employerCustomName}`,
          body: `A new seeker picked "Other" + entered "${employerCustomName}". Review on /admin/taxonomy.`,
          link: "/admin/taxonomy",
          dedupeKey: `organisation::${employerCustomName.toLowerCase()}`,
          meta: {
            suggestionId,
            kind: "organisation",
            customText: employerCustomName,
            pendingOrganisationId: pendingEmployerOrgId,
          },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[signup] organisation suggestion submit failed:", e);
      }
    }
    if (institutionWasCustom && v.academic && resolvedInstitutionSlug) {
      try {
        const suggestionId = `tx_${randomUUID()}`;
        await db.insert(schema.taxonomySuggestions).values({
          id: suggestionId,
          kind: "institution",
          customText: v.academic.institutionSlug,
          submittedByUserId: user.id,
          pendingInstitutionSlug: resolvedInstitutionSlug,
        });
        await logAccess({
          kind: "taxonomy.suggestion.submit",
          actor: user.id,
          subject: suggestionId,
          meta: {
            kind: "institution",
            customText: v.academic.institutionSlug,
            pendingInstitutionSlug: resolvedInstitutionSlug,
            via: "signup",
          },
        });
        await notifyAllAdmins({
          kind: "taxonomy.suggestion.received",
          title: `New institution suggestion: ${v.academic.institutionSlug}`,
          body: `A new student picked "Other" + entered "${v.academic.institutionSlug}". Review on /admin/taxonomy.`,
          link: "/admin/taxonomy",
          dedupeKey: `institution::${v.academic.institutionSlug.toLowerCase()}`,
          meta: {
            suggestionId,
            kind: "institution",
            customText: v.academic.institutionSlug,
          },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[signup] institution suggestion submit failed:", e);
      }
    }

    // Phase 35  record the push PREFERENCE captured at sign-up. Only
    // the two invite kinds, because those are the ones with a clock on
    // them; everything else stays opt-in from the preferences panel.
    // Writing `false` explicitly matters as much as writing `true`: it
    // is how the dashboard knows not to keep offering.
    if (typeof v.wantsPushNotifications === "boolean") {
      try {
        const wants = v.wantsPushNotifications;
        const prefs: NotificationPrefMap = {};
        for (const kind of ["vacancy.invite", "vacancy.invite.followup"] as const) {
          prefs[kind] = { ...defaultPrefFor(kind), push: wants };
        }
        await db
          .update(schema.appUser)
          .set({ notificationPrefs: prefs, updatedAt: new Date() })
          .where(eq(schema.appUser.id, user.id));
      } catch (e) {
        // Auxiliary: a preference write must never tank a sign-up.
        // eslint-disable-next-line no-console
        console.error("[signup] push preference write failed:", e);
      }
    }

    await logAccess({
      kind: "auth.signup",
      actor: user.id,
      meta: {
        role: "seeker",
        consents: v.grantedConsents,
        pushPreference: v.wantsPushNotifications ?? null,
        // Contract-acceptance evidence (schema guarantees true; the
        // timestamp is what future disputes need).
        termsAcceptedAt: new Date().toISOString(),
      },
    });

    // Phase 34  Self Apply funnel: record the application + the
    // vacancy-tailored skills NOW (before email verification  the
    // acceptSeekerInvitation precedent). Auxiliary posture: any
    // failure logs and degrades to a plain sign-up; the account is
    // never tanked by a stale vacancy link.
    let applied = false;
    if (v.applyToken) {
      try {
        const flagOn = await getSetting<boolean>(
          "feature_flag_vacancy_self_apply",
        );
        const loaded = flagOn
          ? await loadSelfApplyVacancyByToken(v.applyToken)
          : null;
        if (loaded && loaded.selfApplyEnabled && loaded.status === "open") {
          const vacancy = loaded.vacancy;
          // One-tap skills: only slugs the vacancy itself asked for
          // (chips are a subset picker, never a free write path).
          const pickable = new Set(vacancy.skillSlugs);
          const pickedSkills = Array.from(
            new Set((v.applySkillSlugs ?? []).filter((s) => pickable.has(s))),
          );
          if (pickedSkills.length > 0) {
            await db.insert(schema.profileSkills).values(
              pickedSkills.map((slug) => ({
                profileId,
                skillSlug: slug,
                // Mid-scale default; the seeker refines proficiency
                // from the dashboard SkillsEditor later.
                proficiency: 3,
              })),
            );
            // Keep the stored completeness honest with the shared
            // formula's skill term (6 per skill, capped at 30).
            await db
              .update(schema.profiles)
              .set({
                completeness: 20 + Math.min(30, pickedSkills.length * 6),
              })
              .where(eq(schema.profiles.id, profileId));
          }
          const recorded = await recordSelfApplication({
            vacancy,
            profileId,
            seekerUserId: user.id,
            source: "signup",
          });
          applied = recorded.ok;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[signup] self-apply record failed:", e);
      }
    }

    return ok({ next: "/verify-email", applied });
  } catch (e) {
    return fail(toMessage(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.17  acceptSeekerInvitation
//
// Token-gated sibling of signUpSeeker. The recipient of an
// employer-initiated invitation arrives on /sign-up/invited/[token]
// with name + email pre-filled (email read-only since it's the
// lookup key). Submitting the form calls this action; on success
// the invite row flips to 'accepted', acceptedProfileId is stamped,
// and every member of the inviting org receives the
// `org.seeker_invite.accepted` notification.
//
// Why it lives here (not in lib/employer/seeker-invitations.ts):
// keeps every sign-up path (public + invited) in one module so the
// Better Auth + consent-insert + redactSurname sequence has a
// single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

const acceptInviteSchema = seekerSignUpSchema
  .omit({ email: true })
  .extend({ token: z.string().min(1) });

export async function acceptSeekerInvitation(
  input: z.infer<typeof acceptInviteSchema>,
): Promise<ActionResult<{ next?: string }>> {
  const { verifyInviteToken } = await import("@/lib/auth/invite-tokens");

  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const { token, ...rest } = parsed.data;

  const tokenCheck = verifyInviteToken(token);
  if (!tokenCheck.ok) {
    return fail(
      tokenCheck.reason === "expired"
        ? "This invitation link has expired. Ask your inviter to send a new one."
        : "This invitation link is invalid.",
    );
  }

  const db = getDb();
  const inviteRows = await db
    .select({
      id: schema.seekerInvitations.id,
      email: schema.seekerInvitations.email,
      state: schema.seekerInvitations.state,
      orgId: schema.seekerInvitations.organizationId,
      invitedByUserId: schema.seekerInvitations.invitedByUserId,
      congratsRole: schema.seekerInvitations.congratsRole,
      congratsVacancyId: schema.seekerInvitations.congratsVacancyId,
    })
    .from(schema.seekerInvitations)
    .where(eq(schema.seekerInvitations.id, tokenCheck.inviteId))
    .limit(1);
  const invite = inviteRows[0];
  if (!invite) return fail("This invitation no longer exists.");
  if (invite.state !== "pending") {
    return fail(
      invite.state === "accepted"
        ? "This invitation has already been accepted. Try signing in instead."
        : `This invitation has been ${invite.state}. Ask your inviter to send a new one.`,
    );
  }

  // Delegate to signUpSeeker with the invite's email locked in.
  const result = await signUpSeeker({ ...rest, email: invite.email });
  if (!result.ok) return result;

  // Look up the freshly-created user + profile so we can stamp the
  // invite row + broadcast to the org. Use lower(email) to match the
  // case-insensitive uniqueness convention.
  const userRows = await db
    .select({ id: schema.appUser.id })
    .from(schema.appUser)
    .where(sql`lower(${schema.appUser.email}) = ${invite.email.toLowerCase()}`)
    .limit(1);
  const newUser = userRows[0];
  if (!newUser) {
    // Shouldn't happen  signUpSeeker just created the row. Log + bail.
    console.error("[acceptSeekerInvitation] user not found post-signup");
    return ok({ next: "/verify-email" });
  }

  const profileRows = await db
    .select({
      id: schema.profiles.id,
      handle: schema.profiles.handle,
      displayName: schema.profiles.displayName,
      city: schema.profiles.city,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, newUser.id))
    .limit(1);
  const newProfile = profileRows[0];

  if (newProfile) {
    await db
      .update(schema.seekerInvitations)
      .set({
        state: "accepted",
        acceptedProfileId: newProfile.id,
        respondedAt: new Date(),
      })
      .where(eq(schema.seekerInvitations.id, invite.id));

    await logAccess({
      kind: "org.seeker_invite.accept",
      actor: newUser.id,
      subject: invite.id,
      meta: {
        profileId: newProfile.id,
        signupCompletedAt: new Date().toISOString(),
      },
    });

    // ── Congrats-invite linkage (docs/RECRUITER_CLIENT_PLAN.md) ────
    // The employer asserted "we hired this person as X" at
    // mark-filled; joining through that exact token link is the
    // seeker's confirmation. Direct employer: employment link + the
    // placement, vacancy attached. Agency: employment link to the
    // LINKED client org only (the agency is not their employer), and
    // no auto-placement - an agency asserting a client's placement
    // would pollute the client's stats. Every step degrades to a
    // plain join on failure: the account always wins.
    if (invite.congratsRole) {
      try {
        const inviterRows = await db
          .select({ orgKind: schema.organizations.orgKind })
          .from(schema.organizations)
          .where(eq(schema.organizations.id, invite.orgId))
          .limit(1);
        const inviterIsAgency =
          inviterRows[0]?.orgKind === "recruitment_agency";

        let employerOrgId: string | null = null;
        let placementVacancyId: string | null = null;
        if (!inviterIsAgency) {
          employerOrgId = invite.orgId;
          placementVacancyId = invite.congratsVacancyId ?? null;
        } else if (invite.congratsVacancyId) {
          // The client link must belong to the inviter's own vacancy.
          const vacRows = await db
            .select({ clientOrgId: schema.vacancies.clientOrgId })
            .from(schema.vacancies)
            .where(
              and(
                eq(schema.vacancies.id, invite.congratsVacancyId),
                eq(schema.vacancies.organizationId, invite.orgId),
              ),
            )
            .limit(1);
          employerOrgId = vacRows[0]?.clientOrgId ?? null;
        }

        if (employerOrgId) {
          await db
            .update(schema.profiles)
            .set({ currentEmployerOrgId: employerOrgId })
            .where(eq(schema.profiles.id, newProfile.id));
          const cntRows = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(schema.profiles)
            .where(
              and(
                eq(schema.profiles.currentEmployerOrgId, employerOrgId),
                isNull(schema.profiles.deletedAt),
              ),
            );
          await db
            .update(schema.organizations)
            .set({ listedBySeekerCount: cntRows[0]?.count ?? 0 })
            .where(eq(schema.organizations.id, employerOrgId));
        }

        if (!inviterIsAgency) {
          const placementId = `plc_${randomUUID()}`;
          await db.insert(schema.placements).values({
            id: placementId,
            profileId: newProfile.id,
            organizationId: invite.orgId,
            actorUserId: invite.invitedByUserId,
            role: invite.congratsRole,
            city: newProfile.city ?? "South Africa",
            hiredAt: new Date(),
            source: "employer_confirmed",
            vacancyId: placementVacancyId,
          });
          await logAccess({
            kind: "placement.confirm",
            actor: invite.invitedByUserId,
            subject: placementId,
            meta: {
              orgId: invite.orgId,
              profileId: newProfile.id,
              vacancyId: placementVacancyId,
              via: "congrats_invite_accept",
            },
          });
          const { createNotification } = await import(
            "@/lib/notifications/server"
          );
          await createNotification({
            userId: newUser.id,
            kind: "placement.confirmed",
            title: `Your hire at Sebenza is on the record`,
            body: `Your new role (${invite.congratsRole}) was confirmed by the employer and now counts toward your verified work history.`,
            link: `/dashboard/activity`,
            meta: { placementId, via: "congrats_invite_accept" },
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[acceptSeekerInvitation] congrats linkage failed:", e);
      }
    }

    // Resolve org name for the notification body.
    const orgRows = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, invite.orgId))
      .limit(1);
    const orgName = orgRows[0]?.name ?? "your organisation";

    const { notifyOrgMembers } = await import("@/lib/notifications/server");
    await notifyOrgMembers(invite.orgId, {
      kind: "org.seeker_invite.accepted",
      title: `${newProfile.displayName} joined Sebenza`,
      body: `An invited seeker  ${newProfile.displayName}  completed sign-up via your invitation. Open the Invites tab to see them on the Joined list. Org: ${orgName}.`,
      link: "/employer/invites",
      meta: {
        inviteId: invite.id,
        profileId: newProfile.id,
        profileHandle: newProfile.handle,
      },
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// signUpEmployer  wires the employer registration form
// ─────────────────────────────────────────────────────────────────────────────

const employerSignUpSchema = z.object({
  orgName: z.string().min(2).max(160),
  registrationNumber: z.string().min(4).max(40),
  industry: z.string().min(2),
  size: z.string().min(1),
  country: z.string().min(2),
  /** 2026-08-22 (docs/RECRUITER_CLIENT_PLAN.md)  what the org IS.
   *  Agencies get the client fields on vacancy creation. */
  orgKind: z.enum(["direct_employer", "recruitment_agency"]),
  fullName: z.string().min(2),
  yourRole: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(10).max(128),
});

export async function signUpEmployer(
  input: z.infer<typeof employerSignUpSchema>,
): Promise<ActionResult> {
  const parsed = employerSignUpSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form and try again.");
  const v = parsed.data;

  // Phase 32.3.9  same neutral duplicate handling as the seeker path.
  // Employer addresses are the higher-value enumeration target (which
  // companies are registered here?), so this matters on both forms.
  if (await emailAlreadyRegistered(v.email)) {
    await notifyExistingAccountHolder(v.email);
    return ok({ next: "/verify-email" });
  }

  const db = getDb();

  try {
    const { user } = await createBetterAuthUser({
      email: v.email,
      password: v.password,
      name: v.fullName,
      role: "employer",
    });

    const orgId = `org_${user.id}`;

    await db.transaction(async (tx) => {
      await tx.insert(schema.organizations).values({
        id: orgId,
        name: v.orgName,
        registrationNumber: v.registrationNumber,
        industry: v.industry,
        sizeBand: v.size,
        country: v.country,
        orgKind: v.orgKind,
        verification: "unverified",
      });
      await tx.insert(schema.organizationMembers).values({
        id: `orgmem_${user.id}`,
        organizationId: orgId,
        userId: user.id,
        role: "owner",
        twoFactorActive: false,
      });
    });

    await logAccess({
      kind: "auth.signup",
      actor: user.id,
      subject: orgId,
      meta: { role: "employer", org: v.orgName },
    });

    return ok({ next: "/verify-email" });
  } catch (e) {
    return fail(toMessage(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signIn  email + password only, server routes by role
// ─────────────────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  next: z.string().optional(),
  // "Remember me on this device". Absent/false = session cookie that dies
  // with the browser; true = the persistent 30-day session. On a platform
  // used from shared phones, opt-IN persistence is the honest default.
  remember: z.boolean().optional(),
});

/**
 * Phase 32.2.2  the account's moderation state, resolved by email.
 *
 * `"unavailable"` means the lookup itself failed: callers must FAIL
 * CLOSED on it rather than assume the account is fine. An unknown email
 * resolves to `"active"` on purpose  a non-existent account must be
 * indistinguishable from a healthy one, and the credential check is
 * what actually rejects it.
 */
async function accountModerationState(
  email: string,
): Promise<"active" | "suspended" | "erased" | "unavailable"> {
  try {
    const rows = await getDb()
      .select({
        suspendedAt: schema.appUser.suspendedAt,
        deletedAt: schema.appUser.deletedAt,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email))
      .limit(1);
    const account = rows[0];
    if (!account) return "active";
    if (account.deletedAt) return "erased";
    if (account.suspendedAt) return "suspended";
    return "active";
  } catch (e) {
    console.error("[signIn] moderation lookup failed:", e);
    return "unavailable";
  }
}

/**
 * Phase 32.2.2  drop every session for an address. Used when a
 * moderation gate rejects a sign-in AFTER Better Auth has already
 * issued the cookie for a correct password.
 */
async function revokeAllSessionsForEmail(email: string): Promise<void> {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: schema.appUser.id })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, email))
      .limit(1);
    const userId = rows[0]?.id;
    if (!userId) return;
    await db.delete(schema.session).where(eq(schema.session.userId, userId));
  } catch (e) {
    // Non-fatal: the DAL re-check (32.2.1) still fails closed for a
    // suspended account, so a surviving row grants no access.
    console.error("[signIn] session revocation after moderation gate failed:", e);
  }
}

export async function signIn(
  input: z.infer<typeof signInSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email and password.");
  const v = parsed.data;

  // Phase 32.2.4 (security remediation)  sign-in IS rate-limited now.
  //
  // The Phase 9 decision recorded here previously ("no sign-in rate
  // limit; Better Auth handles it") rested on a premise the 2026-07-28
  // audit disproved: Better Auth's limiter runs only for requests
  // through its HTTP router (`/api/auth/*`), and this action calls
  // `auth.api.signInEmail()` directly  so nothing was throttling the
  // auth surface at all.
  //
  // The DoS concern that motivated that decision was right, and is
  // preserved: the key is the CLIENT IP, never the email, so nobody can
  // lock a victim out of their own account by guessing at their address.
  //
  // 32.2.4b  the budget counts FAILED attempts only (`peek` here,
  // `enforce` in the catch). Counting successes locked out honest
  // users: one office, campus lab or CGNAT'd mobile network shares an
  // IP, and 20 correct sign-ins in 10 minutes is a normal morning
  // there  while a credential-stuffing run is nothing BUT failures,
  // so the attacker's budget burns just as fast as before.
  const ipKey = await clientIpKey();
  const signInLimit = await peek("signin", ipKey);
  if (!signInLimit.ok) {
    return fail("Too many sign-in attempts. Please wait a few minutes and try again.");
  }

  try {
    const result = (await auth.api.signInEmail({
      body: {
        email: v.email,
        password: v.password,
        // Better Auth: rememberMe=false marks the session so the cookie is
        // issued WITHOUT Max-Age (gone on browser close); the flag also
        // carries through the two-factor handshake to the final session.
        rememberMe: v.remember ?? false,
      },
      asResponse: false,
    })) as {
      user?: { id: string; emailVerified: boolean; role?: string };
      twoFactorRedirect?: boolean;
    };

    // ── Phase 32.2.2 (security remediation)  moderation gate ──────────
    //
    // This check USED TO RUN BEFORE the password was verified, and it
    // returned `Your account is suspended: <admin's free-text reason>`.
    // Anyone who knew an email address could therefore learn, with no
    // credential at all, (a) that the account exists, (b) its moderation
    // state, and (c) a verbatim internal admin assessment  a POPIA
    // disclosure to an unauthenticated party, and a clean account-
    // enumeration oracle.
    //
    // It now runs only AFTER `signInEmail` has accepted the password, so
    // reaching this branch proves the caller owns the credentials. That
    // makes an honest "your account is suspended" safe to say  but the
    // REASON stays internal (the account.suspended notification already
    // delivers the user-facing explanation, and the audit log keeps the
    // full record). Covers the 2FA branch too, since the password is
    // verified before Better Auth asks for the second factor.
    const moderation = await accountModerationState(v.email);
    if (moderation === "unavailable") {
      // Fail CLOSED: the previous code swallowed DB errors here and let
      // the sign-in continue, so a partial outage could admit a
      // suspended user.
      return fail("Sign-in is temporarily unavailable. Please try again.");
    }
    if (moderation !== "active") {
      // Better Auth has already issued a session for the accepted
      // password  destroy it before returning, or a suspended user
      // would leave here holding a valid cookie.
      await revokeAllSessionsForEmail(v.email);
      return fail(
        moderation === "erased"
          ? "This account has been erased and can no longer be used."
          : "Your account is suspended. Contact support if you think this is a mistake.",
      );
    }

    // Phase 7 (Task 7.2)  2FA branch. Better Auth signals it has
    // accepted the password but is holding the session until the user
    // completes the second factor. The cookie carrying the "2FA
    // pending" state has already been set; we just route to the verify
    // page. `next` is preserved so post-verify routing is unchanged.
    if (result.twoFactorRedirect) {
      // Phase 32.2.6  `startsWith("/")` accepted `//evil.example` and
      // `/\evil.example`, both of which browsers resolve as
      // PROTOCOL-RELATIVE (i.e. off-site). safeInternalPath rejects
      // those, backslashes, `://` and CR/LF.
      const next = safeInternalPath(v.next, "");
      const qs = next ? `?next=${encodeURIComponent(next)}` : "";
      return ok({ next: `/verify-2fa${qs}` });
    }

    if (!result.user) {
      // Defensive: signInEmail returned neither user nor 2FA flag.
      return fail("Sign-in failed. Try again.");
    }
    const u = result.user;
    await logAccess({ kind: "auth.signin", actor: u.id });

    // Better Auth blocks unverified sign-ins (requireEmailVerification: true)
    // and surfaces the right error  we keep this branch as a belt-and-braces
    // check in case verification gets toggled off in the future.
    if (!u.emailVerified) {
      return ok({ next: `/verify-email?email=${encodeURIComponent(v.email)}` });
    }

    const home = roleHome(((u.role as "seeker" | "employer" | "admin") ?? "seeker"));
    // Phase 32.2.6  see above: protocol-relative targets must not pass.
    return ok({ next: safeInternalPath(v.next, home) });
  } catch (e) {
    // A rejected credential is what the budget counts (32.2.4b).
    await enforce("signin", ipKey);
    return fail("Email or password is incorrect.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signOut  clears the session cookie
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const headers = await nextHeaders();
  await auth.api.signOut({ headers });
  // 2026-08-20: deliberately NO redirect() here.
  //
  // Redirecting from inside the action made Next re-render the page the
  // action was called from as part of the action response, with the
  // session already destroyed. On Vercel that render 500'd on
  // /dashboard/profile (the founder's "Something went wrong" on
  // sign-out; reproduced on production, digest 234172952 then
  // 1480490623). Signing out from /dashboard and /dashboard/account was
  // fine, so it was specific to re-rendering THAT protected page in a
  // logged-out state.
  //
  // The caller now performs a full-page navigation once the cookie is
  // gone, so no protected page is ever re-rendered mid-sign-out. That is
  // also the more honest model: sign-out ends the session, then the
  // browser starts fresh with no stale client cache.
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset (anti-enumeration: always returns success)
// ─────────────────────────────────────────────────────────────────────────────

const resetRequestSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(
  input: z.infer<typeof resetRequestSchema>,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    // Still return "ok" to avoid enumeration.
    return ok();
  }
  // Phase 32.2.4  throttle per IP AND per address. Unthrottled, this
  // public endpoint let anyone flood a victim's mailbox (burying a real
  // security alert) or burn the platform's SMTP quota and reputation.
  // Returns ok() when limited: the anti-enumeration contract still
  // holds  a caller must not learn anything from the response.
  const [ipOk, addrOk] = await Promise.all([
    enforce("email-send", await clientIpKey()),
    enforce("email-send", emailKey(parsed.data.email)),
  ]);
  if (!ipOk.ok || !addrOk.ok) return ok();
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/reset-password",
      },
      asResponse: false,
    });
  } catch {
    // Don't leak whether the email exists.
  }
  return ok();
}

const resetCompleteSchema = z.object({
  token: z.string().min(8),
  newPassword: z.string().min(10).max(128),
});

export async function completePasswordReset(
  input: z.infer<typeof resetCompleteSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = resetCompleteSchema.safeParse(input);
  if (!parsed.success) return fail("Please choose a stronger password (10+ chars).");
  try {
    await auth.api.resetPassword({
      body: {
        token: parsed.data.token,
        newPassword: parsed.data.newPassword,
      },
      asResponse: false,
    });
    return ok({ next: "/sign-in" });
  } catch {
    return fail("That reset link has expired. Request a new one.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resendVerificationEmail
// ─────────────────────────────────────────────────────────────────────────────

export async function resendVerificationEmail(email: string): Promise<ActionResult> {
  if (!email || !email.includes("@")) return ok(); // anti-enumeration
  // Phase 32.2.4  same throttle as requestPasswordReset. `?email=` on
  // /verify-email is attacker-controllable, so this endpoint could be
  // pointed at any address; the limit is what stops it being a mailer.
  const [ipOk, addrOk] = await Promise.all([
    enforce("email-send", await clientIpKey()),
    enforce("email-send", emailKey(email)),
  ]);
  if (!ipOk.ok || !addrOk.ok) return ok();
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/dashboard" },
      asResponse: false,
    });
  } catch {
    // ignore  anti-enumeration
  }
  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Consent revoke / regrant
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeConsent(
  purpose: ConsentPurpose,
): Promise<ActionResult> {
  const headers = await nextHeaders();
  const sess = await auth.api.getSession({ headers });
  if (!sess) return fail("Not signed in.");

  const db = getDb();
  await db
    .update(schema.consents)
    .set({ state: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(schema.consents.userId, sess.user.id),
        eq(schema.consents.purpose, purpose),
      ),
    );

  await logAccess({
    kind: "consent.revoke",
    actor: sess.user.id,
    meta: { purpose },
  });

  return ok();
}

export async function regrantConsent(
  purpose: ConsentPurpose,
): Promise<ActionResult> {
  const headers = await nextHeaders();
  const sess = await auth.api.getSession({ headers });
  if (!sess) return fail("Not signed in.");

  const db = getDb();
  await db
    .update(schema.consents)
    .set({ state: "granted", grantedAt: new Date(), revokedAt: null })
    .where(
      and(
        eq(schema.consents.userId, sess.user.id),
        eq(schema.consents.purpose, purpose),
      ),
    );

  await logAccess({
    kind: "consent.grant",
    actor: sess.user.id,
    meta: { purpose },
  });

  return ok();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an arbitrary caught error into a user-facing string.
 *
 * IMPORTANT: never return the raw SQL or stack trace to the
 * caller  it leaks schema details + scares users with text they
 * can't act on. Instead, log the full error (including
 * `.cause` which Drizzle uses to attach the underlying Postgres
 * error) server-side, and surface a generic message.
 *
 * Patterns we surface specifically:
 *   - Drizzle `DrizzleQueryError`s where `.message` starts with
 *     "Failed query"  the SQL itself is the message, which is
 *     useless on the client. We collapse to a generic phrase +
 *     server-log the cause so an operator can debug.
 *   - Known Postgres error codes (unique violation, FK violation)
 *     get slightly more actionable text.
 */
function toMessage(e: unknown): string {
  // Log the full error tree for operator diagnostics. `cause` is
  // where Drizzle stashes the underlying Postgres error  pg-protocol
  // sets `code`, `detail`, `constraint` on it.
  // eslint-disable-next-line no-console
  console.error("[signUpSeeker / acceptSeekerInvitation] error:", e);
  if (e instanceof Error && e.cause) {
    // eslint-disable-next-line no-console
    console.error("[signUpSeeker / acceptSeekerInvitation] cause:", e.cause);
  }

  const cause = e instanceof Error ? e.cause : undefined;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : "";

  // 23505 = unique_violation, 23503 = foreign_key_violation,
  // 23502 = not_null_violation, 42703 = undefined_column
  if (causeCode === "23505") {
    // Phase 32.3.9  never reached for sign-up (the catch intercepts
    // duplicates first and returns the neutral success shape), but kept
    // neutral so no other caller can turn it into an oracle.
    return "Sign-up failed. Please refresh and try again, or contact support if the problem persists.";
  }
  if (causeCode === "42703") {
    return "The database is missing a column the app expects. An administrator needs to run `npm run db:migrate`.";
  }
  if (causeCode === "23502" || causeCode === "23503") {
    return "Sign-up couldn't complete because a required field was missing or pointed at something we don't know about. Please refresh and try again.";
  }

  // Generic Drizzle "Failed query: ..." messages leak SQL  collapse.
  if (e instanceof Error && e.message.startsWith("Failed query")) {
    return "Sign-up failed. Please refresh and try again, or contact support if the problem persists.";
  }

  // Phase 32.3.9  do NOT return the raw error. Better Auth's own
  // `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` used to reach the client
  // through this line, re-creating the enumeration oracle the branch
  // above closes.
  if (e instanceof Error && e.message) {
    console.error("[signUp] unmapped error:", e);
  }
  return "Sign-up failed. Please try again.";
}

function redactSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? fullName;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last[0]!.toUpperCase()}.`;
}

async function uniqueHandle(
  db: ReturnType<typeof getDb>,
  fullName: string,
): Promise<string> {
  const slug = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const base = slug || `user-${randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 1;
  // Try up to 6 variations, then fall back to a uuid suffix.
  while (suffix < 6) {
    const existing = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(eq(schema.profiles.handle, candidate))
      .limit(1);
    if (existing.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}
