# PHASE 9.14 COMPLETE  SEEKER PROFILE VERIFICATION ROLL-UP
*Shipped 2026-05-26. Companion: `docs/TO_START_EVERY_SESSION.md` · `docs/ROADMAP.md`. Closes a structural gap discovered during system review: `profiles.verification` was scaffolded but never wired to any code path, leaving every seeker permanently "Unverified" regardless of qualification state.*

> **One-line summary**: The seeker badge now reflects reality. `profiles.verification` is derived from `qualifications.verification` via a roll-up: ≥1 verified qualification ⇒ verified; ≥1 pending ⇒ pending; otherwise unverified. `rejected` is never auto-applied at the profile level (per-document rejection isn't a per-seeker judgement).

---

## 🎯 WHAT SHIPPED

### A  The roll-up contract (D1 of this phase)

`lib/profile/verification-rollup.ts` ships `recomputeProfileVerification(profileId)`, a pure derivation:

| Profile state | Condition |
|---|---|
| **verified** | ≥1 qualification has `verification = 'verified'` |
| **pending** | no verified, but ≥1 qualification has `verification = 'pending'` |
| **unverified** | otherwise  no qualifications OR every qualification is unverified/rejected |
| **rejected** | NEVER auto-applied. Per-document rejection stays per-document. |

Single SQL query reads the current profile state + the qualification counts, computes the new state, updates only when changed, returns `{ changed, from, to }` so callers can audit-log transitions.

### B  Four mutation sites wired

Every code path that flips a qualification's verification calls the roll-up after the qualification update:

| Site | When | Effect |
|---|---|---|
| [`lib/admin/verifications.ts → approveQualification`](../lib/admin/verifications.ts) | Admin approves a qualification | Promotes profile from `unverified`/`pending` → `verified` |
| [`lib/admin/verifications.ts → rejectQualification`](../lib/admin/verifications.ts) | Admin rejects a qualification | Demotes profile if this was the only verified/pending one |
| [`lib/profile/qualifications.ts → uploadQualificationDocument`](../lib/profile/qualifications.ts) | Seeker uploads a doc (qual → `pending`) | Promotes profile from `unverified` → `pending` |
| [`lib/profile/qualifications.ts → deleteQualification`](../lib/profile/qualifications.ts) | Seeker deletes a qualification | Demotes profile if this was the last verified/pending one |

`addQualification` is intentionally NOT wired  a freshly-added qualification starts as `unverified`, which never elevates the profile, so the recompute would be a no-op.

The admin verification audit rows now carry `profileVerificationChanged`, `profileVerificationFrom`, `profileVerificationTo` in their meta so the audit trail captures the roll-up transition alongside the per-document one.

### C  One-time backfill migration

`db/migrations/0022_phase9_14_profile_verification_backfill.sql` runs the same SQL roll-up against every non-deleted profile so existing rows converge to honest state without requiring a re-seed. Idempotent  re-running the migration produces the same result.

### D  Compliance assertion

`assertProfileVerificationMatchesRollup()` walks every non-deleted profile and confirms `profiles.verification` equals the derived state from qualifications. Returns a clean signal when in sync; flags the first 5 drifts with profile id + actual vs expected when not. Wired into `/api/admin/outcomes-compliance`  now **19 assertions** total (18 previous + this one).

---

## ✅ COMPLIANCE ASSERTIONS

| # | Assertion | Where verified |
|---|---|---|
| **a** | Verification-Honesty Rule: profile badge structurally derivable from qualification rows, no manual flip path bypasses the contract. | `recomputeProfileVerification` is the only mutator of `profiles.verification`; no other code path writes to that column. |
| **b** | `rejected` never auto-applied at profile level. | The roll-up has no branch that returns `'rejected'`. Per-doc rejection demotes to whichever state the remaining quals imply (`pending` if others pending, `unverified` otherwise), never to `rejected`. |
| **c** | Backfill is idempotent. | Migration `0022` uses a `CASE` expression that produces the same output for the same input every run. Re-running it is safe. |
| **d** | Audit trail captures the transition. | `approveQualification` + `rejectQualification` write `profileVerificationChanged/From/To` into the audit meta alongside the per-document fields. |
| **e** | Structural pin against regressions. | `assertProfileVerificationMatchesRollup` on the admin endpoint catches any drift the next time it's run. |

---

## 📦 FILES TOUCHED

**New**
- `lib/profile/verification-rollup.ts`  the `recomputeProfileVerification` helper.
- `db/migrations/0022_phase9_14_profile_verification_backfill.sql`  one-time backfill SQL.
- `docs/completed/PHASE_9_14_COMPLETE.md` (this doc).

**Edited**
- `lib/admin/verifications.ts`  added `recomputeProfileVerification` calls + extended audit meta in `approveQualification` + `rejectQualification`.
- `lib/profile/qualifications.ts`  added recompute calls in `uploadQualificationDocument` (after the qual flips to `pending`) + `deleteQualification` (after the qual row is removed).
- `lib/analytics/outcomes-compliance.ts`  new `assertProfileVerificationMatchesRollup` assertion.
- `app/api/admin/outcomes-compliance/route.ts`  wired the new assertion into the live endpoint (now 19 total).
- `db/migrations/meta/_journal.json`  appended `idx: 22` entry for migration `0022`.

**Verification**
- `tsc --noEmit` clean.
- `npm test` 22/22 green.
- New compliance assertion runs against live data on `/api/admin/outcomes-compliance`.

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **`addQualification` is NOT wired.** A new qualification starts as `unverified`, which can never elevate the profile from any starting state. Calling the recompute would be a guaranteed no-op + an extra DB round-trip per insert. Skip for performance + clarity.
2. **No new audit kinds.** The transition piggybacks on existing `verification.approve` / `verification.reject` rows via new meta fields. No new `AuditKind` enum value needed; admin queue + filters work unchanged.
3. **No new notification kind.** The seeker already gets `qualification.verified` / `qualification.rejected` notifications which capture the action they care about. Adding a "your profile is now verified" notification on top would be redundant.
4. **`rejected` is NOT a derivable profile state.** A single rejected document doesn't make a seeker "rejected as a person." The Verification-Honesty Rule says badges must reflect reality  a profile with one rejected qual + two unverified ones is structurally `unverified` (no signal yet), not `rejected`.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/search`**  seeker cards now show real `Verified` / `Verification pending` / `Unverified` badges instead of everyone showing as Unverified.
- **`/p/[handle]`**  public profile badge becomes meaningful.
- **`/employer/dossier/[handle]`**  employer-side view inherits the same honest badge.
- **`/admin/verifications`**  Qualifications tab unchanged; admin actions now silently maintain the profile-level state too.
- **`/admin/audit-log`**  `verification.approve` + `verification.reject` rows now carry richer meta for forensic review.
- **`/api/admin/outcomes-compliance`**  19 assertions; the new one is `profile-verification-matches-rollup`.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ Seeker ID-document verification (per-person KYC). That's a future phase if a partner mandates it; out of scope here.
- ❌ Profile-level "Verified" notification (redundant with per-qual notifications).
- ❌ Manual admin override of `profiles.verification`. The roll-up is the only writer.
- ❌ `rejected` as an auto-applied profile state.

---

## 🧪 HOW TO VERIFY THIS WORKS

Smoke walkthrough:

1. Sign in as a seeker with no qualifications → profile shows `Unverified`.
2. Add a qualification (no doc yet) → still `Unverified` (qual is `unverified`).
3. Upload a document on that qualification → qual flips to `pending`, profile flips to `Verification pending`.
4. As admin on `/admin/verifications` → approve the qualification → seeker profile flips to `Verified`.
5. As admin → reject the qualification → seeker profile demotes (to `Unverified` if no other quals, or `Verification pending` if there's another pending one).
6. Hit `/api/admin/outcomes-compliance` → confirm `profile-verification-matches-rollup` returns `ok: true`.

---

*Phase 9.14 closed the seeker verification gap with the smallest possible change: one helper, one migration, one compliance assertion, four mutation sites wired. The badge now means something.*
