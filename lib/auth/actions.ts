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
import { isValidCountryCode, countryLabel } from "@/lib/taxonomy/countries";

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
  // Phase 9.16 follow-up (2026-05-27)  ISO 3166-1 alpha-2 nationality
  // code. Drives `is_citizen = (code === "ZA")` + the country label
  // stored on `profiles.nationality`. ID / passport numbers are no
  // longer collected at sign-up  the seeker adds them later from
  // /dashboard/profile when ready to be KYC-verified.
  nationality: z.string().length(2),
  password: z.string().min(10).max(128),
  // Consent purposes the user granted in step 2.
  grantedConsents: z.array(z.enum(CONSENT_PURPOSES)).min(1),
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
});

export async function signUpSeeker(
  input: z.infer<typeof seekerSignUpSchema>,
): Promise<ActionResult> {
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
    // Phase 9.16 follow-up  derive citizenship from the picked country.
    // SA = citizen-or-PR class for the Phase 9.7 2-class analytics.
    // Refinable later from /dashboard/profile.
    const isCitizen = v.nationality === "ZA";
    const nationalityLabel = countryLabel(v.nationality) ?? null;

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

    await logAccess({
      kind: "auth.signup",
      actor: user.id,
      meta: { role: "seeker", consents: v.grantedConsents },
    });

    return ok({ next: "/verify-email" });
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
});

export async function signIn(
  input: z.infer<typeof signInSchema>,
): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a valid email and password.");
  const v = parsed.data;

  // Phase 9 review (2026-05-23)  deliberately NO per-email sign-in
  // rate limit. Decided after weighing the trade:
  //   1. Better Auth password hashing (scrypt) is intentionally slow
  //      (~100-200ms per attempt)  that IS the brute-force mitigation.
  //   2. 2FA enforcement on employer + admin (Phase 7.2).
  //   3. Suspended-user check + the account.suspended notification
  //      surface a compromised account fast.
  // A per-email rate limit would create a denial-of-service vector
  // (an attacker submits bad passwords for a target email → legitimate
  // user locked out). Reveal + upload paths DO rate-limit, because
  // their abuse pattern has no legitimate-user collision.

  // Phase 7  before issuing a session, check `app_user.suspended_at` /
  // `deleted_at`. Both states must block sign-in. We look up by email
  // first; if it doesn't resolve we fall through to Better Auth which
  // returns the same generic "incorrect" error (no enumeration).
  try {
    const db = getDb();
    const lookup = await db
      .select({
        id: schema.appUser.id,
        suspendedAt: schema.appUser.suspendedAt,
        suspendedReason: schema.appUser.suspendedReason,
        deletedAt: schema.appUser.deletedAt,
      })
      .from(schema.appUser)
      .where(eq(schema.appUser.email, v.email))
      .limit(1);
    const account = lookup[0];
    if (account?.deletedAt) {
      return fail("This account has been erased.");
    }
    if (account?.suspendedAt) {
      const tail = account.suspendedReason ? `: ${account.suspendedReason}` : ".";
      return fail(`Your account is suspended${tail}`);
    }
  } catch {
    // DB hiccup shouldn't break the sign-in path; fall through to
    // Better Auth which returns its standard error envelope.
  }

  try {
    const result = (await auth.api.signInEmail({
      body: {
        email: v.email,
        password: v.password,
      },
      asResponse: false,
    })) as {
      user?: { id: string; emailVerified: boolean; role?: string };
      twoFactorRedirect?: boolean;
    };

    // Phase 7 (Task 7.2)  2FA branch. Better Auth signals it has
    // accepted the password but is holding the session until the user
    // completes the second factor. The cookie carrying the "2FA
    // pending" state has already been set; we just route to the verify
    // page. `next` is preserved so post-verify routing is unchanged.
    if (result.twoFactorRedirect) {
      const next = v.next && v.next.startsWith("/") ? v.next : "";
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
    return ok({ next: v.next && v.next.startsWith("/") ? v.next : home });
  } catch (e) {
    return fail("Email or password is incorrect.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// signOut  clears the session cookie
// ─────────────────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const headers = await nextHeaders();
  await auth.api.signOut({ headers });
  redirect("/");
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
    return "An account with this email already exists. Try signing in instead.";
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

  if (e instanceof Error && e.message) return e.message;
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
