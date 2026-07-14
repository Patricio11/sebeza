/**
 * Phase 23.1  the DB-backed student lane. Proves the runtime mock is gone:
 * programmes come from the seeded `graduate_programmes` table (field-matched,
 * public sector first), and destinations obey the k-floor (below it → empty →
 * the section hides; never a fabricated distribution).
 */
import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { buildStudentSnapshot } from "@/db/queries/student-lane";
import type { AcademicProfile } from "@/lib/mock/types";

const db = getDb();

const CS_ACADEMIC: AcademicProfile = {
  institutionSlug: "wits",
  institutionLabel: "University of the Witwatersrand",
  institutionKind: "university",
  programme: "BSc Computer Science",
  fieldOfStudy: "Computer Science",
  nqfLevel: 7,
  currentYear: 3,
  expectedGraduation: "2026-12",
  nsfas: false,
  verification: "unverified",
  openToInternships: true,
  openToGraduateProgrammes: true,
  currentModules: [],
  electiveChosen: null,
  projectTopic: null,
};

describe("student lane (Phase 23.1)", () => {
  test("graduate_programmes is seeded from the constants", async () => {
    const rows = await db.select().from(schema.graduateProgrammes);
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  test("snapshot programmes are field-matched + public sector first", async () => {
    const snap = await buildStudentSnapshot({
      academic: CS_ACADEMIC,
      curriculum: null,
      recommendations: [],
    });
    expect(snap.programmes.length).toBeGreaterThan(0);
    // Every programme matches the CS field.
    for (const p of snap.programmes) {
      expect(
        p.fieldTags.some((tag) =>
          tag.toLowerCase().includes("computer science"),
        ),
      ).toBe(true);
    }
    // Public sector listed before non-public (the honesty/visibility rule).
    const firstNonPublic = snap.programmes.findIndex(
      (p) => p.sector !== "public",
    );
    const lastPublic = snap.programmes
      .map((p, i) => (p.sector === "public" ? i : -1))
      .reduce((a, b) => Math.max(a, b), -1);
    if (firstNonPublic !== -1 && lastPublic !== -1) {
      expect(lastPublic).toBeLessThan(firstNonPublic);
    }
    // An accounting-only programme (e.g. PwC SAICA) never leaks into CS.
    expect(
      snap.programmes.some((p) => p.title.includes("SAICA")),
    ).toBe(false);
  });

  test("destinations obey the k-floor  never fabricated below it", async () => {
    // The base seed has 3 employer-confirmed placements for the Wits BSc CS
    // cohort  below the default floor (10)  so destinations must be EMPTY
    // (the renderer hides the section), not an invented distribution.
    const snap = await buildStudentSnapshot({
      academic: CS_ACADEMIC,
      curriculum: null,
      recommendations: [],
    });
    // Count the cohort's confirmed placements so the assertion stays honest
    // against future seed growth (23.6 may push the cohort over the floor).
    const rows = (
      (await db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM placements pl
        INNER JOIN academic_profiles ap ON ap.profile_id = pl.profile_id
        WHERE LOWER(ap.programme) = 'bsc computer science'
          AND ap.institution_slug = 'wits'
          AND pl.source = 'employer_confirmed'
      `)) as unknown as { rows: Array<{ n: number }> }
    ).rows;
    const n = rows[0]?.n ?? 0;

    if (n < 10) {
      expect(snap.destinations).toEqual([]);
    } else {
      expect(snap.destinations.length).toBeGreaterThan(0);
      const shareSum = snap.destinations.reduce((s, d) => s + d.share, 0);
      expect(shareSum).toBeLessThanOrEqual(1.0001);
    }
  });

  test("graduation headline is computed from the seeker's own data", async () => {
    const snap = await buildStudentSnapshot({
      academic: CS_ACADEMIC,
      curriculum: null,
      recommendations: [],
    });
    expect(snap.graduationHeadline.expectedGraduation).toBe("2026-12");
    expect(typeof snap.graduationHeadline.monthsLeft).toBe("number");
  });
});
