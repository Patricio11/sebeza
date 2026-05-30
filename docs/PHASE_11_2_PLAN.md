# PHASE 11.2 PLAN — LEARNING LOOP COMPLETION (SKILL-GROWTH CONVERSION)
*Opens after Phase 11.1. Companion docs: `PHASE_11_PLAN.md` · `docs/completed/PHASE_9_12_COMPLETE.md` (Learning Loop) · `docs/completed/PHASE_9_13_COMPLETE.md` (Curriculum) · `UX_UI_SPEC.md`.*

> **Thesis:** Career Compass (Phase 9.12 + 9.13) tells seekers what to learn, surfaces learning paths, captures abandon reasons for gov analytics. But it doesn't actually help them click through to the course, doesn't surface a free alternative when they abandon for cost, and doesn't reward completion with a verified credential. The learning loop is ornamental until those three holes close.

---

## 🎯 GOAL

Phase 11.2 makes the Learning Loop **load-bearing**: a seeker who reads a recommendation on `/dashboard/grow` can click through to the actual course, swap to a free alternative when cost is a blocker, and upgrade their completion from `self_attested_learning` to `verified_provider` by uploading the certificate when they finish. Together these three tasks change the loop from "the platform suggests; the seeker fends for themselves" to "the platform suggests, helps, and verifies."

The remaining tasks close smaller adjacent gaps: an "interested" parking-lot state so seekers don't lose warm intent; a skill-journey timeline that shows their actual completed learning; auto-revalidation so the Compass updates immediately when a skill is added; the adjacent-profession "Consider this profession" CTA; the city-demand → search drill-down; and the student-lane discoverability nudge for non-academic seekers who haven't yet recorded their programme.

Together these are surface improvements to existing infrastructure. No new ML, no new chart types, no new compliance surface.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Career Compass query** — `getCompassForProfile(me)` in `db/queries/career-compass.ts`. Returns the headline rank delta, recommendations, learning paths, adjacent professions, city demand.
- **Learning Loop server actions** — `lib/seeker/learning.ts`. Five lifecycle states: `recommended → planned → in_progress → completed → abandoned`. Each lifecycle change writes one audit row + (where appropriate) upgrades `profile_skills.provenance`.
- **Provenance contract** — `profile_skills.provenance` enum: `self_attested`, `self_attested_learning`, `verified_provider`. Phase 9.12 D1 honesty contract: upgrade-only, never downgrade.
- **Qualifications upload flow** — `app/[locale]/(seeker)/dashboard/qualifications/page.tsx`. Already has the file-upload + admin-review path. Setting `provenance='verified_provider'` requires the admin verification step.
- **Curriculum-vs-market** — Phase 9.13. Reads from `db/queries/curriculum.ts`; renders `<ProgrammeVsMarketCard>` in the student lane.
- **City demand** — Phase 9.12 part of `CompassSnapshot`. Already rendered as the city-demand table on `/dashboard/grow`.
- **Adjacent professions** — Phase 9.12. Already rendered as cards on `/dashboard/grow`.
- **Search page** — `/search` accepts query parameters: `?skill=javascript&province=gauteng`.

---

## 📋 TASKS

### Task 11.2.1: LearningPath URL — close the conversion gap

**Scope.** Today `LearningPath` carries `provider`, `providerKind`, `durationWeeks`, `cost`, `costNote`, `outcome`, `unlocksSkills`, `national`. It does **not** carry a URL. A seeker reads "MICT SETA Software Development NQF 5", is sold on it, and has to Google their way to the application page. Half of them drop off there.

This task adds `url?: string` to the `LearningPath` interface; renders it as a primary CTA button on each `<LearningPathCard>`; backfills URLs for the most-trafficked paths in `lib/mock/growth.ts`; and adds a "Verified by Sebenza" chip to paths that go through a curated provider we trust (SETA, TVET, public university).

**Why now.** Single biggest seeker-side conversion gap on the entire platform. Three lines of code + a content sweep.

**Data shape.**

```ts
export interface LearningPath {
  title: string;
  provider: string;
  providerKind: LearningProviderKind;
  durationWeeks: number;
  cost: LearningCost;
  costNote?: string;
  outcome: string;
  unlocksSkills: string[];
  national?: boolean;
  /**
   * Phase 11.2.1  direct URL to the provider's enrolment / application
   * page. When set, the LearningPathCard renders it as the primary CTA.
   * NEVER a redirect URL, NEVER a tracking pixel - direct deep-link to
   * the provider's own page so we don't taint the trust chain.
   */
  url?: string;
  /**
   * Phase 11.2.1  set when Sebenza has reviewed the provider + the
   * specific course. Distinct from `providerKind` (which is taxonomic)
   * - this is the editorial trust signal.
   */
  sebenzaReviewed?: boolean;
}
```

**Content posture.** The URL field is populated only for paths Sebenza has actually visited + verified. Empty URL is honest — better than a stale or wrong link. Operator + editorial review before publish.

**Anti-pattern guard.** Never auto-fetch the URL to verify it's live (would create an outbound traffic profile that Lighthouse + the No-Flash Rule would punish). Stale URLs are caught by quarterly editorial sweep, not by the app.

**UI.** Each `<LearningPathCard>` gets a primary CTA button "Open application" (`<a href={url} target="_blank" rel="noopener noreferrer">`). When `url` is unset, the button is replaced with a quiet hint "Provider link coming  search '{title}' on Google for now". When `sebenzaReviewed` is true, a small "Reviewed" chip sits next to the provider name.

- [ ] Update `lib/mock/growth.ts` — add `url` + `sebenzaReviewed` to `LearningPath`.
- [ ] Backfill URLs for at least 20 of the most-trafficked paths (manual editorial pass).
- [ ] Update `<LearningPathCard>` in `app/[locale]/(seeker)/dashboard/grow/page.tsx` to render the CTA.
- [ ] Audit-log the click: `learning_path.opened` row when seeker clicks the CTA (use a Server Action wrapper, not direct `<a>` — we want the row).
- [ ] One help article: `content/help/seeker/growth/finding-the-right-course.md`.

---

### Task 11.2.2: Free-alternative surfacing on cost-driven abandonment

**Scope.** When a seeker abandons a learning item with reason `too_expensive` (one of the structured `growthReason` values from `lib/seeker/learning-types.ts`), the abandon-confirmation modal surfaces, immediately, the next free or subsidised path that unlocks the same skill. The seeker accepts the alternative in one click; the original abandonment + the new acceptance both audit-log.

**Why now.** The largest skill-equity win available. Today the abandon-reason capture is gold for gov analytics but a dead end for the seeker: they hit a wall, the platform records the wall, nothing happens. Surfacing the free alternative inline closes the loop.

**Logic.**

```ts
// lib/seeker/free-alternatives.ts (new)
export function findFreeAlternativeForSkill(
  skillSlug: string,
  excludePathIdsAlreadyAbandoned: string[],
): LearningPath | null {
  // Read from compass.learningPaths where:
  //   - unlocksSkills includes skillSlug
  //   - cost === "free" || cost === "subsidised"
  //   - path id not in the exclude list
  // Order by: prefer "national" providers, then shortest durationWeeks.
}
```

**UX flow.**
1. Seeker on `/dashboard/grow` clicks "Abandon" on a planned learning item.
2. Modal: "Why?" with structured reasons.
3. Seeker picks `too_expensive` → modal expands inline with a follow-up section:
   - "Here's a free alternative for the same skill: **[free path title]** ({duration} weeks, {provider})"
   - Two buttons: "Accept this instead" (server action: abandon the original + accept the alternative atomically) / "Just abandon for now"
4. On "Accept this instead": both audit rows write, one notification fires (`learning.swapped_to_free`), the page revalidates.

**Edge case.** If no free alternative exists for the skill, the modal closes normally — we don't fabricate a fake alternative.

**Notification kind.** `learning.swapped_to_free` — in-app default on, email default off. The notification carries the original path title + the new path title + the cost-driven swap context.

- [ ] New `lib/seeker/free-alternatives.ts`.
- [ ] New atomic server action `swapToFreeAlternative({ abandonItemId, acceptPathId })` in `lib/seeker/learning.ts`.
- [ ] Update the abandon-confirmation modal in `<AbandonLearningButton>` to surface the inline alternative.
- [ ] New notification kind.
- [ ] One help article: `content/help/seeker/growth/cost-and-free-alternatives.md`.
- [ ] DPIA row: this introduces a new derived event (`learning.swapped_to_free`) but no new data category.

---

### Task 11.2.3: Completion → verified-cert upload bridge

**Scope.** When `completeLearningItem` succeeds, the success toast / next-step card carries a CTA "Got a certificate? Upload it for the verified badge →" linking to the Qualifications upload flow with the skill + provider context pre-filled. Admin review (existing Phase 8 flow) sets `profile_skills.provenance = 'verified_provider'` when the cert clears.

**Why now.** Today completing a learning item upgrades provenance to `self_attested_learning` — better than nothing, but still self-attestation. The seeker has a real cert in their hand by definition (they just completed a course). The bridge to upload it is missing.

**Flow.**
1. Seeker clicks "Mark complete" on a planned learning item.
2. `completeLearningItem` succeeds; modal / page renders the success state.
3. Below the existing "Skill added to your profile" line, a secondary CTA appears: "Got a certificate? Upload it for the verified badge →".
4. CTA links to `/dashboard/qualifications/new?skill={slug}&provider={provider}` — the existing upload flow with the skill + provider name pre-filled (seeker can edit).
5. Upload completes; admin review runs (Phase 8); cert is verified or rejected. On verify, the provenance bumps to `verified_provider`; the seeker gets a `qualification.verified` notification (existing kind).

**Anti-pattern guard.** The cert-upload flow does **not** check the cert against the learning-item's claimed completion. If a seeker abandons a learning item but uploads a different cert for the same skill, the cert verification flow runs on its own merits. Decoupling is correct: we don't want to imply the cert is "linked" to the learning item we suggested (the path may not have been the one they actually took).

- [ ] Update `<LearningItemCompleteButton>` / the completion success state in `app/[locale]/(seeker)/dashboard/grow/page.tsx` to add the secondary CTA.
- [ ] Update `/dashboard/qualifications/new` to accept `?skill=` + `?provider=` query params (pre-fill form fields).
- [ ] One help article: `content/help/seeker/growth/upgrading-to-verified.md`.
- [ ] No DB change.

---

### Task 11.2.4: "Interested" state — the parking lot

**Scope.** Add a sixth state to the learning-item lifecycle, between `recommended` and `planned`: `interested`. A seeker who sees a recommendation but isn't ready to commit clicks "Save for later" → creates a `learning_items` row in `state='interested'`. The dashboard surfaces the parked items in a "Saved for later" strip. Promoting to `planned` happens via the same UI as today's "Accept recommendation".

**Why now.** Today the only states are: accept (commits to learning) or scroll past (loses the warm intent forever). Half of seekers want a middle ground — "I'm interested, but not now". The parking-lot pattern is standard in shopping carts, watchlists, every consumer product. Adding it costs almost nothing and recovers real intent.

**Migration.**

```sql
ALTER TYPE learning_state ADD VALUE 'interested' BEFORE 'planned';
```

(Drizzle migration: `migrations/00XX_phase11_2_interested_state.sql`.)

**Lifecycle.**

```
recommended → interested → planned → in_progress → completed
                  ↓            ↓           ↓
              abandoned     abandoned   abandoned
```

`interested` items do **not** count toward the abandonment / completion analytics (they're explicitly parked, not abandoned).

**UI.** On each `<RecommendationItem>` card, a secondary button "Save for later" sits next to the primary "Accept recommendation" button. Once interested, the card shows "Saved" + a button "Move to planned" (promotes to the existing planned flow). The `<MyLearningSection>` gains a new "Saved for later" sub-section above the active items.

- [ ] Migration to add `interested` to the enum.
- [ ] New server action `markLearningInterested(skillSlug)` in `lib/seeker/learning.ts`.
- [ ] Update `<RecommendationItem>` + `<AcceptRecommendationButton>` to render the secondary CTA.
- [ ] Update `<MyLearningSection>` to render the saved-for-later sub-section.
- [ ] No notification (parking is silent).
- [ ] One help article update: existing `learning-paths-and-proficiency.md` mentions the new state.

---

### Task 11.2.5: Skill-journey timeline

**Scope.** A "Your skill journey" section on `/dashboard/grow` showing the seeker's completed learning items in chronological order. Each row: skill, completion date, provenance chip, optional cert badge if uploaded + verified. Read-only; no actions. Sub-section of the existing `<MyLearningSection>` on the page.

**Why now.** Today a seeker can complete five learning items over six months and have no visible record of the journey. The data exists (`learning_items.completedAt` for state `completed`); we just don't render it. The journey view is the achievement-visibility companion to badges (Task 11.1.4).

**UI.** A horizontal time-strip on desktop (one row per skill, dates aligned right); a stacked card list on mobile. Each row is dense: 1 line for the skill + cert badge, 1 line for the date + provenance. No icons that grow the bundle.

**Edge case.** A seeker who has zero completed items sees nothing (no empty state — the existing "Saved for later" + recommendations + paths sections fill the page).

- [ ] New `<SkillJourneyTimeline>` component in `components/feature/seeker/learning/SkillJourneyTimeline.tsx`.
- [ ] Render conditional in `<MyLearningSection>` when `completed.length > 0`.
- [ ] No new query — composes over existing `learning_items` reads.

---

### Task 11.2.6: City-demand → search drill-down

**Scope.** Make each row of the city-demand table on `/dashboard/grow` a link. Click "JavaScript: 1,247 searches, 312 matches, 935 gap" → land on `/search?skill=javascript&province={me.province}` to see the actual employers driving the demand.

**Why now.** Today the table is read-only. The data answers "where's the demand?" but doesn't let the seeker do anything about it. Linking to search closes a 2-click gap with zero schema work.

**Anti-pattern guard.** The link goes to the **public** `/search` page, not an employer-restricted view. The seeker is just running a search the same way an employer would — no privacy gates touched.

- [ ] Wrap each `<tr>` row body in a `<Link>` to `/search?skill={slug}&province={provinceSlug}`.
- [ ] Mobile variant: same link on the card body.
- [ ] No new data.

---

### Task 11.2.7: Compass auto-revalidate on skill mutation

**Scope.** Today the Career Compass page is server-rendered with `revalidate` set to a default cache. If a seeker adds 2 skills on `/dashboard/profile`, then opens `/dashboard/grow`, the compass may still show the **old** rank + recommendations until the cache invalidates. Confusing.

The fix: every server action that mutates `profile_skills` (the `updateSkills` action in `lib/profile/actions.ts`, the `completeLearningItem` action in `lib/seeker/learning.ts`) calls `revalidatePath("/dashboard/grow")` + `revalidatePath("/dashboard")` after the write.

**Why now.** Cheap; closes a real correctness gap; the data layer already exposes the path-revalidation API via Next's `revalidatePath`.

- [ ] Audit every server action that mutates `profile_skills`. Add `revalidatePath` calls.
- [ ] Manual test: add a skill, open `/dashboard/grow`, confirm the headline + recommendation set update without a hard refresh.

---

### Task 11.2.8: Adjacent profession "Consider this profession" CTA

**Scope.** Each `<AdjacentProfessionCard>` on `/dashboard/grow` already shows the overlap percentage + missing skills + demand hint. Add a tertiary link "Consider this as your profession →" that opens a confirmation modal explaining what changing primary profession will do (rank in new pool, search visibility under new profession, learning paths recalibrate) + an "I'll think about it" / "Switch my profession" pair.

**Why now.** Today a seeker sees "you're 8 of 12 skills away from Data Analyst" and has no surface to act on it. The profession field on `/dashboard/profile` is buried 3 clicks deep + lacks the context. Adding the CTA + explainer makes the pivot pathway visible.

**The modal.** Reads (literal copy direction): *"Switching your primary profession means: your rank moves into the new pool (Data Analyst · Gauteng, currently 1,892 seekers); recruiters searching for Data Analyst will surface you; we'll recalibrate your skill recommendations to target the new pool's gaps. Your work history + existing skills stay the same. This is reversible — switch back any time."*

- [ ] Modify `<AdjacentProfessionCard>` to add the CTA link.
- [ ] New `<SwitchProfessionConfirmModal>` client component.
- [ ] Existing `updateProfileBasics` action accepts the profession change; no new action needed.
- [ ] One help article: `content/help/seeker/growth/switching-profession.md`.

---

### Task 11.2.9: Student-lane discoverability for non-academic seekers

**Scope.** The student lane on `/dashboard/grow` is the most sophisticated feature in the seeker product — curriculum-vs-market card, electives, internships, grad programmes, destinations. It renders **only** when `me.academic` exists. Many students sign up without filling in academic record at sign-up, then never discover the lane.

This task: an explicit "Are you a student? Add your programme →" callout on `/dashboard` (and a smaller one on `/dashboard/grow` itself) for seekers without `me.academic`. The callout links to a dedicated `/dashboard/profile#academic` anchor (the existing academic section of the profile editor).

**Why now.** Underutilised goldmine. Cheap surfacing fix.

**Suppression.** Hide the callout once `me.academic` exists. Re-show if the seeker subsequently clears it (rare, but the toggle is honest).

- [ ] New `<StudentLaneDiscoveryCallout>` server component.
- [ ] Render in `app/[locale]/(seeker)/dashboard/page.tsx` and `app/[locale]/(seeker)/dashboard/grow/page.tsx`.
- [ ] No new query — checks for `me.academic` existence.

---

## 🚫 OUT OF SCOPE FOR PHASE 11.2 (explicit guardrails)

- ❌ **AI-driven course recommendations.** Career Compass stays data-grounded (real search-event demand × controlled skill taxonomy).
- ❌ **Verifying course completion by polling provider APIs.** Out-of-scope for content-trust reasons + would require partnerships with every provider (impossible for SETA / TVET fragmentation). Self-attestation + optional cert upload is the right contract.
- ❌ **Paid placement of learning paths.** No "sponsored" path slot. The ordering is editorial (free-first, then provider quality).
- ❌ **Removing the abandon-reason capture.** Continues to flow to gov analytics — that's the whole policy-evidence point of the Learning Loop.
- ❌ **Multi-skill bundle recommendations.** Today recommendations are per-skill. Bundling ("learn React + Redux + Next") is a Phase 12 conversation if it surfaces as a real need.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | Direct deep-link URLs only; no Sebenza-side redirect. | Trust chain stays clean. The seeker lands on the provider's actual URL. We do not track outbound clicks via redirect (would taint the experience + add latency). |
| D2 | Free-alternative surfacing is reactive (on abandon), not proactive. | Showing every free alternative on the original card would clutter the page + dilute the original recommendation. Surface the alternative at the moment the seeker hits the wall. |
| D3 | Cert-upload bridge does not auto-link the cert to the learning item. | Decoupling protects integrity — the seeker may have taken a different course than the one we suggested. Cert verification stands on its own. |
| D4 | The `interested` state lands as a Drizzle enum value, not a separate column. | Cleaner — keeps the single-state-machine invariant intact. The migration is additive. |
| D5 | City-demand drill-down goes to the **public** search, not an employer-restricted view. | Privacy posture: the seeker runs a search the way any visitor would. No new auth surface. |
| D6 | Compass auto-revalidate is on every skill mutation, not only on user-visible events. | Correctness is cheap; over-revalidation cost is negligible (Next's smart cache handles it). |

---

## 🧪 HOW TO VERIFY

1. Open `/dashboard/grow`; pick a learning path; confirm the "Open application" CTA exists + opens the provider URL in a new tab.
2. Accept a recommendation; click "Abandon" → "too expensive". Confirm the inline free-alternative card renders. Click "Accept this instead" → confirm both audit rows wrote + the page now shows the new path as `planned`.
3. Complete a learning item. Confirm the secondary CTA "Got a certificate?" appears. Click it → land on `/dashboard/qualifications/new` with the skill + provider pre-filled.
4. On a recommendation card, click "Save for later". Confirm a `learning_items` row in `state='interested'` writes. Confirm the saved-for-later sub-section on `<MyLearningSection>` renders the item.
5. Add a skill on `/dashboard/profile`. Open `/dashboard/grow`. Confirm the headline + recommendations updated without a hard refresh.
6. On a city-demand table row, click. Confirm landed on `/search?skill={slug}&province={my-province}`.
7. As a seeker without `me.academic`, open `/dashboard`. Confirm the student-lane discovery callout renders. Add an academic record; confirm the callout disappears.
8. On an `<AdjacentProfessionCard>`, click "Consider this as your profession". Confirm the modal renders with the explanation. Click "Switch my profession" → confirm `profiles.profession` updates + rank recomputes.

---

*Plan opened with Phase 11. Target: ship within 8 working days of Phase 11.1 completion.*
