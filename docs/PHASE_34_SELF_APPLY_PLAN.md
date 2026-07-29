# PHASE 34 PLAN — SELF APPLY (public vacancy link + seeker-initiated applications)

*Founder request (2026-07-29): per-vacancy "Self invite (Self Apply)" switch → a beautiful public
vacancy page with an Apply Now button; prompts sign-in/sign-up; for new users a smooth, branded,
vacancy-tailored step that saves role-relevant info (skills) onto their profile; then a
congratulations moment with a complete-your-profile nudge; and the application flows into the
SAME pipeline as an employer-invited seeker. "Everything must be smooth… our modals must be
beautiful, branded, consistent — not generic popups."*

> **Thesis:** the entire feature rides the existing `vacancy_invitations` pipeline. One schema
> addition (an `origin` column + nullable `invitedByUserId`) lets a self-application live in the
> same table, the same employer panel, the same seeker inbox, the same audit/notification
> machinery. The new work is the public surface (token page + OG share card), the sign-up funnel
> integration, and a reusable branded dialog primitive the founder has been asking for implicitly
> every time a "generic popup" bothered him.

---

## 📋 FOUNDER DECISIONS (locked, 2026-07-29)

| # | Decision |
|---|---|
| D1 | Self-application lands as an **accepted** candidate (`state='accepted'`, `respondedAt=now`) with `origin='self_apply'` and a clear **"Self-applied" chip**. No new state: the employer's existing vet step (review / shortlist / mark-filled) applies to all accepted candidates equally — same as employer-invited seekers who accept. |
| D2 | **Salary band:** never in the anonymous public payload. Shown to **signed-in seekers** on the apply page **unless** the employer unticks a new per-vacancy "show salary to applicants" toggle (default ON = shown). |
| D3 | **v1 is `noindex`** — link-only sharing. Indexed job pages / Google Jobs feed is a REAL future asset ("chef jobs Cape Town") but is its own phase with quality rules. Out of scope here. |
| D4 | **Consent posture:** the seeker initiates. New users pass through the full sign-up consent step (searchability + granular purposes + T&C). Existing users already have consent rows. The apply confirmation itself is the specific, informed act for THIS disclosure — the modal states exactly what is shared ("Applying shares your profile with {org} for this role") and the click is audit-logged with that wording. `vacancy_matching` consent is NOT required (it gates employer-initiated matching, not seeker-initiated application). |

## 🔒 GUARDRAILS (from the codebase's standing rules)

- **Ship-dark:** everything behind `feature_flag_vacancy_self_apply`, default OFF.
- **9.8.8 carve-out, done deliberately:** vacancies are org-private by written contract
  (`db/schema.ts` doc-comment) and `assertNoVacancyFieldOnPublicSurfaces` enforces it by grep.
  This phase REWRITES that contract: vacancies with `selfApplyEnabled=true` expose a **defined
  public subset** (title, org name + verification, profession, province/city or national-remote,
  skills, seniority, min experience, work availability, positions, description). **Never:**
  salaryBand (anonymous), inviteExpiryDays, followUpNudges, internal stats, org ids. The
  compliance allowlist gains `lib/vacancy` + `app/[locale]/(public)/apply` with written
  justification; the schema doc-comment is updated to describe the carve-out.
- **No enumeration:** invalid/disabled/closed tokens all render the same calm "not accepting
  applications" panel (200, no notFound; `report-invite/[token]` precedent).
- **Blocked employers:** if the seeker blocked this org, the apply action refuses (prevents
  accidental disclosure to a blocked employer) with honest copy.
- **Rate limits:** new `self-apply` bucket (10/hr, keyed per user id). Sign-up path already
  rate-limited.
- **Server-action guard test:** `selfApplyToVacancy` carries `verifyRole("seeker")`. The public
  vacancy reader lives in a **plain module** (`lib/vacancy/public.ts`, NOT `"use server"`), the
  documented pattern for public reads.
- **Satori:** OG card obeys the Phase 33 lessons (no inline-block; single template strings).

---

## 🧱 TASKS (tick as each lands — house rule from this phase forward)

### 34.1 Schema — migration `0062_phase34_self_apply.sql` (idempotent + journal idx 62)

- [x] `vacancy_invitation_origin` pgEnum: `employer_invite` | `self_apply`.
- [x] `vacancy_invitations`: `origin` NOT NULL DEFAULT `'employer_invite'`; **`invited_by_user_id`
  DROP NOT NULL** (null = self-applied). Existing unique `(vacancyId, profileId)` is the
  collision rule: already-invited seekers see "you're already invited — respond here"; duplicate
  applies are impossible. `expires_at` stays NULL on self-applies (already nullable; expiry cron
  only touches `state='invited'`).
- [x] `vacancies`: `self_apply_enabled boolean NOT NULL DEFAULT false`; `self_apply_token text`
  UNIQUE (nullable — generated once on first enable, `crypto.randomBytes(24)` base64url,
  ~32 chars unguessable; stable across toggle flips, the enabled flag is the gate);
  `salary_visible_to_applicants boolean NOT NULL DEFAULT true` (D2).
- [x] Migration applied to dev DB; columns + seeded flag verified; journal contiguous at idx 62.

### 34.2 Plumbing

- [x] Flag `feature_flag_vacancy_self_apply` (4 mechanical edits in settings/settings-actions;
  revalidate list + the new public route).
- [x] Rate-limit bucket `self-apply` in `lib/rate-limit/types.ts`.
- [x] Audit kind `vacancy.self_apply` (meta: vacancyId, orgId, source `existing_account|signup`,
  disclosure wording version). Notification kind `vacancy.self_apply` → org members ("New
  application for {title}"), catalog entry, default ON, link `/employer/vacancies/{id}`.

### 34.3 Server layer

- [x] **`lib/vacancy/public.ts`** (plain module): `getPublicVacancyByToken(token)` → flag ON +
  `selfApplyEnabled` + `status='open'` + org join (name, verification) → public subset or a
  typed `unavailable` reason. Salary band included ONLY via a second viewer-aware helper for
  signed-in seekers when `salaryVisibleToApplicants` (D2).
- [x] **`lib/seeker/self-apply.ts`** (`"use server"`): `selfApplyToVacancy(token)` —
  `verifyRole("seeker")` → rate limit → re-validate flag/toggle/status → blocked-org check →
  existing-row check (`already_applied` / `already_invited` outcomes) → INSERT
  (`origin='self_apply'`, `state='accepted'`, `respondedAt=now`, `invitedByUserId=null`,
  `vacancySnapshot` frozen same as invites) → notify org + audit → returns outcome + the
  skills-gap payload (vacancy skillSlugs minus the seeker's current skills) for the congrats
  modal.
- [x] Employer toggle: `selfApplyEnabled` + `salaryVisibleToApplicants` join `vacancyInputSchema` +
  create/update writes (house pattern: `followUpNudgesEnabled`); token minted inside
  `updateVacancy`/`createVacancy` on first enable.

### 34.4 The branded dialog primitive + the two dialogs

- [x] **`components/ui/BrandDialog.tsx`** — extracted from the best hand-rolled instance
  (`InviteFromSearchButton`): bottom-sheet on mobile → centred card on desktop, paper/ink
  Civic-Editorial chrome (eyebrow slot, `font-display` title, hairline rules, pill CTAs),
  focus-trapped, Escape/backdrop-close guarded while pending, `useId` labelling, reduced-motion
  safe. This is the house modal from now on.
- [x] **`ApplyConfirmDialog`** — vacancy summary strip (title, org + verification chip, location,
  salary when permitted) + the D4 disclosure line + Apply pill.
- [x] **`ApplyCongratsDialog`** — celebration header (restrained, Civic-Editorial: big Fraunces
  "Application sent." + positive check, no confetti), then the SMART nudge: "This employer asked
  for {skills you don't have yet} — add the ones you have so you rank higher" with a one-tap
  link to `/dashboard/profile#skills`; completeness bar for context. New-user variant adds
  "Verify your email to secure your application."

### 34.5 Public page — `app/[locale]/(public)/apply/[token]/page.tsx`

- [x] Civic-Editorial vacancy dossier: eyebrow ("Open role · {province}"), Fraunces title, org line
  with HONEST verification badge, chips (profession, seniority, work availability, min
  experience, positions when set), skills as chip rows, description, "Apply now" pill +
  "Powered by Sebenza" footer. 360px-first.
- [x] Viewer-aware: anonymous → Apply routes to `/sign-up/apply/{token}` (+ "Already on Sebenza?
  Sign in" → `/sign-in?next=/apply/{token}`); signed-in seeker → ApplyConfirmDialog island
  (salary line per D2); employer/admin viewer → read-only note ("You're signed in as an
  employer"); owner org members see a "this is your public link" banner.
- [x] All unavailable states (bad token, flag off, toggle off, closed/filled) → same calm panel.
- [x] `generateMetadata`: title "{title} — {org}", description from the vacancy, OG image → the new
  card, `robots: noindex` (D3), no sitemap entry.
- [x] **OG share card** `app/[locale]/(public)/apply/[token]/card/route.tsx` — 1200×630: eyebrow
  "Open role · Sebenza", title, org + province, up to 3 skill chips, flag-band footer with
  `{SITE_HOST}/apply/…`. Satori-safe per Phase 33 lessons.

### 34.6 Sign-up funnel — `/sign-up/apply/[token]`

- [x] Page mirrors `sign-up/invited/[token]`: loads the public vacancy, renders `SeekerSignUpForm`
  with a new `applyContext` prop `{token, vacancyTitle, orgName, vacancySkills,
  prefillProfession, prefillProvince}`; a slim vacancy context card stays pinned above the
  steps so the seeker never forgets what they're applying for.
- [x] Step 3 pre-fills profession + province from the vacancy (editable — prefill, never lock) and,
  when `applyContext` is present, adds the founder's tailored moment: **"Skills for this role"**
  — the vacancy's skills as one-tap chips (select what you have; saved onto the profile, not
  just the application). Optional, skippable, zero free-typing.
- [x] `seekerSignUpSchema` gains optional `applyToken` + `applySkillSlugs` (validated server-side
  against the vacancy's skillSlugs ∩ canonical skills). `signUpSeeker`: after profile creation,
  a valid token → insert selected skills, create the application row (same helper as 34.3,
  source `signup`), audit. Application is recorded AT SIGN-UP (the `acceptSeekerInvitation`
  precedent) — email verification is not a race; nothing is lost if they wander off.
  **returnTo does NOT survive verification today; this design sidesteps it entirely.**
- [x] On submit success the form shows **ApplyCongratsDialog (new-user variant)** before routing to
  `/verify-email` — congratulations + "verify your email" + profile nudge, exactly the moment
  the founder described.

### 34.7 Employer UI

- [x] `VacancyForm`: "Self Apply" section — enable toggle + salary-visibility toggle (only rendered
  when the flag is ON; copy explains the public subset honestly).
- [x] Vacancy detail page: when enabled, a **Public link panel** — the URL, Copy button, WhatsApp
  share shortcut (`wa.me/?text=`), and honest state notes ("Link pauses automatically when the
  vacancy is closed or filled").
- [x] `VacancyInvitationsPanel`: **"Self-applied" chip** on `origin='self_apply'` rows (vs the
  existing invited framing); no other pipeline change (D1).
- [x] `AcceptRateStrip` + accept-rate metrics: **exclude self-applies** — a self-application would
  inflate invite-acceptance to 100% and the strip's honesty is the point.

### 34.8 Seeker dashboard

- [x] `listMyInvitations` already returns accepted rows; self-applies get "You applied" framing
  (origin surfaced through the row shape) instead of "You accepted" — honest provenance both
  directions. Invitation detail page shows the same vacancy snapshot card.

### 34.9 Compliance + i18n + tests

- [x] `assertNoVacancyFieldOnPublicSurfaces` allowlist += `lib/vacancy`,
  `app/[locale]/(public)/apply` (+ documented justification); schema doc-comment updated to
  describe the carve-out. New assertion idea (cheap): grep that `salaryBand` never appears in
  `lib/vacancy/public.ts`'s anonymous payload type.
- [x] `messages/en.json`: `selfApply.*` namespace (public page, dialogs, employer panel, sign-up
  step). zu/xh/af deep-merge fallback (no legal/consent copy here beyond the disclosure line —
  which IS consent-adjacent, so keep it in en + flag for human translation like the Phase 25
  precedent).
- [x] Tests: unit — token validity/unguessability, public-subset shape (no salaryBand key
  anonymous), skills-slug validation, origin-aware accept-rate math. Compliance — allowlist
  still green. `typecheck + lint + vitest unit + build` before commit; full `test:all` + E2E
  (both flag states, desktop + 360px) before the flag ever goes ON.

## 🚫 OUT OF SCOPE (v1)

- ❌ Indexed vacancy pages / Google Jobs structured data (own phase, per D3).
- ❌ Application-specific questions/screening forms; cover letters.
- ❌ CV upload at apply time (profile IS the application; documents flow exists post-reveal).
- ❌ Token regeneration UI (stable token v1; toggle is the kill-switch).
- ❌ Employer-side applicant filtering beyond the existing panel.

## 🧪 VERIFY

*Flag-ON items verified 2026-07-29 via the Docker E2E harness — `tests/e2e/self-apply.spec.ts`, 8/8 green
(desktop + 360px). Rides the seeded showcase vacancy "IT Support Technician" (fixed token
`sa-demo-it-support-2026-fixed01`). Screenshots: `docs/screenshots/phase34-self-apply/`.*

- [x] Migration applies clean from zero; journal contiguous at idx 62.
- [x] Flag OFF: no employer toggle rendered, public /apply/{token} shows unavailable panel, action
   refuses — zero regression anywhere.
- [x] Flag ON: toggle → link appears; anonymous page renders full dossier WITHOUT salary; signed-in
   seeker sees salary (and not when employer hid it); apply → row lands `accepted` +
   `self_apply`, employer notified, chip renders, accept-rate unchanged by the self-apply row.
- [x] Already-invited seeker gets the redirect-to-invitation panel; duplicate apply blocked by the
   unique index at the action layer with honest copy.
- [x] New-user funnel: sign-up from the link pre-fills profession/province, skills chips save to
   profile, application row exists before email verification, congrats dialog fires, then
   /verify-email.
- [x] OG card returns 200 image/png (curl), WhatsApp-shaped metadata absolute.
- [x] typecheck + lint + unit vitest + production build green.
