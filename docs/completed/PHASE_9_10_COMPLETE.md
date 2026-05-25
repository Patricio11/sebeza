# Phase 9.10  Employer KYC / Org Vetting Flow · ✅ COMPLETE (2026-05-25)

Side-phase between Phase 9.9 and Phase 10 (public launch). Replaces the dormant `feature_flag_kyc_provider` partnership path with admin-mediated org vetting: employer signs up + verifies email  uploads 4 SA-standard KYC documents on `/employer/onboarding`  admin reviews on `/admin/verifications`  approves / rejects with reason / requests changes with note  notifications + emails fire + the org's `verification` column drives every PII-touching surface downstream.

Distilled from `docs/ONBOARDING_KYC_BLUEPRINT.md`. Companion docs: `PHASE_9_10_PLAN.md` (this directory), `docs/ROADMAP.md`, `docs/TO_START_EVERY_SESSION.md`.

---

## The headline

Today, before this phase: any signed-up employer with a verified email could browse `/employer/*` and  the moment they revealed a contact or downloaded a document  hit `verifyOrgVerified()` which hard-redirected them to a static `/employer/organisation` settings page where they could *see* the unverified state but couldn't do anything about it. The trust gate existed in name only.

After this phase: the same employer lands on `/employer/onboarding` (the new actionable surface), uploads 4 SA-standard KYC docs (Company registration certificate / Tax clearance / Proof of address / Bank confirmation) + their physical address, and clicks Submit. An admin sees the queue at `/admin/verifications`, opens the review modal with signed-URL inline access to every document, and clicks Approve  fires the verified notification + email, stamps `verified_at` + `verified_byUserId`, and unlocks every PII feature for the org.

The same admin can also Reject (with a reason  surfaced verbatim on the rejected screen), Request Changes (with a note  surfaced as a yellow banner on the form so the Owner only revises what's flagged), Resend verification email (for Outlook Safe Links cases), or Mark-as-verified break-glass (when the verification link is truly lost  doesn't auto-sign-in the user).

---

## What shipped

### 9.10.1  Schema + storage extension
- Migration `0019_phase9_10_org_vetting.sql` applied to Neon:
  - `organizations` += `verified_at`, `verified_by_user_id` FK, `rejection_reason`, `admin_note`, `company_address`, `vat_number` (all nullable; existing orgs unaffected).
  - New `organization_documents` table + `org_document_kind` enum (5 values). UNIQUE partial index on (`organization_id`, `kind`) WHERE `kind <> 'other'` so one row per required kind dedupes naturally; `other` is append-only.
- Drizzle schema mirrors the migration.
- AuditKind union extended with 7 new kinds (`org.submit`, `org.review.approve`, `org.review.reject`, `org.review.request-changes`, `org.documents.upload`, `org.verification.resend`, `verification.manual-grant`).
- `lib/storage/upload.ts` extended with `uploadOrgDocument()`  same magic-byte sniff + rate limit + size cap (10 MB) as `uploadDocument()`, different folder (`{ownerUserId}/org-documents/...`).

### 9.10.2  Onboarding form + status screens
- `/employer/onboarding` page  server-rendered, **5 status-aware sub-views**:
  - **emailVerified=false**  *"Verify your email first"* + resend button via the existing `resendVerificationEmail` Server Action.
  - **unverified + emailVerified**  the onboarding form (4 required slots + 1 optional `other` slot up to 3 files + address + VAT). When `admin_note` is set, a yellow banner pins it at the top  cleared server-side on resubmit.
  - **pending**  *"Under review  typically responded to within one business day."* No actions.
  - **verified**  immediate server-redirect to `/employer` (no 2s wait).
  - **rejected**  red callout with `rejection_reason` verbatim + contact-support nudge.
- `<OrgOnboardingForm>` client island. **Architectural choice**: per-file upload as the user picks them (one upload = one Server Action request via FormData)  the server replaces the previous file of the same required kind on each pick. `other` is append-only up to 3. Mobile-first: form sticky submit bar on phones; document slots stack full-width at 360 px wide.
- `lib/employer/vetting.ts` ships Owner-only Server Actions:
  - `uploadOrgDocumentFile(formData)`  validates + uploads + replaces previous row of the same kind; audits `org.documents.upload`.
  - `deleteOrgDocument(documentId)`  removes a row + best-effort storage cleanup.
  - `submitOrgOnboarding({companyAddress, vatNumber, city})`  validates required docs all present, flips verification 'unverified'  'pending', clears `admin_note` + stale `rejection_reason`, fires `verification.queued` to all admins + `org.documents.submitted` to the Owner, audits as `org.submit`.
- `vetting-types.ts` sibling for the label catalogue + types (so client islands can import without dragging a `"use server"` boundary  same pattern as 9.8.5's `invitations-types.ts`).

### 9.10.3  Gate redirect + banner wiring (D6 deviation)
**Deviated from the plan's D6**: the planned `(verified)` route-group file shuffle was rejected as belts-and-braces. The per-page guard convention from Phase 5 (PII-touching surfaces call `verifyOrgVerified()`; permissive surfaces call `verifyEmployer()`) already covers every load-bearing path  the pre-9.10 audit confirmed clean coverage across all 13 employer pages. The file shuffle would have moved ~9 directories without preventing any concrete bug.
- `verifyOrgVerified()` redirect target changed: was `/employer/organisation` (a static settings page), now `/employer/onboarding` (the actionable KYC surface).
- `OrgVerificationBanner` link target changed: same redirect update.
- Bug fix swept in (commit `bdb12ae`): 9.8.6's `getPlacementsForVacancy()` was using the hard `verifyOrgVerified()` gate (wrong for a read; redirected unverified employers away from the vacancy detail page). Read is now permissive (`verifyEmployer()` + org-scoped query); writes (`markAsHired`, `deletePlacement`) keep the hard gate.

### 9.10.4  Admin review queue
- **Route reuse, not new route**: extended the existing `/admin/verifications` page (which already had a qualifications + organisations tab pair from Phase 7). The Phase 7 simple list is replaced with a richer 4-group view: Pending review · Drafts · Rejected · Verified.
- `lib/admin/org-vetting.ts` ships:
  - `listOrgsForReview()` returning 4 grouped buckets with Owner email + emailVerified flag + doc count per row. One round-trip, capped 500.
  - `getOrgReviewDetail(orgId)`  full review payload including signed-URL per document (minted on demand at click time so the queue page doesn't waste tokens).
  - **5 admin Server Actions** (all `verifyAdmin()`-guarded):
    - `approveOrg(orgId)`  flips to `verified` + stamps `verified_at` / `verified_by_user_id`, clears stale rejection / admin-note, fires `org.verified` notification with the orgId as account reference (D3), audits as `org.review.approve`.
    - `rejectOrg({orgId, reason})`  flips to `rejected` + stamps `rejection_reason`, fires `org.rejected` with the reason, audits as `org.review.reject`. Doesn't delete the org or user  they can be re-vetted later.
    - `requestChangesOnOrg({orgId, note})`  flips back to `unverified` + stamps `admin_note`, fires `org.review.changes` notification (new kind), audits as `org.review.request-changes`. Owner lands on form with yellow banner + previous values pre-filled per D5.
    - `resendOrgVerificationEmail(orgId)`  re-fires `auth.api.sendVerificationEmail()` for the Owner. No state change.
    - `markOrgEmailVerified(orgId)`  break-glass per D9. Refuses if already verified. **Does NOT auto-sign-in the user** (security: admin shouldn't silently land in someone else's session).
- `<OrgReviewLauncher>` button per row  fetches the detail on click, opens the modal.
- `<OrgReviewModal>` client island  bottom-sheet on phones / centred on `md+`, status-specific context cards, company-info grid, signed-URL document list with per-doc Open button, conditional reason / note textareas (10500 chars, live char counter), state-dependent footer actions.
- **Existing Phase 7 `approveOrganisation` + `rejectOrganisation` in `lib/admin/verifications.ts` left intact** for backwards compat; new code uses the richer Phase 9.10 actions in `lib/admin/org-vetting.ts`.

### 9.10.5  Email templates
- 2 new `NOTIFICATION_CATALOG` entries: `org.documents.submitted` + `org.review.changes`. Both default-ON for email per D10.
- 4 new templates wired into `lib/email/templates/notifications.ts` using the existing `genericTemplate()` shell:
  - `org.documents.submitted`  "Application received"
  - `org.review.changes`  "Updates needed"
  - `verification.queued`  "New submission" (catalog entry existed since Phase 7 without a template)
  - `org.rejected`  "Verification not approved" (catalog entry existed since Phase 7 without a template)
- `org.verified` already had a template from Phase 7  no change.
- Sending stays gated by `feature_flag_email_notifications` (admin-controlled, ON in this env).

### 9.10.6  Seed + verify
- New `seedPhase9_10OrgVetting()` adds 3 lifecycle fixture orgs alongside the existing Discovery Bank seed:
  - **Acme Logistics**  `pending` (4 docs uploaded; the admin queue's primary actionable row).
  - **Globex Industries**  `rejected` (admin rejected with a reason; demos the seeker-side RejectedScreen).
  - **Initech**  `unverified` + `emailVerified` (Draft state; demos the empty onboarding form).
- Each fixture has its own Owner user + Better Auth account + organisation_members row. Document storage keys are placeholders (the admin modal shows "URL signing failed" gracefully); real uploads on actual flows will work normally.
- Truncate order extended to drop `organization_documents` before `placements`.
- Verified: `npm test` 22/22 green · `npm run typecheck` clean · `npm run build` clean (new routes `/[locale]/employer/onboarding` + `/[locale]/admin/verifications` registered) · `npm run db:seed` runs end-to-end.

---

## Out-of-scope (carried from plan)

| Not built | Why |
|---|---|
| Admin-managed document requirements CRUD (D1) | Hardcoded SA-standard 4 docs ships; admin-managed CRUD adds ~3 hours + a sub-route + a schema table; defer until evidence of jurisdiction variance demand. |
| `(verified)` route-group file shuffle (D6 deviation) | Belts-and-braces over per-page guards that already cover every load-bearing path. The file shuffle would have moved ~9 directories without preventing any concrete bug. |
| Document expiry / annual re-vetting cron | Plan flagged this; not built for v1. Proof-of-address is captured as-of submission; admin can request changes manually. |
| Per-document admin notes | One org-level `admin_note` is enough for v1. Per-doc commentary is post-launch. |
| Multi-admin review lock | Single-admin convention; if two admins both click Approve, last writer wins. Add `locked_by_admin_id` if needed at scale. |
| Audit trail of past submissions | D5  last submission wins. No `revision` column. |
| Country dropdown UX polish | 2-letter ISO textbox is fine for v1. |
| Activate `feature_flag_kyc_provider` | Stays dormant. This phase is the manual-vetted equivalent. |

---

## Risk areas + mitigations (carried from blueprint)

1. **Outlook Safe Links pre-consume the verification token**  mitigated by the existing `/verify-email` error branch + the new admin *Mark as verified* break-glass.
2. **Document upload size limits**  10 MB cap enforced server-side by `uploadOrgDocument()` (`DOC_MAX_BYTES`).
3. **Resubmission wipes old required-kind docs**  acceptable; the admin "Request Changes" flow keeps the Owner in the `unverified` state with previous text fields pre-filled so they only re-upload what was flagged.
4. **The gate must not blackhole the existing seeded employer**  Discovery Bank stays seeded with `verification` driven by `MOCK_EMPLOYER.orgVerified` (currently `false`) so dev can test the gate. The 3 new fixtures land alongside.
5. **Compliance bleed if a gate has a bug**  the previous audit (pre-9.10) confirmed all PII-touching surfaces correctly call `verifyOrgVerified()`. The 9.8.6 bug in `getPlacementsForVacancy()` was found + fixed before this phase shipped.

---

## Migrations applied

- `0019_phase9_10_org_vetting.sql` (9.10.1)  6 new columns on `organizations` + `org_document_kind` enum + `organization_documents` table + 3 indexes (partial UNIQUE + secondary + org-scope).

---

## Why this is the Sebenza version

The blueprint's biggest unbundling was admin-managed requirements (Phase F). We deferred it (D1) and bought ~3 hours of build time we used on a tighter admin modal, richer compliance audit logging, and a fully working email flow on top of the existing Resend infra. The trade-off  jurisdiction-specific documents need a code change to add  is an honest pre-launch posture: when a real employer asks for one, the conversation is "should we ship admin-managed CRUD now?", not "let's untangle a six-week schema migration."

The other deviation (D6, skipping the `(verified)` route group) was the right call once we audited: per-page guards already cover everything. The plan-time anxiety about scattered guards was real but the audit showed the convention works. The redirect-target fix to `verifyOrgVerified()` did more for UX than the file shuffle would have.

The platform is now KYC-gated on day 1 of public launch. Phase 10 (the public-launch fence) opens next  no new features there, just polish + perf + i18n + the credentials flip.

Plan opened + shipped same day, 2026-05-25, two days before Phase 10 (public launch) opens.
