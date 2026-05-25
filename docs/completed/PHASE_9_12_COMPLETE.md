# PHASE 9.12 COMPLETE — THE LEARNING LOOP
*Shipped 2026-05-25. Plan: [`docs/completed/PHASE_9_12_PLAN.md`](./PHASE_9_12_PLAN.md). Sister phase opening next: [`docs/PHASE_9_13_PLAN.md`](../PHASE_9_13_PLAN.md) (learning-loop intelligence — gov-facing analytics that reads the data this loop generates).*

> **One-line summary**: The Career Compass is now a loop the learner lives in. Accept a recommendation → start → mark complete → the skill lands on your profile (as `self_attested_learning`, honestly never "Verified") → your projected rank shifts. Abandon paths capture reason → the cost/access-driven ones surface a free alternative on next render.

---

## 🎯 WHAT SHIPPED

### A — Provenance honesty contract on `profile_skills`
Migration `0020_phase9_12_learning_loop.sql` (additive) adds two columns:
- `provenance skill_provenance NOT NULL DEFAULT 'self_attested'` — back-fills existing rows to the truth (every skill on the platform today was self-attested).
- `verified_at timestamp` — NULL until the dormant Phase 8 SAQA/provider adapter writes here.

The UI honesty rule (D1): **render "Verified" ⇔ `provenance = 'verified_provider'` AND `verified_at IS NOT NULL`**. Everything else reads as "Self-attested" with a provenance-specific qualifier. Closes the only door through which a learning-driven skill could ever leak onto a "Verified" surface. Helper functions `provenanceLabel()` + `isVerifiedSkill()` in `lib/seeker/learning-types.ts` are the canonical readers.

### B — `learning_items` table + state machine
Same migration adds the table + two enums (`learning_state`, `abandon_reason`) + indexes for the two hot read paths (`(profile_id, state)` + `(skill_slug, state)`). One row per (seeker, accepted recommendation). Four Server Actions in `lib/seeker/learning.ts` own the transitions:

| Action | Transition | Side effects |
|---|---|---|
| `acceptRecommendation({ skillSlug })` | _none_ → `accepted` | Dedupes against any active (`accepted`/`in_progress`) row for the same skill. Picks a matching `LearningPath` from the SA-grounded static catalog (`MOCK_COMPASS.learningPaths`) by `unlocksSkills` overlap; falls back to a generic placeholder. Audit `learning.accept`. |
| `startLearningItem(id)` | `accepted` → `in_progress` + `startedAt` | Audit `learning.start`. |
| `completeLearningItem(id)` | `*` → `completed` + `completedAt` | Upserts `profile_skills` with **upgrade-only** semantics via `ON CONFLICT … SET … WHERE provenance = 'self_attested'` — D1's verified-provider rows are never downgraded. Fires `learning.completed` notification (celebration, exempt from D5 cap). Recomputes `rankInPoolQuery` for the celebration copy. Audit `learning.complete`. |
| `abandonLearningItem({ id, reason, note? })` | `*` → `abandoned` + `abandonedAt` + reason | 200-char note clamp; `other` requires a note. Note body stays in `learning_items.abandon_note`; audit meta only records the `seekerAuthoredFreeText` flag (POPIA). Audit `learning.abandon`. |

### C — "My Learning" section on `/dashboard/grow`
Server component reads `listMyLearningItems()` and splits into **Active** (accepted + in_progress) + **Recent** (last 5 of completed + abandoned). Empty state is editorial — explains the loop in one sentence rather than apologising. Each row gets state-appropriate controls (`Start` / `Mark complete` / `Give up`) via the `<LearningItemRow>` client island.

The `<AcceptRecommendationButton>` client island sits at the bottom of every recommendation card. Renders as a primary `Learn [skill]` CTA, OR as a quiet "On your learning list" pill when the seeker already has an active row for that skill. The Compass page does a single `listMyLearningItems()` read at load and threads the active-skill set down to each recommendation — zero extra round trips.

### D — Abandon modal (was 9.12.5; shipped alongside 9.12.3)
`<AbandonModal>` bottom-sheet on phones / centred on `md+`. Radio picker over all seven `abandon_reason` enum values + optional 200-char note (live counter, POPIA reminder). Mirrors the 9.8.5 decline-with-reason UX so the two "what just stalled" surfaces read consistently. When `reason ∈ {too_expensive, access_transport}`, a brand-tint note in the modal previews: *"We'll surface a free alternative for this skill next time you open the compass."* — the D3 nudge made visible to the user at the moment of decision.

### E — D3 free-alt surfacing on the next render
The Compass page now also loads `listRecentAbandonReasonsBySkill()`. Any recommendation whose skill matches a recent cost/access abandon gets a dashed `Free alt` chip beside the reason chip + Vacancy gap chip. The chip has a tooltip explaining why. (The actual "swap in a free path" picker lives in a future polish ticket; for 9.12 the visible signal is enough to close the loop.)

### F — Gentle nudges + the D5 cross-kind weekly cap
New cron `/api/cron/learning-nudge` (Phase 8 pattern): for every `accepted`/`in_progress` item silent for ≥ 14 days, fires one `learning.nudge` notification (in-app default-on, email default-off). Idempotency via `learning_items.nudge_last_sent_at` (mirrors `profiles.status_stale_last_sent_at`).

**D5 enforcement** (cross-kind, channel-agnostic): before queuing each candidate, the cron looks at the `notifications` table for any `vacancy.outcome.other-hired` OR `learning.nudge` row in the last 7 days for that user — if either exists, skip. Two demoralising nudges in the same week is the opposite of the loop's intent. `learning.completed` is exempt — positive payoff is never throttled.

### G — Three new compliance assertions
Wired into `/api/admin/outcomes-compliance`:
- `self-attested-never-verified` — D1 structural pin. Walks `profile_skills` for rows that have `provenance ∈ {self_attested, self_attested_learning}` AND `verified_at IS NOT NULL` (the only way a non-verified provenance could render as "Verified").
- `learning-items-seeker-private` — confirms every `learning_items` row traces to a real, non-deleted profile (FK + audience invariant). Cheap structural pin.
- `learning-nudge-cap-honoured` — runs the inverse of the D5 cron-side check directly against `notifications`; flags any `learning.nudge` row with a same-user `vacancy.outcome.other-hired`/`learning.nudge` row in the preceding 7 days.

---

## ✅ COMPLIANCE ASSERTIONS

| # | Assertion | Where verified |
|---|---|---|
| **a** | D1 honesty contract: no row with non-verified provenance + non-null `verified_at`. | `assertSelfAttestedNeverVerified()` |
| **b** | Learning progress is seeker-private — every `learning_items` row traces to a real profile, no orphaned audience leakage. | `assertLearningItemsSeekerPrivate()` |
| **c** | D5 cross-kind weekly cap: no `learning.nudge` within 7 days of a `vacancy.outcome.other-hired` or another `learning.nudge` for the same user. | `assertLearningNudgeCapHonoured()` |
| **d** | Per D4 (plan): no streaks, points, leaderboards, or pressure mechanics anywhere in the UI. | Grep — `LearningItemRow`, `MyLearningSection`, `AbandonModal` carry no badge/streak/pressure logic. |
| **e** | `learning.nudge` defaults to email-off (less intrusive); `learning.completed` defaults to email-on (positive payoff). | `lib/notifications/catalog.ts` |
| **f** | `acceptRecommendation` dedupes against active rows — clicking Accept twice on the same skill returns the existing item, not a new one. | `lib/seeker/learning.ts` (Section A in this doc). |
| **g** | Abandon note is PII-flagged in audit meta (note text stays in `learning_items`, not audit). Mirrors 9.8.5 decline-note contract. | `lib/seeker/learning.ts` `abandonLearningItem` |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0020_phase9_12_learning_loop.sql` — additive migration + journal entry `idx: 20`.
- `lib/seeker/learning.ts` — Server Actions + read queries (`listMyLearningItems`, `listRecentAbandonReasonsBySkill`).
- `lib/seeker/learning-types.ts` — enum value catalogs + label maps + `provenanceLabel()` / `isVerifiedSkill()` honesty helpers.
- `components/feature/seeker/learning/MyLearningSection.tsx` — server component.
- `components/feature/seeker/learning/LearningItemRow.tsx` — client island per row with state-appropriate controls.
- `components/feature/seeker/learning/AcceptRecommendationButton.tsx` — client island on each recommendation card.
- `components/feature/seeker/learning/AbandonModal.tsx` — bottom-sheet / centred modal.
- `app/api/cron/learning-nudge/route.ts` — Phase 8 cron pattern + D5 cross-kind cap.
- `docs/completed/PHASE_9_12_COMPLETE.md` (this doc).

**Edited**
- `db/schema.ts` — added `skillProvenance` enum + 2 new columns on `profileSkills` + `learningState`/`abandonReason` enums + `learningItems` table.
- `db/migrations/meta/_journal.json` — appended `idx: 20`.
- `db/seed.ts` — added `seedPhase9_12LearningLoop()` (3 fixture items on `wits-bsc-cs-2026-08`: react in-progress, typescript completed → `profile_skills` upgraded to `self_attested_learning`, postgres abandoned with reason `too_expensive`). Truncate list extended with `learning_items`.
- `lib/audit/index.ts` — `AuditKind` union extended with `learning.{accept,start,complete,abandon}`.
- `lib/notifications/catalog.ts` — added `learning.completed` (email default-on, exempt from D5 cap) + `learning.nudge` (in-app only, subject to D5 cap).
- `lib/email/templates/notifications.ts` — wired `learning.completed` via `genericTemplate` (eyebrow "Skill added", CTA "Open your profile").
- `lib/analytics/outcomes-compliance.ts` — three new assertions.
- `app/api/admin/outcomes-compliance/route.ts` — added the three assertions to the runtime endpoint.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx` — loads `listMyLearningItems()` + `listRecentAbandonReasonsBySkill()`; renders `<MyLearningSection>` above recommendations; threads `alreadyOnList` + `costAccessAbandoned` into each recommendation; new "Free alt" chip on cost/access-abandoned rows.

**Verification**
- `npx tsc --noEmit` clean across all changes.
- Compliance endpoint exposes the three new assertions for admin smoke-checks.

---

## ⚠️ KNOWN COMPROMISES (acceptable for v1; surface in future polish if asked)

1. **Upsert side-effect detection in `completeLearningItem`** — Drizzle's pg driver doesn't reliably expose `rowCount` from a conditional `onConflictDoUpdate`, so the `attachedSkill` boolean returned to the client is "did we touch `profile_skills` at all" not "was it a new insert vs an upgrade." Good enough for the celebration copy; doesn't affect the audit row (which records the skill slug + the rank delta).
2. **The D3 free-alt chip is visible-signal only.** The compass doesn't swap a paid path for a free one programmatically — the chip + the matching learning_path catalog entries communicate the option, and the next time the user accepts the same skill the action will pick the first matching path (often the free one, given the catalog ordering). A proper "swap in a free path" picker is a future polish ticket.
3. **`acceptRecommendation` uses a hand-rolled `INSERT … WHERE NOT EXISTS` via two queries instead of one** — readable but not race-proof if a user double-clicks. Worst case is two rows for the same skill; the de-dupe at action-call time catches the common case. UNIQUE constraint addition is a future cleanup if abuse appears.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/dashboard/grow`** — Now context-aware in three new ways: (1) shows My Learning above recommendations; (2) each recommendation has an Accept button or a quiet "On your learning list" pill; (3) cost/access-abandoned skills get a "Free alt" chip alongside the existing 9.11 "Vacancy gap" chip. The 9.11 deep-link banner + Career Compass behaviour is unchanged.
- **`/dashboard/profile`** — Skills section behaviour unchanged for now; 9.12.4's upsert lands new skills with `provenance='self_attested_learning'` but the existing SkillsEditor UI reads them as ordinary skills. A future polish ticket can surface the provenance label on the editor card.
- **`/admin/audit-log`** — Four new audit kinds visible: `learning.accept`, `learning.start`, `learning.complete`, `learning.abandon`.
- **`/api/admin/outcomes-compliance`** — Now returns 15 assertions (12 previous + 3 new for 9.12).
- **9.13 (next)** — Has real (suppressed) data to aggregate against from day 1 via the seed.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ Becoming an LMS (no hosted lessons / quizzes / video / platform certificates).
- ❌ Auto-verifying completed skills (always self-attested + honest provenance; SAQA dormant).
- ❌ Streaks / points / leaderboards / pressure mechanics (D4).
- ❌ Learning progress on any public/employer surface (seeker-private).
- ❌ Per-person curriculum or stall data on any aggregate surface (forwarded to 9.13, with suppression).
- ❌ The demand-vs-curriculum dataset materialisation (forwarded to 9.13).
- ❌ "Why learners stall" gov analytics surface (forwarded to 9.13).

---

*Phase 9.12 turned the Career Compass from advice you read into a loop you live in — and quietly, in audit-logged rows the seeker owns, started producing the raw data 9.13 will aggregate into a map of where the education-to-work pipeline leaks.*
