# PHASE 11.5 COMPLETE  PROFILE DEPTH + MOBILE / A11Y POLISH
*Shipped 2026-05-31. Fifth and final sub-phase of Phase 11. Fifteen polish tasks across three classes: profile depth (Open-to tags + CV backup), mobile UX (jump-to-section, responsive avatars, lazy below-fold, mobile-aware city-demand bar), and accessibility floor (group roles, ordinal aria, html dir, skip link, listbox semantics, decorative-avatar opt-in).*

> **One-line summary**: Closes Phase 11 with the surface-polish work the senior review flagged. Two new profile surfaces (Open-to tags + CV backup) let seekers express secondary intent and back up their CV without overloading the matcher. Mobile editing gains a jump-to-section nav. Below-fold Career Compass sections lazy-load to shave first-paint cost. Eleven small a11y fixes tighten the WCAG 2.2 AA floor: html dir, public-route skip link, screen-reader-friendly ordinals + bar gaps, group roles on the skill picker, listbox semantics on the month picker, decorative-vs-standalone opt-in on the Avatar. Zero new external dependencies; zero new cron jobs.

Commits:

- (this commit)  Phase 11.5 ship: 15 tasks, 1 new migration (4 columns + 1 GIN index), 2 new consent purposes for the public profile chip set, 0 new audit kinds, 0 new notification kinds

---

## 🎯 WHAT SHIPPED

### Task 11.5.1  "Open to ___" tags (mentorship / freelance / contract_gigs / public_speaking)
- Migration `0042` adds `profiles.open_to_tags text[] NOT NULL DEFAULT '{}'` + GIN index for `&&` overlap filter.
- New `OPEN_TO_TAGS` constant + `OpenToTag` type + `OPEN_TO_TAG_LABEL` + `OPEN_TO_TAG_HINT` maps + `isOpenToTag` runtime guard in `lib/mock/types.ts`.
- `PublicProfile.openToTags` + `SearchFilters.openTo` fields added.
- New `setOpenToTags({ tags })` Server Action in `lib/profile/actions.ts` with Zod-enum validation (only canonical values stored).
- New `<OpenToTagsEditor>` component on `/dashboard/profile` (new section 07).
- Public profile `/p/{handle}` now renders an "Open to" dossier row when tags are set.
- `searchProfilesQuery` gains `p.open_to_tags && ${tagsLiteral}::text[]` clause (matches the existing `availableFor` pattern).
- `/search?open_to=mentorship,freelance` parses + filters via new `parseOpenTo` helper.
- D1 invariant: tags do NOT affect primary ranking; they surface only on explicit filter.

### Task 11.5.2  CV upload as personal backup
- Migration `0042` adds `profiles.cv_storage_key` + `cv_uploaded_at` + `cv_filename`.
- New `uploadCv` helper in `lib/storage/upload.ts` (PDF-only, 5 MB cap, `{userId}/cvs/{id}.pdf` path).
- New `lib/profile/cv.ts` with `uploadCv` + `downloadCv` + `deleteCv` Server Actions. Each writes a `profile.update` audit row with `action` meta.
- New `<CvBackupEditor>` component on `/dashboard/profile` (new section 08). Two visual states: empty (with privacy explainer) + present (filename + uploaded date + Download/Replace/Delete).
- D3 invariant honored end-to-end: CV is never returned in any public projection; never indexed for search; never referenced from employer-facing surfaces.
- Old object cleaned up on Replace (best-effort delete).
- `MyProfile` shape gains `cvStorageKey` + `cvUploadedAt` + `cvFilename`.

### Task 11.5.3  Mobile jump-to-section nav
- New `<MobileSectionJumpNav>` component. Sticky pill at the top of `/dashboard/profile` on phones; opens a bottom-sheet listing all sections (including the two new ones from 11.5.1 + 11.5.2 + academic when present). Hidden on `md+` where the sidebar nav already serves.

### Task 11.5.4  Responsive avatar sizes
- `signedPhotoUrl(key, { width? })` in `lib/storage/signed.ts` now decorates the signed URL with `?width=N&resize=cover` query params honoured by Supabase image transformations. Backward-compatible: existing callers without the options arg get the full-size URL.

### Task 11.5.5  Lazy-load below-the-fold sections on `/dashboard/grow`
- New `<LazySection>` wrapper in `components/ui/LazySection.tsx`. Uses IntersectionObserver with a 600 px `rootMargin` sentinel; falls back to immediate render on browsers without IO support.
- Wrapped the city-demand + honest-note + recommended-employers + curriculum + My Learning sub-tree under one lazy boundary on `/dashboard/grow`. Above-fold (headline, recommendations, learning paths, adjacent professions) renders synchronously.
- D4 honored: sentinel-based trigger; not coupled to layout measurements.

### Task 11.5.6 + 11.5.11  Mobile-aware city-demand bar + screen-reader percent
- Gap bar hidden at `< sm` (640 px) so the gap number is the dominant signal on phones.
- New `<span className="sr-only">{pct}% gap</span>` adds the percentage as text for screen readers (the bar itself stays `aria-hidden="true"`).

### Task 11.5.7  Public-route skip link
- New "Skip to main content" link at the top of `app/[locale]/layout.tsx`. Visually hidden until focused; targets `#main` (already declared on the landing, /search, /p/[handle], insights, verify-employment pages).

### Task 11.5.8  `<html dir>` attribute
- Root layout sets `dir="ltr"` explicitly. Comment notes the future per-locale lookup when an RTL locale ships.

### Task 11.5.9  `<MultiSelectComboboxField>` group roles
- "Suggested for this role" + "All other options" sections each now wrap in `<div role="group" aria-label="…">`. Screen readers announce the grouping; visual unchanged.

### Task 11.5.10  Career Compass ordinal numerals (screen-reader correction)
- Recommendation ordinals on `/dashboard/grow` now carry an explicit `aria-label="Recommendation N"` with the visual glyph inside an `aria-hidden` span. Stops VoiceOver / NVDA from announcing "zero one".

### Task 11.5.12  Modal focus return (partial)
- All Phase 11 modals already handle Esc-to-close + focus-trap. Explicit return-focus-to-trigger was wired into the new modals (BlockEmployerControl, ReportInvitationControl, SwitchProfessionConfirmModal) at their original ship time; a follow-up sweep across older modals (AbandonModal, StatusCard picker, EmploymentVerification) lives in `docs/A11Y_AUDIT.md` as a known polish item for Phase 12. The existing modals are usable today  focus simply lands on the document body after close, which is the browser default.

### Task 11.5.13  Avatar `decorative` prop
- `<Avatar decorative={true}>` opts the wrapper into `aria-hidden="true"` for use cases where the avatar sits adjacent to the seeker's name in text. Default `false` preserves the existing standalone `role="img" + aria-label` behaviour at every current call site.

### Task 11.5.14  Status confirmation copy clarity
- The secondary button on `<StatusCard>` reads "I'm in a different situation now" instead of "Update"  clearer verb, no ambiguity about whether tapping changes the status.

### Task 11.5.15  `<MonthYearPicker>` listbox semantics
- Month-grid container now carries `aria-activedescendant` pointing at the focused month's button id; each button gets `id="myp-month-{year}-{month}"`. Screen readers announce the active month without DOM focus moving off the listbox container (WAI-ARIA composite single-focus pattern).

---

## 📦 FILES TOUCHED

**New (7 files)**
- `db/migrations/0042_phase11_5_profile_depth.sql`
- `lib/profile/cv.ts`
- `components/feature/profile/OpenToTagsEditor.tsx`
- `components/feature/profile/CvBackupEditor.tsx`
- `components/feature/profile/MobileSectionJumpNav.tsx`
- `components/ui/LazySection.tsx`
- `docs/completed/PHASE_11_5_COMPLETE.md` (this doc)

**Edited (13 files)**
- `db/schema.ts`  4 new columns on `profiles` (`openToTags`, `cvStorageKey`, `cvUploadedAt`, `cvFilename`).
- `lib/mock/types.ts`  `OpenToTag` enum + label/hint maps + guard; `PublicProfile.openToTags`; `SearchFilters.openTo`.
- `lib/profile/me.ts`  `MyProfile` shape gains the 4 new fields + the loader maps them.
- `lib/profile/actions.ts`  `setOpenToTags` action.
- `lib/storage/upload.ts`  `uploadCv` helper + `cvs` kind in the union.
- `lib/storage/signed.ts`  `signedPhotoUrl(key, { width })` width-hint parameter.
- `db/queries/profiles.ts`  search SELECT extended + WHERE clause for `openTo` filter + `findProfileByHandle` projection extended.
- `app/[locale]/(public)/p/[handle]/page.tsx`  "Open to" dossier row.
- `app/[locale]/(public)/search/page.tsx`  `openTo` searchParam + `parseOpenTo` helper.
- `app/[locale]/(seeker)/dashboard/profile/page.tsx`  sidebar nav extended, mobile jump nav, two new editorial sections.
- `app/[locale]/(seeker)/dashboard/grow/page.tsx`  lazy below-fold wrapper + city-demand bar mobile hide + sr-only percent + ordinal aria-label.
- `app/[locale]/layout.tsx`  `dir="ltr"` on `<html>` + skip-to-main link.
- `components/ui/Avatar.tsx`  `decorative` prop wiring.
- `components/ui/MultiSelectComboboxField.tsx`  group roles around the Suggested + All other sections.
- `components/ui/MonthYearPicker.tsx`  `aria-activedescendant` + per-button ids.
- `components/feature/profile/StatusCard.tsx`  clearer secondary-button copy.

**Verification**
- `tsc --noEmit` clean
- `npm run build` succeeded (285 routes)
- `vitest run` 50/50 green

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **"Open to" tags are independent of employment status** (D1). Captures real SA professional behaviour (employed devs mentoring on weekends, contractors taking gig work) without polluting the primary status enum.
2. **CV is one file per profile, PDF only** (D2). Multi-CV + Word doc are Phase 12+ conversations if they surface as a real need.
3. **CV is invisible to employers; backup-only** (D3). Sharing the CV with employers is a separate, more-considered feature.
4. **Lazy below-fold uses sentinels, not viewport-derived layout measurements** (D4). Predictable across browsers; decouples lazy logic from design changes.
5. **A11y fixes ship in a single sub-phase** (D5). Easier to track + one PR per finding is too granular.
6. **No new font weights or families** (D6). Civic-Editorial typography is fixed.
7. **Modal focus-return is partial**. Newer Phase 11 modals (BlockEmployer, ReportInvitation, SwitchProfession) already handle it; older modals (AbandonModal, StatusCard picker, EmploymentVerification) leave focus on document body after Esc. Documented in `docs/A11Y_AUDIT.md` as a deferred polish item.
8. **No StatusCard modal redesign**. The current copy + flow (already revised in earlier phases) is clearer than what the original plan described. Single small copy tweak ("I'm in a different situation now") suffices.
9. **No backfill of pre-existing profiles' `openToTags`**. Default empty array; seekers opt in deliberately.
10. **No CV preview thumbnail on the editor card**. A thumbnail would require a PDF-rendering dependency; the filename + uploaded date is enough metadata for a backup-only artefact.

---

## 🧭 IMPACT ON OTHER SURFACES

- **Profile editor** (`/dashboard/profile`)  two new sections (Open to + CV backup); mobile jump-to-section nav at the top of phone viewports; sidebar links extended.
- **Public profile** (`/p/{handle}`)  "Open to" dossier row when tags are set.
- **Search** (`/search`)  `?open_to=` query-param filter via `parseOpenTo`.
- **Career Compass** (`/dashboard/grow`)  below-fold sections lazy-render; city-demand bar drops out at small viewports; ordinals announce as "Recommendation N".
- **Root layout**  `dir="ltr"` + skip-to-main link.
- **Avatar component**  `decorative` opt-in; `dataSaver` from Phase 11.4 stays untouched.
- **Skill picker / MonthYearPicker**  improved screen-reader semantics.

---

## 🚫 EXPLICITLY OUT OF SCOPE

- ❌ WCAG 2.2 AAA (AA is the floor; AAA welcome where it lands cleanly).
- ❌ Full responsive redesign of `/dashboard/grow` (Phase 12 conversation).
- ❌ Multi-CV upload (Phase 12+ if it surfaces).
- ❌ CV parsing into structured fields (no OCR, no LLM extraction; CV is a personal artefact, structured profile is the matcher's source of truth).
- ❌ Voice-to-text bio (POST_LAUNCH_BACKLOG).
- ❌ Sharing CVs with employers (separate, more-considered feature).
- ❌ Help articles for each new sub-feature (Phase 12 polish).

---

## 🧪 HOW TO VERIFY

1. As a seeker, toggle "Open to mentorship" on `/dashboard/profile`. Confirm a chip appears on `/p/{handle}` and that `/search?open_to=mentorship` includes the seeker.
2. Upload a CV PDF. Confirm download works. Search `/search` and check `/p/{handle}` + invitations  no employer surface shows the CV.
3. On a 360 px viewport, open `/dashboard/profile`. Tap "Jump to section" → confirm bottom-sheet lists all sections and smooth-scrolls on tap.
4. Open `/dashboard/grow` on a 360 px viewport. Confirm city-demand bar is hidden; gap number is the primary signal. Confirm screen readers announce "{pct}% gap" alongside the absolute value.
5. Run Lighthouse on `/dashboard/grow`. Confirm below-fold sections defer (Network tab shows IntersectionObserver-triggered mount).
6. Open the skill picker on `/dashboard/profile` with VoiceOver. Confirm "Suggested for this role" + "All other options" groups are announced.
7. Tab into the page on `/` (or any public route). Confirm the "Skip to main content" link appears + jumps focus to `#main` on enter.
8. Open the MonthYearPicker; arrow-key through months. Confirm screen readers announce the focused month as the user moves.
9. View the recommendation cards on `/dashboard/grow` with VoiceOver. Confirm ordinals announce as "Recommendation 1, 2, 3..." not "zero one".

---

*Phase 11.5 closes Phase 11. The five sub-phases together delivered: engagement-velocity surfaces (11.1), learning-loop completion (11.2), seeker control + trust posture (11.3), SA distribution surface  share card + follow + data-saver + dormant SMS/WhatsApp + recommended employers (11.4), profile depth + mobile / a11y polish (11.5). Next: **Phase 12** (Testing & QA).*
