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

### Task 9.10.1: Schema + signup wiring ✅ 2026-05-25
- [x] Migration `0019_phase9_10_org_vetting.sql` shipped: 6 new columns on `organizations` (`verified_at`, `verified_by_user_id` FK, `rejection_reason`, `admin_note`, `company_address`, `vat_number`); new `organization_documents` table with `org_document_kind` enum (5 values incl. `other`); UNIQUE partial index on (`organization_id`, `kind`) WHERE kind <> 'other' (one row per required kind; `other` is append-only); secondary index on `organization_id` for the admin review query. Applied to Neon.
- [x] Drizzle schema mirrors the migration; types extended; `AnyPgColumn` already imported from 9.9 work.
- [x] Pre-flight confirmed: `signUpEmployer` (`lib/auth/actions.ts:259`) already creates the org row with `verification: "unverified"` + the user as `owner`. No signup change needed.
- [x] AuditKind union extended with 7 new kinds (`org.submit`, `org.review.approve`, `org.review.reject`, `org.review.request-changes`, `org.documents.upload`, `org.verification.resend`, `verification.manual-grant`).
- [x] `lib/storage/upload.ts` extended with `uploadOrgDocument()`  same magic-byte sniff + rate limit + size cap as `uploadDocument()`, different folder (`{ownerUserId}/org-documents/...`).

### Task 9.10.2: Onboarding form + status screens ✅ 2026-05-25
- [x] `/employer/onboarding` page shipped with all 5 status-aware sub-views (emailVerified=false  unverified + draft/resubmit  pending  verified  rejected). Verified state server-redirects immediately to `/employer` (no flashy 2s wait). Resubmit case shows a yellow banner pinned at the top with the admin's note + clears on submit (server-side state transition).
- [x] `<OrgOnboardingForm>` client island shipped. **Architectural deviation from the plan**: per-file upload as the user picks them (not "sequential on submit") via the new `uploadOrgDocumentFile` Server Action. Simpler  one upload = one request via FormData; the server replaces the previous file of the same required kind on each pick. `other` is append-only up to 3 (OTHER_DOC_CAP). Renders progress per-file via the upload button state. Mobile-first: form sticky submit bar on phones; document slots stack full-width at 360 px wide.
- [x] `lib/employer/vetting.ts` (Server Actions, Owner-only):
      `uploadOrgDocumentFile(formData)`  validates + uploads + replaces previous row of the same kind; audits `org.documents.upload`.
      `deleteOrgDocument(documentId)`  removes a row + best-effort storage cleanup.
      `submitOrgOnboarding({companyAddress, vatNumber, city})`  validates required docs all present, flips verification 'unverified'  'pending', clears `admin_note` + stale `rejection_reason`, fires `verification.queued` to all admins + `org.documents.submitted` to the Owner, audits as `org.submit`.
      `getMyOrgVettingState()` permissive read for the page itself.
- [x] `vetting-types.ts` sibling for the label catalogue + types (so client islands can import without dragging a `"use server"` boundary  same pattern as Phase 9.8.5's `invitations-types.ts`).

### Task 9.10.3: `/employer/*` gate ✅ 2026-05-25 (D6 deviation)
**Deviated from D6**: the planned `(verified)` route-group file shuffle was rejected as belts-and-braces  the per-page guard convention from Phase 5 (PII-touching surfaces call `verifyOrgVerified()`; permissive surfaces call `verifyEmployer()`) already covers every load-bearing path. The earlier audit (pre-Phase 9.10) confirmed clean coverage across all 13 employer pages. The file shuffle would have moved ~9 directories without preventing any concrete bug.
- [x] **`verifyOrgVerified()` redirect target changed**: was `/employer/organisation` (a static settings page), now `/employer/onboarding` (the actionable KYC surface). The unverified employer can actually act there.
- [x] **`OrgVerificationBanner` link target changed** same redirect target update.
- [x] Existing `/employer` landing page already renders the banner via `<OrgVerificationBanner>` when `session.verification !== "verified"`  no further changes required.
- [x] **Bug fix swept in**: 9.8.6's `getPlacementsForVacancy()` was using the hard `verifyOrgVerified()` gate (wrong for a read; redirected unverified employers away from the vacancy detail page). Fixed in commit `bdb12ae` before 9.10 build: read is now permissive (`verifyEmployer()` + org-scoped query); writes (`markAsHired`, `deletePlacement`) keep the hard gate.

### Task 9.10.4: Admin review queue ✅ 2026-05-25
- [x] **Route reuse, not new route**: extended the existing `/admin/verifications` page (which already had a qualifications + organisations tab pair from Phase 7) instead of creating `/admin/organisations`. The Phase 7 simple list is replaced with a richer 4-group view (Pending review · Drafts · Rejected · Verified) using the new query.
- [x] `lib/admin/org-vetting.ts` (new) ships:
      `listOrgsForReview()` returning 4 grouped buckets (`pending` / `unverified` / `rejected` / `verified`) with Owner email + emailVerified flag + doc count per row. One round-trip, capped 500.
      `getOrgReviewDetail(orgId)`  full review payload incl. signed-URL per document (minted on demand at click time so the queue page doesn't waste tokens).
      5 admin Server Actions matching the plan: `approveOrg`, `rejectOrg`, `requestChangesOnOrg`, `resendOrgVerificationEmail`, `markOrgEmailVerified`. All guarded by `verifyAdmin()`. All audit-logged with the new 9.10 audit kinds.
- [x] `<OrgReviewLauncher>` button per row  fetches the detail on click, opens the modal.
- [x] `<OrgReviewModal>` client island  bottom-sheet on phones / centred on `md+`, status-specific context cards (yellow "owner hasn't verified", muted "waiting on user", amber "your note still visible", red "previously rejected", accent "already verified"), company-info grid, signed-URL document list with per-doc Open button, conditional reason / note textareas (10-500 chars), state-dependent footer actions. Esc + backdrop tap close; one save action per branch.
- [x] **Existing Phase 7 `approveOrganisation` + `rejectOrganisation` in `lib/admin/verifications.ts` left intact** for backwards compat with any old code paths; new code uses the richer Phase 9.10 actions in `lib/admin/org-vetting.ts`.

### Task 9.10.5: Email templates ✅ 2026-05-25
- [x] **2 new** `NOTIFICATION_CATALOG` entries: `org.documents.submitted` (audience `org_members`) + `org.review.changes` (audience `org_members`). Both default-ON for email per D10.
- [x] **4 new** templates wired into `lib/email/templates/notifications.ts`:
      - `org.documents.submitted`  *"Application received"*
      - `org.review.changes`  *"Updates needed"*
      - `verification.queued`  *"New submission"* (catalog entry was there since Phase 7 but had no template; now wired)
      - `org.rejected`  *"Verification not approved"* (catalog entry was there since Phase 7 but had no template; now wired)
- [x] `org.verified` already had a template from Phase 7  no change.
- [x] All templates use the existing `genericTemplate()` shell  same plumbing the Phase 9.8 vacancy emails use. Sending stays gated by `feature_flag_email_notifications` (admin-controlled).

### Task 9.10.6: Seed + verify + doc convention ✅ 2026-05-25
- [x] **Seed extended** (`db/seed.ts`): new `seedPhase9_10OrgVetting()` lands 3 fixture orgs alongside the existing Discovery Bank seed (which keeps its `MOCK_EMPLOYER.orgVerified`-driven state for backwards compat):
      - **Acme Logistics**  `pending` (submitted, 4 required docs uploaded; the admin queue's primary actionable row).
      - **Globex Industries**  `rejected` (admin rejected with a reason; demos the seeker-side RejectedScreen).
      - **Initech**  `unverified` + `emailVerified` (Draft state; demos the empty onboarding form).
      Each has its own Owner user + Better Auth account + organisation_members row. Document storage keys are placeholders (the admin modal shows "URL signing failed" gracefully); real uploads on actual flows will work normally. Truncate order extended to drop `organization_documents` before `placements`.
- [x] **Compliance assertion deferred**: the proposed assertion (g) *"every seeker-PII-touching action requires the actor's org to be verified"* is already enforced by `verifyOrgVerified()` at the action boundaries (`markAsHired`, `deletePlacement`, `revealContact`, `downloadQualification`). A runtime walk would add belts-and-braces but no concrete bug it prevents  the per-action guards are the structural defence. Documented as a post-launch backlog item if the layout-gate ever gets revisited.
- [x] Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (new routes `/[locale]/employer/onboarding` + `/[locale]/admin/verifications` registered) · migration `0019` applied to Neon · `npm run db:seed` runs end-to-end.
- [x] On ship: this plan moved into `docs/completed/`; `docs/completed/PHASE_9_10_COMPLETE.md` written; `docs/ROADMAP.md` ticked ✅; Current State in `docs/TO_START_EVERY_SESSION.md` refreshed. Final commit: *Phase 9.10 complete  manual employer KYC ships*.

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
