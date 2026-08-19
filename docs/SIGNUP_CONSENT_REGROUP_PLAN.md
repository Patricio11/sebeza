# SIGN-UP CONSENT REGROUP + TERMS ACCEPTANCE PLAN

*UX fix for seeker sign-up step 2, prompted by founder review (2026-07-02): "all those checkboxes might be too much." Companion decision: a single blanket "I agree to the T&Cs" checkbox was considered and REJECTED, POPIA §1 defines consent as "voluntary, specific and informed"; bundling distinct processing purposes into one contract acceptance is the classic invalid-consent pattern, and the platform's per-purpose gates (vacancy-invite consent check, outcomes-research INNER JOIN + compliance assertion, audited contact reveal) structurally depend on granular grants.*

> **Thesis:** Keep consent granular (legal validity + platform machinery), but make the screen READ as two decisions instead of seven checkboxes: visual grouping + short titles with detail lines. Separately, ADD what the founder's screenshot actually shows, a Terms-of-Service acceptance line, as the *contract* acceptance it legally is, distinct from consent. That requires a real `/terms` page, which also fixes a live footer 404.

---

## 🎯 GOAL

Step 2 renders as:

1. **Searchability**: required row, exactly as today (pre-checked, disabled, REQUIRED pill).
2. **"What employers may do"** group: contact reveal · document sharing · vacancy invites.
3. **"Count me in national statistics"** group: aggregate statistics · outcomes research.
4. **Terms acceptance line**: *"I agree to the Terms of Service and Privacy Policy"* with links; the Continue button stays disabled until ticked; the sign-up action refuses server-side without it.

Each consent row becomes a short bold title + one detail sentence (substance unchanged, this is presentation restructuring of existing consent copy, not new legal meaning). The Phase 9.8.3 D8 vacancy-invites explainer stays verbatim (locked plan copy).

New `/[locale]/terms` page: engineering-authored Terms of Service draft in the Civic-Editorial voice mirroring the existing self-authored Privacy Policy + PAIA pattern, carrying an explicit "attorney review before commercial launch" note. Fixes the footer's dead `/terms` link.

---

## 📋 TASKS

### 1. en.json restructure (`auth.seekerSignUp.step2`)

- `purposes.*` → short titles ("Contact reveal", "Document sharing", "Vacancy invites", "Aggregate statistics", "Outcomes research", "Searchability").
- New `purposeDetails.*` → one-sentence detail per purpose, preserving today's substance verbatim-or-tighter (e.g. contact_reveal: "Verified employers can request my contact details. Every reveal is audit-logged.").
- New `groups.employers` / `groups.statistics` headings + one-line hints.
- New `terms.*` keys: label fragments + link texts.
- zu/xh/af untouched: deepMerge falls back to English; consent copy stays human-translation-only per the non-negotiable rule.
- Privacy centre is unaffected (it carries its own inline labels).

### 2. `SeekerSignUpForm` step-2 rework

- Replace the flat `SIGN_UP_CONSENT_PURPOSES` list with `SIGN_UP_CONSENT_GROUPS` (required row + two titled groups). The allowlist fail-safe property is preserved: the render flattens the groups, so an unlisted future purpose simply doesn't appear.
- Row renders title (bold) + detail line; the existing `PURPOSE_ONBOARDING_EXPLAINER` tap-to-expand mechanism stays for vacancy_matching.
- New `termsAccepted: boolean` in form state (default false, included in the session draft persistence); checkbox row with links to `/terms` + `/privacy` (new tab).
- Step-2 Continue button disabled until `termsAccepted`.

### 3. `signUpSeeker` server action

- Schema gains `termsAccepted: z.literal(true)`: a bypassed-form payload without it is refused (same belt-and-braces posture as every other client gate).
- `auth.signup` audit meta gains `termsAcceptedAt` (ISO timestamp) so contract acceptance is provable later.
- No schema/table change: acceptance evidence lives in the audit log like other sign-up facts.

### 4. New `/[locale]/(public)/terms/page.tsx`

Mirrors the Privacy Policy page shell (SiteHeader/Footer, metadata, lastUpdated). Sections: who we are (Yetotec (Pty) Ltd, working name Sebenza) · the service (talent register, not a job board, no employment relationship, verification/placement honesty) · accounts (accuracy, minimum age 14 per the existing BCEA-derived sign-up gate, security) · acceptable use (truthful info, no scraping/harassment; employer purpose-limitation on revealed contact details) · consent & privacy cross-reference (granular, revocable, links to /privacy + /paia) · employer terms (org verification, audited reveals, invite conduct + report mechanism) · availability & changes (free at launch; features may be dormant/flagged) · disclaimers & liability (no employment guarantee; POPIA rights unaffected) · suspension/termination (moderation) · governing law (South Africa) · contact (popia@sebenzasa.com). Top banner: engineering-authored draft, attorney review required before commercial launch (same honesty posture as the DPIA sign-off section).

---

## 🚫 OUT OF SCOPE

- ❌ Reducing the number of consent PURPOSES or changing the consent machinery, presentation only.
- ❌ Deferring `document_sharing` / `outcomes_research` to in-context moments (first upload / dashboard card), good future idea, separate phase; changes grant-rate dynamics and needs its own look.
- ❌ The footer's `/accessibility` link also 404s, noted, separate small fix.
- ❌ Recording terms acceptance in a dedicated table/column, audit-log evidence is proportionate at this stage.

---

## 🧪 HOW TO VERIFY

1. Sign-up step 2 shows: required searchability row, two titled groups (3 + 2 rows), terms line. Continue disabled until terms ticked.
2. Crafted payload without `termsAccepted: true` → action refuses.
3. `/terms` renders (footer link no longer 404s); links from step 2 open it.
4. `auth.signup` audit row meta carries `termsAcceptedAt`.
5. `npm run typecheck` + `npm test` green; E2E sign-up spec (if it exercises step 2) updated + green.
