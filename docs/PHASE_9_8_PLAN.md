# PHASE 9.8 PLAN — VACANCIES & DEMAND-DRIVEN MATCHING
*Side-phase between Phase 9.7 and Phase 10, mirroring the 6.5 / 7.5 / 9.7 pattern. Opened 2026-05-24. Open questions closed same day.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/`.*

> **Why 9.8 and not "9.5":** the nationality-analytics side-phase shipped as **9.7** (it took the slot the
> earlier voice-chat called "9.5"). This is a distinct, later side-phase. Numbered 9.8 so it sits cleanly
> before the Phase 10 public-launch phase. Self-contained, like 6.5 / 7.5 / 9.7.

> **UX/UI quality bar (non-negotiable, applies to every surface in this phase):** smooth, beautiful,
> consistent with the Civic Editorial aesthetic, **mobile-first** by construction. No-Flash Rule applies:
> works on a low-end Android over 3G; JS budget ~150KB on key routes; no heavy animation. Every list,
> form, and modal in this phase must render cleanly at 360px wide before it ships.

---

## 🎯 GOAL

Let an employer create a **private vacancy specification**, reverse-match it against the talent database,
**invite** specific seekers, and capture their **accept / decline-with-reason** response — turning Sebenza
from ad-hoc search-and-contact into a structured, demand-driven matching system.

This is **not** a job board. The distinction is the whole point:

| Job board (NOT this) | Sebenza vacancies (this) |
|---|---|
| Employer posts publicly | Vacancy is **private** to the employer org |
| Seekers browse + apply (broadcast) | Employer reverse-matches + invites specific people (intent) |
| Inbox fills with applications | Pipeline of invited candidates with explicit responses |
| Nationality often invisible | Citizens **highlighted** honestly, gap made visible — never gated |

**Why it's on-axis:** it systematises the Phase 5 search→shortlist→contact→placement flow, gives employers
a reason to log *structured* hiring specs (→ better demand data for `/insights` + `/gov`), and the
decline-with-reason captures *why roles go unfilled* — labour-market intelligence no job board has.

**Bonus: this is also the data that unblocks the "Local shortage" classifications from 9.7.** The 9.7
COMPLETE doc flagged that genuine `shortage` cells need more diverse employer-confirmed placement data than
seed can provide. Every `decline_reason = salary_not_competitive` or `skills_mismatch` is concrete evidence
the local pool isn't filling for a discoverable reason. 9.8 makes 9.7's centerpiece classifier render real
cells, not just seeded ones.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **Saved searches + shortlists** (Phase 5, per-org CRUD). A vacancy is *spec-like* a saved search — but
  note the key difference: saved searches store **count + `lastRunAt` only, never the result set**
  (`searchSnapshot ≠ result-set`). A vacancy is the opposite: it needs a **persistent candidate pipeline**.
  So this is a new table + relationship, not a renamed saved search.
- **Typed consent system** (`consentPurpose` enum + `lib/consent` state machine; `outcomes_research` is the
  precedent). The vacancy-invite opt-in is a **new purpose in this existing machinery**, not a boolean.
- **Per-kind notifications** (Phase 7: `notifications` table, `notification_prefs` JSONB, `createNotification`
  honouring prefs + dedupe, `notifyOrgMembers`). Vacancy invites/responses are **new kinds**, not new infra.
- **Placement-Truth + `placements`** (Phase 5 / 7.5.5: `placement_source`, salary band private). A filled
  vacancy links to a placement.
- **Audit log** + action-naming convention. Every invite/response is audit-logged like any PII interaction.
- **`citizen_boost` ranking + Citizen-Visibility Rule** (Phase 4) — already does "highlight citizens" the
  right way. The vacancy match view **reuses this**; it does not add a stricter gate (see §CRITICAL).

---

## 🚨 CRITICAL DESIGN CORRECTION — nationality is HIGHLIGHT, not GATE

The originating voice-chat proposed a per-vacancy **"South African only"** toggle that gates who can be
invited. **We are not building that**, and the reason is the spine of the whole platform:

- **Rule 2 (Location-Not-Nationality):** nationality is "a displayed, optionally-filterable attribute —
  **never a barrier**." A hard "nationals only" invite gate makes it a barrier. Direct violation.
- **Rule 3 (Citizen-Visibility):** "match talent, never exclude foreigners." A nationals-only switch is
  exactly the exclusion this rule forbids.
- **Phase 9.7 just reframed** the nationality analytics to remove any exclusionary framing and recorded it
  in **DPIA R9** as a mitigation. Shipping an employer-facing "nationals only" toggle days later would
  contradict our own documented mitigation.

**What we build instead (the honest version the platform already implies):**
- The vacancy match view **highlights and ranks SA citizens first** (reuse `citizen_boost`), and shows the
  **honest supply picture**: *"4 SA citizens match · 9 if you broaden to all eligible candidates."* That is
  the Skills-Shortage Justification Index (9.7) **at hiring time** — evidence, not exclusion.
- Employers can **filter/sort** by nationality_class as a *view preference* (same as search today), but
  there is **no switch that prevents inviting** a matched person based on nationality.
- **Legal-restriction exception — deferred entirely** (operator decision, 2026-05-24): some roles do carry
  genuine statutory citizenship/clearance requirements (security clearance, specific licensure). **9.8 does
  not build or scaffold any `legal_eligibility_note` field.** Reasoning: scaffolding an exclusion field
  is exactly how "well, since the column exists…" stories start. If a concrete legal case ever appears,
  the conversation is "should we add this field?" not "should we activate this dormant one?" When (if) it
  lands later, it lands as its own intentional, counsel-reviewed, dormant-by-default change.

---

## 🔒 DECISIONS CLOSED 2026-05-24

Pre-flight resolved. The four open questions from the original draft + the senior-review push-back items
are settled. Load-bearing for the build; don't relitigate without re-opening here first.

### D1 — `interested_but_notice` shape (was Q1)
**A flag on `accepted`, not a third top-level state.** Stored as `state = "accepted_with_notice"` (new enum
value) with `notice_period_months` (int, nullable). Counts as a yes everywhere except the "available now"
filter; **never** as a decline. Protects every downstream stat from the "role X was rejected" lie.

### D2 — Invite expiry (was Q2)
**Per-vacancy, employer-set.** Each vacancy carries `invite_expiry_days` (int, nullable for "no expiry").
Each `vacancy_invitations` row gets `expires_at` computed at send time. A nightly cron transitions any
`state = "invited" AND expires_at < now()` to `state = "expired"` (new enum value) and fires two
notifications: `vacancy.invite.expired` (to the seeker, polite) + `vacancy.invite.unanswered` (to the
employer, useful). Both surfaces honour the in-app + email channel pipeline (Resend stays dormant per
Phase 8; in-app always works). Audit-logged as `vacancy.invite.expire`. Cron reuses the Phase 8 cron infra
+ `CRON_SECRET` guard.

### D3 — Decline-note + POPIA (was Q3)
**Soft truncate + plain-language hint.** Decline-note free-text field capped at 200 chars. Visible
reminder under the input: *"Work-related reasons only — don't include personal info like health, family
status, or religion."* In CSV exports + audit-log meta the note is included but flagged
`seeker-authored free text — treat as PII.`

### D4 — `legal_eligibility_note` (was Q4)
**Defer entirely.** No column, no flag, no scaffolding. If a concrete legal case ever appears, that's a
separate, counsel-reviewed change at that point. See §CRITICAL above.

### D5 — Bulk invite + consent state (was push-back item)
**Skip cleanly with soft user-facing message; record the actual reason in the audit log.** When an employer
multi-selects N seekers and clicks "Invite to opportunity," the action splits into eligible (consent
granted) and skipped (consent not granted, or already invited, or otherwise ineligible). The employer
sees a soft message: *"17 invites sent · 3 not eligible to receive an invite right now."* The exact
per-seeker reason is **not** exposed in the UI (it would leak consent state). Every skip writes one
audit-log row with the actual reason (`consent_not_granted`, `already_invited`, `profile_deleted`, etc.)
for admin oversight.

### D6 — Honest-supply line wording (was push-back item)
**"N SA citizens · M candidates match this vacancy."** Avoid "eligible" (loaded language that could read
as *legally* eligible) — use **"candidates"** or **"matched"**. Same number, cleaner framing.

### D7 — Workspace-role taxonomy (was pre-flight item)
**Already exists.** The `orgMemberRole` pgEnum in `db/schema.ts:85` carries `owner`, `recruiter`,
`viewer`. 9.8 reads from it; no new role-permissions layer to build. Convention: Owner + Recruiter create
vacancies + send invites; Viewer is read-only. Enforced via `organization_members.role` check on every
Server Action.

### D8 — `vacancy_matching` consent text (was push-back item)
**Drafted inline here** as a stable English source for the Tier-1 human translation:

> **Vacancy invites.** When you grant this, verified employers can flag you for a *specific role* they're
> trying to fill — a chef position at a particular restaurant, a developer role at a particular bank.
> You'll get a notification with the role + employer named, and you can accept, decline, or decline with
> a reason. Declining is free. You can revoke this consent any time from your privacy centre, and
> declining a single invite doesn't hurt your visibility in search.

---

## ✅ PRE-FLIGHT RECHECK (run before writing code)

- [x] **Workspace-role taxonomy** confirmed: `orgMemberRole` enum already exists (`db/schema.ts:85`,
      values `owner` / `recruiter` / `viewer`). See D7.
- [ ] Confirm `consentPurpose` enum + the `ALTER TYPE … ADD VALUE IF NOT EXISTS` migration pattern (per
      `0008_phase7_5_outcomes_consent.sql`). 9.8 adds `vacancy_matching`.
- [ ] Confirm `notification_prefs` JSONB shape + `createNotification` kind catalog + dedupe window. 9.8 adds
      kinds `vacancy.invite`, `vacancy.response`, `vacancy.reconsider`, `vacancy.invite.expired`,
      `vacancy.invite.unanswered`.
- [ ] Confirm `placements` columns + `placement_source` + the vacancy linkage point (9.8 adds
      `placement.vacancy_id` nullable FK — a placement may exist without a vacancy, and vice-versa).
- [ ] Confirm the search query + ranking entrypoint so "Find matches" can reuse it with a vacancy's filters
      (no parallel search path — one ranking source of truth).
- [ ] Confirm `searchSnapshot ≠ result-set` rule so the vacancy pipeline is modelled as explicit
      membership rows, not a stored search blob.
- [ ] Confirm audit action naming + the hardened CSV export path (for the response-reasons export).
- [ ] Confirm Phase 8 cron infra + `CRON_SECRET` pattern (the new invite-expiry cron reuses it).

---

## 📋 TASKS

### Task 9.8.1: Vacancy schema + lifecycle
- [ ] `vacancies` table: `id`, `organization_id`, `created_by` (member), `title`, `profession_id`,
      `province_id`/`city_id`, `skills` (taxonomy refs), `seniority`, `salary_band` (**private**, never on
      any seeker-facing surface — consistent with Phase 5 salary handling), `description`,
      `documents_required` (refs to qualification kinds), `status` enum, **`invite_expiry_days`** (int,
      nullable; per D2), `created_at`, `closed_at`.
- [ ] `pgEnum vacancy_status` = `["draft", "open", "closed", "filled"]`.
- [ ] **Privacy invariant (assert in code + test):** no vacancy field is ever exposed on a public route,
      `/p/[handle]`, search, sitemap, or to a non-member of the owning org. Vacancies are org-private.
- [ ] `drizzle-zod` validators; isolated migration. Extend `dataProvider` (db + mock) end-to-end.
- [ ] `/employer/vacancies` (list + create + edit + close) respecting workspace roles
      (Owner/Recruiter create+invite; Viewer read-only — using the existing `orgMemberRole` enum per D7).
      **Mobile-first, No-Flash.** All forms render cleanly at 360px wide; create-vacancy is a single column
      on mobile, two columns on `md+`. Salary-band input never has hover-only affordances.

### Task 9.8.2: Reverse-matching ("Find matches")
- [ ] "Find matches" on a vacancy pre-populates the **existing search** with the vacancy's filters — reuse
      the Phase 4 ranking SQL, no parallel matcher. One ranking source of truth.
- [ ] Match view reuses the existing search-results UI + `<TalentRosterItem>`, with citizen highlighting via
      the existing `citizen_boost` (NOT a new gate — see §CRITICAL).
- [ ] **Honest supply line** at the top of results: ***"N SA citizens · M candidates match this vacancy"***
      (per D6 — "candidates," not "eligible"). Justification Index at hiring time. Suppression not needed
      here (the employer's own match view, not published analytics) but the figure is freshness-weighted
      like every count.
- [ ] Respects all existing redaction: no ID numbers/docs/contact in the match list; reveal stays the
      audited Phase 5 dossier flow.
- [ ] **Mobile-first:** match cards stack on mobile, the honest-supply line sits sticky-on-top so it's
      always visible while scrolling. Tap targets ≥ 44px on every card action.

### Task 9.8.3: Consent purpose for vacancy invites
- [ ] `consentPurpose` += `vacancy_matching` (existing migration pattern, per
      `0008_phase7_5_outcomes_consent.sql`).
- [ ] **Optional, default-off, non-degrading:** a seeker who doesn't grant it is still searchable/contactable
      exactly as today; they simply aren't sent vacancy invites. No feature degradation, no nagging.
- [ ] Consent UI on `/dashboard/privacy` + a plain-language explainer at onboarding using the **D8 source
      text** (drafted above). **Human-translated** for Tier-1 locales (consent copy rule).
- [ ] A seeker can be **invited only if `vacancy_matching` is currently granted** (enforced in the invite
      action, asserted in tests). This is the gate the originating chat correctly insisted on.
- [ ] **Mobile-first:** the consent toggle on `/dashboard/privacy` matches the existing per-purpose toggle
      row pattern; the explainer text is a tap-to-expand `<details>` block on mobile, expanded by default
      on `md+`.

### Task 9.8.4: Invite flow (employer → seeker)
- [ ] `vacancy_invitations` table: `vacancy_id`, `profile_id`, `invited_by`, `invited_at`,
      **`expires_at`** (timestamp, nullable; computed at send time from `vacancy.invite_expiry_days`),
      `state` enum, `responded_at`, `decline_reason` enum (nullable), `decline_note` (text, **capped 200
      chars** per D3), `notice_period_months` (int, nullable — see D1), unique on
      (`vacancy_id`,`profile_id`).
- [ ] `pgEnum invitation_state` = `["invited","accepted","accepted_with_notice","declined","reconsidering",
      "withdrawn","expired"]` (per D1 + D2).
- [ ] Employer multi-selects matched seekers → "Invite to opportunity" (bulk). The action splits selections
      into **eligible** (consent granted, not already invited) and **skipped** (per D5). For eligible:
      writes invitation row → fires `vacancy.invite` notification → audit-logged (`vacancy.invite`, with
      `vacancy_id` + actor). For skipped: audit-logged with the actual per-seeker reason
      (`consent_not_granted` / `already_invited` / `profile_deleted`); UI shows the soft summary
      ***"17 invites sent · 3 not eligible to receive an invite right now"*** — the per-seeker reason is
      never exposed (it would leak consent state).
- [ ] Seeker sees the invite **attributed**: *"Discovery Bank flagged you for: Chef · Cape Town."* Honest,
      human, never anonymous.
- [ ] Employer can withdraw an invite (state `withdrawn`, seeker notified, audited).
- [ ] **Invite expiry cron** (new `/api/cron/vacancy-invite-expiry`, reuses Phase 8 cron infra +
      `CRON_SECRET` guard): nightly, finds `state='invited' AND expires_at < now()`, transitions to
      `state='expired'`, fires two notifications: `vacancy.invite.expired` (seeker, polite — *"Your
      invitation from Discovery Bank has expired without a response"*) + `vacancy.invite.unanswered`
      (employer, useful — *"Sipho K. didn't respond within your N-day window"*). Both honour the in-app
      + email channel pipeline (Resend stays dormant per Phase 8; in-app always fires). Audit-logged as
      `vacancy.invite.expire`.
- [ ] **Mobile-first:** the bulk-invite confirmation modal is a bottom-sheet on mobile, centred modal on
      `md+`. The "N sent · M skipped" summary uses the same `<Pill>` idiom as elsewhere in the employer
      workspace.

### Task 9.8.5: Accept / decline-with-reason (the market-signal engine)
- [ ] Seeker responds: **Accept** → `state = "accepted"`, employer notified (`vacancy.response`), moves to
      the existing dossier/contact flow for next steps (interview/comms happen there, audited as today).
- [ ] **Accept with notice** (per D1) → `state = "accepted_with_notice"` + `notice_period_months` int. A
      *yes*, never a decline. Excluded from every "declined / unfilled" stat by query construction
      (asserted in 9.8.8 compliance check (e)).
- [ ] **Decline** → reason picker (fast modal, radio + optional note — *not a quiz*, mobile-first):
  - `already_employed` · `salary_not_competitive` · `location_not_feasible` · `skills_mismatch` ·
    `role_not_what_im_looking_for` · `other` (requires note).
  - **Decline-note** (per D3): text input capped at 200 chars. Visible reminder under the input:
    *"Work-related reasons only — don't include personal info like health, family status, or religion."*
    Treated as PII in exports + audit-log meta.
- [ ] **Change-of-mind path:** a declined seeker can later "Express interest again" → state
      `reconsidering` → `vacancy.reconsider` notification to the employer. Human workflow, not a dead end.
- [ ] **Every response audit-logged** (`vacancy.response`, reason + timestamp). This is what makes the
      "why roles go unfilled" analytics trustworthy.
- [ ] **Mobile-first:** the decline-reason modal is a bottom-sheet on mobile (thumb-reachable),
      radio-group with large tap targets, note input only renders when a reason is selected. Submit button
      sticks to the bottom edge so it doesn't get hidden by the keyboard. Esc closes; tapping the backdrop
      closes; one save action, no quiz.

### Task 9.8.6: Vacancy outcome → placement linkage
- [ ] When an employer marks a vacancy `filled`, prompt to log the `placement` (reuse Phase 5/7.5.5 flow)
      with `vacancy_id` set. Keeps Placement-Truth intact (still employer-confirmed) and ties the loop:
      vacancy → invites → accepted → placement.
- [ ] **Cardinality:** a vacancy may have **0..N placements** (an employer might hire 3 chefs from one
      posting), a placement has **0..1 vacancy** (`placement.vacancy_id` nullable so the pre-9.8 placement
      flow continues to work unchanged). Asserted by FK shape, not just code.
- [ ] Vacancy fill metrics derive from `employer_confirmed` placements only (7.5.5 honesty rule inherited).
- [ ] **Mobile-first:** "Mark vacancy as filled" is one tap from the vacancy detail, the placement-log
      prompt is the same bottom-sheet pattern as 9.7.5's mark-as-hired flow.

### Task 9.8.7: "Why roles go unfilled" analytics (the policy payoff)
- [ ] Aggregate decline-reason distribution by profession × province (e.g. *"Welders · EC: 60% declined —
      salary not competitive"*). Surfaced on `/insights` (employer-private aggregate of their own vacancies)
      and `/gov` (cross-market, **k=10 + complementary suppression reused from `lib/analytics/suppress.ts`**).
- [ ] Freshness-weighted; CSV export reuses the hardened path (`lib/analytics/csv.ts`); suppression applies
      to exports identically.
- [ ] Feeds the existing skills-gap narrative: a gap that's *salary-driven* is a different policy signal
      than one that's *supply-driven*. This is genuinely new intelligence.
- [ ] **Cross-references 9.7.3's classifier**: a (profession × province) cell where 60% of declines cite
      `salary_not_competitive` reinforces (not contradicts) the 9.7 Justification Index — the gap is real,
      it's just *salary-driven* rather than supply-driven. The COMPLETE doc will spell out how to read the
      two together.
- [ ] **Mobile-first:** the decline-reason breakdown renders as horizontal-bar list (one row per reason)
      so it reads cleanly stacked on phones. No charting library; reuse the same bar-pattern idiom from
      the 9.7 nationality cards.

### Task 9.8.8: Wiring, verification, doc convention
- [ ] All new strings in `messages/en.json`; `zu/xh/af` deepMerge fallback (full translation Phase 10;
      consent copy in 9.8.3 human-translated now using the D8 source text).
- [ ] Compliance assertions (extend the existing suite):
      (a) no vacancy field ever appears on any public / seeker / cross-org surface;
      (b) an invite is impossible without current `vacancy_matching` consent (validated at the action
          boundary AND at the bulk-skip path  see D5);
      (c) **no nationality-based invite gate exists in the codebase**  no endpoint blocks invite by
          `nationality_class` (verified by grep + a runtime assertion that walks the invite action with
          a foreign-national candidate);
      (d) `/gov` decline-reason cells never emit below k;
      (e) `accepted_with_notice` is **excluded** from "declined / unfilled" stats by query construction
          (asserted by inserting a known fixture and confirming it doesn't appear in the unfilled
          aggregate);
      (f) decline-note free text in audit-log + CSV exports is flagged `seeker-authored free text 
          treat as PII`.
- [ ] `npm test` green; `npm run build` clean (typecheck + lint + static gen × 4 locales); smoke-test new
      `/employer/vacancies` + seeker invite routes 200. Manually verify mobile (360px wide) on Chrome
      DevTools or a real device for at least the create-vacancy form, the bulk-invite modal, and the
      decline-reason bottom-sheet.
- [ ] Seed: 1–2 open vacancies on the seeded org, a few invites across SA-citizen + foreign-national seeded
      profiles (to prove highlight-not-gate), one accepted + one declined-with-reason + one
      accepted-with-notice + one expired (after backdated `expires_at`) so `/insights` + `/gov` render real
      (suppressed) rows out of the box. **Bonus**: retroactively wire the three BSc CS cohort placements
      from 7.5.4 to a synthetic vacancy so the vacancy→placement loop has real history immediately.
- [ ] On ship: `docs/completed/PHASE_9_8_COMPLETE.md`; tick 9.8 in `ROADMAP.md` ✅ + date; refresh
      **Current State** in `TO_START_EVERY_SESSION.md`; confirm `docs/PHASE_10_PLAN.md`; commit
      `Phase 9.8 complete + Phase 10 opens`.

---

## 🔓 STILL-OPEN QUESTIONS (decide on data)

All four original open questions are resolved (see **DECISIONS CLOSED** at the top of this doc).
What remains is the standard operational follow-up that lands on real data, not at plan-time:

1. **`invite_expiry_days` UX default** — the field is per-vacancy and employer-set. The create-vacancy
   form needs a sensible *default* in the input (so most employers don't have to think about it). Suggest
   14 days. Confirm on first real-traffic feedback.
2. **Decline-reason taxonomy completeness** — the six reasons in 9.8.5 cover the common cases. Real
   responses may surface a seventh ("commute / transport") or eighth ("hours don't suit") that we'd add
   via migration. Re-assess at every Phase boundary based on `other`-reason note volume.

## 🚫 OUT OF SCOPE FOR 9.8 (explicit guardrails)
- ❌ **Any public vacancy listing, "apply" button, or seeker-side vacancy browsing.** Vacancies are
  org-private specification + matching tools. If it lets a seeker browse/apply to postings, it's a job
  board — don't build it.
- ❌ **Nationality-as-gate on invites** (the "SA only" switch). Highlight + honest supply figure only.
  No endpoint may block an invite based on `nationality_class`.
- ❌ **Any `legal_eligibility_note` field** — not even scaffolded. See D4. If a concrete legal case
  appears, that's a separate, counsel-reviewed change at that point.
- ❌ Salary band on any seeker-facing surface — stays private (Phase 5 rule).
- ❌ In-app interview scheduling / messaging build-out — reuse the existing dossier/contact flow; a full
  comms suite is its own future phase, not 9.8.
- ❌ Changing search-side behaviour — the public/employer search is unchanged; 9.8 *reuses* it.
- ❌ Exposing the per-seeker skip reason on the bulk-invite UX (see D5) — the audit log records it;
  the employer-facing summary is intentionally soft to avoid leaking consent state.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION
The voice-chat got the shape right (private reverse-matching, consent-gated invites, decline-with-reason as
market signal) and two specifics wrong: it reused a dead phase number and — more importantly — endorsed a
per-vacancy "South African only" gate that contradicts Rule 2, Rule 3, and the DPIA R9 mitigation shipped
six days earlier in 9.7. This plan keeps every genuinely strong idea (the pipeline, the typed consent reusing
existing machinery, the reason taxonomy + the notice-period catch + the change-of-mind path, the
"why-unfilled" analytics) and corrects the nationality piece to **highlight-not-gate** — the honest version
the platform already implements everywhere else. Vacancies make Sebenza's demand data richer and its
matching active, without ever becoming the job board, or the exclusion tool, it was built not to be.

*Plan opened 2026-05-24. Open questions closed same day. Target: complete before Phase 10 (public launch) opens.*
