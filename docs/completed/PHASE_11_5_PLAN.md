# PHASE 11.5 PLAN  PROFILE DEPTH + MOBILE / A11Y POLISH
*Opens after Phase 11.4. Companion docs: `PHASE_11_PLAN.md` · `docs/A11Y_AUDIT.md` · `docs/PERF_BUDGET.md` · `UX_UI_SPEC.md`.*

> **Thesis:** Phase 11.1–11.4 added retention, conversion, control, and distribution surfaces. Phase 11.5 polishes the surface the seeker already touches every day  the profile editor, the mobile views, the accessibility floor. None of these are dramatic; together they are the difference between *"this product feels considered"* and *"this product feels rough."*

---

## 🎯 GOAL

Phase 11.5 ships three classes of work:

1. **Profile depth.** Two new opt-in surfaces  "Open to ___" tags (mentorship / freelance / contract gigs / public speaking) and CV upload as a personal backup  let seekers express more of themselves without overloading the matcher.
2. **Mobile UX polish.** Specific friction points at 360 px viewport that the senior review (Phase 11.0 audit) flagged: profile-editor jump-to-section, responsive avatars, lazy-loaded Career Compass below the fold, mobile-aware city-demand bar.
3. **Accessibility floor fixes.** The static-scan findings from `docs/A11Y_AUDIT.md` that haven't yet been addressed: Career Compass ordinal numerals, MultiSelectComboboxField group roles, MonthYearPicker listbox semantics, public-route skip link, `<html dir>` attribute, modal focus return.

Together: ~15 small tasks. None are urgent in isolation; together they are the WCAG 2.2 AA + mobile-first commitments the platform made.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Profile editor**  `app/[locale]/(seeker)/dashboard/profile/page.tsx`. Seven-section vertical layout with a sticky desktop sidebar nav.
- **Sticky-section pattern**  used on `/employer/vacancies/new`, `/admin/audit-log` and others. Mobile fall-back is a linear scroll.
- **Existing components needing polish**  `<MultiSelectComboboxField>`, `<MonthYearPicker>`, `<Avatar>`, the city-demand table on `/dashboard/grow`.
- **A11y audit findings**  `docs/A11Y_AUDIT.md`. The findings table is the input to the a11y tasks below.
- **Civic-Editorial typography + Hanken + Fraunces**  already loaded; no new font work.

---

## 📋 TASKS

### Task 11.5.1: "Open to ___" tags

**Scope.** A new profile field: optional, multi-select, four canonical tags `mentorship`, `freelance`, `contract_gigs`, `public_speaking`. Independent of employment status; a fully-employed senior dev can be "Open to mentorship" without changing their primary status.

Tags appear on the public profile (`/p/{handle}`) as small chips below the location. They are searchable (employers can filter `/search` by tag). They are voluntary  empty by default.

**Why now.** Today the platform represents a seeker as "available / looking / employed / dormant"  a four-state employment posture. That doesn't capture the secondary intent that a lot of SA professionals actually have: *"I'm employed, but I'll mentor juniors", "I'm employed, but I'll take a contract gig on weekends", "I'm available for conference talks"*. The tag system surfaces it cleanly without confusing the primary status.

**Data shape.**

```sql
-- Reuse the existing approach: tags as a controlled enum-backed array column.
ALTER TABLE profiles
  ADD COLUMN open_to_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_profiles_open_to_tags ON profiles USING GIN (open_to_tags);
```

Validation in the server action ensures only canonical tag values are stored:

```ts
const OPEN_TO_TAGS = [
  "mentorship",
  "freelance",
  "contract_gigs",
  "public_speaking",
] as const;
type OpenToTag = (typeof OPEN_TO_TAGS)[number];
```

**Matcher behaviour.** Tags **do not** change the seeker's appearance in the primary matcher (profession + skill + province). They surface only when an employer explicitly filters by them in `/search`.

**UI.** New section on `/dashboard/profile` "Open to" with four toggleable chips. Each chip carries a one-line explainer on focus / hover ("Mentor a junior in your field once a month  usually unpaid").

**Public surface.** Tags render as small Civic-Editorial chips on `/p/{handle}`, with deliberately quiet styling (they're a secondary signal, not the primary one).

- [ ] Migration: column + GIN index.
- [ ] New `<OpenToTagsEditor>` component on `/dashboard/profile`.
- [ ] Render tags on `/p/{handle}`.
- [ ] Search filter on `/search` (new query param `?open_to=mentorship`).
- [ ] Update `updateProfileBasics` server action validation.
- [ ] One help article: `content/help/seeker/profile/open-to-tags.md`.

---

### Task 11.5.2: CV upload as personal backup

**Scope.** A seeker can upload one CV file (PDF, max 5 MB) to their profile. The file is **not** shown to employers, **not** indexed for search, **not** surfaced anywhere except the seeker's own profile editor. It's a personal backup copy  the seeker can re-download it whenever they need it.

**Why now.** Two reasons. First, low-tech seekers often have a CV file ready and feel friction in retyping the data into structured form fields. The CV upload is psychological permission  *"the platform has my CV; the structured fields can come later"*. Second, the upload itself produces a useful side-effect: the file is now backed up on the platform, so the seeker doesn't lose it when their phone dies.

**Data shape.** New column on `profiles`:

```sql
ALTER TABLE profiles
  ADD COLUMN cv_storage_key text,
  ADD COLUMN cv_uploaded_at timestamp,
  ADD COLUMN cv_filename text;
```

The file is stored in Supabase Storage under a private bucket; only the seeker (and admin during data-export / erasure flows) can read it.

**Privacy invariant.** The CV is **not exposed to employers** under any flow. Not on `/p/{handle}`, not in `/search`, not in invitations. The audit log records the upload + any re-download; admin access requires the existing data-export flow.

**UI.** New section at the bottom of `/dashboard/profile`: "Personal CV backup". Empty state: "Upload a PDF of your CV. It stays private to you  we don't share it with employers. It's your backup copy." With-file state: "{filename} · uploaded 2026-05-30 · Download · Replace · Delete".

**POPIA touch.** CVs often contain PII the structured profile doesn't expose (home address, ID, etc.). The seeker is uploading deliberately; the platform treats the file as the seeker's own document, not as platform-processed content. DPIA row clarifies.

- [ ] Migration: three columns.
- [ ] Supabase Storage private bucket setup (operator runbook).
- [ ] New `<CvBackupEditor>` component on `/dashboard/profile`.
- [ ] Server actions: `uploadCv`, `downloadCv`, `deleteCv`, `replaceCv` (each writes an audit row).
- [ ] One help article: `content/help/seeker/profile/cv-backup.md`.
- [ ] DPIA row + Retention Policy line (CV is part of the data subject's own holdings  erasure removes it).

---

### Task 11.5.3: Profile editor mobile jump-to-section nav

**Scope.** The profile editor at `app/[locale]/(seeker)/dashboard/profile/page.tsx` has a sticky desktop sidebar nav (240 px wide column). On mobile (≤ 768 px), the sidebar is hidden and the seeker must scroll through seven sections linearly.

This task adds a collapsed "Jump to section" picker at the top of the mobile layout. Tap → open a sheet listing the seven sections + their completion state (✓ / empty / partial); tap a section → smooth-scroll to that anchor.

**Why now.** UX friction at the surface that holds the most seeker minutes per session. Profile editing happens on phones.

**UI.** A sticky bar at the top of `/dashboard/profile` on mobile only. When closed, shows "{current section name} · Jump to section ▾". Opens to a bottom-sheet listing all seven sections.

**Implementation.** A new `<MobileSectionJumpNav>` component. CSS scroll-margin handles the smooth-scroll offset. No JavaScript required for the smooth-scroll itself; the sheet open / close is a small client island.

- [ ] New component.
- [ ] Wire to `app/[locale]/(seeker)/dashboard/profile/page.tsx`.
- [ ] CSS `scroll-margin-top` on each section anchor.

---

### Task 11.5.4: Responsive avatar sizes

**Scope.** Today the `<Avatar>` component serves the same Supabase-signed URL regardless of viewport. On a 360 px viewport, the avatar is rendered at ~64 px display size; we're serving the full image regardless.

This task adds a `sizes` attribute + Supabase image transformation parameters to serve a 128 px avatar to mobile clients and the full image to desktop.

**Why now.** Bandwidth saving + faster first paint on mobile. Aligns with the data-saver work in Phase 11.4.

**Implementation.** Supabase Storage supports image transformations via query params (e.g., `?width=128`). Wire into `lib/storage/signed.ts` to add the width parameter; update `<Avatar>` to compute it from the rendered size + DPR.

- [ ] Update `lib/storage/signed.ts` to support width param.
- [ ] Update `<Avatar>` to request the appropriate width.
- [ ] No data shape change.

---

### Task 11.5.5: Career Compass lazy-load below the fold

**Scope.** Today `/dashboard/grow` is a 1071-line page that server-renders every section. The first-paint Time-to-Interactive is fine (everything is server HTML) but the DOM size is large and the Career Compass page is the heaviest seeker route.

This task lazy-loads the below-fold sections: city demand, student lane, programme-vs-market card. The above-fold sections (headline, recommendations, learning paths, adjacent professions) render synchronously; below-fold sections render only when the user scrolls past a sentinel ~600 px above them.

**Why now.** Faster first paint, smaller initial DOM, better mobile perf. The above-fold sections are the ones that actually drive engagement; below-fold sections are read by maybe 30% of seekers.

**Implementation.** Each lazy section becomes a Server Component imported behind a client island that uses `IntersectionObserver` on a sentinel element. When the sentinel scrolls into view, the island fetches the lazy section and renders it.

- [ ] New `<LazySection>` wrapper component.
- [ ] Convert `<CityDemandTable>`, `<StudentLane>`, `<ProgrammeVsMarketCard>` to render behind lazy sentinels.
- [ ] No data shape change.
- [ ] Confirm Lighthouse perf score on `/dashboard/grow` improves.

---

### Task 11.5.6: Mobile-aware city-demand bar

**Scope.** Today the city-demand table on `/dashboard/grow` has a 40 px-wide gap bar in the rightmost cell. On a 320 px viewport, the bar is barely visible + the actual gap number gets lost.

This task: hide the bar at viewports ≤ 480 px; promote the gap number to large bold type. Desktop view unchanged.

- [ ] CSS media query in the city-demand table style block.
- [ ] No JS change.

---

### Task 11.5.7: Public-route skip link

**Scope.** The A11Y_AUDIT flagged: authenticated routes use `DashboardShell` which provides a "Skip to main content" link. Public routes (`/`, `/search`, `/p/{handle}`, `/sign-in`, `/sign-up`, `/privacy`, `/paia`) do not.

This task adds a skip link in `app/[locale]/layout.tsx` that targets `<main id="main">`. Each public page declares a `<main id="main">` landmark; the link is the first focusable element on the page.

- [ ] Skip link in root layout.
- [ ] Verify each public route declares a `<main id="main">` landmark.

---

### Task 11.5.8: `<html dir>` attribute

**Scope.** Today `<html lang>` is set per-locale (good). `<html dir>` is not set.

None of the Tier-1, Tier-2, or Tier-3 locales are RTL today. Setting `dir="ltr"` explicitly documents intent + protects against future Arabic / Persian addition where the `dir` attribute becomes load-bearing.

- [ ] Add `dir="ltr"` to `<html>` in `app/[locale]/layout.tsx`.
- [ ] Comment notes the locale-aware lookup if RTL locales ever ship.

---

### Task 11.5.9: MultiSelectComboboxField group roles

**Scope.** The recently-shipped `<MultiSelectComboboxField>` (commit `b710428`) renders the listbox with two visually distinct sections (Suggested + All other), divided by a `<p>` heading. Screen readers announce the options as a flat list; the grouping is invisible.

This task wraps each section in `role="group"` with an `aria-label` matching the visible divider text.

- [ ] Update `components/ui/MultiSelectComboboxField.tsx`.
- [ ] Manual verify with VoiceOver / NVDA.

---

### Task 11.5.10: Career Compass ordinal numerals  screen-reader correction

**Scope.** Recommendation cards on `/dashboard/grow` render the ordinal as a styled `<span>`: `01`, `02`, `03`. Screen readers announce *"zero one"*  confusing.

This task wraps the ordinal in `aria-label="Recommendation 1:"` (or similar localised string). Visual unchanged.

- [ ] Update the recommendation-item rendering in `app/[locale]/(seeker)/dashboard/grow/page.tsx`.
- [ ] Same fix on any other surface using styled ordinals (audit and apply).

---

### Task 11.5.11: City-demand bar visually-hidden text

**Scope.** The gap bar in the city-demand table is `aria-hidden="true"` (correct  it's a visual aid). But the percentage encoded by the bar is not duplicated as text for screen readers.

This task adds a visually-hidden span with the percentage to the table cell.

```tsx
<span className="sr-only">{Math.round(ratio * 100)}% gap</span>
```

- [ ] Update the city-demand table cell rendering.

---

### Task 11.5.12: Modal focus return

**Scope.** Modal patterns (KYC review, decline reason, contact reveal) should return focus to the triggering element when closed. The A11Y_AUDIT manual-pass section flagged this as pending.

This task audits every modal-pattern in the seeker product (decline modal, status confirm, employment verification request, profession switch confirm). Each one should:

- Trap focus inside the modal while open.
- Return focus to the triggering button when closed.
- Close on Escape.

- [ ] Audit each modal.
- [ ] Wire focus-return where missing.
- [ ] Manual verify with keyboard-only navigation.

---

### Task 11.5.13: Avatar standalone aria-label

**Scope.** The `<Avatar>` component currently sets `aria-hidden="true"` which is correct when the avatar appears adjacent to text (e.g., a list row with the seeker's name). For standalone uses (top-right of the dashboard header where the name isn't directly adjacent), `aria-hidden="true"` is wrong.

This task adds a `decorative` prop (default `true` for backward-compat); when `false`, the component sets `role="img"` + `aria-label={user.displayName}`.

- [ ] Update `components/ui/Avatar.tsx`.
- [ ] Update standalone Avatar call-sites to pass `decorative={false}`.

---

### Task 11.5.14: Status confirmation copy clarity

**Scope.** Today the status card on `/dashboard` says "Confirm your status" with a button. The verb is wrong  does that change my status or just affirm it? Friction.

This task changes the copy + UX:

- Button label becomes "I am still [employed]" (current status pre-selected, last-confirmed date inline).
- On tap, a modal: "Confirm: I am still currently [employed]." + buttons "Yes, still employed" / "I'm in a different situation now" (latter opens a state picker).
- Confirming writes a `profile.status.confirm` row + resets the freshness timer.

**Why now.** The current copy reads ambiguously; users hesitate. The clarified copy makes the action unambiguous.

- [ ] Update `<StatusCard>` copy.
- [ ] Update `<StatusConfirmModal>` flow.
- [ ] One help article cross-link.

---

### Task 11.5.15: MonthYearPicker listbox semantics

**Scope.** The `<MonthYearPicker>` shipped recently (consolidating month + year inputs in profile editor + seasonal window). The grid of months should be announced as a listbox with each month as an option.

This task audits the picker's ARIA roles + adds the missing semantics:

- `role="listbox"` on the month grid.
- `role="option"` + `aria-selected` on each month cell.
- `aria-activedescendant` on the picker to track keyboard focus.

- [ ] Update `components/ui/MonthYearPicker.tsx`.
- [ ] Manual verify with VoiceOver / NVDA.

---

## 🚫 OUT OF SCOPE FOR PHASE 11.5 (explicit guardrails)

- ❌ **WCAG 2.2 AAA.** AA is the floor; AAA is welcome where it lands cleanly but not a Phase 11.5 deliverable.
- ❌ **Full responsive redesign of `/dashboard/grow`.** The page is large; redesigning it is a Phase 12 conversation. The lazy-load + bar polish in 11.5.5 + 11.5.6 are the high-leverage subset.
- ❌ **Multi-CV upload.** One CV per profile. Multi-CV with role-targeting is a Phase 12+ idea if it surfaces as a real need.
- ❌ **CV parsing into structured fields.** No OCR, no LLM-based extraction. The CV is a personal artefact; the structured profile is the matcher's source of truth.
- ❌ **Voice-to-text bio.** Deferred to Phase 12+ per POST_LAUNCH_BACKLOG.

---

## 🧭 DECISIONS

| # | Decision | Why |
|---|---|---|
| D1 | "Open to" tags are independent of employment status. | Captures real SA professional behaviour (fully-employed devs mentoring on weekends, contractors taking gig work between contracts). The status field stays clean; tags carry the secondary intent. |
| D2 | CV upload is one file per profile, PDF only. | Constrains the scope. Multi-file + Word doc support is a Phase 12+ conversation if it matters. |
| D3 | CV is invisible to employers; backup-only. | Privacy posture. Sharing the CV with employers is a separate, more-considered feature. |
| D4 | Lazy-load below the Career Compass fold uses sentinels, not viewport-detection from layout. | Sentinels are predictable + work across browsers. Layout-derived measurements would couple the lazy logic to design changes. |
| D5 | A11y fixes ship in a single sub-phase so the audit-doc updates land together. | Easier to track; one PR per finding is too granular. |
| D6 | No new font weights or families added in Phase 11.5. | Bundle weight discipline. The Civic-Editorial typography is fixed. |

---

## 🧪 HOW TO VERIFY

1. As a seeker, toggle "Open to mentorship" on `/dashboard/profile`. Confirm the chip appears on `/p/{handle}`. Confirm `/search?open_to=mentorship` includes the seeker.
2. Upload a CV PDF. Confirm the seeker can download it. Confirm no employer-side surface shows the CV (search → `/p/{handle}` → invitations all confirm absence).
3. On a 360 px viewport, open `/dashboard/profile`. Confirm the jump-to-section nav renders at the top. Tap "Skills" → confirm smooth scroll lands at the skills section.
4. Open `/dashboard/grow` on a 360 px viewport. Confirm avatars render at appropriate size (no oversized image). Confirm city-demand bar is hidden + the gap number is the primary signal.
5. Run Lighthouse on `/dashboard/grow` pre- and post-lazy-load. Confirm perf score improves (target: ≥ 90).
6. Run axe-core static scan on `/dashboard`. Confirm no listbox / group-role / ordinal-label findings remain.
7. Use VoiceOver to navigate the MultiSelectComboboxField on `/dashboard/profile` (skill picker). Confirm "Suggested for this role" + "All other options" groups are announced.
8. Tab through `/dashboard/profile`. Open the decline modal (from `/dashboard/invitations/[id]`). Esc to close. Confirm focus returns to the originating button.

---

*Plan opened with Phase 11. Target: ship within 8 working days of Phase 11.4 completion. Bundle with whichever sub-phase happens to touch the relevant surfaces; mobile-polish items don't need to ship in isolation.*
