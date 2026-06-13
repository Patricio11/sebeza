# MIGRATION JOURNAL RECOVERY PLAN ✅ COMPLETE

*One-off fix surfaced when `npm run db:seed` failed with `column "secondary_professions" of relation "profiles" does not exist` after `npm run db:migrate` ran silently.*

> **✅ RESOLVED 2026-06-09.** Journal + idempotency fixes shipped as `e3da3cb`. Recovery on the
> dev DB went via `npm run db:push` (the tracking table's recorded hashes pre-dated the
> idempotency edits, so `migrate` stayed silent — push syncs the schema directly). Verified by a
> read-only information_schema probe: all 0038–0048 artifacts present (`secondary_professions`,
> `llm_providers`, `student_milestones`, `module_skills`, `seeker_badges`, nullable
> `vacancies.province_slug`, `academic_profiles.current_modules`), 24 profiles seeded, 51
> catalogue rows. **One deviation found during verification:** the push path skips migration
> INSERTs AND the seed's TRUNCATE CASCADE wipes `llm_providers` through its `configured_by`
> FK — the 4 dormant provider rows were missing. Fixed by adding `seedLlmProviders()` to
> `db/seed.ts` (idempotent, ON CONFLICT DO NOTHING). Task 3's workflow rule landed in
> `docs/TO_START_EVERY_SESSION.md` (migration convention block) + a recovery pointer in the
> README database section.

> **↪ FOLLOW-UP 2026-06-13 — the second-order effect, fully resolved.** The `db:push` recovery
> above synced the schema but never touched drizzle's tracking table, so
> `drizzle.__drizzle_migrations` stayed frozen at migration **0027** (28 rows, 11 of them stale
> hashes from the idempotency edits to 0001–0011). `db:migrate` therefore couldn't reconcile and
> silently applied **nothing** — which is why the Phase-16 search-vector fix (`0051`) never landed
> until `scripts/heal-search-vectors.mts` ran it by hand. Permanently fixed with a **bookkeeping-only**
> reconcile (`scripts/reconcile-migrations.mts`, committed `e3fb6b4`): TRUNCATE + rebuild the tracking
> table to mirror the journal exactly (hash = sha256 of each `.sql`, `created_at` = journal `when`);
> transactional, guarded to abort unless the schema is at head, does **not** re-run migration SQL
> (several like 0028's `CREATE TYPE` aren't idempotent). Outcome on the dev DB: **28 → 52 rows,
> head = 0051**, and `npm run db:migrate` is now a verified clean no-op. Read-only diagnostic:
> `scripts/diagnose-migrations.mts`. The lesson + both scripts are recorded in the migration
> convention block of `docs/TO_START_EVERY_SESSION.md` (bookkeeping-drift corollary).

> **Root cause:** `db/migrations/meta/_journal.json` stops at idx 37 (`0037_phase9_23_employment_verifications`). The 11 migrations added between Phase 11.1 and Phase 13.10 (`0038`-`0048`) shipped as raw SQL files but were never registered in the journal. `drizzle-kit migrate` reads the journal to know which migrations are available; missing entries are silently skipped. The seed runs against a DB that's still at the 0037 schema and fails on the first column from a missing migration.

---

## 🎯 GOAL

After this fix:

1. `db/migrations/meta/_journal.json` carries all 49 entries (idx 0-48).
2. The 11 missing migration SQL files (`0038`-`0048`) gain `IF NOT EXISTS` / `IF EXISTS` guards so re-running them against a DB where the schema was already pushed via `drizzle-kit push` (or partially applied) is a no-op rather than a duplicate-column error.
3. `npm run db:migrate` applies whatever's outstanding cleanly.
4. `npm run db:seed` succeeds end-to-end.

---

## 🧱 WHAT'S BROKEN

- `_journal.json` has 38 entries (idx 0-37).
- `db/migrations/` has 49 SQL files (0000-0048).
- The 11 missing entries are: 0038 (Phase 11.1), 0039 (Phase 11.2.4), 0040 (Phase 11.3), 0041 (Phase 11.4), 0042 (Phase 11.5), 0043-0046 (Phase 13.1-13.4), 0047 (Phase 13.9), 0048 (Phase 13.10).

The user's DB may be in one of three states:

- **State A (fresh DB):** none of 0038-0048 applied. Adding journal entries + running migrate applies all 11 cleanly.
- **State B (partial push):** `drizzle-kit push` ran at some point and synced the schema directly without touching `__drizzle_migrations`. Some or all of 0038-0048 already-applied at the schema level but no record in the migrations tracking table. Running migrate would try to re-apply and fail on duplicate columns.
- **State C (mixed):** some migrations applied via raw SQL / push, others not.

We don't know which state. The fix has to be safe for all three.

---

## 📋 TASKS

### Task 1: Add 11 entries to `_journal.json`

Append `idx 38` through `idx 48` with monotonically increasing `when` timestamps (continuing the +100000000 pattern from the existing entries: 0037 = 1780900000000 → 0038 = 1781000000000 ... 0048 = 1782000000000). Tags match the SQL filename without `.sql`.

### Task 2: Make 11 migration SQL files idempotent

Wrap every `ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`, `CREATE TYPE`, `CREATE INDEX`, `ALTER COLUMN ... DROP NOT NULL`, etc. with `IF NOT EXISTS` / `IF EXISTS` clauses where Postgres supports them. For DDL that doesn't support `IF NOT EXISTS` natively (e.g. `ALTER TYPE ... ADD VALUE`), wrap in a `DO $$ ... EXCEPTION WHEN ... END $$` block.

**Why retrofit instead of leaving as-is:** A dev workflow that mixes `drizzle-kit push` (the fast path) with `drizzle-kit migrate` (the canonical path) is common; idempotent migrations make either path safe to re-run. The cost is a few extra `IF NOT EXISTS` clauses; the benefit is the user can always run `npm run db:migrate` without first diagnosing what state the DB is in.

### Task 3: Document the recovery in the migration runbook

Add a short section to the README's database setup notes (or create `docs/DEV_DB_SETUP.md` if one doesn't exist) explaining:

- Always commit `_journal.json` updates alongside new SQL files.
- For the `push` → `migrate` mix, add `IF NOT EXISTS` to all new migrations.
- If the journal ever drifts again, this plan doc is the recovery template.

---

## 🚫 OUT OF SCOPE

- ❌ Generating migrations via `drizzle-kit generate` (the canonical path going forward) — separate dev-workflow conversation. This plan fixes the immediate breakage.
- ❌ Rewriting the seed to skip migrations entirely (would mask future migration drift).
- ❌ Per-environment migration tracking — `__drizzle_migrations` already exists in the DB; we just need our journal aligned with it.

---

## 🧪 HOW TO VERIFY

1. `npm run db:migrate` exits with output naming the migrations applied (not silent).
2. `npm run db:seed` completes through the "Profiles…" step without the "column does not exist" error.
3. Re-running `npm run db:migrate` against a DB that's already at the head is a no-op (the journal + DB tracking table agree).
4. A fresh DB (drop all tables) → `npm run db:migrate` → `npm run db:seed` works end-to-end.

---

*Plan opens immediately; no Phase number assigned since this is a dev-workflow fix, not a product change. Tracking the fix in a plan doc anyway to honour the convention.*
