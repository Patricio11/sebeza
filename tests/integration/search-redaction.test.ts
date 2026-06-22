/**
 * Phase 12 (Task 12.2)  Redaction Rule against the real database.
 *
 * `searchProfilesQuery` and `findProfileByHandleQuery` are THE canonical
 * public read paths. These fixtures assert, on real seeded rows, that no
 * forbidden field ever appears in a returned payload  as a KEY-SET check
 * on the actual objects, not a type-level promise (types erase; key sets
 * don't lie).
 *
 * Also pins the soft-delete exclusion: an erased seeker vanishes from
 * search immediately (the 30-day hard-delete grace is a retention detail,
 * not a visibility one).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  findProfileByHandleQuery,
  searchProfilesQuery,
  type SearchResultRow,
} from "@/db/queries/profiles";

/**
 * One shared forbidden-key list (docs/PHASE_12_PLAN.md Task 12.4)  both
 * camelCase (drizzle mapping) and snake_case (raw SQL) spellings, so a
 * refactor that switches the read to `db.execute()` can't sneak a column
 * back in under its SQL name.
 */
const FORBIDDEN_PUBLIC_KEYS = [
  "nationalIdEnc",
  "national_id_enc",
  "fullSurname",
  "full_surname",
  "email",
  "searchVector",
  "search_vector",
  "deletedAt",
  "deleted_at",
  "dateOfBirth",
  "date_of_birth",
  "dob",
  "documentStorageKey",
  "document_storage_key",
  "idDocumentStorageKey",
  "id_document_storage_key",
  "phoneE164Enc",
  "phone_e164_enc",
  "cvStorageKey",
  "cv_storage_key",
  "userId",
  "user_id",
];

function assertNoForbiddenKeys(obj: object, label: string): void {
  const keys = new Set(Object.keys(obj));
  for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
    expect(keys.has(forbidden), `${label} leaked key "${forbidden}"`).toBe(
      false,
    );
  }
}

describe("search payload redaction", () => {
  let rows: SearchResultRow[] = [];

  beforeAll(async () => {
    const result = await searchProfilesQuery({});
    rows = result.profiles;
  });

  test("seed yields a non-empty result set (fixtures sanity)", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  test("no search row carries a forbidden key", () => {
    for (const row of rows) {
      assertNoForbiddenKeys(row, `search row ${row.handle}`);
    }
  });

  test("nested payloads (skills / experience / qualifications) are clean too", () => {
    for (const row of rows) {
      for (const skill of row.topSkills ?? []) {
        assertNoForbiddenKeys(skill, `skill on ${row.handle}`);
      }
    }
  });

  test("free-text query path returns the same redacted shape", async () => {
    const { profiles } = await searchProfilesQuery({ query: "developer" });
    for (const row of profiles) {
      assertNoForbiddenKeys(row, `FTS row ${row.handle}`);
    }
  });
});

describe("public profile (dossier) redaction", () => {
  test("findProfileByHandleQuery returns a clean payload incl. children", async () => {
    const { profiles } = await searchProfilesQuery({});
    const handle = profiles[0]!.handle;
    const profile = await findProfileByHandleQuery(handle);
    expect(profile).not.toBeNull();
    assertNoForbiddenKeys(profile!, `dossier ${handle}`);
    for (const q of profile!.qualifications ?? []) {
      assertNoForbiddenKeys(q, `qualification on ${handle}`);
    }
    for (const e of profile!.experience ?? []) {
      assertNoForbiddenKeys(e, `experience on ${handle}`);
    }
  });
});

describe("soft-delete exclusion (erasure visibility contract)", () => {
  const db = getDb();
  let victimHandle: string;

  beforeAll(async () => {
    const { profiles } = await searchProfilesQuery({});
    victimHandle = profiles[profiles.length - 1]!.handle;
    await db.execute(
      sql`UPDATE profiles SET deleted_at = now() WHERE handle = ${victimHandle}`,
    );
  });

  afterAll(async () => {
    await db.execute(
      sql`UPDATE profiles SET deleted_at = NULL WHERE handle = ${victimHandle}`,
    );
  });

  test("a soft-deleted profile vanishes from search immediately", async () => {
    const { profiles } = await searchProfilesQuery({});
    expect(profiles.map((p) => p.handle)).not.toContain(victimHandle);
  });

  test("a soft-deleted profile's public dossier is gone too", async () => {
    const profile = await findProfileByHandleQuery(victimHandle);
    expect(profile).toBeNull();
  });
});
