# PHASE 13.5  MODULE_SKILLS CATALOGUE GUIDE

*Companion to `PHASE_13_PLAN.md`. The operational playbook for editors maintaining the `module_skills` editorial catalogue.*

> The catalogue starts small and grows editorially. We don't pretend to ship Day 1 with every SA institution covered  Tier 1 covers the five highest-volume undergraduate programmes; Tier 2 expansion is post-launch ongoing work.

---

## 🎯 WHAT THE CATALOGUE IS FOR

`module_skills` is the editorial mapping from **module label** → **canonical skill slug** that the student-side `ProgrammeVsMarketCard` uses to infer skills from declared modules. Every row carries:

| Column | Purpose |
|---|---|
| `module_slug` | Stable canonical key. Lowercase-hyphen. |
| `module_label` | Display label. The trigram fuzzy match runs against this. |
| `skill_slug` | FK to `skills.slug`  the canonical taxonomy. **NEVER invent new tags here.** Skill-tag additions stay on the Phase 9.15 admin human-only path. |
| `confidence` | 1–5 editorial confidence. 5 = central to the module, 1 = touched briefly. Influences ranking + tiebreaks. |
| `source` | `editorial` (admin curated) · `llm_suggested` (Task 13.3 pipeline output) · `student_signal` (reserved). |
| `institution_slug` | NULL = canonical cross-institution. Set = scoped to one institution; the read path prefers the institution row over canonical when both exist. |
| `approved_by` / `approved_at` | Editorial provenance for the audit trail. Editorial rows always have these set; `llm_suggested` rows have NULL until an admin reviews. |

The read path lives in `db/queries/curriculum.ts` (`moduleSkillsForStudent`). It excludes `llm_suggested` rows by default  those land only on the admin review queue at `/admin/curriculum` until approved.

---

## 🪜 TIER LADDER

### Tier 1 (the launch covered surface)

Five programmes × ~30 core modules each × ~5 skill mappings per module ≈ **~750 catalogue rows**.

- **BSc Computer Science**  Wits, UCT, Stellenbosch, UJ, UP
- **BCom**  Accounting, Economics, Management Studies
- **BEd**  Foundation Phase, Intermediate Phase, FET
- **BA**  Humanities core programmes
- **BSc Engineering**  Civil, Mechanical, Electrical, Industrial

The seed (`db/seed.ts → seedPhase13_2ModuleSkills`) ships a demo skeleton of ~50 rows covering the most common modules  enough to prove the read path renders content for the seeded BSc CS + BCom Honours Accounting students. The catalogue grows to the full ~750 rows editorially before public ship.

### Tier 2 (post-launch ongoing)

- **TVET diplomas** (using `programme_kind='tvet'` from the existing taxonomy)
- **UNISA distance-learning programmes** (different module structure  one module = one credit-bearing unit, not three)
- **INDLELA artisan tradetests + trade-theory subjects**

Tier 2 expansion has no fixed deadline. New programmes land as editorial bandwidth allows; the platform reads the rows as soon as they're approved.

### Tier 3 (case-by-case)

- Postgraduate-only programmes
- Cross-institution joint degrees (e.g. UCT–Stellenbosch MBA)
- Niche professional certifications (CIMA, ACCA pathways)

---

## ➕ ADDING A NEW PROGRAMME

### 1. Identify the canonical module set

Pull the official syllabus / programme handbook from the institution's prospectus. Most universities publish PDF programme structures publicly. The module list is institution-specific in detail but the **core modules** (the compulsory ones every student takes) tend to converge across institutions.

Aim for **the ~30 most common modules** across the programme's lifetime. Outliers (one institution's one-off elective) land later if/when a student declares them; don't try to seed the long tail.

### 2. Curate the skill mappings

For each module, list which `skills.slug` rows the module legitimately teaches. **Three rules of thumb**:

- **Skills must already exist in the `skills` taxonomy.** If a module teaches something the taxonomy doesn't cover yet (e.g. "thermodynamics" for a BSc Mech module), the right move is to add the skill via the Phase 9.15 admin queue first, THEN catalogue. NEVER invent skill slugs inside `module_skills`.
- **Confidence is editorial honest, not optimistic.** A "Software Engineering" module that spends one week on React deserves confidence 2, not 5. The student sees the confidence score; over-claiming erodes trust.
- **Five mappings per module is the soft cap.** A module that maps to fifteen skills is probably a survey course  only the central ones matter for the matcher. Surface the top 3-5; let the long tail sit on the floor.

### 3. Pick the curation path

**Manual editorial add** is fastest for ≤ 20 rows: `/admin/curriculum → Add by hand`. Each row writes `source='editorial'` + `approved_by = <admin id>` + `approved_at = now()`.

**Bulk import** is the right tool when the syllabus PDF is at hand. Paste the syllabus text into `/admin/curriculum → Bulk import`, let the active LLM provider suggest rows, then approve them one by one. Same editorial outcome (rows land as `editorial` after approval), but the LLM does the labour of reading the syllabus and proposing the mappings.

### 4. Institution-specific overrides

When the same module label maps to materially different skill sets at two institutions, curate an institution-scoped row. Example shipped in the seed: Wits "Database Systems" teaches PostgreSQL at confidence 5; the canonical cross-institution row pins it at 4. The read path prefers the institution row when the student's `academic_profiles.institution_slug` matches.

**Don't over-use institution overrides.** The canonical row is the default for a reason  most module-skill mappings converge across SA institutions teaching the same subject. Override only when there's a *real* curriculum divergence, not stylistic syllabus differences.

---

## 🔄 MONTHLY CATALOGUE REVIEW

Mirrors the editorial sweep posture for `LearningPath` URLs from Phase 11.2.1.

**Cadence:** monthly, on the first working day. Owner: the team member rotating into the editorial duty for the month (rotation tracked in `docs/EDITORIAL_ROTATION.md` when ops grows past three editors).

### The four-step review

1. **Flag rows older than 18 months.** Query: `SELECT * FROM module_skills WHERE approved_at < now() - interval '18 months' AND source = 'editorial'`. These rows are stale-eligible  their syllabus may have changed since approval.
2. **Pull the current syllabus** for each flagged module. Programme handbooks update yearly; the module the editor curated in 2024 may have been restructured in 2026.
3. **Decide: keep, edit, or retire.**
   - **Keep**: re-stamp `approved_at = now()` (the admin "Edit-and-approve" flow does this implicitly even when no fields change).
   - **Edit**: adjust the confidence / skill set; the audit row carries `changedFields` so the trail is intact.
   - **Retire**: delete the row when the module has been removed from the programme. The cascade leaves the audit history in place.
4. **Spot-check the high-confidence rows.** Pick five `confidence = 5` rows at random; verify they still describe the central content. High-confidence rows feed the strongest recommendations  they earn the highest scrutiny.

### What the review explicitly does NOT do

- **Doesn't sweep `llm_suggested` rows.** Those expire when an admin rejects them; they don't have an `approved_at` to age out against. The review is editorial-rows only.
- **Doesn't re-validate by running another LLM pass.** Each catalogue version is the editor's judgement. The LLM is a curation accelerator, not the source of truth.

---

## 🚫 OUT OF SCOPE FOR THE CATALOGUE

- ❌ **Per-institution course catalogues at full granularity.** SA institution module catalogues are too heterogeneous + change yearly; a controlled list of every module at every institution is impossible to maintain at national scale. The trigram fuzzy match on `module_label` is the right granularity.
- ❌ **Module grade / pass-rate data.** The catalogue is about *which skills a module teaches*, not *how well students perform in it*. Performance data is downstream of the curriculum mapping.
- ❌ **Real-time LLM lookups for unseen modules.** When a student declares a module the catalogue doesn't cover yet, the matcher silently skips it  no error, no nudge. Programme-level recommendations still surface. The growth path is editorial, not runtime.
- ❌ **Student-facing catalogue editing.** Students declare modules on their profile; they don't curate the mapping. Catalogue curation is admin-only.

---

## 📋 OPERATIONAL CHECKLIST FOR THE TIER-1 PUSH

Before public ship of the catalogue surface on `/dashboard/grow`:

- [ ] All five Tier-1 programmes have ≥ 25 curated canonical rows.
- [ ] At least three institution-specific overrides exist (proves the override pattern works in production, not just in tests).
- [ ] Editorial-rotation doc names the owner for month 1.
- [ ] The 18-month review query is wired into a monthly admin reminder (no automation yet; calendar invite).
- [ ] DPIA addendum names "editorial catalogue enrichment" as a processing purpose (Task 13.7).
- [ ] Help article `student-modules-and-project.tsx` references the catalogue ("the matcher intersects them with this catalogue").
- [ ] LLM bulk-import has been used at least once end-to-end on a real syllabus, including the s.72 acknowledgement flow.

---

*Plan opens for editorial Tier-1 expansion. Target: full ~750 rows in editorial review within 4 weeks of Phase 13.3 ship. Tier 2 expansion runs ongoing.*
