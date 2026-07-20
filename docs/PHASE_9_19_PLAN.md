# PHASE 9.19 PLAN — DATA MINIMISATION: NATIONALITY-STATUS + DORMANT-BY-DEFAULT ID VERIFICATION
*Pre-launch data-minimisation side-phase, part of the launch-readiness consolidation. Opened 2026-07-08.*
*Companion docs: `ROADMAP.md` · `TO_START_EVERY_SESSION.md` · `docs/SECURITY.md` · `docs/popia/` (DPIA).*

> **The core decision (operator, 2026-07-08):** Sebenza should run, by default, on **self-reported
> profiles with no ID/passport collected** — like LinkedIn/Indeed — and treat authoritative ID
> verification as an **optional, admin-gated upgrade that only switches ON once a real verification
> partnership (Home Affairs / KYC SaaS / SAQA) is confirmed.** Two changes deliver this:
> 1. Reduce nationality capture to the **only distinction the system actually uses: a two-class
>    citizen / non-citizen split.** No granular immigration status (asylum / permit / PR) — that is
>    sensitive data we would be holding without using, which is the exact liability this phase sheds.
>    (Operator, 2026-07-08: *"we just need two-class citizen / non-citizen; we do not need to go granular
>    for now."*)
> 2. Make the **entire ID/passport collection surface dormant by default**, behind an admin switch —
>    not just the SaaS verifier (which 8.1/9.16 already gate), but the *collection prompt itself*.
>
> **Why now:** launch-readiness is being consolidated; Yetotec (Pty) Ltd is now the responsible party.
> Collecting national ID numbers is the single heaviest POPIA liability in the system and the biggest
> breach blast-radius. Minimising it **before** real users' IDs enter the DB is far cheaper than after,
> and a company making a POPIA representation is held to a higher bar than a side-project was.

---

## 🎯 GOAL

Ship a Sebenza that is **fully functional with zero ID/passport data collected**, while preserving:
- the **citizen/foreign-national analytics** (Phase 9.7) — via a simple two-class flag, not raw ID;
- the **Citizen-Visibility ranking** (`citizen_boost`) — driven by that same flag;
- a **clean, dormant, admin-switchable** path to turn real ID verification ON later, so the day a
  partnership lands it's a toggle, not a rebuild.

**Scope discipline:** the analytics only ever consume two classes (`sa_citizen` / `foreign_national`),
so the profile only captures those two classes. No asylum/refugee/permit/PR granularity is collected —
not because it doesn't matter in life, but because Sebenza doesn't *use* it, and unused sensitive data
is pure liability. If a genuine future need appears, it's a governance-reviewed phase of its own.

**Honest framing to preserve (Verification-Honesty Rule):** we never hold a sensitive credential we
can't verify and don't yet need. "We don't hoard ID numbers" becomes a *trust selling point* to a
POPIA-conscious government, not a weakness.

---

## 🧱 WHAT ALREADY EXISTS (build on — this is why 9.19 is small)

- **9.16** already moved ID/passport **off the signup form** — signup captures DOB + nationality; ID lives
  on the profile editor + `<KycPanel>`. ✅ (So we are NOT undoing "ID at signup" — it's already gone.)
- **9.16** nationality = searchable ~191-country `<ComboboxField>` → `profiles.nationality` (label) +
  derived `profiles.is_citizen = (code === "ZA")` feeding the 9.7 `nationality_class` + `citizen_boost`.
  **→ 9.19 reduces this to the two-class citizen / non-citizen signal the system actually uses.**
  Note: `is_citizen` **already provides the two-class split** — so much of this is a *simplification of
  capture*, not new analytics. The decision is only how light to make the capture (see 9.19.1 + Open Q1).
- **8.1 / 9.10 / 9.16** already gate the *verifier*: `feature_flag_kyc_provider` (default OFF),
  `IdentityVerifier` interface + `MockIdentityVerifier`, `adminVerifyIdManually`, admin "Seeker IDs" tab,
  `feature_flag_verification_badges_visible`. **→ 9.19 adds a switch above these that gates the whole
  *collection surface*, not just the verifier.**
- `national_id_enc` (kind-agnostic), `id_document_kind` (`sa_id|passport`), `passport_country`,
  encryption util, redaction select-list, audit kinds `kyc.verify`/`kyc.revoke`. **→ retained, dormant.**

**The gap:** today the ID/passport fields + `<KycPanel>` upload prompt are *visible by default* on the
profile editor. 9.19 makes them **invisible + inert by default**, controlled by a new admin flag.

---

## ✅ PRE-FLIGHT RECHECK (run before writing code)

- [x] Confirm every read of `profiles.nationality` (label) + `profiles.is_citizen` so the capture change
      updates all callers cleanly: 9.7 `nationality_class`, `citizen_boost` ranking, employer-search
      highlight, `/gov` analytics, any CSV export, any profile render. (Most already read `is_citizen` —
      confirm none depend on the raw country *label* except display.)
- [x] Confirm the `<KycPanel>` + `uploadIdDocument` + `/dashboard/profile` ID/passport field mount points
      (the surfaces to hide behind the new flag).
- [x] Confirm `platform_settings` flag pattern (`feature_flag_kyc_provider`,
      `feature_flag_verification_badges_visible`) so the new flag follows the exact same shape.
- [x] Confirm `id_document_kind` / `passport_country` / `national_id_enc` are only touched via the KYC
      path (so gating that path fully dormant-izes them).
- [x] Confirm DPIA sections referencing ID collection (R-13.x / R-17→25 / the 9.16 addendum) so the DPIA
      update is complete, not partial.

---

## 📋 TASKS

### Task 9.19.1 — Reduce nationality capture to the two-class citizen / non-citizen signal
The system only ever uses two classes. So capture two classes. **Recommended capture (Option A):** a
single **"Are you a South African citizen?" Yes / No** — the lightest possible question, collecting
exactly the one bit the analytics + ranking consume and nothing more. (Option B, if country-of-origin is
genuinely wanted for a future regional/diaspora angle: keep the existing country picker and just wire
everything to the derived flag. See Open Q1 — pick one before building.)

- [x] **Canonical field:** ensure a single boolean/flag `profiles.is_citizen` (already exists from 9.16)
      is the **one source of truth** for the two-class split. Everything reads this, nothing re-derives
      from a country label.
- [x] **Option A capture (recommended)  ADOPTED:** replace the 191-country `<ComboboxField>` on signup + profile
      editor with a plain **Yes / No "South African citizen?"** control (radio / segmented). Persists
      `is_citizen` directly. Plain-language, i18n strings, mobile-first. Lowest friction for a nervous user.
      - Retire the country-label write path; keep `profiles.nationality` column for one release as a
        rollback net, then drop (Open Q3). No live surface reads the label except (optionally) display.
- [~] ~~**Option B capture**~~  not chosen (Option A adopted; Open Q1 resolved): keep the country picker
      as-is; change nothing about capture; just confirm every consumer reads `is_citizen`, not the label.
- [x] **Analytics + ranking unchanged:** `nationality_class` (9.7) = `is_citizen ? sa_citizen :
      foreign_national`; `citizen_boost` reads `is_citizen`. Two-class suppression (k=10) unchanged.
- [x] **No granular status field.** Do **not** add asylum / refugee / permit / PR capture. Explicitly out
      of scope (see guardrails) — sensitive, unused, pure liability. A future need = its own governed phase.
- [x] **Framing guardrail:** the citizen question is for *labour-market analytics + citizen-visibility
      ranking*, never a gate. Copy must not imply status affects whether the person can use Sebenza or be
      found (Rules 2 & 3 — Location-Not-Nationality / Citizen-Visibility). Non-citizens are first-class users.

### Task 9.19.2 — New admin flag gating the ENTIRE ID/passport collection surface
- [x] New `feature_flag_id_verification_enabled` in `platform_settings` (**default OFF**), on
      `/admin/settings`, **acknowledgement-gated** (mirror the Phase 22.5 coach-switch pattern: the admin
      must tick "a verification partnership is confirmed and lawful" before it flips ON).
- [x] **When OFF (the default, launch state):**
      - `<KycPanel>`, the ID/passport fields, `id_document_kind` picker, and `uploadIdDocument` entry point
        are **hidden and inert** on `/dashboard/profile` (not just visually — the Server Action refuses).
      - No ID/passport is collected, stored, or requested anywhere. Profiles are fully self-reported.
      - `<VerificationBadge>` follows existing `feature_flag_verification_badges_visible` (already OFF-able).
      - Sebenza is fully usable: search, profiles, vacancies, analytics, coach — none depend on ID.
- [x] **When ON (post-partnership):**
      - The existing 8.1/9.10/9.16 KYC path activates exactly as already built (opt-in `<KycPanel>`,
        SA-ID/passport capture, admin review or SaaS verifier per `feature_flag_kyc_provider`).
      - **Opt-in only:** turning the feature ON must NOT retroactively demand ID from existing users; it
        merely makes the optional upgrade *available*. No feature is gated behind being ID-verified
        (consistent with the 9.4 "Lever B rejected — don't conflate KYC with behaviour" decision).
- [x] Structural backstop: a compliance assertion that **no ID/passport collection endpoint executes when
      the flag is OFF** (the Server Action hard-refuses, not just a hidden UI).

### Task 9.19.3 — "Verify-and-minimise" posture for when it IS on (design now, honest later)
- [x] Document the target handling for the ON state so it's not an afterthought: prefer **store the
      verification *result*, not the raw number** where the provider allows (verify-and-discard), or keep
      `national_id_enc` encrypted-at-rest with the existing AES-GCM + strict redaction if the raw value is
      unavoidable. Decision recorded in the DPIA (Open Q4).
- [x] No change to encryption/redaction infra now — this task is a **documented design commitment** the
      partnership-activation phase will implement, so the dormant path activates *honestly*.

### Task 9.19.4 — DPIA + governance update (load-bearing, not optional)
- [x] DPIA addendum: record the **data-minimisation decision** — ID/passport not collected by default;
      the biggest special-category field is now dormant. This is a *risk reduction* the DPIA should
      celebrate and the government pitch can cite.
- [x] Update every DPIA/Privacy/PAIA reference that currently assumes ID collection at profile time
      (R-13.x, the 9.16 addendum) to reflect "collected only when `feature_flag_id_verification_enabled`
      is ON, opt-in, post-partnership."
- [x] Note the **responsible party is Yetotec (Pty) Ltd** — the entity making the POPIA representation.

### Task 9.19.5 — Wiring, verification, doc convention
- [x] All new copy in `messages/en.json` (zu/xh/af deepMerge fallback; the citizen question is short and
      identity-sensitive — worth prioritising for real translation).
- [x] Migration: **Option A** — no new column needed (`is_citizen` already exists); just retire the
      country-label write path and keep `profiles.nationality` for one release as rollback safety.
      **Option B** — no migration at all. Either way: **do not** drop old columns in this phase.
- [x] Compliance assertions (extend suite): (a) no ID/passport endpoint runs with the flag OFF;
      (b) `nationality_class` + `citizen_boost` read the single `is_citizen` flag, never a raw country
      label; (c) no granular immigration-status field exists anywhere (structural guard against scope
      creep); (d) two-class analytics + k=10 suppression unchanged; (e) no raw country label resurfaces in
      any analytics list or export.
- [x] `npm run test:all` green; `build` clean; E2E in **both flag states** (OFF = no ID surface anywhere;
      ON = the existing KYC flow works), desktop + 360px.
- [x] Seed: profiles across both classes (citizen + non-citizen) so analytics + ranking render; ID flag
      seeded OFF so the default launch state is what's exercised by default.
- [x] On ship: `docs/completed/PHASE_31_COMPLETE.md` (the 9.19 name was taken by the real Phase 9.19's completion doc); tick 9.19 in `ROADMAP.md` ✅ + date; refresh
      **Current State** in `TO_START_EVERY_SESSION.md`; commit `Phase 9.19 complete`.

---

## 🔓 OPEN QUESTIONS (decide before / during build)
1. **Capture style — Option A vs B (the one real build decision).**
   - **Option A (recommended):** single **"South African citizen? Yes / No."** Maximal data-minimisation,
     lowest friction, collects exactly the one bit used. Loses country-of-origin data.
   - **Option B:** keep the country picker; wire everything to `is_citizen`. Retains country-of-origin
     (a possible future regional/diaspora angle) at the cost of holding data you don't currently use.
   - *Leaning A*, consistent with the whole data-minimisation thrust — but pick before building.
2. **Government-pitch story — decide deliberately.** Dropping default ID collection moves Sebenza toward
   the LinkedIn model (self-reported; employer verifies right-to-work at hire, where it legally belongs)
   and away from "authoritative verified registry." **Recommended:** embrace it — "we don't hoard
   unverifiable ID numbers; verification is opt-in and partnership-backed" is *safer and more honest*, and
   is itself a POPIA trust point. But confirm this is the pitch you want, since it changes the deck's
   "verified data" line. (Leaning: adopt the minimised model.)
3. **When to drop the deprecated `nationality` country-label column?** (Leaning: one release after 9.19
   ships clean, once nothing reads it — a small follow-up task, not now, to keep rollback safety.)
4. **ON-state storage posture** (verify-and-discard vs encrypted-at-rest raw). Decide with whoever advises
   on POPIA; document in DPIA. (Leaning: verify-and-discard wherever the future provider allows.)

## 🚫 OUT OF SCOPE FOR 9.19 (explicit guardrails)
- ❌ Removing the encryption / redaction / audit infra — it stays, dormant, ready for the ON state.
- ❌ Activating any real ID verification — the flag ships **OFF**; turning it ON needs a confirmed,
   lawful partnership + the acknowledgement gate.
- ❌ Gating any feature behind being ID-verified (don't conflate KYC with access — 9.4 Lever B decision).
- ❌ Nationality as a search/invite **gate** — unchanged; still highlight-not-gate (Rules 2 & 3, DPIA R9).
- ❌ **Granular immigration status** (asylum / refugee / permit / PR) — not collected, not a field, not
   scaffolded. The system uses two classes; anything finer is sensitive, unused, and out of scope. A real
   future need is its own governance-reviewed phase, not a quiet add here.

---

## 🧭 WHY THIS IS THE RIGHT MOVE
Self-reported profiles with opt-in, partnership-gated verification is the LinkedIn insight applied with
Sebenza's POPIA discipline: it removes the heaviest liability in the system, lowers the signup barrier for
exactly the nervous, unemployed users the platform exists to serve, and — because Yetotec (Pty) Ltd is now
the responsible party — reduces the compliance weight the company carries at launch. The two-class
citizen / non-citizen capture keeps every ounce of the citizen/foreign-national analytics and ranking
value while dropping both the toxic raw-ID field and any granular status data the system doesn't use. And
the admin switch means the day a real verification partnership lands, ID verification is a single
acknowledged toggle — built, dormant, honest — not a rebuild.

*Plan opened 2026-07-08. Part of the launch-readiness consolidation. Ships OFF by default.*

---

## 📌 STATUS — ✅ SHIPPED 2026-07-19 (as **Phase 31** in ROADMAP.md)

> Naming note: "Phase 9.19" was already used by the shipped vacancy-match-enrichment phase
> (referenced throughout the code), so this plan ships under **Phase 31** to keep history
> truthful. This file remains the authoritative plan text.

- [x] **9.19.1 / Option A** — sign-up + profile editor now ask a single "South African citizen?
  Yes/No" (segmented control at sign-up; the existing checkbox on the profile editor). The
  191-country picker is gone; `signUpSeeker` takes `isCitizen: boolean`; the `nationality` label
  write path is retired (legacy labels stay displayed, column drops one release later — Open Q3).
  Analytics/ranking unchanged (they always read `is_citizen`; verified in pre-flight).
- [x] **9.19.2** — `feature_flag_id_verification_enabled` (default OFF), ack-gated
  `IdVerificationSwitch` on /admin/verifications (Seeker IDs tab). While OFF: profile editor shows
  a Date-of-birth-only section (no ID field, no KYC upload) and `changeNationalId` /
  `uploadIdDocument` / `submitMyIdForVerification` HARD-REFUSE server-side. **Removal is never
  gated** (`removeNationalId` / `revokeMyKyc` work regardless — data-subject rights). A seeker
  who already holds ID data keeps status + remove-only affordances. Admin review queue keeps
  working for already-submitted documents.
- [x] **9.19.3** — verify-and-discard design commitment recorded in DPIA R-26.3.
- [x] **9.19.4** — DPIA addendum **R-26** (risk REDUCTION; Yetotec (Pty) Ltd named as the
  responsible party; supersedes register entries assuming ID capture at profile time).
- [x] **9.19.5** — compliance tests in `tests/integration/data-export-dormant-gates.test.ts`
  (endpoints refuse before validation when OFF; removal never gated; gate opens when ON;
  structural guard: no asylum/refugee/permit/visa/immigration column may ever exist) +
  `tests/e2e/id-minimisation.spec.ts` (citizen question at sign-up, both flag states on the
  profile editor, the ack-gated admin switch), desktop + 360px, screenshots.
- **⚠️ AMENDMENT (operator feedback, 2026-07-20 — after live sign-up testing):** Option A is
  revised to a **HYBRID**: the citizen Yes/No stays the primary (and only) question for the ~99%
  SA majority, but answering **No now reveals the canonical country picker** (ZA excluded) — the
  nationality label displays on the public profile + search rows, so "non-citizen from where?"
  is real product information the operator wants kept. Labels are always DERIVED server-side
  (citizens → "South Africa"; non-citizens → the picked country); free text stays retired; the
  analytics still read only `is_citizen`. The `nationality` column is therefore NO longer
  deprecated — Open Q3 (drop the column) is **withdrawn**: the column is live again as the
  derived display label.
- **Open Q2 (government-pitch story):** adopted the minimised model per the plan's
  recommendation — "we don't hoard unverifiable ID numbers" is the pitch line.
- **Open Q3 (drop the label column):** ~~deferred~~ **WITHDRAWN** by the 2026-07-20 amendment — the column now carries the derived display label (citizens "South Africa", non-citizens their picked country) and stays.
