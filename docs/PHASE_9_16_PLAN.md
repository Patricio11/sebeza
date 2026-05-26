# PHASE 9.16 PLAN — DOB + PASSPORT + ADMIN-MEDIATED ID VERIFICATION
*Side-phase after 9.15. Opened 2026-05-26. Revisits Phase 9.9's DOB-out-of-scope decision + closes the structural gap surfaced 2026-05-26 in system review: the existing KYC panel toggles a flag without an actual document upload path. Without the dormant Phase 8 KYC SaaS partnership, admin-mediated review is the only honest verification path for seekers — same pattern Phase 9.10 shipped for employer org KYC.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `docs/popia/DPIA.md` · `docs/completed/PHASE_8_COMPLETE.md` (dormant KYC adapter context) · `docs/completed/PHASE_9_10_PLAN.md` (employer admin-mediated KYC pattern).*

> **One-phase scope** locked in D0: DOB + passport + admin-mediated ID verification ship together. Splitting would mean two DPIA passes + two Privacy Policy updates. The mechanism is uniform: capture identity → store securely → admin reviews evidence → flip `kyc_verified_at`.

---

## 🎯 GOAL

Three paired changes shipped in one commit:

1. **Capture Date of Birth at sign-up step 1.** Typed `date` column on `profiles`, NULLABLE for backward compat. Lets the platform compute age + power youth-unemployment analytics + check programme eligibility (YEI, ECD, internships).

2. **Support passport identity for non-SA residents.** Sign-up's "National ID" becomes an ID-kind selector (`SA ID` / `Passport`) + conditional input. Existing `national_id_enc` column carries both — new `id_document_kind` enum + optional `passport_country`.

3. **Admin-mediated ID document verification.** The KYC partnership is dormant — admin manual review is the path until it activates. Seeker uploads an ID document on `/dashboard/profile` (image / PDF), admin reviews on `/admin/verifications` → "Seeker IDs" tab + Approve / Reject (sets `kyc_verified_at` / clears the document + notifies seeker). Mirrors Phase 9.10's employer-org-vetting flow.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- `profiles.national_id_enc` — AES-256-GCM encrypted, set at sign-up, accepts either SA ID or passport text (encryption is identity-document-agnostic)
- `profiles.kyc_verified_at` (Phase 8) — timestamp flag the `KycPanel` reads to render "Verified" state
- `lib/kyc/actions.ts` — `submitMyIdForVerification` (currently returns "pending" without an attached document) + `revokeMyKyc`. Both extended in 9.16 not rewritten.
- `KycPanel.tsx` (Phase 8) — already three-state, three-card UI. 9.16 adds a file picker + uploaded-doc preview.
- **Phase 9.10 admin-mediated org KYC** — full template: `organization_documents` table + Supabase Storage upload helper + signed-URL inline preview on `/admin/verifications` + 5-action review modal. Same patterns adapt for seekers.
- `<ComboboxField>` (9.14.x) — ready for the passport-country picker
- `<MonthYearPicker>` (9.14.x) — pattern + Civic Editorial styling to extend into a full day picker
- `lib/storage/upload.ts` — `uploadDocument()` with magic-byte sniffing + signed URL minting (already used by qualifications + org KYC)
- `lib/audit` — kind union ready to extend

---

## 🔒 LOCKED DECISIONS

### D0 — One combined phase, three paired changes
DOB + passport + admin-mediated ID verification ship together. Same DPIA pass, one Privacy Policy update, one shared `<DatePicker>` reusable component, one shared validation helper. Splitting would mean two passes through review work that has to happen anyway.

### D1 — DOB schema: typed `date`, NULLABLE, no app-layer encryption
- New column `profiles.date_of_birth date`
- NULLABLE so existing rows back-fill cleanly (analytics queries handle NULL gracefully)
- **No application-layer encryption** for DOB — it's not special-category PII alone; the name+DOB identification surface is already public via `PublicProfile`; DB-level encryption-at-rest covers the medium
- National ID stays encrypted (it's the special-category bit)

### D2 — ID kind: new enum + new column
- New `pgEnum id_document_kind` = `["sa_id", "passport"]`
- New column `profiles.id_document_kind` NOT NULL DEFAULT `'sa_id'` (existing rows back-fill correctly — sign-up historically only accepted SA ID)
- Existing `national_id_enc` column **kept as-is** despite the slightly broadened semantics. Schema comment documents the rename-deferral. Touches fewer sites this way.

### D3 — Passport country: new column
- New column `profiles.passport_country` text (ISO 3166-1 alpha-2 codes)
- NULLABLE; required only when `id_document_kind = 'passport'` (enforced application-side, not via DB CHECK because the dependency is conditional)
- Stored as plain text — same posture as the existing `profiles.nationality` field

### D4 — ID document upload: ONE slot on profiles, mirrors qualifications pattern
- New column `profiles.id_document_storage_key text` — single slot, similar to `qualifications.document_storage_key`
- New column `profiles.id_document_uploaded_at timestamp`
- New column `profiles.id_document_rejection_reason text` (populated on admin reject so seeker sees the note)
- Lifecycle:
  - Seeker uploads → `id_document_storage_key` set + `id_document_uploaded_at` set; `kyc_verified_at` stays NULL; queue surfaces
  - Admin approves → `kyc_verified_at = now()`; rejection_reason cleared; seeker notified
  - Admin rejects → `id_document_storage_key` cleared (Supabase object deleted) + `id_document_rejection_reason` populated; seeker notified; seeker can re-upload
- **One slot** for now. Multi-document (front + back + supporting docs) is a future phase if admin volume justifies it.
- Document stored in Supabase Storage at `{userId}/id-document/<id>.<ext>` (same pattern as qualifications + org KYC)

### D5 — Validation rules
| Field | Rule |
|---|---|
| DOB | Age ≥ 14 (lowest legal SA working age) AND ≤ 100 (sanity bound) |
| SA ID | 13 digits exactly + first 6 digits encode DOB year/month/day → cross-check against captured DOB + Luhn check digit valid |
| Passport | 6-20 chars, alphanumeric + optional spaces / hyphens |
| Passport country | Valid ISO 3166-1 alpha-2 code |
| ID document file | PDF / JPEG / PNG only; ≤ 5 MB; magic-byte sniff (not just MIME-type trust) — reuses the helper from Phase 3 / 9.10 |

The DOB-vs-SA-ID cross-check catches typos at entry: SA ID `9001011234080` encodes DOB 1990-01-01; if user types DOB 1985-01-01 we fail with a clear message.

### D6 — UI on sign-up step 1
- ID-kind chip selector ("SA ID" / "Passport") above the input
- SA ID input: auto-formats to `NNNNNN NNNN NN`; clamps to 13 digits
- Passport input: free-text 6-20 chars + `<ComboboxField>` over ISO 3166 country list
- DOB input: new `<DatePicker>` component (mobile-first; reusable)
- Inline validation (DOB-vs-SA-ID cross-check + Luhn) before letting step 1 advance

### D7 — New `<DatePicker>` reusable component
- Lives in `components/ui/DatePicker.tsx`
- Same Civic Editorial idiom as `<MonthYearPicker>` (Fraunces year header, brand-ink selection, accent ring for today, mobile bottom-sheet / desktop dropdown)
- Day grid (6 rows × 7 columns + month-navigation header)
- Keyboard-accessible (arrow keys nav days, Page Up/Down nav months, Shift+Page Up/Down nav years, Home/End nav to week edges)
- Returns ISO `YYYY-MM-DD` strings — drop-in replacement for `<input type="date">`
- Reusable: future yyyy-mm-dd fields (employment-start dates on `experiences`, hire date on placement modal, etc.) use the same component

### D8 — KycPanel extension
Replaces the current "Submit for verification" simple button with a four-state component:
- **No ID on file** → CTA to fill the ID section first (unchanged)
- **ID on file, no document uploaded** → file picker + upload action + helper text ("PDF / JPEG / PNG, up to 5 MB; one document only — front of your SA ID card, ID-book photo page, or passport bio page")
- **Document uploaded, awaiting review** → preview of the uploaded document (signed URL, mobile-friendly) + "Replace document" link + "Awaiting admin review" badge with the upload date
- **Verified** → green confirmation + revoke option (existing) + signed-URL preview of the document still shown
- **Rejected** → red callout with admin's `rejection_reason` + a "Re-upload" CTA (the storage_key is cleared on reject, so the seeker can submit a fresh document)

### D9 — Admin queue on `/admin/verifications`
- New third tab on the existing tabs row: "Seeker IDs"
- Lists profiles where `id_document_storage_key IS NOT NULL` AND `kyc_verified_at IS NULL` — pending-review queue
- Each row: seeker handle + displayName + ID kind + masked ID number (e.g. `9001●●●●●●080`) + signed-URL preview of the uploaded document
- Three actions: **Approve** (sets `kyc_verified_at = now()`; clears `rejection_reason` if set) / **Reject** with reason (clears `id_document_storage_key` + sets `rejection_reason` + deletes Supabase object) / **Request changes** with note (keeps the document but adds an admin note for the seeker)
- Same Server Action pattern as Phase 9.10 (`approveOrganisation` etc.)

### D10 — Audit kinds + notifications
Two new audit kinds:
- `kyc.document.upload` — actor: seeker; subject: profileId; meta: `{ idKind, fileBytes }`
- `kyc.review.approve` — actor: admin; subject: profileId; meta: `{ idKind, note? }`
- `kyc.review.reject` — actor: admin; subject: profileId; meta: `{ idKind, reason }`
- (Phase 8 already has `kyc.verify` / `kyc.revoke` — those stay; the new `.review.*` kinds capture the admin-mediated path specifically)

Two new notification kinds:
- `kyc.approved` — seeker, in-app default-on + email default-off ("Your identity verification is approved.")
- `kyc.rejected` — seeker, in-app default-on + email default-on ("Your identity verification needs changes" + admin's reason)

### D11 — POPIA + DPIA work
1. **`docs/popia/DPIA.md`** — new risk entry R10: *"DOB + passport-country collection at sign-up + ID document upload."* Mitigations:
   - Application-layer encryption mandatory for the ID document number (passport just like SA ID)
   - DOB is `date`-typed (no precision creep)
   - DOB never returned on `PublicProfile` (compliance assertion enforces)
   - ID document file lives in private Supabase bucket; signed URLs only for admin reviewers + the seeker themselves
   - Rejected document storage is cleaned up by Phase 8's orphan sweep cron + the reject action itself
2. **`/privacy` Section 2** — DOB + ID kind + passport country + ID document file added to "what we collect"
3. **`/paia` Section 5** — DOB + ID kind + passport country + ID document added to the record

### D12 — Compliance assertions (4 new)
1. `dob-never-in-public-payload` — DOB never returned on any `PublicProfile` query
2. `id-encryption-mandatory` — every profile with `id_document_kind IS NOT NULL` has a non-empty `national_id_enc`
3. `passport-country-when-passport` — every profile with `id_document_kind = 'passport'` has a non-null `passport_country` matching ISO 3166-1 alpha-2 pattern
4. `kyc-document-private` — no public-facing query returns `id_document_storage_key`; only signed URLs minted server-side for the seeker themselves or admin reviewers can yield the document

Wired into `/api/admin/outcomes-compliance` — now **26 assertions** total.

---

## 📋 TASKS

### Task 9.16.1: Schema + migration
- [ ] Migration `0028_phase9_16_dob_passport_kyc_upload.sql`:
      - New `pgEnum id_document_kind`
      - 6 new columns on `profiles`: `date_of_birth`, `id_document_kind`, `passport_country`, `id_document_storage_key`, `id_document_uploaded_at`, `id_document_rejection_reason`
- [ ] Drizzle schema mirrors
- [ ] Journal entry idx 28

### Task 9.16.2: `<DatePicker>` reusable component
Per D7.

### Task 9.16.3: ISO 3166 country data
- [ ] `lib/taxonomy/countries.ts` exports `COUNTRIES: { code: string; label: string }[]` — all 249 ISO 3166-1 alpha-2 entries
- [ ] Static const, no DB table

### Task 9.16.4: Validation helpers + tests
- [ ] `lib/auth/id-validation.ts` — `validateSaId(id, dob)`, `validatePassport(passport, country)`, `validateDob(dob)`
- [ ] Vitest fixtures covering the Luhn algorithm + DOB cross-check edge cases + country lookup

### Task 9.16.5: SeekerSignUpForm step 1 update
- [ ] ID-kind chip selector + conditional inputs
- [ ] SA ID auto-formatter
- [ ] Passport text input + country `<ComboboxField>`
- [ ] DOB `<DatePicker>`
- [ ] `step1Valid()` updated to include all three fields
- [ ] Inline validation messaging

### Task 9.16.6: signUpSeeker Server Action update
- [ ] zod schema extended: `dateOfBirth` (ISO yyyy-mm-dd), `idDocumentKind`, `passportCountry?`
- [ ] Server-side re-validation via the helpers from 9.16.4
- [ ] `national_id_enc` stores either SA ID or passport (kind-agnostic encryption)
- [ ] `auth.signup` audit meta extended with `idKind` + `dobProvided`

### Task 9.16.7: KycPanel extension (seeker upload)
- [ ] Replace simple submit button with the four-state component per D8
- [ ] File picker → calls new `uploadIdDocument` Server Action
- [ ] Signed-URL preview component for the uploaded document (mobile-first; image inline / PDF embedded)
- [ ] "Replace document" + "Re-upload after rejection" paths

### Task 9.16.8: Seeker upload Server Action
- [ ] `lib/kyc/actions.ts` new `uploadIdDocument(formData)`:
      - `verifyRole("seeker")` gate
      - Profile ownership check (the seeker uploads to their own profile only)
      - File size + magic-byte sniff (PDF / JPEG / PNG) via the existing storage helpers
      - Upload to Supabase Storage at `{userId}/id-document/{id}.{ext}`
      - Update `profiles.id_document_storage_key` + `id_document_uploaded_at`
      - Audit `kyc.document.upload`

### Task 9.16.9: Admin queue + actions
- [ ] New "Seeker IDs" tab on `/admin/verifications` (third tab alongside Qualifications + Organisations)
- [ ] Pending queue: profiles with `id_document_storage_key IS NOT NULL` + `kyc_verified_at IS NULL`
- [ ] Each row carries handle + name + ID kind + masked ID + document preview
- [ ] Three Server Actions in `lib/admin/kyc-review.ts`:
      - `approveSeekerKyc({ profileId, note? })` — sets `kyc_verified_at`; audits `kyc.review.approve`; notifies seeker `kyc.approved`
      - `rejectSeekerKyc({ profileId, reason })` — clears `id_document_storage_key` + deletes Supabase object + sets `rejection_reason`; audits `kyc.review.reject`; notifies seeker `kyc.rejected`
      - `requestKycChanges({ profileId, note })` — keeps document, sets `rejection_reason` as the change-request note, NO `kyc_verified_at` set; seeker can replace the document

### Task 9.16.10: Profile editor update
- [ ] New section "Date of birth" on `/dashboard/profile` (uses `<DatePicker>`) — seeker can update if left blank on sign-up
- [ ] ID kind + masked ID + passport country shown in the existing identity section

### Task 9.16.11: Notification + audit catalog updates
- [ ] 3 new audit kinds in `lib/audit/index.ts` (`kyc.document.upload`, `kyc.review.approve`, `kyc.review.reject`)
- [ ] 2 new notification kinds in `lib/notifications/catalog.ts` (`kyc.approved`, `kyc.rejected`) with email templates via `genericTemplate`

### Task 9.16.12: Compliance assertions
Four new assertions per D12. Wired into `/api/admin/outcomes-compliance` (now 26 total).

### Task 9.16.13: DPIA + Privacy + PAIA addenda
Per D11.

### Task 9.16.14: Seed + tests + ship
- [ ] Seed: backfill existing seed profiles with DOBs derived from SA-ID-encoded dates; set `chiamaka-o` to `kind='passport'` + `country='NG'`; give 1 cohort member an uploaded-but-pending ID document for the admin queue demo
- [ ] Vitest fixtures pass (validation helpers + new compliance assertions)
- [ ] `npm test` green; `npm run typecheck` clean; `npm run build` clean
- [ ] On ship: `docs/completed/PHASE_9_16_COMPLETE.md`; tick 9.16 in `ROADMAP.md` ✅ + date; refresh **Current State** in `TO_START_EVERY_SESSION.md`; commit `Phase 9.16 complete  DOB + passport + admin-mediated ID verification`

---

## ⚠️ RISK AREAS

1. **DOB-vs-SA-ID cross-check edge cases** — SA IDs from before 2000 use 2-digit years; sliding cutoff resolves most cases, but the truly-100-years-old edge case relies on the age sanity bound we already enforce. Add Vitest fixture covering the boundary.

2. **Existing rows have NULL DOB** post-migration. Every place that reads DOB needs a graceful NULL branch. Seed backfill covers dev; production users from before 9.16 fill DOB later via the profile editor.

3. **Passport format variation by country** — broad regex + 6-20 length is permissive but catches obvious garbage. Tighter per-country validation is overengineering at pilot scale.

4. **Storage cleanup on reject** — must DELETE the Supabase object AND clear the column atomically. If storage delete fails, the column still clears (audit row remains for forensic). Phase 8's orphan-sweep cron also catches it.

5. **DPIA + Privacy Policy review** — addenda land in this commit; Information Officer review is the formal gate before Phase 10 (public launch). PR comment notes this.

6. **Trust-story shift** — collecting DOB + uploaded ID document expands the PII surface. The honest framing remains: special-category bits stay encrypted application-side; DOB is typed + not on public payloads; the ID document is private storage with signed-URL access; admin actions are audit-logged + notifications close the loop with the seeker. This is what the Privacy Policy update spells out.

7. **Admin queue volume at scale** — at 10K seekers, a meaningful fraction (5-15%) submitting for verification could mean hundreds in the queue. The "Seeker IDs" tab inherits Phase 9.10's per-row review modal — efficient at pilot scale. If volume becomes a bottleneck post-launch, that's where the dormant Phase 8 KYC SaaS adapter activates: flip the flag, partner provider auto-pre-screens, admin reviews exceptions only.

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved guardrails)

- ❌ **Gender field** — still deferred per Phase 9.9. Governance-reviewed phase when/if added.
- ❌ **Multi-document upload** (SA ID front + back + supporting docs) — single slot for now; future phase if admin volume requires evidence depth.
- ❌ **Automated identity verification via SAQA / Home Affairs APIs** — dormant Phase 8 adapter territory.
- ❌ **Automatic programme-eligibility surfacing** (YEI badge auto-applied to <29 seekers) — the data lands; the surfacing is its own phase.
- ❌ **Renaming `national_id_enc` column** to `id_document_enc` — would ripple to too many sites; schema comment documents the broadened semantics.
- ❌ **DOB / passport-country editable on sign-up step 2 or 3** — capture once on step 1, edit thereafter via profile editor (matches the existing identity-field pattern).

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

Three reasons it's one phase, not three:

1. **The DPIA work has to happen once.** Splitting DOB + passport + admin-ID-verification would mean three passes through DPIA review, Privacy Policy update, PAIA update. Doing them as one coherent commit is cheaper for everyone.

2. **The infrastructure pattern is uniform.** Phase 9.10 shipped exactly this admin-mediated-document-review pattern for employer org KYC. The seeker side mirrors it 1:1 — same storage pattern, same admin-review action shape, same audit kinds, same notification kinds. The DRY value of building once is real.

3. **The user-side wins compound.** Onboarding a non-SA resident (passport support) without an actual document-upload path is incomplete — the verification chain has to be end-to-end. Same for DOB: capturing it without the related identity-evidence path means we can't actually defend the data we hold under POPIA §11(1)(b). Shipping all three at once tells one honest story.

Phase 9.9's "DOB out of scope" decision was correct at the time. Six months later, with the gov-pitch story matured + the dormant-KYC partnership still not confirmed + non-SA-resident onboarding flagged as a real gap, revisiting that decision is sound — and bringing the admin-mediated review path along solves the structural verification gap that 8.X left when it shipped the KYC adapter dormant.

---

*Plan opened 2026-05-26. Target: complete before Phase 10 (public launch) opens. Bounded scope (~1 focused session given the existing infrastructure: encryption pipeline + audit + compliance machinery + Supabase Storage helpers + `<ComboboxField>` + `<MonthYearPicker>` pattern + Phase 9.10's admin-mediated KYC blueprint).*
