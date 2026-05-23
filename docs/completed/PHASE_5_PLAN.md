# Phase 5  The Employer Portal · 📋 PLAN (opened 2026-05-22)

> Active plans live at the top of `docs/`. When this phase ships, this file moves to `docs/completed/PHASE_5_PLAN.md` and `docs/completed/PHASE_5_COMPLETE.md` is written.

**Goal:** Employers can find, shortlist, **reveal contact for** (audit-logged), and **log placements**. The placement record is the data-quality lever  it's what turns Sebenza from a directory into a national talent-intelligence system. Without confirmed placements, analytics in Phase 6 are guessing.

---

## Re-checks (decide before kickoff)

### Re-check #1  Contact reveal requires verified org + consent
Three locks gate every reveal:
1. The employer is in a verified `organizations` row (`verification = 'verified'`)
2. The seeker granted `contact_reveal` consent (`consents.state = 'granted'`)
3. The action audit-logs an `profile.contact.reveal` event with `actor = orgId`, `subject = profileId`

Missing any of these → reveal returns `forbidden` with a clear reason. **No silent failures.**

### Re-check #2  What "contact" actually is
For now: `app_user.email` + profile-derived city. We do NOT expose `national_id`, `full_surname`, or `document_storage_key` via reveal. Documents have their own audited download flow (Re-check #3).

### Re-check #3  Document reveal is separate from contact reveal
- Contact reveal  fast, one-click, audit-logged once
- Document download  separate API call per file, mints a fresh short-lived signed URL, writes its own `profile.document.download` event with `subject = qualificationId`

### Re-check #4  Placement = "Mark as hired" form
The Placement-Truth Rule (`TO_START_EVERY_SESSION.md §8`): analytics only count a hire when the employer logs it on Sebenza. Build:
- "Mark this candidate as hired" CTA on every revealed dossier
- `placements` row with `profileId`, `organizationId`, `role`, `city`, `hiredAt`
- Triggers a seeker email (Phase 8 transactional email): *"Discovery Bank logged you as hired  is your status now 'employed'?"*
- Inserting a placement should write `profile.contact.reveal` audit (employers can't log a hire for someone whose contact they didn't see)

### Re-check #5  Saved searches + shortlists live in `(employer)`
Tables: `saved_searches` (org-scoped), `shortlist_members` (org + profile). New schema. Pure org-data  no PII leakage.

### Re-check #6  Search-side filter for "open to internships / graduate programmes"
Carried over from Phase 4 (deferred there). Toggle on the search filter UI; `searchProfilesQuery` already has the column path  just adds a `WHERE academic.open_to_internships = true`.

### Re-check #7  Doc convention (unchanged)
Standard pattern: PHASE_5_COMPLETE.md + PHASE_5_SMOKE_TEST.md when shipped; tick ROADMAP; update Current State; open PHASE_6_PLAN.md; commit with `Phase 5 complete + Phase 6 opens`.

---

## Implementation plan

### 1. Schema additions (~30 min)
- `saved_searches`: `id`, `organizationId`, `name`, `filters JSONB`, `createdAt`, `lastRunAt`, `newMatchesCount`
- `shortlist_pools`: `id`, `organizationId`, `name`, `createdAt`
- `shortlist_members`: `(poolId, profileId)` PK, `addedAt`, `addedBy`
- `placements` already exists from Phase 0  add an `actorUserId` column to record WHO logged the hire
- Drizzle migration + db:migrate + seed update if needed

### 2. Contact-reveal flow (~60 min)
- New page `/employer/dossier/[handle]`  full candidate dossier with the "Reveal contact" CTA
- Server Action `revealContact({ handle })`:
  - `await verifyOrgVerified()` → returns `{ userId, orgId }`
  - Check `consents.contact_reveal = 'granted'` for the profile owner
  - On success: write `audit_log` row, return `{ email, phone? }`
- Show the revealed contact in a card with a clear "audit-logged" indicator + the org name surfaced to the seeker

### 3. Document download flow (~45 min)
- Server Action `downloadQualification({ qualificationId })`:
  - Same gates as reveal + ownership check (qualification belongs to a profile whose owner granted `document_sharing`)
  - Mints `signedDocumentUrl(key)` (60s TTL)
  - Writes `profile.document.download` audit row
  - Returns the URL; client redirects

### 4. Placement confirmation (~45 min)
- Server Action `markAsHired({ handle, role, city, hiredAt })`:
  - Gate: must have revealed contact in last 30 days (search `audit_log` for the prior reveal)
  - Insert `placements` row
  - Audit `placement.confirm`
  - Trigger seeker notification (Phase 8 stub for now)
- New CTA "Mark as hired" on `/employer/dossier/[handle]` (visible only after reveal)
- `/employer/placements` lists the org's placement history with edit / delete

### 5. Saved searches + shortlists CRUD (~45 min)
- Server Actions: `saveSearch`, `runSavedSearch` (executes against `searchProfilesQuery`, updates `newMatchesCount`), `createPool`, `addToPool`, `removeFromPool`
- Wire the existing `/employer/saved-searches` + `/employer/shortlists` UIs

### 6. Verification + commit (~30 min)
- Build + typecheck clean
- Smoke: Naledi reveals Andile's contact → audit log shows it → marks Andile as hired → `/employer/placements` shows the row → `/insights` "confirmed hires this month" bumps
- Write `docs/completed/PHASE_5_COMPLETE.md`; tick Phase 5 in `ROADMAP.md`; update Current State; open `docs/PHASE_6_PLAN.md` (analytics + skills-gap + government wedge); commit with `Phase 5 complete + Phase 6 opens`

---

## Acceptance criteria (Phase 5 is DONE when every box ticks)

- [ ] Naledi (verified org owner) visits `/employer/dossier/andile-z` → sees the full dossier (still no email/phone)
- [ ] "Reveal contact" CTA → if Andile has granted `contact_reveal` consent, the email surfaces with an "audit-logged" badge
- [ ] If Andile hasn't granted consent → CTA disabled, copy says so honestly
- [ ] Document download on a verified qualification → audit row written; signed URL TTL ≤ 60s; the file streams from Supabase
- [ ] "Mark as hired" → row in `placements`, `/insights` `confirmedHiresThisMonth` increments on next ISR refresh
- [ ] An unverified employer hits any reveal endpoint → redirected to `/employer/organisation` with a banner explaining the verification gate
- [ ] A different employer (no relationship to Andile) trying to mark Andile as hired → action rejects (no prior reveal)
- [ ] Saved searches CRUD works; `runSavedSearch` recomputes match count
- [ ] Shortlist pools CRUD works; adding a profile audit-logs `profile.shortlist.add`
- [ ] `npm run build` clean

---

## Out of scope for Phase 5

- **Analytics + skills-gap engine** → Phase 6
- **Career compass real-data wire-up** → Phase 6
- **2FA enforcement (employer + admin)** → Phase 7
- **SAQA / Home Affairs verification adapters** → Phase 8
- **Resend / transactional email for seeker placement notifications** → Phase 8 (Phase 5 ships the trigger point; email body lands then)
- **Rate limit on reveal endpoint** → Phase 9 (Better Auth's basic in-memory limit holds for now)

---

## Risks to flag at kickoff

- **Audit-log writes on every reveal MUST succeed.** Current `logAccess()` swallows DB write errors. For reveals we may want to refuse the action if the audit can't be written  POPIA-First Rule. Decide upfront.
- **"Mark as hired" → seeker notification.** Resend isn't wired until Phase 8. For now, just write the placement row and log; the notification stub becomes the email later.
- **Org verification today is a flag in `organizations.verification`**  we set it manually in seed. Phase 8 adds the KYC adapter. Until then, admin verifications page (Phase 7) is the only way to flip it.
- **`runSavedSearch` materialises results.** If we store snapshots, the `new matches` count can drift if a profile is later removed. Plan: just store a count + `lastRunAt`, never the result set itself.
- **Contact data is `app_user.email` for now.** Phone number isn't stored anywhere in Phase 3 schema. Decide before Phase 5: add `app_user.phone` (encrypted)? Or defer phone to Phase 8 along with the SMS verification path?

---

*When this ships: write `docs/completed/PHASE_5_COMPLETE.md` and open `docs/PHASE_6_PLAN.md` (analytics + skills-gap + government wedge).*
