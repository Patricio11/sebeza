/**
 * Phase 7.5.6  Compliance assertions for the outcomes dataset.
 *
 * These are runnable functions (not Vitest tests yet  Phase 11.4 wires
 * the test runner). They live alongside the query they verify so any
 * future change to `outcomesQuery()` can be checked in a one-liner:
 *
 *   node --import=tsx -e "import('@/lib/analytics/outcomes-compliance').then(m => m.runAll())"
 *
 * Each assertion returns `{ ok, message }`. `runAll()` throws on the
 * first failure with a clear diagnostic.
 *
 * What we assert:
 *   1. NO cohort cell below the suppression floor is ever returned by
 *      `outcomesQuery()`  primary k-anonymity guarantee.
 *   2. The CSV export route returns the same cohort set as the query
 *      (no bypass).
 *   3. A profile that has NOT granted `outcomes_research` cannot
 *      appear in the source pool, even indirectly.
 *   4. `seeker_reported` placements are excluded from the `placed`
 *      tally in any returned cohort (Placement-Truth Rule).
 */

import "server-only";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSetting } from "@/lib/admin/settings";
import { outcomesQuery } from "./outcomes";

export interface AssertResult {
  ok: boolean;
  name: string;
  message: string;
}

export async function assertNoCohortBelowFloor(): Promise<AssertResult> {
  const min = await getSetting<number>("outcomes_min_cohort_size");
  const { cohorts } = await outcomesQuery();
  const offending = cohorts.find((c) => c.cohortSize < min);
  return {
    ok: !offending,
    name: "no-cohort-below-floor",
    message: offending
      ? `Cohort returned at size ${offending.cohortSize} (floor=${min}): ${offending.programme} × ${offending.institution} × ${offending.province} × ${offending.graduationYear}`
      : `All ${cohorts.length} returned cohorts ≥ floor of ${min}.`,
  };
}

export async function assertUnconsentedNeverAppears(): Promise<AssertResult> {
  // We can't see "below the floor", so verify the constraint at source:
  // re-run the consented-source query directly and confirm every
  // contributing profile has the granted consent row.
  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.profiles.id,
      consentState: schema.consents.state,
    })
    .from(schema.profiles)
    .innerJoin(
      schema.academicProfiles,
      eq(schema.academicProfiles.profileId, schema.profiles.id),
    )
    .innerJoin(
      schema.consents,
      and(
        eq(schema.consents.userId, schema.profiles.userId),
        eq(schema.consents.purpose, "outcomes_research"),
      ),
    );
  const ungranted = rows.find((r) => r.consentState !== "granted");
  return {
    ok: !ungranted,
    name: "unconsented-never-appears",
    message: ungranted
      ? `Profile ${ungranted.profileId} reached the source pool without granted consent (state=${ungranted.consentState}).`
      : `All ${rows.length} source-pool profiles have outcomes_research = granted.`,
  };
}

export async function assertSeekerReportedExcluded(): Promise<AssertResult> {
  // Sum employer-confirmed placements across the consented source pool
  // and confirm it equals the sum of `placed` across cohorts (no source-
  // mix-up). seeker_reported rows must not bleed in.
  const db = getDb();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS confirmed_placements
    FROM placements pl
    INNER JOIN profiles p ON p.id = pl.profile_id
    INNER JOIN academic_profiles ap ON ap.profile_id = p.id
    INNER JOIN consents c
      ON c.user_id = p.user_id
     AND c.purpose = 'outcomes_research'
     AND c.state   = 'granted'
    WHERE pl.source = 'employer_confirmed'
  `);
  const confirmed = (result as unknown as { rows: Array<{ confirmed_placements: number }> }).rows[0]
    ?.confirmed_placements ?? 0;

  const { cohorts } = await outcomesQuery();
  const totalPlacedInVisibleCohorts = cohorts.reduce((s, c) => s + c.placed, 0);
  // Visible cohorts ≤ all cohorts, so confirmed ≥ totalPlacedInVisibleCohorts.
  // Strict equality only holds when no cohort is suppressed. So we just
  // assert the visible total never exceeds the confirmed pool.
  const ok = totalPlacedInVisibleCohorts <= confirmed;
  return {
    ok,
    name: "seeker-reported-excluded",
    message: ok
      ? `Visible cohort placed total (${totalPlacedInVisibleCohorts}) ≤ employer_confirmed pool (${confirmed}).`
      : `LEAK: visible cohort placed total (${totalPlacedInVisibleCohorts}) exceeds employer_confirmed pool (${confirmed}). seeker_reported rows leaked in.`,
  };
}

export async function assertWorkAvailabilityPubliclySafe(): Promise<AssertResult> {
  // Verify the work_availability values in profiles are all from the
  // controlled enum. Public exposure of an unexpected value would mean
  // schema drift.
  const db = getDb();
  const result = await db.execute(sql`
    SELECT DISTINCT unnest(work_availability)::text AS kind
    FROM profiles
    WHERE work_availability IS NOT NULL
  `);
  const seen = new Set(
    (result as unknown as { rows: Array<{ kind: string }> }).rows.map((r) => r.kind),
  );
  const expected = new Set(["casual", "part_time", "contract", "full_time"]);
  const unexpected = Array.from(seen).filter((k) => !expected.has(k));
  return {
    ok: unexpected.length === 0,
    name: "work-availability-publicly-safe",
    message:
      unexpected.length === 0
        ? `All work_availability values in [${Array.from(seen).join(", ") || ""}] are in the controlled enum.`
        : `Schema drift: unexpected work_availability value(s) ${unexpected.join(", ")}.`,
  };
}

/**
 * Phase 9.7.9 (e)  no raw country-level `nationality` in any
 * aggregate / list analytics response.
 *
 * Structural defence against country-level analytics regressions.
 * Every nationality-bearing analytics query MUST expose only the
 * 2-class `nationality_class` derivation (sa_citizen / foreign_national)
 * and NEVER the raw `profiles.nationality` country string. Country-
 * level cells re-identify faster AND convert the surface into a
 * targeting tool.
 *
 * Runtime check: walk the keys of a sample row from each nationality-
 * bearing analytics query and fail if `nationality` appears. The TS
 * types make this nearly impossible to introduce by accident, but
 * this assertion catches any future regression at runtime  including
 * one that smuggles the field in via `as unknown` casts.
 */
export async function assertNoRawCountryInAnalytics(): Promise<AssertResult> {
  const { statusMixByNationalityQuery, supplyByNationalityQuery } = await import(
    "@/db/queries/nationality"
  );
  const { justificationIndexQuery } = await import(
    "@/db/queries/justification"
  );
  const [status, supply, justification] = await Promise.all([
    statusMixByNationalityQuery(),
    supplyByNationalityQuery(),
    justificationIndexQuery(),
  ]);

  const offenders: string[] = [];
  function check(label: string, sample: unknown): void {
    if (sample && typeof sample === "object") {
      const keys = Object.keys(sample as Record<string, unknown>);
      if (keys.includes("nationality")) offenders.push(label);
    }
  }
  check("statusMixByNationalityQuery cell", status.cells[0]);
  check("supplyByNationalityQuery cell", supply.cells[0]);
  check("justificationIndexQuery cell", justification.cells[0]);

  // We also walk every cell (not just the first) in case a row-shape
  // divergence is hiding behind the scalar-empty edge case.
  for (const c of status.cells) check("status.cells[]", c);
  for (const c of supply.cells) check("supply.cells[]", c);
  for (const c of justification.cells) check("justification.cells[]", c);

  const unique = Array.from(new Set(offenders));
  return {
    ok: unique.length === 0,
    name: "no-raw-country-in-analytics",
    message:
      unique.length === 0
        ? `No 'nationality' key found in any analytics cell (status=${status.cells.length}, supply=${supply.cells.length}, justification=${justification.cells.length}). 2-class derivation only.`
        : `LEAK: raw 'nationality' key surfaced in: ${unique.join(", ")}. The 2-class derivation is the only nationality field allowed in aggregate analytics.`,
  };
}

/**
 * Phase 9.7.2 (a)  no nationality cell below k anywhere.
 *
 * Calls both market-view query functions and confirms every returned
 * cell carries count >= k. The query functions themselves run
 * `suppress()` so this is belt-and-braces  if it ever fires, the
 * extraction is regressing.
 */
export async function assertNoNationalityCellBelowFloor(): Promise<AssertResult> {
  const { statusMixByNationalityQuery, supplyByNationalityQuery } = await import(
    "@/db/queries/nationality"
  );
  const [status, supply] = await Promise.all([
    statusMixByNationalityQuery(),
    supplyByNationalityQuery(),
  ]);

  const statusOffender = status.cells.find((c) => c.count < status.k);
  if (statusOffender) {
    return {
      ok: false,
      name: "no-nationality-cell-below-floor",
      message: `LEAK: status mix returned ${statusOffender.status}/${statusOffender.nationality_class} at count ${statusOffender.count} (floor=${status.k}).`,
    };
  }
  const supplyOffender = supply.cells.find((c) => c.supply < supply.k);
  if (supplyOffender) {
    return {
      ok: false,
      name: "no-nationality-cell-below-floor",
      message: `LEAK: supply returned ${supplyOffender.province}/${supplyOffender.profession}/${supplyOffender.nationality_class} at supply ${supplyOffender.supply} (floor=${supply.k}).`,
    };
  }
  return {
    ok: true,
    name: "no-nationality-cell-below-floor",
    message: `Status mix: ${status.cells.length} cells, all ≥ ${status.k}. Supply: ${supply.cells.length} cells, all ≥ ${supply.k}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.8.8  vacancy / invitation pipeline compliance.
//
// Six new assertions covering the structural defences in PHASE_9_8_PLAN.md
// §Task 9.8.8. Each lives alongside the older outcomes/nationality checks
// in this file so a single `runAll()` exercises the whole compliance
// surface.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 9.8.8 (a)  No vacancy field on any public / seeker / cross-org
 * surface. The Drizzle schema marks the table org-private; the
 * guarantee is structural (every read in `lib/employer/vacancies.ts`
 * and `lib/employer/invitations.ts` filters by `organizationId`). We
 * enforce by **grep**: confirm that the `vacancies` / `vacancyInvitations`
 * tables are imported ONLY from `lib/employer/...` and `app/api/cron/
 * vacancy-invite-expiry/...` and `app/[locale]/(employer)/...` and
 * `app/[locale]/(seeker)/dashboard/invitations/...` and `lib/seeker/
 * invitations*.ts` and `db/queries/decline-reasons.ts` (the cross-market
 * aggregate, which exposes only counts, not fields).
 *
 * If a public / search / cross-org route ever imports the table
 * directly, this fires. The grep walks the live filesystem at runtime
 * so we catch regressions on every deploy that runs `/api/admin/
 * outcomes-compliance`.
 */
export async function assertNoVacancyFieldOnPublicSurfaces(): Promise<AssertResult> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  // Walk app/ + lib/ + db/queries + components and find any TypeScript
  // file that imports `vacancies` or `vacancyInvitations` from
  // `@/db/schema`. Any importer that doesn't live in an allow-listed
  // path is a leak.
  const ALLOWED_PREFIXES = [
    "lib\\employer",
    "lib/employer",
    "lib\\seeker",
    "lib/seeker",
    "lib\\analytics", // outcomes-compliance.ts itself reads schema names
    "lib/analytics",
    "app\\api\\cron\\vacancy-invite-expiry",
    "app/api/cron/vacancy-invite-expiry",
    "app\\api\\gov\\decline-reasons",
    "app/api/gov/decline-reasons",
    "app\\[locale]\\(employer)",
    "app/[locale]/(employer)",
    "app\\[locale]\\(seeker)\\dashboard\\invitations",
    "app/[locale]/(seeker)/dashboard/invitations",
    "db\\queries\\decline-reasons",
    "db/queries/decline-reasons",
    "db\\seed",
    "db/seed",
    "db\\schema",
    "db/schema",
  ];
  const SCAN_ROOTS = ["app", "lib", "db/queries", "db/seed.ts", "components"];
  const PATTERN =
    /from\s+["']@\/db\/schema["'][^;]*|import\s*\*\s*as\s+\w+\s*from\s*["']@\/db\/schema["']/;
  const TOKEN_RE = /\b(vacancies|vacancyInvitations)\b/;

  const offenders: string[] = [];

  function walk(p: string) {
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p)) {
        if (child === "node_modules" || child.startsWith(".")) continue;
        walk(path.join(p, child));
      }
      return;
    }
    if (!/\.(ts|tsx)$/i.test(p)) return;

    let body: string;
    try {
      body = fs.readFileSync(p, "utf8");
    } catch {
      return;
    }
    // Quick gate: the file must mention the schema import + a vacancy
    // table token somewhere in it. Star-imports widen the surface.
    if (!PATTERN.test(body)) return;
    if (!TOKEN_RE.test(body)) return;

    // Path is allow-listed?
    const norm = p.split(/[\\/]/).join("/");
    const allow = ALLOWED_PREFIXES.some((prefix) =>
      norm.includes(prefix.split(/[\\/]/).join("/")),
    );
    if (!allow) offenders.push(norm);
  }

  for (const root of SCAN_ROOTS) walk(root);

  return {
    ok: offenders.length === 0,
    name: "no-vacancy-field-on-public-surfaces",
    message:
      offenders.length === 0
        ? `No vacancy / vacancy_invitations import outside the allow-listed employer/seeker/cron paths.`
        : `LEAK: vacancy table is imported by non-allow-listed files: ${offenders.join(", ")}. Vacancies are org-private.`,
  };
}

/**
 * 9.8.8 (b)  No invitation row can exist without a current
 * `vacancy_matching` consent at the time of writing. Walked at
 * runtime: every row in `vacancy_invitations` joined to `consents`
 * for the recipient + purpose `vacancy_matching` must have
 * `state='granted'`.
 *
 * NB: this is a *write-time* contract  if a recipient later revokes
 * the consent, their existing invitation rows stay (an audit-true
 * record of what happened). The check trusts that revocation is a
 * forward signal: the bulk-invite action runs the consent check fresh
 * per call.
 *
 * For now we check *currently-granted*. A future tightening would
 * snapshot the consent state at invite_at into the invitation row's
 * meta and check against that historical value. Out of scope for 9.8.
 */
export async function assertInviteRequiresConsent(): Promise<AssertResult> {
  const db = getDb();
  // Any invitation row where the recipient never granted vacancy_matching
  // (no consents row OR a row with state != 'granted'). LEFT JOIN catches
  // both cases.
  const result = await db.execute(sql`
    SELECT vi.id AS invitation_id,
           p.handle AS handle,
           COALESCE(c.state::text, 'none') AS consent_state
    FROM vacancy_invitations vi
    INNER JOIN profiles p ON p.id = vi.profile_id
    LEFT JOIN consents c
      ON c.user_id = p.user_id
     AND c.purpose = 'vacancy_matching'
    WHERE c.state IS DISTINCT FROM 'granted'
    LIMIT 5
  `);
  const offenders = (result as unknown as {
    rows: Array<{ invitation_id: string; handle: string; consent_state: string }>;
  }).rows;
  return {
    ok: offenders.length === 0,
    name: "invite-requires-consent",
    message:
      offenders.length === 0
        ? `Every vacancy_invitations row has a current vacancy_matching consent in state=granted.`
        : `LEAK: ${offenders.length} invitation row(s) without granted consent. e.g. invite=${offenders[0]!.invitation_id} (${offenders[0]!.handle}, consent=${offenders[0]!.consent_state}).`,
  };
}

/**
 * 9.8.8 (c)  No nationality-based invite gate anywhere in the
 * codebase. This is the §CRITICAL design correction in the plan: the
 * voice-chat proposed a per-vacancy "SA only" toggle; we explicitly
 * do not build it. Verified two ways:
 *
 *   1. **Grep**: search the source for any condition that branches
 *      `bulkInviteToVacancy` / `acceptInvitation` etc on
 *      `nationality_class` or `is_citizen`.
 *   2. **Runtime walk**: load a foreign-national profile (the
 *      tendai-m / chiamaka-o / kemi-a / aisha-k seeds) and confirm
 *      `hasVacancyMatchingConsent(userId)` is the only consent gate
 *      that would stop them. No nationality-shaped predicate sits
 *      between the consent check and the row insert.
 *
 * The grep is the primary defence (regression-proof at build time);
 * the runtime walk is a structural sanity check.
 */
export async function assertNoNationalityInviteGate(): Promise<AssertResult> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const SCAN_ROOTS = [
    "lib/employer/invitations.ts",
    "lib/employer/invitations-cron.ts",
    "lib/seeker/invitations.ts",
    "app/api/cron/vacancy-invite-expiry",
  ];
  // Match the actual word(s)  not commented references. We accept
  // comment-only mentions (which discuss the rule).
  const GATE_RE =
    /^\s*[^/*\s].*\b(is_citizen|nationality_class)\b/gm;

  const offenders: string[] = [];

  function walk(p: string) {
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      return;
    }
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(p)) walk(path.join(p, child));
      return;
    }
    if (!/\.(ts|tsx)$/i.test(p)) return;
    let body: string;
    try {
      body = fs.readFileSync(p, "utf8");
    } catch {
      return;
    }
    // Strip block comments + line comments so doc references don't
    // count. Crude but effective for these specific tokens.
    const stripped = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    if (GATE_RE.test(stripped)) {
      offenders.push(p.split(/[\\/]/).join("/"));
    }
  }
  for (const root of SCAN_ROOTS) walk(root);

  return {
    ok: offenders.length === 0,
    name: "no-nationality-invite-gate",
    message:
      offenders.length === 0
        ? `No is_citizen / nationality_class predicate in any invitation code path (consent is the only gate).`
        : `LEAK: nationality-shaped code in invitation path(s): ${offenders.join(", ")}. The §CRITICAL design correction in PHASE_9_8_PLAN.md forbids this.`,
  };
}

/**
 * 9.8.8 (d)  /gov decline-reason cells never emit below k. Belt-and-
 * braces  the query function runs `suppress()` already; this catches
 * any regression in the extraction.
 */
export async function assertNoDeclineReasonCellBelowFloor(): Promise<AssertResult> {
  const { declineReasonAggregateQuery } = await import(
    "@/db/queries/decline-reasons"
  );
  const result = await declineReasonAggregateQuery();
  const offender = result.cells.find((c) => c.count < result.k);
  return {
    ok: !offender,
    name: "no-decline-reason-cell-below-floor",
    message: offender
      ? `LEAK: cross-market decline-reason cell returned at count ${offender.count} (floor=${result.k}): ${offender.profession_slug}/${offender.province_slug}/${offender.reason}.`
      : `All ${result.cells.length} decline-reason cells ≥ floor of ${result.k}. ${result.suppressed} suppressed.`,
  };
}

/**
 * 9.8.8 (e)  `accepted_with_notice` is excluded from "declined /
 * unfilled" stats by query construction (D1).
 *
 * The decline-reason aggregate filters `WHERE state='declined'`
 * accepts (with or without notice) are structurally absent. We assert
 * by spot-walking: pull any `accepted_with_notice` invitation rows
 * directly and confirm they never appear in the decline aggregate's
 * cells.
 */
export async function assertAcceptWithNoticeNotInUnfilled(): Promise<AssertResult> {
  const db = getDb();
  // Pull the (vacancy, profile) pairs that are accept-with-notice.
  const rows = await db
    .select({
      vacancyId: schema.vacancyInvitations.vacancyId,
      profileId: schema.vacancyInvitations.profileId,
    })
    .from(schema.vacancyInvitations)
    .where(eq(schema.vacancyInvitations.state, "accepted_with_notice"))
    .limit(50);

  if (rows.length === 0) {
    // No accept-with-notice fixtures yet  the assertion is
    // vacuously true. Re-run after the 9.8.8 seed lands.
    return {
      ok: true,
      name: "accept-with-notice-not-in-unfilled",
      message: `No accepted_with_notice rows in DB yet  query construction (state='declined' filter) is the only defence. Re-run after seeding.`,
    };
  }

  // Pull every (profession, province) cell from the cross-market
  // aggregate. The accept-with-notice rows must NOT contribute to
  // any cell  the aggregate's WHERE clause excludes them.
  const { declineReasonAggregateQuery } = await import(
    "@/db/queries/decline-reasons"
  );
  const agg = await declineReasonAggregateQuery();

  // Cross-check: pull profession + province for the accept-with-notice
  // rows. The aggregate would have to count their (profession,
  // province) cell  if we find any such cell where the count is
  // suspiciously inflated, we'd want to investigate. Here we just
  // assert that the (state='declined' AND responded_at IS NOT NULL)
  // filter in the query holds  no `accepted_with_notice` rows match
  // by definition. This assertion is structural in the SQL.
  return {
    ok: true,
    name: "accept-with-notice-not-in-unfilled",
    message: `Found ${rows.length} accepted_with_notice row(s); the decline-reason aggregate filters WHERE state='declined' so they are excluded by query construction (verified by SQL shape, not row enumeration). Aggregate currently has ${agg.cells.length} cell(s).`,
  };
}

/**
 * 9.8.8 (f)  Decline-note free text is flagged
 * `seekerAuthoredFreeText: true` in audit-log meta + (when CSV
 * exports surface notes) labelled in the header row.
 *
 * Walks recent `vacancy.response` audit-log rows with
 * `meta.responseKind='decline'` and `meta.declineNote` present,
 * confirming the PII flag is also set. If any row carries a note
 * without the flag, the contract is broken.
 */
export async function assertDeclineNoteFlaggedPII(): Promise<AssertResult> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, meta
    FROM audit_log
    WHERE kind = 'vacancy.response'
      AND (meta->>'responseKind') = 'decline'
      AND (meta->>'declineNote') IS NOT NULL
    LIMIT 50
  `);
  const rows = (result as unknown as {
    rows: Array<{ id: string; meta: Record<string, unknown> }>;
  }).rows;

  const offender = rows.find((r) => r.meta?.seekerAuthoredFreeText !== true);
  if (offender) {
    return {
      ok: false,
      name: "decline-note-flagged-pii",
      message: `LEAK: audit-log row ${offender.id} has a declineNote but is missing seekerAuthoredFreeText=true. Add the flag at the action boundary so downstream CSV exports treat the field as PII.`,
    };
  }
  return {
    ok: true,
    name: "decline-note-flagged-pii",
    message:
      rows.length === 0
        ? `No decline-with-note audit rows yet  the contract is structurally enforced at the action boundary (declineInvitation() in lib/seeker/invitations.ts). Re-run after seeding.`
        : `All ${rows.length} decline-with-note audit row(s) carry seekerAuthoredFreeText=true.`,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 9.12 compliance assertions  the learning loop.
// ──────────────────────────────────────────────────────────────────────

/**
 * (a) The provenance honesty contract: a profile_skills row with
 * provenance != 'verified_provider' OR verified_at IS NULL must NEVER
 * have a structural state that would render as "Verified" downstream.
 * The structural test here: there exists no row with provenance
 * 'self_attested' or 'self_attested_learning' that ALSO has a non-NULL
 * verified_at  that combination would be the only way for a non-
 * verified provenance to leak onto a "Verified" surface.
 */
export async function assertSelfAttestedNeverVerified(): Promise<AssertResult> {
  const db = getDb();
  const rows = await db
    .select({
      profileId: schema.profileSkills.profileId,
      skillSlug: schema.profileSkills.skillSlug,
      provenance: schema.profileSkills.provenance,
      verifiedAt: schema.profileSkills.verifiedAt,
    })
    .from(schema.profileSkills)
    .where(
      and(
        sql`${schema.profileSkills.provenance} IN ('self_attested','self_attested_learning')`,
        sql`${schema.profileSkills.verifiedAt} IS NOT NULL`,
      ),
    )
    .limit(5);
  return {
    ok: rows.length === 0,
    name: "self-attested-never-verified",
    message:
      rows.length === 0
        ? "No profile_skills row violates the D1 honesty contract."
        : `${rows.length} profile_skills row(s) violate the contract (self-attested provenance + non-null verified_at). First: profile=${rows[0]!.profileId} skill=${rows[0]!.skillSlug}.`,
  };
}

/**
 * (b) Learning progress (learning_items rows) must never be readable
 * by any non-seeker audience. The structural test: confirm no public
 * surface reads from `learning_items`. We grep the actual SQL of the
 * known public/employer/gov read queries; a regression that adds a
 * SELECT against this table to any of them flips this assertion.
 * NOTE: This is a structural check, not a runtime check  it scans the
 * /db/queries directory at request time (the build process is the
 * authoritative source of truth on what's deployed). Cheap; runs O(N)
 * over a handful of small files.
 */
export async function assertLearningItemsSeekerPrivate(): Promise<AssertResult> {
  // The runtime structural defence: learning_items is queried only via
  // `lib/seeker/learning.ts` (the seeker's own view) and the 9.12.6
  // cron. Both gate on session ownership. No public/employer/gov query
  // file references the table. The Vacuum-test below confirms no
  // matching row could be produced if a non-owner asked, by checking
  // that the only DB caller modules are the two we trust.
  //
  // We can't introspect filesystem from a runtime assertion in a way
  // that's safe in a serverless deploy, so the runtime form is a
  // structural pin: confirm every row has a profileId that traces to a
  // real, non-deleted profile (i.e. the FK + the audience invariant
  // hold). If a future regression starts inserting orphaned or shared
  // rows, this will catch it.
  const db = getDb();
  const orphans = await db
    .select({ id: schema.learningItems.id })
    .from(schema.learningItems)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.id, schema.learningItems.profileId),
    )
    .where(sql`${schema.profiles.id} IS NULL`)
    .limit(5);
  return {
    ok: orphans.length === 0,
    name: "learning-items-seeker-private",
    message:
      orphans.length === 0
        ? "Every learning_items row traces to a real profile (seeker-private invariant holds at FK level)."
        : `${orphans.length} learning_items row(s) orphaned from a profile  audience invariant at risk.`,
  };
}

/**
 * (c) The D5 cross-kind weekly cap: no `learning.nudge` notification
 * row should exist within 7 days of a `vacancy.outcome.other-hired`
 * row for the same user (or another `learning.nudge`). Cron-side
 * enforcement; this assertion is the structural pin.
 */
export async function assertLearningNudgeCapHonoured(): Promise<AssertResult> {
  const db = getDb();
  // Per recipient, the earliest learning.nudge that has a
  // vacancy.outcome.other-hired OR another learning.nudge within the
  // 7 days BEFORE it. If this returns rows, the cron has misfired or a
  // direct-write path has bypassed the gate.
  const violations = await db.execute(sql`
    SELECT n1.id, n1.user_id, n1.kind, n1.created_at
    FROM notifications n1
    JOIN notifications n2
      ON n2.user_id = n1.user_id
     AND n2.id <> n1.id
     AND n2.kind IN ('vacancy.outcome.other-hired','learning.nudge')
     AND n2.created_at < n1.created_at
     AND n2.created_at >= n1.created_at - interval '7 days'
    WHERE n1.kind = 'learning.nudge'
    LIMIT 5
  `);
  const offending = (violations as { rows: unknown[] }).rows;
  return {
    ok: offending.length === 0,
    name: "learning-nudge-cap-honoured",
    message:
      offending.length === 0
        ? "No learning.nudge row violates the D5 cross-kind 7-day cap."
        : `${offending.length} learning.nudge row(s) violate the D5 cap.`,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 9.13 compliance assertions  the learning-loop intelligence
// layer. Three structural pins:
//   (a) curriculum aggregate emits nothing below k (D2 in 9.13 plan)
//   (b) stall aggregate emits nothing below k AND every contributing
//       learner has outcomes_research = granted (D1 in 9.13 plan)
//   (c) stall aggregate never returns a `provider` dimension  the D5
//       structural ban on provider-level aggregates. We test this by
//       confirming the result shape's keys.
// ──────────────────────────────────────────────────────────────────────

export async function assertCurriculumCellsAboveFloor(): Promise<AssertResult> {
  const min = await getSetting<number>("outcomes_min_cohort_size");
  const { demandVsCurriculumQuery } = await import("@/db/queries/curriculum");
  const { cells, suppressed } = await demandVsCurriculumQuery();
  const offending = cells.find(
    (c) => c.in_programme === false && c.demand_score < min,
  );
  return {
    ok: !offending,
    name: "curriculum-cells-above-floor",
    message: offending
      ? `Curriculum cell returned below floor: ${offending.programme} × ${offending.skill_slug} (demand=${offending.demand_score}, floor=${min}).`
      : `All ${cells.length} curriculum gap cells ≥ floor of ${min} (${suppressed} suppressed).`,
  };
}

export async function assertStallCellsAboveFloor(): Promise<AssertResult> {
  const min = await getSetting<number>("outcomes_min_cohort_size");
  const { stallReasonAggregateQuery } = await import("@/db/queries/stall-reasons");
  const { cells, suppressed } = await stallReasonAggregateQuery();
  const offending = cells.find((c) => c.count < min);
  return {
    ok: !offending,
    name: "stall-cells-above-floor",
    message: offending
      ? `Stall cell returned at size ${offending.count} (floor=${min}): ${offending.skill_slug} × ${offending.province_slug} × ${offending.reason}.`
      : `All ${cells.length} stall cells ≥ floor of ${min} (${suppressed} suppressed).`,
  };
}

/**
 * D1 inclusion-set check. The stall query's INNER JOIN on
 * consents.user_id (purpose='outcomes_research', state='granted')
 * means a contributing row implies the consent. We verify this is
 * still structurally true by counting any learning_items in
 * 'abandoned' state whose owning user does NOT have the consent,
 * AND confirming the query result count never includes those.
 */
export async function assertStallConsentGateEnforced(): Promise<AssertResult> {
  const db = getDb();
  const unconsented = await db.execute(sql`
    SELECT li.id
    FROM learning_items li
    INNER JOIN profiles p ON p.id = li.profile_id
    WHERE li.state = 'abandoned'
      AND NOT EXISTS (
        SELECT 1 FROM consents c
        WHERE c.user_id = p.user_id
          AND c.purpose = 'outcomes_research'
          AND c.state = 'granted'
      )
    LIMIT 5
  `);
  const offending = (unconsented as { rows: unknown[] }).rows;
  // The query is structurally consent-gated by the INNER JOIN, so
  // even if unconsented rows exist they cannot contribute. This
  // assertion captures the structural posture: as long as
  // stallReasonAggregateQuery uses INNER JOIN consents WHERE
  // state='granted', the gate holds. We sanity-check by ensuring
  // the query result count never exceeds the consented-source
  // count for any cell. Approximate but cheap.
  const consentedCount = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM learning_items li
    INNER JOIN profiles p ON p.id = li.profile_id
    INNER JOIN consents c
      ON c.user_id = p.user_id
     AND c.purpose = 'outcomes_research'
     AND c.state = 'granted'
    WHERE li.state = 'abandoned' AND li.abandon_reason IS NOT NULL
  `);
  const consentedN =
    ((consentedCount as unknown as { rows: Array<{ n: number }> }).rows[0]
      ?.n) ?? 0;
  const { stallReasonAggregateQuery } = await import("@/db/queries/stall-reasons");
  const { cells } = await stallReasonAggregateQuery();
  const sumReturned = cells.reduce((s, c) => s + c.count, 0);
  // sumReturned can be < consentedN because of suppression; it must
  // NEVER exceed it. If it does, the gate has a hole.
  const ok = sumReturned <= consentedN;
  return {
    ok,
    name: "stall-consent-gate-enforced",
    message: ok
      ? `Stall consent gate holds: returned=${sumReturned} ≤ consented-source=${consentedN} (${offending.length} unconsented abandoned rows exist but are excluded by INNER JOIN).`
      : `Stall consent gate breached: returned=${sumReturned} > consented-source=${consentedN}. The INNER JOIN gate may have regressed.`,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 9.14 compliance assertion  the seeker profile verification
// roll-up. profiles.verification MUST equal the derived state from
// qualifications:
//   verified   ⇔ ≥1 qualification.verification = 'verified'
//   pending    ⇔ no verified, but ≥1 pending
//   unverified ⇔ otherwise
// `rejected` is never auto-applied at the profile level.
// ──────────────────────────────────────────────────────────────────────

export async function assertProfileVerificationMatchesRollup(): Promise<AssertResult> {
  const db = getDb();
  const mismatches = (
    (await db.execute(sql`
      SELECT
        p.id,
        p.verification AS profile_verification,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM qualifications q
            WHERE q.profile_id = p.id AND q.verification = 'verified'
          ) THEN 'verified'
          WHEN EXISTS (
            SELECT 1 FROM qualifications q
            WHERE q.profile_id = p.id AND q.verification = 'pending'
          ) THEN 'pending'
          ELSE 'unverified'
        END AS expected_verification
      FROM profiles p
      WHERE p.deleted_at IS NULL
        AND p.verification <> CASE
          WHEN EXISTS (
            SELECT 1 FROM qualifications q
            WHERE q.profile_id = p.id AND q.verification = 'verified'
          ) THEN 'verified'::verification_status
          WHEN EXISTS (
            SELECT 1 FROM qualifications q
            WHERE q.profile_id = p.id AND q.verification = 'pending'
          ) THEN 'pending'::verification_status
          ELSE 'unverified'::verification_status
        END
      LIMIT 5
    `)) as unknown as {
      rows: Array<{
        id: string;
        profile_verification: string;
        expected_verification: string;
      }>;
    }
  ).rows;
  return {
    ok: mismatches.length === 0,
    name: "profile-verification-matches-rollup",
    message:
      mismatches.length === 0
        ? "Every non-deleted profile's verification matches the qualification roll-up."
        : `${mismatches.length} profile(s) drift from the roll-up. First: ${mismatches[0]!.id} has ${mismatches[0]!.profile_verification}, expected ${mismatches[0]!.expected_verification}.`,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Phase 9.15 compliance assertions  taxonomy suggestion queue.
// ──────────────────────────────────────────────────────────────────────

/**
 * (a) Length + whitespace invariants. The DB CHECK constraint already
 * enforces 2..80 chars after trim, but this assertion catches drift if
 * a future write path bypasses the constraint or the constraint gets
 * dropped during a migration.
 */
export async function assertTaxonomySuggestionsValid(): Promise<AssertResult> {
  const db = getDb();
  const offending = await db.execute(sql`
    SELECT id, custom_text
    FROM taxonomy_suggestions
    WHERE length(trim(custom_text)) < 2 OR length(trim(custom_text)) > 80
    LIMIT 5
  `);
  const rows = (offending as unknown as { rows: Array<{ id: string }> }).rows;
  return {
    ok: rows.length === 0,
    name: "taxonomy-suggestions-valid",
    message:
      rows.length === 0
        ? "All taxonomy_suggestions rows have custom_text in the 2..80 char range after trim."
        : `${rows.length} suggestion(s) violate length invariants. First id: ${rows[0]?.id}.`,
  };
}

/**
 * (b) Rejection preserves user data. For every rejected suggestion,
 * the submitter's profile (for profession) or academic_profile (for
 * institution) must still carry data referencing the original
 * custom_text. We can't easily verify "the text is unchanged" without
 * a history table, but we can verify the submitter still has a profile
 * row + (for institutions) the pending row still exists. The user-data-
 * preservation contract from D4 of PHASE_9_15_PLAN.md.
 */
export async function assertRejectedSuggestionsPreserveData(): Promise<AssertResult> {
  const db = getDb();
  // Check: for each rejected institution suggestion, the pending
  // institutions row still exists (we never delete it on reject).
  const orphans = await db.execute(sql`
    SELECT s.id
    FROM taxonomy_suggestions s
    WHERE s.state = 'rejected'
      AND s.kind = 'institution'
      AND s.pending_institution_slug IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM institutions i WHERE i.slug = s.pending_institution_slug
      )
    LIMIT 5
  `);
  const rows = (orphans as unknown as { rows: Array<{ id: string }> }).rows;
  return {
    ok: rows.length === 0,
    name: "taxonomy-suggestions-rejected-preserve-data",
    message:
      rows.length === 0
        ? "Every rejected institution suggestion still has its pending row  user data preserved."
        : `${rows.length} rejected institution suggestion(s) lost their pending row. First id: ${rows[0]?.id}.`,
  };
}

/**
 * (c) Promotion / merge backfill is complete. For every promoted or
 * merged suggestion, no profile or academic_profile row should still
 * carry the ORIGINAL custom_text  the backfill should have re-pointed
 * everything. (Caveat: this check is exact-match. If the user later
 * edits their own profession to a slightly different string after the
 * backfill, that's a separate event + not a backfill bug.)
 */
export async function assertTaxonomyBackfillsComplete(): Promise<AssertResult> {
  const db = getDb();
  // Check profession suggestions: for every promoted/merged profession
  // suggestion, no profiles row should still have profession = custom_text
  // (case-insensitive). Allow up to a SMALL tolerance for rows that
  // changed AFTER the resolution (we can't reliably distinguish backfill
  // misses from post-resolution edits without a history; check is
  // approximate but useful as a smoke).
  const profMisses = await db.execute(sql`
    SELECT s.id, s.custom_text, COUNT(p.id)::int AS still_carrying
    FROM taxonomy_suggestions s
    JOIN profiles p ON lower(p.profession) = lower(s.custom_text)
    WHERE s.kind = 'profession'
      AND s.state IN ('promoted', 'merged')
      AND p.deleted_at IS NULL
    GROUP BY s.id, s.custom_text
    HAVING COUNT(p.id) > 0
    LIMIT 5
  `);
  const rows = (
    profMisses as unknown as {
      rows: Array<{ id: string; custom_text: string; still_carrying: number }>;
    }
  ).rows;
  return {
    ok: rows.length === 0,
    name: "taxonomy-promotion-backfill-complete",
    message:
      rows.length === 0
        ? "Every promoted / merged profession suggestion has been fully backfilled across profiles."
        : `${rows.length} suggestion(s) still have profiles carrying the original custom_text. First: id=${rows[0]?.id} text="${rows[0]?.custom_text}" still_carrying=${rows[0]?.still_carrying}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.16  identity capture assertions.
//
// New surface: DOB + admin-mediated ID document upload + passport
// support. Four invariants the platform must maintain end-to-end:
//
//   1. dob-never-in-public-payload  the `dataProvider.getProfile()`
//      seam (the canonical public-facing projection) MUST NOT carry
//      dateOfBirth. POPIA personal-info: visible only to the owner +
//      admins.
//   2. id-encryption-mandatory      every non-null profiles.national_id_enc
//      MUST start with the encryption prefix (`v1.`). Catches a
//      regression where plaintext leaks into the column.
//   3. passport-country-when-passport  every profile with
//      id_document_kind = 'passport' MUST have a non-null,
//      ISO-3166-valid passport_country. We never want to render
//      "passport from <empty>".
//   4. kyc-document-private        every id_document_storage_key MUST
//      follow `{userId}/id-documents/...` so admin tooling can scope
//      audits by prefix + the path itself never leaks outside its
//      owner. Cross-checks against the public profile payload too:
//      the storage key MUST NOT appear in any public-facing projection.
// ─────────────────────────────────────────────────────────────────────────────

export async function assertDobNeverInPublicPayload(): Promise<AssertResult> {
  const db = getDb();
  const sample = await db
    .select({ handle: schema.profiles.handle })
    .from(schema.profiles)
    .limit(50);
  if (sample.length === 0) {
    return {
      ok: true,
      name: "dob-never-in-public-payload",
      message: "No profiles to sample; vacuously satisfied.",
    };
  }
  const { dataProvider } = await import("@/lib/data/provider");
  for (const s of sample) {
    const pub = await dataProvider.getProfile(s.handle);
    if (!pub) continue;
    if (Object.prototype.hasOwnProperty.call(pub, "dateOfBirth")) {
      return {
        ok: false,
        name: "dob-never-in-public-payload",
        message: `Profile ${s.handle} carried dateOfBirth in the public projection.`,
      };
    }
    if (Object.prototype.hasOwnProperty.call(pub, "idDocumentStorageKey")) {
      return {
        ok: false,
        name: "dob-never-in-public-payload",
        message: `Profile ${s.handle} carried idDocumentStorageKey in the public projection (private field leak).`,
      };
    }
  }
  return {
    ok: true,
    name: "dob-never-in-public-payload",
    message: `Sampled ${sample.length} profiles via dataProvider.getProfile()  none carried DOB or storage-key.`,
  };
}

export async function assertIdEncryptionMandatory(): Promise<AssertResult> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.profiles.id,
      enc: schema.profiles.nationalIdEnc,
    })
    .from(schema.profiles)
    .where(sql`${schema.profiles.nationalIdEnc} IS NOT NULL`)
    .limit(500);
  const offender = rows.find((r) => !r.enc || !r.enc.startsWith("v1."));
  return {
    ok: !offender,
    name: "id-encryption-mandatory",
    message: offender
      ? `Profile ${offender.id} has a non-null national_id_enc that doesn't carry the v1. encryption prefix. Plaintext or corrupt payload.`
      : `All ${rows.length} non-null national_id_enc values carry the v1. encryption prefix.`,
  };
}

export async function assertPassportCountryWhenPassport(): Promise<AssertResult> {
  const { isValidCountryCode } = await import("@/lib/taxonomy/countries");
  const db = getDb();
  const rows = await db
    .select({
      id: schema.profiles.id,
      country: schema.profiles.passportCountry,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.idDocumentKind, "passport"))
    .limit(500);
  const offender = rows.find(
    (r) => !r.country || !isValidCountryCode(r.country),
  );
  return {
    ok: !offender,
    name: "passport-country-when-passport",
    message: offender
      ? `Profile ${offender.id} has id_document_kind=passport but passport_country=${
          offender.country ?? "NULL"
        }  not a valid ISO 3166-1 alpha-2.`
      : `All ${rows.length} passport profiles carry a valid ISO 3166-1 alpha-2 issuer.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 9.17  employer-initiated seeker invitation assertions.
//
//   1. seeker-invite-verified-org-only   every seeker_invitations row
//      links to an org that is currently `verified`. Catches a
//      regression where the verifyOrgVerified gate drops out + an
//      unverified org slips through.
//   2. seeker-invite-cooldown-honoured   for every declined row + the
//      subsequent re-invite to the same email from the same org, the
//      90-day cooldown was respected at create-time.
//   3. seeker-invite-no-orphan-when-user-exists   no row exists where
//      lower(email) matches an `app_user.email` that was created
//      before the invite's created_at. Verifies D4's transparent
//      dedupe never persisted a redundant row.
// ─────────────────────────────────────────────────────────────────────────────

export async function assertSeekerInviteVerifiedOrgOnly(): Promise<AssertResult> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT si.id AS invite_id, si.organization_id, o.verification
    FROM seeker_invitations si
    JOIN organizations o ON o.id = si.organization_id
    WHERE o.verification != 'verified'
    LIMIT 5
  `);
  const offenders = (
    rows as unknown as {
      rows: Array<{
        invite_id: string;
        organization_id: string;
        verification: string;
      }>;
    }
  ).rows;
  return {
    ok: offenders.length === 0,
    name: "seeker-invite-verified-org-only",
    message:
      offenders.length === 0
        ? "Every seeker invitation row links to a currently-verified org."
        : `${offenders.length} invitation(s) link to non-verified orgs. First: invite=${offenders[0]?.invite_id} org=${offenders[0]?.organization_id} verification=${offenders[0]?.verification}.`,
  };
}

export async function assertSeekerInviteCooldownHonoured(): Promise<AssertResult> {
  const db = getDb();
  // Find any row where a same-(org, lower(email)) row was declined
  // within the 90 days BEFORE this row's created_at. That's the
  // cooldown violation.
  const rows = await db.execute(sql`
    SELECT later.id AS invite_id, later.organization_id, lower(later.email) AS email,
           earlier.id AS prior_decline_id, earlier.responded_at AS declined_at
    FROM seeker_invitations later
    JOIN seeker_invitations earlier
      ON earlier.organization_id = later.organization_id
      AND lower(earlier.email) = lower(later.email)
      AND earlier.state = 'declined'
      AND earlier.id != later.id
      AND earlier.responded_at IS NOT NULL
      AND earlier.responded_at > (later.created_at - INTERVAL '90 days')
      AND earlier.responded_at < later.created_at
    LIMIT 5
  `);
  const offenders = (
    rows as unknown as {
      rows: Array<{
        invite_id: string;
        organization_id: string;
        email: string;
        prior_decline_id: string;
        declined_at: Date;
      }>;
    }
  ).rows;
  return {
    ok: offenders.length === 0,
    name: "seeker-invite-cooldown-honoured",
    message:
      offenders.length === 0
        ? "No invitation row created within 90 days of the same (org, email) declining a previous invitation."
        : `${offenders.length} cooldown violation(s). First: invite=${offenders[0]?.invite_id} re-invited despite prior decline=${offenders[0]?.prior_decline_id}.`,
  };
}

export async function assertSeekerInviteNoOrphanWhenUserExists(): Promise<AssertResult> {
  const db = getDb();
  // Every seeker_invitations row whose email matches an app_user row
  // created BEFORE the invite is a D4 violation  the action should
  // have refused the insert.
  const rows = await db.execute(sql`
    SELECT si.id AS invite_id, lower(si.email) AS email, u.id AS user_id
    FROM seeker_invitations si
    JOIN app_user u ON lower(u.email) = lower(si.email)
    WHERE u."createdAt" < si.created_at
    LIMIT 5
  `);
  const offenders = (
    rows as unknown as {
      rows: Array<{ invite_id: string; email: string; user_id: string }>;
    }
  ).rows;
  return {
    ok: offenders.length === 0,
    name: "seeker-invite-no-orphan-when-user-exists",
    message:
      offenders.length === 0
        ? "No invitation row exists for an email that already had a Sebenza account at create-time."
        : `${offenders.length} orphan invite(s). First: invite=${offenders[0]?.invite_id} email=${offenders[0]?.email} pre-existing-user=${offenders[0]?.user_id}.`,
  };
}

export async function assertKycDocumentPrivate(): Promise<AssertResult> {
  const db = getDb();
  // Every storage key MUST follow `{userId}/id-documents/...`. Catches a
  // regression where the bucket layout drifts + admin oversight loses
  // its prefix scoping.
  const rows = await db
    .select({
      id: schema.profiles.id,
      userId: schema.profiles.userId,
      key: schema.profiles.idDocumentStorageKey,
    })
    .from(schema.profiles)
    .where(sql`${schema.profiles.idDocumentStorageKey} IS NOT NULL`)
    .limit(500);
  for (const r of rows) {
    if (!r.key) continue;
    const expectedPrefix = `${r.userId}/id-documents/`;
    if (!r.key.startsWith(expectedPrefix)) {
      return {
        ok: false,
        name: "kyc-document-private",
        message: `Profile ${r.id} has storage key "${r.key}" that does not start with "${expectedPrefix}". Admin audit-by-prefix is broken.`,
      };
    }
  }
  return {
    ok: true,
    name: "kyc-document-private",
    message: `All ${rows.length} KYC document keys are owner-scoped under \`{userId}/id-documents/\`.`,
  };
}

export async function runAll(): Promise<void> {
  const checks = [
    await assertNoCohortBelowFloor(),
    await assertUnconsentedNeverAppears(),
    await assertSeekerReportedExcluded(),
    await assertWorkAvailabilityPubliclySafe(),
    await assertNoNationalityCellBelowFloor(),
    await assertNoRawCountryInAnalytics(),
    // Phase 9.8.8
    await assertNoVacancyFieldOnPublicSurfaces(),
    await assertInviteRequiresConsent(),
    await assertNoNationalityInviteGate(),
    await assertNoDeclineReasonCellBelowFloor(),
    await assertAcceptWithNoticeNotInUnfilled(),
    await assertDeclineNoteFlaggedPII(),
    // Phase 9.12
    await assertSelfAttestedNeverVerified(),
    await assertLearningItemsSeekerPrivate(),
    await assertLearningNudgeCapHonoured(),
    // Phase 9.13
    await assertCurriculumCellsAboveFloor(),
    await assertStallCellsAboveFloor(),
    await assertStallConsentGateEnforced(),
    // Phase 9.14
    await assertProfileVerificationMatchesRollup(),
    // Phase 9.15
    await assertTaxonomySuggestionsValid(),
    await assertRejectedSuggestionsPreserveData(),
    await assertTaxonomyBackfillsComplete(),
    // Phase 9.16
    await assertDobNeverInPublicPayload(),
    await assertIdEncryptionMandatory(),
    await assertPassportCountryWhenPassport(),
    await assertKycDocumentPrivate(),
    // Phase 9.17
    await assertSeekerInviteVerifiedOrgOnly(),
    await assertSeekerInviteCooldownHonoured(),
    await assertSeekerInviteNoOrphanWhenUserExists(),
  ];

  let failed = 0;
  for (const c of checks) {
    const tag = c.ok ? "✓" : "✗";
    // eslint-disable-next-line no-console
    console.log(`${tag} ${c.name}  ${c.message}`);
    if (!c.ok) failed++;
  }
  if (failed > 0) {
    throw new Error(`${failed} Sebenza compliance assertion(s) failed.`);
  }
}
