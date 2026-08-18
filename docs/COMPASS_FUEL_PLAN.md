# Compass fuel: blended demand + reviewed catalogue growth (2026-08-18)

**Founder go-ahead** after the real-user "unclear what compass does" feedback (explainer
shipped separately). Two builds, in order:

**A. Blended demand signal.** Today compass demand = `search_events` only → cold-start-thin.
Blend three REAL signals with weights: employer searches (freshest, weight 1.0) + open
vacancies' `skill_slugs` (strongest intent, weight 1.5 per vacancy) + confirmed placements'
vacancy skills (proven hiring, weight 2.0, 180-day window). Below a volume floor
(< MIN_LOCAL_SIGNALS = 5 weighted events for the seeker's province+profession), fall back to
the NATIONAL aggregate for the profession, honestly labelled in the UI ("based on national
patterns  not enough employer activity near you yet"). Never fabricate local precision
(No-Flash of data honesty). Same blending for the demand-pulse province lines only if trivial;
otherwise compass-only this phase.

**B. Catalogue growth pipeline.** Living Learning Catalog has 49 rows (target ~750).
AI-drafted, ADMIN-APPROVED  reuse the curriculum-queue pattern: a "Draft catalogue entries"
action on /admin/learning-paths (admin picks skill slugs → LLM drafts SA-grounded entries:
provider, cost band, SETA/TVET/free routes, duration) → drafts land in a review list →
admin edits/approves/rejects → only approved rows join the catalog. Requires an active LLM
provider on /admin/llm; the draft action is admin-only (no seeker-facing AI). Follow the
llm_providers posture; audit kind `catalog.draft` + `catalog.approve`.

## TASKS
- [x] A1: `db/queries/career-compass.ts`  blended demand CTE (searches + vacancies +
      placements, weighted), province+profession scoped, 180-day window
- [x] A2: national fallback below MIN_LOCAL_SIGNALS + `demandBasis: "local" | "national"`
      in the compass payload
- [x] A3: UI label on /dashboard/grow when basis = national (4 locales)
- [x] A4: unit/integration tests  weight math, floor trigger, national fallback
- [x] B1: `catalog_drafts` table (or reuse curriculum-queue shape) + migration
- [x] B2: admin draft action (LLM, admin-only, audited) + review/approve/reject UI on
      /admin/learning-paths
- [x] B3: approved rows insert into the living catalog; E2E admin-smoke route intact
- [x] B4: tests + typecheck + suites green; TO_START + memory updates

## VERIFY
- [ ] Harness: seeker in a low-signal province sees national-basis label; high-signal
      (seeded Gauteng) sees local suggestions ranked by blended weight
- [x] Admin drafts → approve → entry appears in a seeker's compass learning paths
- [ ] role-arcs + admin-smoke green desktop + 360px

## B implementation anchors (surveyed 2026-08-18)
- `learning_paths` columns to draft: title, provider, providerKind (seta|tvet|university|open…),
  cost (free|subsidised|paid), costNote, outcome, durationWeeks, unlocksSkills (LABELS
  jsonb), national, url (null honest), sortOrder. Approved drafts insert with
  `sebenzaReviewed: false` + `lastVerifiedAt: null` until the admin verifies links.
- LLM posture: mirror `lib/llm/curriculum.ts` `suggestModuleSkills` gates (admin caller,
  kill-switch `feature_flag_llm_curriculum_enabled` REUSED  same admin drafting family,
  no new flag; provider infra from llm_providers; telemetry skip() pattern). Input = skill
  labels only (no PII surface).
- New table `catalog_drafts` (migration 0068): id, skillSlugs text[], payload jsonb (the
  drafted entry fields), state pending|approved|rejected, rawModel text, createdByUserId,
  resolvedByUserId, resolvedAt, adminNote, createdAt. Audit kinds `catalog.draft` +
  `catalog.approve` + `catalog.reject`.
- UI: section atop /admin/learning-paths (LearningPathsManager page)  "Draft with AI"
  (ComboboxField multi skill pick → action) + pending drafts list with inline edit of
  payload fields before Approve.

## Notes
- Phase 22 (coach safety) is SHIPPED  unrelated gate; coach ON needs founder to verify
  crisis resources (/admin/crisis-resources) + ack on /admin/llm. Not part of this plan.
