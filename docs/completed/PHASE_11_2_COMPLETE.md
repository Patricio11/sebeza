# PHASE 11.2 COMPLETE — LEARNING LOOP COMPLETION (SKILL-GROWTH CONVERSION)
*Shipped 2026-05-30. Second sub-phase of Phase 11 (Seeker Retention + Skill-Growth Conversion). Nine tasks; the Career Compass is now load-bearing — recommendations link out, free alternatives surface inline on cost abandonment, completion bridges to the verified-cert upload flow.*

> **One-line summary**: Closes the three holes that left the Learning Loop ornamental — `LearningPath.url` so seekers can actually click through to enrol, cost-driven swap-to-free directly inside the abandon modal, and a completion → cert-upload bridge that pre-fills the qualification form. Five smaller pieces round it out: parking-lot `interested` state, skill-journey timeline, city-demand drill-down to search, compass auto-revalidate on skill mutations, adjacent-profession pivot CTA with a confirmation modal, and a student-lane discoverability callout for seekers without an academic record.

Commits:

- (this commit) — Phase 11.2 ship: 9 tasks, 1 new migration (interested enum value), 4 new audit kinds, 1 new notification kind

---

## 🎯 WHAT SHIPPED

### Task 11.2.1 — LearningPath URL + Reviewed chip + click-through audit
- `LearningPath` interface gains `url?: string` + `sebenzaReviewed?: boolean` in `lib/mock/growth.ts`. All five seeded paths backfilled with editorially-verified URLs + `sebenzaReviewed: true`.
- New `learning_path.opened` audit kind in `lib/audit/index.ts`.
- New `logLearningPathOpen` Server Action in `lib/seeker/learning.ts` — fire-and-forget; navigation goes straight to the provider URL, the audit row lands a beat later (D1: no Sebenza redirect, trust chain stays clean).
- New `<OpenLearningPathButton>` client island; renders the primary CTA when `url` is set, a quiet "Provider link coming  Google {title} for now" hint when not. "Reviewed" chip sits next to the CTA when `sebenzaReviewed` is true.

### Task 11.2.2 — Free-alternative surfacing on cost-driven abandonment
- New `lib/seeker/free-alternatives.ts` with `findFreeAlternativeForSkill(skillSlug, excludeTitles[])`. Ordering rule codified: free > subsidised > national > shortest durationWeeks.
- New `fetchFreeAlternativeForItem(itemId)` Server Action — lazy-load on demand from the modal, excludes the current item title + any prior abandoned titles for the same skill.
- New atomic `swapToFreeAlternative({ abandonItemId, reason, note, freePath... })` Server Action — `db.transaction()` wraps the abandon + accept; writes three audit rows (`learning.abandon` with `swappedToFree: true`, `learning.swapped_to_free`, `learning.accept` with `viaSwap: true`).
- New `learning.swapped_to_free` audit kind; new `learning.swapped_to_free` notification kind (in-app default ON, email default OFF, no dedupe).
- `<AbandonModal>` rewritten to render the inline alternative when the seeker picks `too_expensive` / `access_transport`. Two CTAs: "Accept this instead" (atomic swap) / "Just abandon for now" (existing flow). Honest fallback when nothing matches.

### Task 11.2.3 — Completion → verified-cert upload bridge
- Completed `<LearningItemRow>` rows render an inline secondary CTA: "Got a certificate? Upload it for the verified badge". Deep-links to `/dashboard/qualifications?prefillTitle=…&prefillInstitution=…`.
- `app/[locale]/(seeker)/dashboard/qualifications/page.tsx` now accepts `prefillTitle` + `prefillInstitution` query params, threads them through to `<QualificationsManager>` as a `prefill` prop.
- `<QualificationsManager>` auto-opens the Add panel + pre-fills the title + institution fields when `prefill` is set (still editable).
- Per D3 the cert verification stands on its own  no FK linking the qualification row back to the learning_item.

### Task 11.2.4 — `interested` parking-lot state
- New migration `0039_phase11_2_interested_state.sql` (additive: `ALTER TYPE learning_state ADD VALUE IF NOT EXISTS 'interested' BEFORE 'accepted'`).
- `learningState` pgEnum in `db/schema.ts` extended; `MyLearningRow` state union widened.
- New `markLearningInterested(skillSlug)` Server Action — creates a parking-lot row; de-dupes against existing interested / accepted / in_progress for the same skill.
- New `promoteInterestedToPlanned(itemId)` Server Action — flips interested → accepted via the existing planned flow.
- Two new audit kinds: `learning.interested`, `learning.interested.promote`.
- `<AcceptRecommendationButton>` gains a secondary "Save for later" link next to "Learn {skill}".
- `<LearningItemRow>` handles the new state (StateChip + "Move to active" / "Remove" buttons).
- `<MyLearningSection>` renders a "Saved for later" sub-section above active items when any parked items exist.
- `activeLearningSkills` set on `/dashboard/grow` now counts interested rows too (the "On your list" pill renders for parked items).

### Task 11.2.5 — Skill-journey timeline
- New `<SkillJourneyTimeline>` component in `components/feature/seeker/learning/`. Server component; renders nothing when no items are completed.
- Reads from the existing `MyLearningRow[]` passed to `<MyLearningSection>`  no new query. Newest first; provenance chip + completion date per row.

### Task 11.2.6 — City-demand row → search drill-down
- Each row of the city-demand table on `/dashboard/grow` is now a `<Link>` to `/search?q={skillLabel}&province={provinceSlug}`.
- Helper `cityDemandSearchHref(skillLabel, province)` slugifies the province the same way the existing dashboard rank-card link does.
- D5 honored: links to the **public** search page, not an employer-restricted view  the seeker runs a search the way any visitor would.

### Task 11.2.7 — Compass auto-revalidate on skill mutation
- `updateSkills` in `lib/profile/actions.ts` now calls `revalidatePath("/dashboard/grow")` after the write. Closes the correctness gap where adding skills on the profile editor left the Compass showing stale recommendations.
- `completeLearningItem` adds `revalidatePath("/dashboard")` (was already revalidating grow + profile).

### Task 11.2.8 — Adjacent profession "Consider this as your profession" CTA + modal
- New `switchPrimaryProfession({ profession })` Server Action in `lib/profile/actions.ts` — single-field update; audits as `profile.update` with `pivot: true` meta; revalidates dashboard + dashboard/profile + dashboard/grow + public profile.
- New `<SwitchProfessionConfirmModal>` client component — bottom-sheet on phones, centred on `md+`. Lists what changes (rank pool, recruiter visibility, learning paths recalibrate) + what doesn't (work history, skills, verification, status). Explicit reversibility note.
- New `<AdjacentProfessionSwitch>` client wrapper — owns the open/close state so the surrounding `<AdjacentProfessionCard>` stays a server component.

### Task 11.2.9 — Student-lane discoverability callout
- New `<StudentLaneDiscoveryCallout>` component with `full` + `compact` variants. Renders nothing when `me.academic` exists.
- Wired into `/dashboard` (full variant, between StatusNudgeBanner + the audit-log callout) and `/dashboard/grow` (compact variant, after the curriculum surface that would have rendered for academics).

---

## 📦 FILES TOUCHED

**New (8 files)**
- `lib/seeker/free-alternatives.ts`
- `db/migrations/0039_phase11_2_interested_state.sql`
- `components/feature/seeker/learning/OpenLearningPathButton.tsx`
- `components/feature/seeker/learning/SkillJourneyTimeline.tsx`
- `components/feature/seeker/learning/SwitchProfessionConfirmModal.tsx`
- `components/feature/seeker/learning/AdjacentProfessionSwitch.tsx`
- `components/feature/seeker/learning/StudentLaneDiscoveryCallout.tsx`
- `docs/completed/PHASE_11_2_COMPLETE.md` (this doc)

**Edited (12 files)**
- `lib/mock/growth.ts` — `LearningPath.url` + `sebenzaReviewed`; 5 paths backfilled.
- `lib/audit/index.ts` — 4 new audit kinds (`learning_path.opened`, `learning.swapped_to_free`, `learning.interested`, `learning.interested.promote`).
- `lib/notifications/catalog.ts` — `learning.swapped_to_free` notification kind.
- `lib/seeker/learning.ts` — `logLearningPathOpen`, `fetchFreeAlternativeForItem`, `swapToFreeAlternative`, `markLearningInterested`, `promoteInterestedToPlanned` actions; `MyLearningRow.state` widened to include `interested`; revalidation paths extended on completion.
- `lib/profile/actions.ts` — `switchPrimaryProfession` action; `updateSkills` now revalidates `/dashboard/grow`.
- `db/schema.ts` — `learningState` pgEnum widened with `interested`.
- `components/feature/seeker/learning/AbandonModal.tsx` — inline free-alternative flow.
- `components/feature/seeker/learning/AcceptRecommendationButton.tsx` — secondary "Save for later" link.
- `components/feature/seeker/learning/LearningItemRow.tsx` — interested-state controls + cert-upload bridge CTA on completed rows.
- `components/feature/seeker/learning/MyLearningSection.tsx` — parking-lot sub-section + skill-journey timeline.
- `components/feature/profile/QualificationsManager.tsx` — `prefill` prop + auto-open behaviour.
- `app/[locale]/(seeker)/dashboard/qualifications/page.tsx` — accepts `prefillTitle` + `prefillInstitution` query params.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx` — `<LearningPathCard>` gains CTA + Reviewed chip; city-demand rows become links; AdjacentProfessionCard gains switch CTA; locale threaded into MyLearningSection; compact student-lane nudge.
- `app/[locale]/(seeker)/dashboard/page.tsx` — full-variant student-lane callout.

**Verification**
- `tsc --noEmit` clean
- `npm run build` succeeded (279 routes)
- `vitest run` 50/50 green

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **No Sebenza redirect on `LearningPath.url`** (D1). The browser navigates directly to the provider; the audit row writes asynchronously. We never proxy outbound traffic.
2. **No URL-liveness auto-check.** A `fetch()` against every path would create an outbound traffic profile that Lighthouse + the No-Flash Rule punish. Quarterly editorial sweep catches dead links instead.
3. **Free-alternative surfacing is reactive, not proactive** (D2). Showing every free alternative on the original recommendation card would clutter the page and dilute the original recommendation; we surface only at the abandon moment.
4. **Cert-upload bridge does NOT link the cert row to the learning_item row** (D3). Decoupling protects integrity  the seeker may have taken a different course than the one we suggested.
5. **`interested` state shipped as an enum value, not a separate column or table** (D4). Keeps the single state-machine invariant intact.
6. **City-demand links to public `/search`, not an employer-restricted view** (D5). Privacy posture: the seeker runs a public search.
7. **Compass auto-revalidate on every skill mutation, not just visible events** (D6). Over-revalidation cost is negligible; correctness is cheap.
8. **No notification fires on `learning.interested` / `learning.interested.promote`.** Parking is silent by design.
9. **No public-facing achievement leaderboards for the skill journey.** The timeline is private to the seeker; matches the badge stance from Phase 11.1.4.
10. **`switchPrimaryProfession` is its own narrow action**, not a wrapper around `updateProfileBasics`. The pivot is a deliberate state change that deserves a distinct audit-meta flag (`pivot: true`) + smaller surface area.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Career Compass (`/dashboard/grow`)** — every section now load-bearing: outbound CTA on learning paths, parking lot + active + recent + journey sub-sections in My Learning, switch CTA on adjacent professions, drill-down links on city demand, student-lane nudge for non-academics.
- **Dashboard (`/dashboard`)** — full student-lane callout for non-academic seekers.
- **Qualifications page (`/dashboard/qualifications`)** — accepts pre-fill query params; the Add panel auto-opens with pre-populated text when the seeker arrives via the completion bridge.
- **Audit log** — picks up `learning_path.opened`, `learning.swapped_to_free`, `learning.interested`, `learning.interested.promote` rows.
- **Notification prefs panel** — picks up `learning.swapped_to_free` automatically via the catalog iteration.

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ AI-driven course recommendations (Compass stays data-grounded)
- ❌ Verifying course completion by polling provider APIs
- ❌ Paid placement of learning paths
- ❌ Removing the abandon-reason capture (continues to flow to gov analytics)
- ❌ Multi-skill bundle recommendations (Phase 12+ if real need surfaces)
- ❌ Help articles for each new sub-feature (deferred to Phase 11.5 polish)
- ❌ URL liveness monitoring (quarterly editorial review is the contract)

---

## 🧪 HOW TO VERIFY

1. Open `/dashboard/grow`; pick a learning path; confirm the "Open application" CTA opens the provider URL in a new tab; confirm a `learning_path.opened` audit row writes.
2. Accept a recommendation; click "Give up" → "Too expensive". Confirm the inline free-alternative renders. Click "Accept this instead" → confirm the original row is `abandoned` AND a new row in `accepted` state exists for the same skill.
3. Complete a learning item. Confirm the "Got a certificate? Upload it for the verified badge" CTA appears below the row. Click it → land on `/dashboard/qualifications` with the Add panel open + title + institution pre-filled.
4. On a recommendation card, click "Save for later". Confirm a row in `state='interested'` writes + the Saved-for-later sub-section on `<MyLearningSection>` renders the item. Click "Move to active" → confirm the row flips to `accepted`.
5. Complete a second learning item. Confirm the "Your skill journey" section now lists both, newest first.
6. On a city-demand table row, click. Confirm `/search?q=...&province=...` with the slugified province lands.
7. Add a skill on `/dashboard/profile`. Open `/dashboard/grow`. Confirm the headline + recommendations updated without a hard refresh.
8. On an `<AdjacentProfessionCard>`, click "Consider this as your profession →". Confirm the modal explains the consequences. Click "Switch my profession" → confirm `profiles.profession` updates and the rank recomputes on next page load.
9. As a seeker without `me.academic`, open `/dashboard`. Confirm the full student-lane callout renders. Open `/dashboard/grow`. Confirm the compact variant renders below curriculum. Add an academic record; confirm both disappear.

---

*Phase 11.2 closes the skill-growth conversion arc. Next: Phase 11.3 (seeker control + trust posture  pause searchability, block employer, report invite, vacancy snapshot, verification badge on invite).*
