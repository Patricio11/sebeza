"use server";

/**
 * Phase 9.7.6  Per-employer governed lookup (Server Action).
 *
 * The highest-sensitivity surface of Phase 9.7. Ships dormant behind
 * `feature_flag_employer_mix_lookup` (default OFF) per D3.
 *
 *   Access:        verifyGov() AND flag === true.
 *   Input:         exactly one of orgName OR registrationNumber.
 *                  Exact string match (case-folded for name). No
 *                  autocomplete, no browse, no fuzzy fallback  the
 *                  input shape itself is part of the "no leaderboard"
 *                  guarantee.
 *   Reason:        required; one of the four catalogued values.
 *                  "other" requires a free-text note ≥ 5 chars.
 *   Small-numbers: result returns the SA-citizen / foreign-national
 *                  split ONLY when employer_confirmed placements
 *                  >= `employer_mix_min_placements` (default 5).
 *                  Below it: aboveFloor=false, no breakdown leaked
 *                  to the gov UI (the audit log still records the
 *                  raw count for the regulator-of-the-regulator).
 *   Audit:         EVERY call writes one `gov.employer_mix.lookup`
 *                  row, found-or-not, above-or-below. The audit
 *                  trail is the trust mechanism. Pairs with
 *                  `employer.own_mix.view` (9.7.5) so the 9.7.7
 *                  oversight log can correlate.
 *
 * Framing per D2: ESA §8 evidence aid for DEL inquiries  not
 * "audit a company's foreigner ratio." Counsel review of the
 * legal-claim wording is tracked as DPIA R9.
 */

import { z } from "zod";
import { eq, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyGov } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";
import type { LookupInput, LookupResult } from "./employer-lookup-types";

const inputSchema = z
  .object({
    orgName: z.string().trim().max(200).optional(),
    registrationNumber: z.string().trim().max(40).optional(),
    reason: z.enum([
      "esa_s8_compliance",
      "incentive_verification",
      "mandated_audit",
      "other",
    ]),
    reasonNote: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) =>
      // Exactly one of the two inputs must be non-empty. Both empty
      // refuse. Both filled  refuse (canonical single-input rule).
      Boolean(v.orgName) !== Boolean(v.registrationNumber),
    { message: "Provide exactly one of org name OR registration number." },
  )
  .refine(
    (v) =>
      v.reason !== "other" ||
      (typeof v.reasonNote === "string" && v.reasonNote.length >= 5),
    {
      message:
        "When reason is 'other', a note of at least 5 characters is required.",
      path: ["reasonNote"],
    },
  );

export async function performEmployerLookup(
  input: LookupInput,
): Promise<LookupResult> {
  // Two-layer access check: verifyGov (role + 2FA) AND the dormant
  // feature flag. The page checks the flag too, but defence-in-depth
  // means a direct invocation via something else still respects policy.
  const session = await verifyGov();
  const flagOn = await getSetting<boolean>(
    "feature_flag_employer_mix_lookup",
  );
  if (!flagOn) {
    return {
      ok: false,
      message:
        "Per-employer mix lookup is dormant. An admin must enable feature_flag_employer_mix_lookup in /admin/settings (activation pairs with a real DEL §8 partnership workflow).",
    };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Invalid input. Check the form.",
    };
  }
  const v = parsed.data;

  const db = getDb();
  const floor = await getSetting<number>("employer_mix_min_placements");

  // Org lookup  EXACT match, case-insensitive on the name (ILIKE
  // with no wildcards is functionally equality, just case-folded),
  // exact on the registration number. No partial-match autocomplete;
  // the input shape itself is part of the no-leaderboard guarantee.
  const org = await (async () => {
    if (v.orgName) {
      const rows = await db
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          registrationNumber: schema.organizations.registrationNumber,
        })
        .from(schema.organizations)
        .where(ilike(schema.organizations.name, v.orgName))
        .limit(1);
      return rows[0] ?? null;
    }
    const rows = await db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        registrationNumber: schema.organizations.registrationNumber,
      })
      .from(schema.organizations)
      .where(
        eq(schema.organizations.registrationNumber, v.registrationNumber!),
      )
      .limit(1);
    return rows[0] ?? null;
  })();

  const auditMeta = {
    inputMethod: v.orgName ? "org_name" : "registration_number",
    reason: v.reason,
    reasonNote: v.reasonNote ?? null,
    orgFound: org !== null,
    floor,
  };

  if (!org) {
    await logAccess({
      kind: "gov.employer_mix.lookup",
      actor: session.id,
      meta: { ...auditMeta, placementCount: 0, aboveFloor: false },
    });
    return { ok: true, orgFound: false, floor };
  }

  // Org found  count employer_confirmed placements + the split.
  const totals = (
    (await db.execute(sql`
      SELECT
        COUNT(*)::int                                        AS total,
        COUNT(*) FILTER (WHERE p.is_citizen = true)::int     AS sa_citizen,
        COUNT(*) FILTER (WHERE p.is_citizen = false)::int    AS foreign_national,
        MIN(pl.hired_at)::text                               AS first_hire_at,
        MAX(pl.hired_at)::text                               AS last_hire_at
      FROM placements pl
      INNER JOIN profiles p ON p.id = pl.profile_id
      WHERE pl.organization_id = ${org.id}
        AND pl.source = 'employer_confirmed'
        AND p.deleted_at IS NULL
    `)) as unknown as {
      rows: Array<{
        total: number;
        sa_citizen: number;
        foreign_national: number;
        first_hire_at: string | null;
        last_hire_at: string | null;
      }>;
    }
  ).rows[0]!;

  const aboveFloor = totals.total >= floor;

  await logAccess({
    kind: "gov.employer_mix.lookup",
    actor: session.id,
    subject: org.id,
    meta: { ...auditMeta, placementCount: totals.total, aboveFloor },
  });

  if (!aboveFloor) {
    return {
      ok: true,
      orgFound: true,
      orgId: org.id,
      orgName: org.name,
      registrationNumber: org.registrationNumber ?? null,
      total: totals.total,
      aboveFloor: false,
      floor,
      firstHireAt: null,
      lastHireAt: null,
    };
  }

  return {
    ok: true,
    orgFound: true,
    orgId: org.id,
    orgName: org.name,
    registrationNumber: org.registrationNumber ?? null,
    total: totals.total,
    sa_citizen: totals.sa_citizen,
    foreign_national: totals.foreign_national,
    aboveFloor: true,
    floor,
    firstHireAt: totals.first_hire_at
      ? new Date(totals.first_hire_at).toISOString()
      : null,
    lastHireAt: totals.last_hire_at
      ? new Date(totals.last_hire_at).toISOString()
      : null,
  };
}
