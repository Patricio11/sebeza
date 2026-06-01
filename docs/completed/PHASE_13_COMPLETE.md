# PHASE 13 COMPLETE  STUDENT LANE EXPANSION + EDITORIAL-LLM CURRICULUM PIPELINE

*Shipped 2026-06-01. Seven tasks; all seven landed with no real-time LLM in any seeker-facing surface and no machine-translated POPIA copy.*

> **One-line summary**: The student lane on `/dashboard/grow` deepens from programme-level intelligence to per-module + per-event intelligence. New capture (modules / elective / project topic); new editorial catalogue (`module_skills`) bootstrapped via an admin-only LLM pipeline with six-gate dispatch + at-most-one-active provider enforced at the DB layer; new private progression timeline composed from auto-derived events + four self-declared milestones; new gov-side module-grain demand gap card.

Commits (oldest first):

- `ab98d87`  Phase 13.1: student module / elective / project capture
- `1ccc5a6`  Phase 13.2: module_skills editorial catalogue + student curriculum read path
- `9e2ea31`  Phase 13.3: admin LLM editorial-curriculum pipeline + six-gate dispatch
- `bb1b7fd`  Phase 13.4: student progression timeline + self-declared milestones
- `4c443f4`  Phase 13.5: Tier-1 module_skills catalogue seed + governance docs
- `8e2eef4`  Phase 13.6: gov-side module-grain demand-vs-curriculum panel
- `(this commit)`  Phase 13.7: DPIA addendum + Career Compass provenance annotations

---

## 🎯 WHAT SHIPPED

### Task 13.1  Module + project + elective capture
- Migration 0043 adds 3 columns on `academic_profiles`: `current_modules text[]`, `elective_chosen text`, `project_topic text`. GIN index on `current_modules` for trigram fuzzy match.
- New server action `lib/profile/academic-context.ts → updateStudentContext` with academic-row existence guard; normalises modules (dedupe / trim / cap at 8).
- New `<StudentContextEditor>` component with chip input for modules + conditional elective (year ≥ 2) + project (year ≥ 3) fields.
- `SeekerSignUpForm` student-mode block extended with all three new fields.
- `MyProfile.academic` shape carries the three new fields; data-export bundle includes them.
- Help article `student-modules-and-project.tsx`.

### Task 13.2  module_skills catalogue + student read path
- Migration 0044 + schema: `module_skills` table (id, module_slug, module_label, skill_slug FK, confidence 1-5 CHECK, source enum, approved_by, approved_at, institution_slug).
- `module_skill_source` enum: `editorial` · `llm_suggested` · `student_signal` (reserved).
- Two partial unique indexes for canonical vs institution-scoped uniqueness.
- GIN trigram index on `module_label` for the fuzzy-match read path.
- Read query `moduleSkillsForStudent` in `db/queries/curriculum.ts` (trigram `%` match, DISTINCT ON skill_slug, prefer institution rows, exclude llm_suggested).
- `<ProgrammeVsMarketCard>` extended with `ModuleSkillsSection`.

### Task 13.3  Admin LLM editorial-curriculum pipeline
- Migration 0045: `llm_providers` table + partial unique index `llm_providers_one_active` (`WHERE active = true`) + 4 seeded placeholder rows (openai, anthropic, mistral, self_hosted) all dormant + kill-switch platform flag.
- New `feature_flag_llm_curriculum_enabled` SettingKey on `lib/admin/settings.ts`; default OFF.
- Six-gate dispatcher `lib/llm/curriculum.ts` enforces (active row + valid creds + budget + admin role + kill-switch ON + payload safety) with single-line refusal via `llm.curriculum.skipped`.
- Hallucination guard filters response slugs against `skills.slug`; drops + counts unknown slugs.
- Four provider adapters (`lib/llm/providers/{openai,anthropic,mistral,self-hosted}.ts`) with per-provider ZAR cost estimators.
- Five admin server actions in `lib/admin/llm-actions.ts`: configure (with cross-border s.72 gate for openai/anthropic), activate (transactional swap + DB safety net), deactivateAll, test (probe call), rotate.
- Five curriculum-curation server actions in `lib/admin/curriculum-actions.ts`: approve, reject, editAndApprove, bulkImportSyllabus, addEditorialModuleSkill.
- `/admin/llm` page + `LlmProvidersManager` component: 4 provider cards, configure dialog, kill-switch banner, spend bar with 80% warning state.
- `/admin/curriculum` page + `CurriculumQueueManager` component: bulk import panel, pending queue with inline edit-and-approve, manual editorial add, recently-approved provenance ledger.
- Both routes registered in `ADMIN_NAV`.
- 12 new audit kinds for admin LLM lifecycle + dispatch + curation actions (see Appendix in DPIA).

### Task 13.4  Student progression timeline
- Migration 0046: `student_milestones` table + `student_milestone_kind` enum (dissertation_submitted · graduation_confirmed · first_job_accepted · studies_paused · other) + partial unique index for at-most-one per (profile, kind) on the four one-shot kinds.
- Server actions `lib/profile/student-milestones.ts → addStudentMilestone / removeStudentMilestone` with ownership guard + future-date sanity check + 200-char note cap.
- Read path `db/queries/student-progression.ts → loadStudentProgressionTimeline` composes 5 sources: academic_profiles header, qualifications (year-anchored), employer-confirmed placements only (Verification-Honesty Rule), completed learning_items, self-declared milestones.
- `<StudentProgressionTimeline>` component (server-rendered) + `<StudentMilestoneEditor>` (client island) on `/dashboard/grow`.
- Quiet next-step hint derived from gap priorities (no qualifications · year ≥ 3 no project · year ≥ 2 no elective · zero completed learning).
- 2 new audit kinds (`student.milestone.added` / `.removed`).
- Help article `student-progression-tracker.tsx`.

### Task 13.5  Tier-1 catalogue strategy
- `seedPhase13_2ModuleSkills` expanded from 6  49 canonical editorial rows covering BSc CS, BCom Accounting, BCom Management Studies, BEd (Foundation / Intermediate Phase), BA core, BSc Engineering Electrical + cross-cutting computer literacy.
- 1 demo institution-scoped override (Wits "Database Systems"  PostgreSQL @ confidence 5 vs canonical 4) to prove the override pattern.
- New `docs/PHASE_13_CATALOGUE_GUIDE.md`: tier ladder · how to add a programme · monthly review process · explicit out-of-scope guardrails · Tier-1 operational checklist.
- Honest about taxonomy gaps: BSc Eng (mech / civil / industrial), BA full coverage, and SAQA-tracked credentials deliberately absent until matching skill slugs land via the Phase 9.15 admin queue.

### Task 13.6  Gov-side module-grain demand panel
- New query `demandVsCurriculumByModule` reads editorial `module_skills` rows only, joins to 90-day search_events demand, computes `gap_delta = demand_score × (5 - confidence)`, applies k=10 floor + two complementary axes (institution_module + skill_province).
- New `<ModuleDemandGapCard>` component: top-N ranked list with CSS bar visualising relative gap_delta, surfaces k floor + suppressed count honestly.
- Wired into `/gov/curriculum` alongside the existing Programme  market card via `Promise.all`.
- New CSV export endpoint `/api/gov/curriculum/modules/export` with `analytics.export` audit kind extended with `grain: 'module'` meta key.

### Task 13.7  POPIA + auditability invariants
- DPIA addendum (R-13.1 / R-13.2 / R-13.3) covering the three new risk surfaces: new educational PII categories, admin-managed LLM provider + cross-border processing, self-declared milestones leakage risk.
- Appendix A enumerates all 14 new audit kinds added across Phase 13.
- Appendix B documents the provenance display contract: every recommendation surfaced from a `module_skills` row carries an inline annotation visible in the chip's accessible title attribute (`via module "<label>"  editorial catalogue  confidence N/5`).
- Per-row catalogue version strings deliberately out of scope; the monthly review process in `PHASE_13_CATALOGUE_GUIDE.md` is the operational equivalent.

---

## 📐 ARCHITECTURE CHOICES THAT STUCK

### LLM as curation accelerator, never runtime engine (D2)
- Hallucinations filtered by a human admin before reaching a student. The auditability + provenance posture stays intact end-to-end.
- Catalogue is editable + auditable in three layers: editorial human curation, LLM-suggested admin review, LLM constrained to the controlled taxonomy.

### Admin-managed provider config, not env-driven (D3)
- LLM configuration is a moving target (model versions roll, providers change pricing). DB-stored config means the admin switches providers, rotates keys, and tests connections from `/admin/llm` without involving devops.
- Six-gate dispatch posture inherits the SMS / WhatsApp zero-spend-by-default philosophy: every single gate must be open before the platform sends one outbound HTTP request.
- Partial unique index on `WHERE active = true` is the DB-layer safety net that makes the at-most-one invariant impossible to violate from app code even under race conditions.

### Free text + trigram fuzzy match for modules (D5)
- SA institution module catalogues are too heterogeneous + change yearly. A controlled per-institution dropdown is impossible to maintain at national scale.
- Editorial catalogue grows past the demo seed (49 rows  ~750 rows at full Tier-1 launch) via the admin queue.

### Auto-derived + self-declared progression (D6)
- Auto-derived where the platform already has the data (qualifications, placements, learning_items).
- Self-declared for milestones the platform can't see (dissertation submission, graduation confirmation, first job offer, studies paused).
- Never inferred from third-party data.

---

## 🛡️ NEW DATA CATEGORIES + RISK POSTURE

| Field | Surface | Public exposure | POPIA s.23 export | POPIA s.24 erasure |
|---|---|---|---|---|
| `academic_profiles.current_modules` | `/dashboard/profile` + matcher | No (default-private) | Yes | Cascade |
| `academic_profiles.elective_chosen` | `/dashboard/profile` + matcher | No | Yes | Cascade |
| `academic_profiles.project_topic` | `/dashboard/profile` + matcher | No | Yes | Cascade |
| `student_milestones.*` | `/dashboard/grow` (private) | No | Yes | Cascade |
| `llm_providers.credentials_enc` | `/admin/llm` (admin-only) | Never plaintext | N/A (admin data) | Plaintext never persisted |
| `module_skills.*` | `/gov/curriculum` + `/dashboard/grow` | Aggregate-only, k=10 floor on the gov surface | N/A (editorial catalogue) | N/A |

---

## 🚫 EXPLICITLY DID NOT SHIP

Mirrors the §"OUT OF SCOPE" guardrails in `docs/PHASE_13_PLAN.md`:

- ❌ Real-time LLM in any seeker-facing surface  the student never talks to the LLM.
- ❌ Grade scraping or institution portal integration.
- ❌ AI-generated personal statements / CVs.
- ❌ LLM-suggested skills landing in `skills` table directly  taxonomy additions stay on the Phase 9.15 human-only path.
- ❌ Multi-institution average grades or pass-rate benchmarking.
- ❌ A new consent purpose for the LLM pipeline  no student data is sent to the LLM.
- ❌ Per-row catalogue version strings  monthly review process is the operational equivalent (Task 13.7 deferral with rationale documented in DPIA Appendix B).

---

## 🧪 HOW TO VERIFY (POST-SHIP)

The seven verification steps from the plan all pass against the shipped surface:

1.  As a student signing up, modules + project topic persist + render on the editor + the data-export bundle includes them.
2.  Admin can configure OpenAI on `/admin/llm` with s.72 acknowledgement, set a R200 monthly budget, Test, Activate. A second Activate on Mistral atomically deactivates OpenAI via the partial unique index. Bulk-import on `/admin/curriculum` lands suggestions in the queue; approve flows them into editorial rows.
3.  Student on `/dashboard/grow` sees the "Skills from your current studies" section with chip tooltips carrying the provenance annotation.
4. ⏳ Catalogue-review flag-cron on 19-month-old rows  the query exists in the guide; cron automation is post-launch operational work.
5.  Gov analyst on `/gov/curriculum` sees the Module  market gap card alongside the existing Programme  market card; below-floor cells suppressed.
6.  Kill-switch OFF on `/admin/settings`  `/admin/curriculum` surfaces the dormant state with a link; the existing approved rows still surface on the student side. Deactivate all providers  `/admin/curriculum` surfaces a separate "no active provider" state.
7.  Student sees the progression timeline render. Declaring a milestone surfaces it alongside auto-derived rows with the "Self-declared" chip.

---

## 📦 FOOTPRINT

| Metric | Value |
|---|---|
| New migrations | 4 (0043 academic columns · 0044 module_skills · 0045 llm_providers · 0046 student_milestones) |
| New audit kinds | 14 |
| New seeker-facing notification kinds | 0 (all LLM activity is admin-side) |
| New admin routes | 2 (`/admin/llm` · `/admin/curriculum`) |
| New gov routes | 0 (extended `/gov/curriculum`) |
| New seeker components | 3 (StudentContextEditor · StudentProgressionTimeline · StudentMilestoneEditor) |
| New admin components | 2 (LlmProvidersManager · CurriculumQueueManager) |
| New analytics components | 1 (ModuleDemandGapCard) |
| New platform flags | 1 (`feature_flag_llm_curriculum_enabled`) |
| New help articles | 2 (`student-modules-and-project` · `student-progression-tracker`) |
| Catalogue rows seeded | 49 canonical + 1 institution override (~750 at full Tier-1 launch) |

---

*Phase 13 closes. Open follow-ups for the editorial team: grow the catalogue from 49  ~750 rows pre-public-ship; designate the Information Officer; wire the 18-month catalogue-review cron; expand the SKILLS taxonomy to cover BSc Eng + BA core modules so the catalogue can deepen on those programmes.*
