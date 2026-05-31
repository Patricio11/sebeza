# PHASE 13 PLAN — STUDENT LANE EXPANSION + EDITORIAL-LLM CURRICULUM PIPELINE
*Opens after Phase 12 (Testing & QA) ships. Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/popia/DPIA.md` · `docs/completed/PHASE_9_13_COMPLETE.md` (the Phase 9.13 curriculum-vs-market work this phase builds on).*

> **Thesis:** Sebenza's strongest civic-trust surface is the student lane on `/dashboard/grow`  curriculum vs market demand, programme cohort outcomes, the privacy-floor methodology. Phase 13 expands the lane in two directions: capture the granular signal that programme + field alone don&rsquo;t carry (modules, project topic, elective choices), and scale the curated programme catalogue across SA&rsquo;s actual institution landscape via an editorial LLM pipeline that puts no AI in front of the student. Adds a student-progression tracker so the platform keeps students engaged through their academic journey, not just at sign-up. National-system thinking from commit one.

---

## 🎯 GOAL

After Phase 13 ships, a student gets recommendations that reflect what they&rsquo;re *actually* studying:

- **Captured at sign-up + editable from `/dashboard/profile`**: modules they&rsquo;re currently doing, electives they chose, project / dissertation topic (3rd+ year only).
- **Matched against an editorially-curated `module_skills` catalogue** that covers the top 5 SA graduate-volume programmes at launch and grows admin-side from there.
- **The admin editorial pipeline uses LLM as a curation accelerator**, not a runtime engine. Admin pastes a module syllabus; LLM suggests skill-tag candidates against the controlled taxonomy; admin reviews and publishes. Same pattern as the Phase 9.15 taxonomy-suggestions queue. Student-facing recommendations stay auditable end-to-end.
- **Progression tracker** surfaces the student&rsquo;s academic journey as a private timeline on `/dashboard/grow`  current year + GPA-style indicators (when declared) + auto-derived placement / verification events + self-declared milestones. The student sees themselves moving forward; the platform earns retention.

Built for SA national scale: Tier-1 launch covers the five highest-volume undergraduate programmes (BSc CS, BCom, BEd, BA, BSc Eng), Tier-2 expansion covers TVET + UNISA + INDLELA pathways.

---

## 🧱 WHAT ALREADY EXISTS (build on, don&rsquo;t rebuild)

- **`academic_profiles` table**  programme, fieldOfStudy, nqfLevel, institutionSlug, currentYear, expectedGraduation, nsfas, openToInternships, openToGraduateProgrammes. The capture surface is already there; we extend it.
- **`programme_skills` table** (Phase 9.13)  hand-curated programme &rarr; skill mapping. 44 rows across 8 institutions &times; 5 programme archetypes.
- **`demandVsCurriculumQuery`**  the read path that intersects programme_skills with 90-day search-event demand. We add module-level depth + reuse the existing intersection logic.
- **`<ProgrammeVsMarketCard>`**  the student-side render of the result. Stays; gains module-level rows.
- **Taxonomy-suggestions admin queue** (Phase 9.15)  the canonical pattern for &ldquo;admin reviews user-generated or LLM-generated rows before they reach the platform&rdquo;. The new module-curation surface mirrors it exactly.
- **Audit log + DPIA infrastructure** (Phase 0)  every LLM dispatch, every admin curation action, every student data field touched gets a row.
- **Skill taxonomy** (Phase 0)  the controlled set of canonical skills. LLM matches against this set, never invents new tags.

---

## 📋 TASKS

### Task 13.1: Module + project + elective capture

**Scope.** Three additive fields on `academic_profiles`, exposed via the student-mode block in sign-up and the academic section of `/dashboard/profile`. All three are **optional**  students who don&rsquo;t fill them in still see programme-level recommendations as today.

**Data shape.**

```sql
ALTER TABLE academic_profiles
  ADD COLUMN current_modules     text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN elective_chosen     text,
  ADD COLUMN project_topic       text;
```

**Field-by-field.**

- **`current_modules`**  multi-tag input (chip field), capped at 8 entries. The UI uses the same `MultiSelectComboboxField` pattern from Phase 9.15 with `allowOther` enabled  modules go straight to free text since per-institution module catalogues are huge. A nightly normalisation cron writes a slugified version into a sibling column for fuzzy match.
- **`elective_chosen`**  single free-text. Surfaced only when `currentYear >= 2`.
- **`project_topic`**  single free-text, 200-char cap. Surfaced only when `currentYear >= 3`.

**Why these three.** Modules are concrete (what you&rsquo;re doing); elective is intentional (what you chose when you had options); project topic is the strongest skill signal a final-year can give (single sentence describes 5+ skills cleanly). &ldquo;Favourite module&rdquo; is deliberately NOT a field per D1: the signal is too noisy + survey-fatigue cost is high.

**UI placement.** Inside the existing student-mode block. We do not split into a separate sign-up step  the new fields add ~30 seconds to the form, not a new page.

**POPIA.** New educational PII categories. DPIA addendum + export + erasure include all three.

- [ ] Migration: 3 columns + 1 GIN index on `current_modules` for the fuzzy-match read path.
- [ ] Update `signUpSeeker` + `/dashboard/profile` academic editor to capture all three.
- [ ] `MyProfile.academic` shape gains the three fields.
- [ ] Data export bundle includes them.
- [ ] One help article: `content/help/seeker/profile/student-modules-and-project.md`.

---

### Task 13.2: `module_skills` catalogue table + read path

**Scope.** New table mirroring `programme_skills`, populated by the editorial pipeline in Task 13.3.

**Data shape.**

```sql
CREATE TABLE module_skills (
  id              text PRIMARY KEY,
  module_slug     text NOT NULL,
  module_label    text NOT NULL,
  skill_slug      text NOT NULL REFERENCES skills(slug) ON DELETE CASCADE,
  confidence      smallint NOT NULL DEFAULT 3,   -- 15, editorial
  source          text NOT NULL,                 -- 'editorial' | 'llm_suggested' | 'student_signal'
  approved_by     text REFERENCES app_user(id),
  approved_at     timestamp,
  institution_slug text REFERENCES institutions(slug),  -- NULL = cross-institution canonical
  UNIQUE(module_slug, skill_slug, institution_slug)
);

CREATE INDEX idx_module_skills_by_module ON module_skills(module_slug);
```

**Read path.**

```ts
// db/queries/curriculum.ts (extend the existing surface)
export async function moduleSkillsForStudent(profileId: string): Promise<{
  fromModules: SkillRef[];
  fromProject: SkillRef[];
  fromElective: SkillRef[];
}>;
```

The read path matches the student&rsquo;s module strings against `module_label` via trigram similarity (existing `pg_trgm` extension), prefers institution-scoped rows when present, falls back to canonical cross-institution rows. Project + elective text matches against the canonical `skill_synonyms` map via the same trigram path.

**Renders into the existing `<ProgrammeVsMarketCard>`** as a new section: &ldquo;Skills inferred from your current modules&rdquo;. Same suppression posture as the programme-level read; nothing surfaces below the existing `outcomes_min_cohort_size` floor.

- [ ] Migration: new table + index.
- [ ] Read helpers in `db/queries/curriculum.ts`.
- [ ] Extend `<ProgrammeVsMarketCard>` with the module section.

---

### Task 13.3: Editorial LLM curriculum-curation pipeline (admin-only)

**Scope.** The slot where LLM legitimately fits  bootstrapping the `module_skills` catalogue at scale, with a human admin in the loop before any row reaches the student.

**Surface.** New `/admin/curriculum` page with three views:

1. **Catalogue queue**  table of pending `module_skills` rows from LLM suggestions, each with: module label, suggested skill slug, LLM-extracted rationale (1 sentence), confidence (15), admin actions (Approve / Reject / Edit-and-approve / Defer).
2. **Bulk-import**  admin pastes a programme curriculum or syllabus document (PDF text or plain text). The platform sends it to the configured LLM provider; the response is parsed into candidate `(module_label, skill_slug, confidence, rationale)` rows + lands in the catalogue queue.
3. **Provenance ledger**  every approved row carries `approved_by` + `approved_at`. The ledger view filters by date, admin, source. Mirrors the Phase 9.15 taxonomy-suggestions admin queue 1:1.

**LLM provider abstraction (dormant by default).** Mirrors the SMS / WhatsApp posture from Phase 11.4.4 exactly:

- `lib/llm/curriculum.ts` with a single `suggestModuleSkills({ syllabusText })` interface.
- Provider env-switched: `LLM_PROVIDER=openai | anthropic | mistral | self_hosted | console | disabled`. Default `disabled`. Same six-gate dispatch posture: admin platform flag + provider env + per-admin opt-in.
- **Zero spend until admin enables.** The `disabled` transport returns a clearly-labelled error so the admin knows the curation tool isn&rsquo;t wired yet.
- **Self-hosted (Llama 3 / Mistral)** is the runbook-recommended path; OpenAI / Anthropic are env-configurable but trigger a cross-border-processing POPIA s.72 notice on the admin curation page.

**Per-LLM-call audit.** `llm.curriculum.suggest` audit row per call: caller, provider, token count, suggestion count, syllabus-text SHA-256 hash (never the text itself). Cost is enumerated in a monthly admin dashboard panel.

**Hallucination guard.** The LLM is constrained to suggest skills only from the existing controlled taxonomy slugs. A response containing a skill slug not in `skills` is dropped silently with an audit row. We never let the LLM invent new skill tags  that flows through the existing Phase 9.15 taxonomy-suggestion queue, which is a human-only path.

**POPIA.** New &ldquo;editorial catalogue enrichment&rdquo; processing purpose on DPIA. No student PII goes to the LLM  the input is generic syllabus / module text from publicly-available academic documents.

- [ ] Migration: per-call audit kinds.
- [ ] `lib/llm/curriculum.ts` provider abstraction.
- [ ] `/admin/curriculum` queue + bulk-import + provenance views.
- [ ] 3 new feature flags (`feature_flag_llm_curriculum_enabled`, `_provider`, `_monthly_budget_zar`).
- [ ] DPIA addendum.

---

### Task 13.4: Student progression tracker

**Scope.** A new private surface on `/dashboard/grow` that shows the student where they are in their academic journey + maps that to platform-side outcomes. Mix of auto-derived events + self-declared milestones.

**Auto-derived from existing data.**

- `academic_profiles.currentYear` + `expectedGraduation`  derives &ldquo;Year 2 of 4, ~18 months to graduation&rdquo;.
- `qualifications.verified_at` per qualification  &ldquo;Mathematics 1 verified Sept 2026&rdquo; etc.
- `placements.confirmed` rows  &ldquo;Internship at Yoco confirmed Jan 2027&rdquo;.
- `learning_items.state='completed'`  &ldquo;Completed: SQL Fundamentals via Sebenza&rsquo;s Career Compass&rdquo;.

**Self-declared milestones (new table `student_milestones`).** The student can mark milestones the platform can&rsquo;t derive: dissertation submitted, graduation date confirmed, first job offer accepted (which the platform may or may not have confirmed via Mark-as-Hired).

**Surface.** A new `<StudentProgressionTimeline>` component, vertical timeline on phones + horizontal on `md+`. Civic-Editorial typography: ordinal year numerals (Year 1 / Year 2 / Year 3), small status chips, no progress-bar gamification. Each row carries the source (auto / self-declared) so the student can see how the platform knows what it knows.

**Retention hook.** The page&rsquo;s eyebrow line surfaces the next-milestone prompt: &ldquo;You&rsquo;re in Year 2  the platform sees 3 verified subjects + 1 module completed via Career Compass. Next: declare your elective + check in on your dissertation topic.&rdquo; Quiet nudge, not pressure.

- [ ] Migration: `student_milestones` table.
- [ ] `<StudentProgressionTimeline>` component.
- [ ] Compose read from existing tables + the new milestones table.
- [ ] One help article: `content/help/seeker/profile/student-progression-tracker.md`.

---

### Task 13.5: National-scale catalogue strategy

**Scope.** The catalogue starts small and grows editorially. We don&rsquo;t pretend to ship Day 1 with every SA institution covered.

**Tier 1 launch** (admin-curated before public ship):
- BSc Computer Science (Wits + UCT + Stellenbosch + UJ + UP)
- BCom (Accounting, Economics, Management Studies)
- BEd (Foundation Phase, Intermediate Phase, FET)
- BA (Humanities core programmes)
- BSc Engineering (Civil + Mechanical + Electrical + Industrial)

Five programmes &times; ~30 core modules each &times; ~5 skill mappings per module = ~750 rows of curated catalogue. Achievable in ~4 weeks of editorial + LLM-assisted work.

**Tier 2 expansion** (post-launch, ongoing):
- TVET diplomas (using `programme_kind='tvet'` from existing taxonomy).
- UNISA distance-learning programmes (different module structure  one module = one credit-bearing unit).
- INDLELA artisan tradetests + trade-theory subjects.

**Institution-specific overrides.** When the same module label maps to materially different skill sets at two institutions (Wits&rsquo; &ldquo;Database Systems&rdquo; teaches PostgreSQL deeply; UCT&rsquo;s teaches MongoDB), admin curates institution-scoped rows on `module_skills.institution_slug`. The read path prefers institution rows; falls back to canonical.

**Editorial governance.** A monthly catalogue review: rows older than 18 months get flagged for re-validation against the current syllabus. Mirrors the editorial sweep posture for `LearningPath` URLs from Phase 11.2.1.

- [ ] Tier-1 catalogue seed (admin-driven).
- [ ] Documentation on adding a new programme to the catalogue.
- [ ] Monthly catalogue review process documented.

---

### Task 13.6: Demand-vs-curriculum panel for the gov side

**Scope.** When the catalogue grows past Tier 1, the gov-side `/gov/curriculum` page (Phase 9.13) gains a new dimension  per-module gap analysis.

**Why now.** A gov policy analyst evaluating where curriculum-to-market gaps are widest can&rsquo;t fix it at the programme level alone  curriculum committees set MODULES, not programmes. The module-level breakdown makes the gap actionable for the people who can change it.

**Implementation.** New query function in `db/queries/curriculum.ts`: `demandVsCurriculumByModule({ province, profession })`. Returns top-N modules with the largest skill-gap delta vs current employer demand. Surfaces in a new card on `/gov/curriculum`. Same k=10 suppression posture as every other gov surface.

- [ ] Query function.
- [ ] Gov-side render.
- [ ] CSV export endpoint.
- [ ] Compliance assertion: module-level cells respect the same suppression floor.

---

### Task 13.7: POPIA + auditability invariants

**Scope.** The new data categories + LLM pipeline require explicit POPIA documentation and audit-trail hardening.

**DPIA addendum.**
- New PII categories: `current_modules`, `elective_chosen`, `project_topic`, `student_milestones.note`. Processing purpose: education-to-employment transition support.
- New cross-border-processing notice when admin enables an external LLM provider (OpenAI / Anthropic). Self-hosted path is the recommended POPIA-clean default.
- Retention posture: same as the rest of `academic_profiles`. Erasure flow (POPIA s.24) removes all new fields.

**Audit kinds.**
- `student.modules.update` / `student.project.update` / `student.elective.update`  per-field write events.
- `student.milestone.added` / `student.milestone.removed`.
- `admin.curriculum.module_skill.approved` / `.rejected` / `.edited`  every editorial action on the catalogue.
- `llm.curriculum.suggest` / `.failed`  every LLM call.
- `admin.llm.budget.alert`  when the monthly spend crosses 80% of the configured threshold.

**Provenance display.** Every recommendation on the student&rsquo;s Career Compass that originated from a `module_skills` row carries a small inline annotation: &ldquo;via module X (catalogue v2026.10)&rdquo;. The student can see *how* the recommendation was derived; an admin can audit which catalogue version surfaced it.

- [ ] DPIA addendum.
- [ ] All 7 audit kinds.
- [ ] Provenance annotations on Career Compass cards.

---

## 🚫 OUT OF SCOPE FOR PHASE 13 (explicit guardrails)

- ❌ **Real-time LLM in any seeker-facing surface.** The student never talks to the LLM. The trust contract this protects is the platform&rsquo;s single biggest differentiator; we don&rsquo;t break it for an incremental dynamic-recommendations win.
- ❌ **Grade scraping or institution portal integration.** Per-institution APIs don&rsquo;t reliably exist; even where they do, ingesting grades creates a new PII category with no proportional gain. Self-declared GPA can land in Phase 14 if students ask for it.
- ❌ **AI-generated personal statements / CVs.** Adjacent to legal copy (hiring discrimination case law); explicit POPIA s.71 concern around automated decision-making.
- ❌ **LLM-suggested skills landing in `skills` table directly.** Skill taxonomy additions stay on the Phase 9.15 admin human-only path. LLM operates downstream of the canonical taxonomy, never on it.
- ❌ **Multi-institution average grades or pass-rate benchmarking.** Re-identification risk for small cohorts; gov surfaces already handle aggregate cohort outcomes via k=10 suppression.
- ❌ **A new consent purpose specifically for the LLM pipeline.** The student doesn&rsquo;t consent to anything new here  no student data is sent to the LLM. The LLM processes generic syllabus text. POPIA s.11(1)(b) (performance of contract) covers the rest.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Module / project / elective fields are optional, never required. | Survey fatigue at sign-up costs more than the marginal signal we&rsquo;d gain by forcing completion. Programme + field already give us a useful baseline. |
| D2 | LLM is admin-side editorial only. | Hallucinations get filtered by a human before reaching a student. The auditability + provenance posture stays intact end-to-end. |
| D3 | LLM provider env-configurable + dormant by default. | Mirrors the SMS / WhatsApp posture from Phase 11.4.4 exactly. Zero spend until admin enables; self-hosted is the POPIA-clean recommended path. |
| D4 | LLM constrained to suggest from the existing skill taxonomy. | New skill tags stay on the Phase 9.15 human-only admission path. LLM operates downstream of the canonical taxonomy. |
| D5 | Module text capture is free text + trigram fuzzy match, not a controlled per-institution dropdown. | SA institution module catalogues are too heterogeneous + change yearly; a controlled list is impossible to maintain at national scale. Free text + fuzzy match is the right granularity. |
| D6 | Student progression tracker is a mix of auto-derived + self-declared. | Auto-derived where we already have the data (qualifications, placements, learning items); self-declared for milestones the platform can&rsquo;t see (graduation, first job offer). Never inferred from third-party data. |
| D7 | Catalogue versions are annotated on every recommendation. | Provenance for the student + audit for the admin. When the catalogue updates, the student can see which version surfaced a given recommendation. |
| D8 | Tier-1 launch covers 5 programmes; expansion is editorial. | We don&rsquo;t pretend national-day-1 coverage; we ship Tier 1 well and grow honestly. |

---

## 🧪 HOW TO VERIFY

1. As a student signing up, enter modules + a project topic. Confirm the fields persist + render on the profile editor + the data-export bundle includes them.
2. As an admin on `/admin/curriculum`, paste a BCom Accounting 1 syllabus. Confirm the LLM call returns suggestions; approve a row; verify it lands in `module_skills` + an audit row writes.
3. As the student from step 1, open `/dashboard/grow`. Confirm the &ldquo;Skills inferred from your current modules&rdquo; section renders + carries the catalogue-version annotation.
4. Manually trigger the catalogue-review flag-cron on a 19-month-old row. Confirm the admin queue shows it for re-validation.
5. As a gov analyst on `/gov/curriculum`, confirm the module-level gap analysis surfaces top modules where curriculum + market diverge. Confirm cells below the k=10 floor are suppressed.
6. Flip `feature_flag_llm_curriculum_enabled` OFF in admin settings. Confirm the admin curation page surfaces the dormant &ldquo;Provider not enabled&rdquo; state + the read path on the student side still works using existing approved rows.
7. As the student, see the progression timeline render. Self-declare a milestone (&ldquo;Dissertation submitted&rdquo;); confirm it appears + the auto-derived qualifications + placements appear alongside.

---

## 📦 PROBABLE FOOTPRINT

Rough order-of-magnitude estimate, for comparison with Phase 11 sub-phases:

- 1 new migration (4 columns on `academic_profiles` + 2 new tables).
- 11 new audit kinds.
- 0 new seeker-facing notification kinds (all LLM activity is admin-side).
- 1 new admin route (`/admin/curriculum`).
- 1 new admin-side dispatcher (`lib/llm/curriculum.ts`).
- 1 new component (`<StudentProgressionTimeline>`).
- 3 new feature flags (LLM enabled, provider, monthly budget).
- ~750 catalogue rows at Tier-1 ship.

Comparable in scope to Phase 11.4 (which shipped 38 files / +3,337 lines).

---

*Plan opens for Phase 13. Target: ship Tier-1 catalogue + capture + admin pipeline within 6 working weeks of Phase 12 (Testing & QA) completion. Tier-2 expansion is ongoing editorial work that runs post-launch.*
