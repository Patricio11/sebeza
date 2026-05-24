# PHASE 9.10 PLAN — EMPLOYER KYC / ORG-VETTING FLOW
*Side-phase between Phase 9.9 and Phase 10. Opened 2026-05-24 from a system-review handoff: KYC partnership isn't ready, so we ship the manual-vetted equivalent (employer onboarding form  admin review queue  approval gate on `/employer/*`). Distilled from `docs/ONBOARDING_KYC_BLUEPRINT.md` and trimmed to fit Sebenza's existing primitives.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/ONBOARDING_KYC_BLUEPRINT.md` · `docs/PHASE_10_PLAN.md`.*

> **UX/UI quality bar (non-negotiable, inherited from every side-phase):** smooth, beautiful, consistent with the Civic Editorial aesthetic, **mobile-first** by construction. The onboarding form must render cleanly at 360 px wide; the admin review modal is a bottom-sheet on phones, centred on `md+`.

---

## 🎯 GOAL

Close the trust loop on the employer side before public launch. Today an employer signs up + verifies email + lands on `/employer` with no friction  but their `organizations.verification` column stays `unverified` and that has no operational meaning. This phase makes the state load-bearing: an unverified org submits an onboarding form (registration cert, tax clearance, proof of address, bank confirmation), an admin reviews + approves / rejects / requests changes, and `/employer/*` is gated on `verified`.

**Why now**: the platform is days from public launch. Currently any signed-up employer can reveal contact details + download documents from real seekers  the only barrier is the email-verification gate which prevents nothing operationally. Manual vetting is the realistic interim until the KYC partnership lands (the `feature_flag_kyc_provider` infra from Phase 8 stays dormant; this phase replaces it with admin labour).

**Why this phase and not Phase 10**: Phase 10 (public launch) is explicitly "no new features." The trust gate is a launch *blocker*, not a feature  it has to land before launch. Side-phase between 9.9 and 10, same pattern as 9.7 / 9.8 / 9.9.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

- **`organizations.verification` enum** (`db/schema.ts`)  values `unverified` / `pending` / `verified` / `rejected`. Already wired into reads + admin views.
- **`verifyOrgVerified()`** in `lib/auth/dal.ts`  guard that reads the org's verification state. Called ad-hoc from `/employer/dossier` and a couple of others; **not yet enforced as a layout-level gate** on `/employer/*`.
- **Better Auth email verification**  fully wired via `sendEmail()` in `lib/email/send.ts`. Resend transport is live (see commit `b4e3f75`). Verification email lands; the user clicks; emailVerified flips.
- **`sendEmail()`** transport + `genericTemplate()` shell in `lib/email/templates/notifications.ts`  five Phase 9.8 vacancy templates already use it. New KYC templates plug in the same way.
- **Notification kinds** already in `NOTIFICATION_CATALOG` from Phase 7:
  - `org.verified` (audience: `org_members`)
  - `org.rejected` (audience: `org_members`)
  - `verification.queued` (audience: `all_admins`)
  - Just need email templates wired + fire sites in the new admin actions.
- **`lib/storage/upload.ts`**  shipped Phase 3 / extended later. Magic-byte sniffing + rate limiting + per-user folders. Used today by seeker qualification documents (`qualifications.documentStorageKey`). The `kind` parameter is the swappable knob; we add `"org-document"` and reuse the rest.
- **Audit log + AuditKind union** (`lib/audit/index.ts`)  `org.verified` / `org.rejected` / `verification.queued` already in the union. Add `org.review.request-changes` + `org.documents.upload` if needed.
- **Admin moderation pattern**  Phase 7's `/admin/moderation` page handles seeker reports with a similar review-modal idiom. The org queue mirrors the shape, different table.
- **MOCK_EMPLOYER seed**  Discovery Bank is seeded `verification: "verified"` so existing dev flows aren't broken when the layout gate ships. We add 2-3 pending / rejected fixtures alongside.

---

## 🔒 LOCKED DECISIONS

The blueprint's locked-decisions table, adapted to Sebenza's reality. Settle now so the build is straight.

### D1  Hardcode the SA-standard 4 documents (defer admin-managed CRUD)
The blueprint ships admin-managed `onboarding_requirements` CRUD so jurisdictions can add docs without code changes. **We defer this.** v1 ships a hardcoded 4-document set baked into the form:
- Company registration certificate (CK1 / CK2 / CIPC document)  **required**
- Tax clearance certificate (SARS pin or letter)  **required**
- Proof of physical address (≤ 3 months)  **required**
- Bank confirmation letter  **required**

If a SA employer needs to upload something non-standard (e.g. SARB licence for a financial-services org), the form has a single optional *"Other supporting document"* slot. The admin-managed CRUD lands post-launch when we see real demand for jurisdiction-specific variance.

**Trade-off**: saves ~3 hours of admin UI + a sub-route + a schema table; loses runtime configurability for one document set.

### D2  Map the blueprint's 5-state machine to Sebenza's existing 4-state enum
Blueprint uses `EMAIL_PENDING  ONBOARDING_PENDING  PENDING_REVIEW  APPROVED | REJECTED`. We have `unverified | pending | verified | rejected` on `organizations`.

| Blueprint state | Sebenza mapping |
|---|---|
| `EMAIL_PENDING` | `appUser.emailVerified = false` (Better Auth-native; not on the org row) |
| `ONBOARDING_PENDING` | `organizations.verification = 'unverified'` AND `appUser.emailVerified = true` |
| `PENDING_REVIEW` | `organizations.verification = 'pending'` |
| `APPROVED` | `organizations.verification = 'verified'` |
| `REJECTED` | `organizations.verification = 'rejected'` |

**Why**: the user-level `emailVerified` is already load-bearing in Better Auth; duplicating it on the org row is desync risk. The mapping is unambiguous because an org always belongs to exactly one verified owner.

### D3  Account number = organisation id (no new field)
The blueprint auto-assigns `SRS-{nanoid(8)}` on approval as a human reference. Sebenza already has stable `organizations.id` (text PK, format `org_{slug}`). We surface that as the "account reference" in the approval email + UI. No new column.

### D4  Document storage  extend `lib/storage/upload.ts` with `kind: "org-document"`
Reuse the existing pipeline (magic-byte sniff + rate limit + per-user folder). New folder convention: `org/{organizationId}/{requirement_slug}/{filename}`. Service role key (server-side upload) for org docs  same security model as qualifications.

### D5  Document set per org  replace on each submission
Last submission wins. Resubmitting wipes the previous `organization_documents` rows for that org and inserts the new set. Matches the blueprint's hard mode (D in the blueprint). **Trade-off**: no audit trail of revisions; admin "Request Changes" loop is the soft path that pre-fills previous values so the user doesn't re-upload from scratch.

### D6  Layout-level gate via a route group
New route group `app/[locale]/(employer)/employer/(verified)/` whose `layout.tsx` enforces `verifyOrgVerified()` and redirects to `/employer/onboarding` if the org isn't verified. Move existing `/employer/{search,vacancies,placements,...}` pages under it. The `(unverified)` peers stay at the `/employer/` root: `/employer/onboarding`, `/employer/organisation` (read-only view of pending state), `/employer/account` (sign-out / change email).

**Trade-off**: file shuffle, but cleaner than scattered guards. The route group has zero URL impact.

### D7  Admin "Request Changes" flips back to `unverified` + sets `adminNote`
Blueprint matches this exactly. No new state. The user lands on the onboarding form with a yellow banner *"Our team asked you to revise this  see the note below"* + the note text. Cleared on resubmit (`adminNote = null`, `verification = 'pending'`).

### D8  Approval is irreversible (no rollback)
Blueprint's rule. If an admin needs to suspend a verified employer post-approval, that's a separate `appUser.suspendedAt` flag (already exists from Phase 7). The vetting state doesn't roll back.

### D9  Mark-as-verified break-glass (admin)
Blueprint's escape hatch for cases like Outlook Safe Links pre-consuming the verification token. Admin can flip `emailVerified = true` from the review modal without auto-signing-in the user (security). Logged as `verification.manual-grant`.

### D10  Email templates default ON (transactional lifecycle)
All 5 KYC emails (verification reminder, submitted, approved, rejected, request-changes) get `defaultEmail: true` in `NOTIFICATION_CATALOG`  same convention as the Phase 9.8 vacancy emails. These are transactional lifecycle events; recipients can opt out per kind in `/employer/notifications/preferences`. Sending stays gated by `feature_flag_email_notifications` (already ON).

---

## ✅ PRE-FLIGHT CHECKLIST (run before writing code)

- [ ] Confirm `signUpEmployer` in `lib/auth/actions.ts` **creates the `organizations` row** on signup with `verification: "unverified"`. If it doesn't today, that's part of 9.10.1.
- [ ] Confirm `verifyOrgVerified()` in `lib/auth/dal.ts` already returns the verification state and redirects on miss  if it does, the layout wiring is one line per protected route group.
- [ ] Confirm `lib/storage/upload.ts` exports a generic upload helper that accepts a `kind` parameter (not hard-coded to seeker contexts).
- [ ] Confirm `NOTIFICATION_CATALOG` entries `org.verified` / `org.rejected` / `verification.queued` exist with the audiences documented above.
- [ ] Confirm `audit_log` accepts the new kinds we'll add (`org.review.approve`, `org.review.reject`, `org.review.request-changes`, `verification.manual-grant`, `org.documents.upload`).

---

## 📋 TASKS

### Task 9.10.1: Schema + signup wiring
- [ ] Migration `0019_phase9_10_org_vetting.sql` (additive):
      - `organizations` += `verified_at` timestamp, `verified_by_user_id` text FK to `app_user.id`, `rejection_reason` text, `admin_note` text. All nullable.
      - New table `organization_documents`: `id`, `organization_id` (FK CASCADE), `kind` (enum: `company_reg_cert` / `tax_clearance` / `proof_of_address` / `bank_confirmation` / `other`), `original_name`, `storage_key`, `mime_type`, `size_bytes`, `uploaded_by_user_id` FK, `uploaded_at` timestamp default now. Unique on (organization_id, kind) for the 4 required slots; `other` allows multiple.
- [ ] Drizzle schema + types extended.
- [ ] **`signUpEmployer`** Server Action: confirm it creates the `organizations` row at signup (if not already); if not, add the insert with `verification: 'unverified'` + the user as Owner.
- [ ] AuditKind union extended with `org.review.approve`, `org.review.reject`, `org.review.request-changes`, `verification.manual-grant`, `org.documents.upload`.
- [ ] Migration applied to Neon.

### Task 9.10.2: Onboarding form + status screens
- [ ] New surface `/employer/onboarding` (route NOT under the new `(verified)` group)  server-rendered, status-driven, five sub-views:
      - **emailVerified=false**  *"Verify your email to continue"* + resend button (re-uses existing `/api/auth/resend-verification`)
      - **`unverified` + `emailVerified`**  the onboarding form (4 required document slots + 1 optional, physical address textarea, VAT number optional)
      - **`pending`**  *"Thanks  your application is under review. We typically respond within one business day."* No actions.
      - **`verified`**  auto-redirect to `/employer` after 2s, with green confirmation.
      - **`rejected`**  red callout with `rejection_reason` verbatim + *"Contact support if you'd like to discuss."*
- [ ] **`<OrgOnboardingForm>`** (client island):
      - 4 required file inputs + 1 optional + address + VAT.
      - Sequential uploads on submit with progress (*"Uploading 3 of 5…"*).
      - Pre-fill from the org row so a request-changes resubmission starts with previous values (except docs  see D5).
      - Yellow banner at the top when `adminNote` is set; cleared on submit.
      - Mobile-first: single column on phones; file inputs are tap-friendly; the submit button stays sticky at the bottom of the form on mobile.
- [ ] **`submitOrgOnboarding`** Server Action:
      - Validates required fields + required docs.
      - Replaces the `organization_documents` set (delete-then-insert in a transaction).
      - Flips `organizations.verification` to `'pending'`, clears `admin_note`.
      - Fires `verification.queued` notification to all admins (in-app + email).
      - Fires submission-confirmation email to the org Owner.
      - Audit-logged as `org.documents.upload` (per doc) and `org.review.request-changes`  no, just one `org.submit` audit row with doc count. **Reserve `org.submit` audit kind in 9.10.1.**

### Task 9.10.3: `/employer/*` layout gate
- [ ] Create new route group `app/[locale]/(employer)/employer/(verified)/`. Move existing protected pages into it:
      `search` / `vacancies` / `placements` / `shortlists` / `saved-searches` / `team` / `dossier` / `notifications` (the operational surfaces).
- [ ] Keep at the root (no `(verified)` gate): `onboarding`, `organisation` (read-only when not verified), `account`, the top-level `/employer` page (lands on a dashboard that nudges toward onboarding when not verified).
- [ ] `(verified)/layout.tsx` calls `verifyOrgVerified()`  redirects to `/employer/onboarding` on miss.
- [ ] Top-level `/employer` page: when `verification !== 'verified'`, render a callout *"Complete your verification to unlock candidate search + invites"* with a CTA to `/employer/onboarding`. When verified, render the normal employer dashboard.

### Task 9.10.4: Admin review queue
- [ ] New route `/admin/moderation/organisations` (tab-style addition to the existing moderation surface). Or, if cleaner, top-level `/admin/organisations`  decide during build based on the existing layout.
- [ ] **`<OrganisationVettingTable>`**: tabs (Pending review · Onboarding · Approved · Rejected · All) with counts. Search across company name / contact name / email / registration number. Manual refresh button.
- [ ] **`<OrganisationReviewModal>`**: large dialog (~680px wide, max 90vh, scrollable on phones).
      - Header: company name + org id (mono, small) + state pill.
      - Status-specific context cards: yellow "user hasn't verified yet" / blue "email verified, waiting on form" / red "previous rejection" / amber "admin note still visible".
      - Company info grid: legal name, reg, country, VAT, address.
      - Documents list: one row per doc with the requirement name + filename, click  opens signed-URL in new tab.
      - Action prompts: yellow textarea when collecting a reject reason or admin note.
      - Footer actions, state-dependent:
        - **emailVerified=false**: *Mark as verified* (break-glass amber) · *Resend verification email* (blue)
        - **unverified + verified email**: (nothing actionable  waiting on user)
        - **pending**: *Request Changes* (amber) · *Reject* (red outline) · *Approve* (emerald)
        - **verified**: read-only
        - **rejected**: read-only, shows previous reason
- [ ] Five admin Server Actions (all guarded by `verifyAdmin()`):
      - `approveOrganisation(orgId)`  flips to `verified` + stamps `verified_at` / `verified_by_user_id`, clears `rejection_reason` + `admin_note`, fires `org.verified` notification to org members (with the org id as account reference), audits as `org.review.approve`.
      - `rejectOrganisation({ orgId, reason })`  flips to `rejected` + stamps `rejection_reason`, fires `org.rejected` notification, audits as `org.review.reject`. **Doesn't delete the org or user**  they can be re-vetted later.
      - `requestChangesOnOrganisation({ orgId, note })`  flips back to `unverified` + stamps `admin_note`, fires request-changes notification (new kind `org.review.changes`), audits as `org.review.request-changes`.
      - `resendOrgVerificationEmail(orgId)`  re-fires `auth.api.sendVerificationEmail()` for the Owner. No state change.
      - `markOrgEmailVerified(orgId)`  break-glass per D9. Constraints: caller must be admin, target must be the org Owner, target must currently be unverified. Audits as `verification.manual-grant`. **Does NOT auto-sign-in the user.**

### Task 9.10.5: Email templates
- [ ] New `NOTIFICATION_CATALOG` entry `org.review.changes` (audience: `org_members`, `defaultInApp: true`, `defaultEmail: true`).
- [ ] Five new templates in `lib/email/templates/notifications.ts` using the existing `genericTemplate()` shell:
      - `org.verification.reminder` (seeker pattern? no  this is the existing Better Auth verification path; might already work). Confirm during build  may not be a new template.
      - **`org.documents.submitted`**  to the Owner: *"We received your application — typically reviewed within one business day."* (Tied to a new catalog kind or reused via direct `sendEmail()` call.)
      - **`org.verified`**  to org members: *"You're verified  welcome. Your account reference is {orgId}."*
      - **`org.rejected`**  to org members: *"Your verification was not approved. Reason: {reason}. Reply to discuss."*
      - **`org.review.changes`**  to org members: *"We need some updates: {note}. Open your application to revise + resubmit."*
      - **`verification.queued`**  to admins: *"{orgName} submitted KYC for review. Open the admin queue."*
- [ ] Templates default ON per D10. Email channel still gated by `feature_flag_email_notifications` (already ON).

### Task 9.10.6: Seed + verify + doc convention
- [ ] **Seed updates** (`db/seed.ts`):
      - Existing Discovery Bank stays `verification: 'verified'` so dev flows aren't broken.
      - Add 3 new fixture orgs: one `unverified` (email pending), one `unverified` + emailVerified (onboarding pending), one `pending` (admin queue has something to review), one `rejected` (with a reason). Each gets its own seeded org + owner user + the matching `organization_documents` rows where applicable.
- [ ] Compliance assertions  consider extending `lib/analytics/outcomes-compliance.ts` with: (g) *every seeker-PII-touching action requires the actor's org to be `verified`*  belt-and-braces over the layout gate. Worth a runtime walk.
- [ ] Verified: `npm test` green · `npm run typecheck` clean · `npm run build` clean · `npm run db:migrate` + `npm run db:seed` runs end-to-end. Mobile smoke at 360 px for the onboarding form + the admin review modal.
- [ ] On ship: `docs/completed/PHASE_9_10_COMPLETE.md`; move this plan to `docs/completed/`; tick 9.10 in `ROADMAP.md` ✅; refresh **Current State** in `TO_START_EVERY_SESSION.md`; commit `Phase 9.10 complete + Phase 10 still next`.

---

## 🚫 OUT OF SCOPE FOR 9.10 (explicit guardrails)

- ❌ **Admin-managed document requirements CRUD** (D1). Hardcoded SA set ships; CRUD lands post-launch when there's evidence of jurisdiction variance demand.
- ❌ **Document expiry / annual re-vetting cron.** The blueprint flags this; we don't build it for v1. Proof-of-address is captured as-of submission; admin can request changes manually if needed.
- ❌ **Per-document admin notes.** One org-level `admin_note` field is enough for v1. Per-doc commentary is post-launch.
- ❌ **Multi-admin review lock** (`lockedByAdminId`). Single-admin convention; if two admins both click Approve, last writer wins. Add lock if we grow to multi-admin review.
- ❌ **Audit trail of past submissions.** D5  last submission wins. No `revision` column on `organization_documents`.
- ❌ **Country dropdown UX polish.** A 2-letter ISO textbox is fine for v1; the seed org owners can self-correct.
- ❌ **Activate `feature_flag_kyc_provider`.** The KYC partnership integration stays dormant. This phase is the manual-vetted equivalent. When the partnership confirms, the flip is a separate concern  the manual path stays as the fallback.
- ❌ **Onboarding wizard / multi-step form.** Single-page form per the blueprint (faster for B2B + admin pre-fills work).

---

## ⚠️ RISK AREAS (read before shipping)

Carried from the blueprint, plus Sebenza-specific:

1. **Outlook Safe Links pre-consume the verification token.** Already mitigated by `/verify-email`'s error branch + the admin break-glass *Mark as verified* per D9. Confirm the existing `/verify-email` page reads `?error=...`  if not, add it.
2. **Document upload size limits.** Supabase default is 50 MB; the existing `lib/storage/upload.ts` should already cap. Add per-doc-kind soft cap (10 MB) at the form level.
3. **Resubmission wipes old docs** (D5). Acceptable; the admin "Request Changes" pre-fills previous text fields so the user only re-uploads what changed.
4. **The layout gate must not blackhole existing seeded employer.** Discovery Bank stays seeded `verified` so dev flows aren't broken on first run after the gate ships. **Seeding sequence matters**  the new fixtures must be inserted alongside, not in place of, the existing one.
5. **Compliance bleed.** A bug in the gate that lets an `unverified` employer reach `/employer/dossier/[handle]` is a Phase 5 redaction violation. Compliance check (g) (proposed in 9.10.6) walks this  worth shipping even though no equivalent exists today.
6. **Approval irreversibility** (D8). Once `verified`, no auto-rollback; suspension is a separate flag. Document this in the admin review modal copy so admins don't expect a Reject button on an Approved org.

---

## 🧭 WHY THIS IS ON-AXIS (and not feature creep)

Phase 10 is the public-launch fence. Manual employer vetting is not a *feature*  it's the trust gate that has to exist before launch, because today any verified-email employer can reveal real seeker contact details. The Phase 8 KYC provider flag is dormant pending partnership; this phase replaces that placeholder with admin labour so the gate is actually load-bearing on day 1.

The trim from the blueprint (D1, deferring admin-managed-requirements CRUD) cuts the most jurisdiction-specific piece while keeping the load-bearing flow intact. ~1 focused session (comparable to 9.8.4 in size). Won't push Phase 10.

*Plan opened 2026-05-24. Target: complete before Phase 10 (public launch) opens.*
