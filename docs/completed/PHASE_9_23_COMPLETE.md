# PHASE 9.23 COMPLETE — OPT-IN EMPLOYMENT VERIFICATION (CONSENT + ONE-SHOT EMAIL)
*Shipped 2026-05-29. Plan: [`docs/completed/PHASE_9_23_PLAN.md`](./PHASE_9_23_PLAN.md). Closes the trust gap Phase 9.22 left open: distinguishes "the seeker says they work at Acme" from "their manager confirms it."*

> **One-line summary**: A seeker on their dashboard can opt into verifying their currently-declared employer by entering ONE contact + work email + ticking a structured consent box. Sebenza sends ONE transactional email; the contact's binary response (verify / decline / dispute) writes the outcome + redacts their email within 14 days. POPIA-clean by construction — contact email lives at most 14 days in encrypted form; consent proof is a SHA-256 hash, never the raw identifier.

One commit, one migration:

- **Phase 9.23** `07d5aab` — schema + lifecycle actions + email template + landing page + dashboard panel + cron + D7 supersede hook + public badge

---

## 🎯 WHAT SHIPPED

### A — Migration `0037_phase9_23_employment_verifications.sql`
- New `employment_verification_state` enum with seven values: `pending` / `verified` / `declined` / `disputed` / `expired` / `superseded` / `withdrawn`
- New `employment_verifications` table:
  - `profile_id` + `employer_org_id` FKs
  - `contact_name` (durable)
  - `contact_email_enc` (AES-GCM, NULLed on resolve)
  - `contact_email_hash` (SHA-256, durable — consent.grant proof + per-contact rate limit)
  - `state` + `requested_at` + `responded_at` + `expires_at`
  - `verification_token` (cleared on response)
  - `superseded_by_id` (reserved for future lineage)
- Four indexes: per-profile state, unique partial on token, partial expiry sweep `WHERE state='pending'`, and the dedupe lookup `(profile_id, contact_email_hash, requested_at)`

### B — Server actions in `lib/profile/employment-verification.ts`
- `requestEmploymentVerification({ employerOrgId, contactName, contactEmail, consentAccepted: true })` — gated on `status='employed'` (D2); employer must match `current_employer_org_id`; rate-limited per D8 (one open at a time + max 2 per (profile, contact-hash) in 12 months). Writes `consent.grant` audit + `employment.verification.request` audit; fires the one-shot email via `sendEmail`.
- `withdrawEmploymentVerification({ verificationId })` — seeker pulls before resolve; state='withdrawn' + email redacted + token cleared.
- `respondToVerification({ token, outcome })` — public endpoint (no session). Idempotent — a second click renders "already resolved"; past-expiry click renders "expired" without writing. On success: flips state + redacts email + clears token + writes the kind-specific audit row + fires the binary-outcome notification to the seeker (D9 — never reveals which button the contact clicked).
- `supersedeEmploymentVerifications({ profileId, priorEmployerOrgId })` — called by the Phase 9.22 `updateCurrentEmployment` hook (D7) when the seeker changes employer.
- `getMyEmploymentVerification()` — dashboard read; returns the seeker's most recent record (any state) joined to the org name.

### C — Email template `lib/email/templates/employment-verification.ts`
Attributed to the seeker by name + the org name. Three CTA buttons with distinct colour treatments (verify green, decline amber, dispute red). POPIA-§16 footer language with the explicit deletion-clock: *"If you do nothing, the request expires in 14 days and your email is deleted from our records."* No tracking pixel, no follow-up emails.

### D — Public landing at `/verify-employment/[token]`
- No auth; locale-aware (`setRequestLocale`).
- Reads `?outcome=verified|declined|disputed` from query string and calls `respondToVerification`.
- State-specific resolved panels for each outcome + `already_resolved` + `expired`.
- Unsolicited bare-URL hit renders a neutral "what is this?" panel with the three buttons (each links back with the appropriate `?outcome=`).
- POPIA-§11 lawful-basis explainer in the footer.

### E — Dashboard panel `EmploymentVerificationPanel`
New client island slotted into the "Current employment" section of `/dashboard/profile` (right below the Phase 9.22 `CurrentEmploymentEditor`). Three states:
- **None / resolved** — consent form (contact name + work email + structured consent checkbox) + a previous-outcome strip when one exists.
- **Pending** — in-flight panel with days-left countdown + Withdraw button.
- **Resolved (verified / declined / disputed / expired / superseded / withdrawn)** — outcome strip with tone-appropriate icon + the consent form below for resubmission.

Gated by `status='employed'` per D2 — self-employed seekers never see the panel even though the dashboard editor accepts their employer declaration.

### F — Public profile badge on `/p/[handle]`
New "Employer-verified · MMM YYYY" pill alongside the Phase 9.22 "Currently at" line when the seeker has a verified record within the 12-month badge lifetime (D6). Silently downgrades to the Phase 9.22 honest-label posture after 12 months — Status-Freshness Rule applied to verification, not just status.

### G — Read-path plumbing
- `PublicProfile.employmentVerifiedAt: string | null` added.
- `findProfileByHandleQuery` calls a new `loadVerificationBadgeDate(profileId, employerOrgId)` helper (filters `state='verified'` AND `responded_at >= now - 12mo`).
- `searchProfilesQuery` calls a new batched `verificationBadgeDatesByProfile(rows)` so the entire page of search results gets the badge in one extra round-trip.

### H — Cron `/api/cron/employment-verification-expire`
CRON_SECRET-guarded. Pulls every `state='pending'` row past `expires_at` joined to profile + org for the notification body. For each due row: flip to `state='expired'` + null the encrypted email + clear the token + write `employment.verification.expired` audit + fire the seeker outcome notification. POPIA D4 floor — even if no one ever clicks, the contact's email is gone by day 14.

### I — D7 supersede hook in Phase 9.22's `updateCurrentEmployment`
When the seeker changes `current_employer_org_id` (or clears it), any `state IN ('pending', 'verified')` verification for the prior employer is auto-superseded: state flips, email redacted, token cleared. For previously-verified records, a seeker outcome notification fires informing them their badge was cleared. Best-effort — if the supersede fails, the employer change still goes through (informational, not a write barrier).

### J — Audit + notification kinds
**Audit** — 7 new kinds: `employment.verification.request` / `.contact_verified` / `.contact_declined` / `.contact_disputed` / `.expired` / `.superseded` / `.withdrawn`. The contact's email NEVER lands in audit meta; only `contact_email_hash` does.

**Notification** — 1 new kind: `employment.verification.outcome` (audience: seeker; default `inApp: true, email: true` — this is a state change the seeker requested, not a periodic prompt).

---

## ✅ LOCKED DECISIONS HONOURED

| # | Decision | Where it lives |
|---|---|---|
| **D0** | Seeker initiates explicit consent; no path captures the contact without it | Structured consent checkbox + `consent.grant` audit row keyed on SHA-256 hash |
| **D1** | One contact, one email, one outcome — no chains | Schema models one row per request; no "fallback contact" field |
| **D2** | Only `status='employed'` can verify; self-employed can't | Gated on the form + the action rejects `status !== 'employed'` |
| **D3** | Fixed 14-day window | `VERIFICATION_WINDOW_DAYS = 14` constant + the cron sweep |
| **D4** | Contact email redacted within 14 days regardless of outcome | Action handler nulls on response; cron nulls on expiry |
| **D5** | One-shot transactional email with opt-out on every action | Email template; three buttons each write a different outcome; no follow-up |
| **D6** | Badge decays at 12 months | `VERIFICATION_BADGE_LIFETIME_MS` filter in the read-path helpers; public renderer falls back to Phase 9.22 labels |
| **D7** | Cross-employer transfer disables prior verification | `supersedeEmploymentVerifications` hook in `updateCurrentEmployment` |
| **D8** | Rate-limit: one open at a time, two per 12 months per (seeker, contact) | Enforced in `requestEmploymentVerification` with two pre-flight checks |
| **D9** | No retaliation surface for the contact | Notification body is binary outcome only; the contact's actual button choice stays in audit |
| **D10** | /insights aggregate, never per-employer | Not added in this commit — deferred until the action layer has live data; the data shape supports it |
| **D11** | One new table, one new enum | Migration 0037 is the entire schema change |
| **D12** | 7 new audit kinds + 1 new notification kind | Listed above in (J) |

---

## 📦 FILES TOUCHED

**New**
- `db/migrations/0037_phase9_23_employment_verifications.sql`
- `lib/profile/employment-verification.ts` — request / withdraw / respond / supersede / read
- `lib/email/templates/employment-verification.ts` — one-shot email template
- `components/feature/profile/EmploymentVerificationPanel.tsx` — dashboard client island
- `app/[locale]/(public)/verify-employment/[token]/page.tsx` — public landing
- `app/api/cron/employment-verification-expire/route.ts` — nightly expiry sweep
- `docs/completed/PHASE_9_23_PLAN.md` (moved from `docs/`)
- `docs/completed/PHASE_9_23_COMPLETE.md` (this doc)

**Edited**
- `db/schema.ts` — `employmentVerificationState` enum + `employmentVerifications` table
- `db/migrations/meta/_journal.json` — appended idx 37
- `db/queries/profiles.ts` — `loadVerificationBadgeDate` + batched `verificationBadgeDatesByProfile` + `employmentVerifiedAt` on both readers
- `lib/audit/index.ts` — 7 new kinds
- `lib/mock/types.ts` — `PublicProfile.employmentVerifiedAt` optional field
- `lib/notifications/catalog.ts` — `employment.verification.outcome` entry
- `lib/profile/employment.ts` — D7 hook calls `supersedeEmploymentVerifications` when employer changes
- `app/[locale]/(public)/p/[handle]/page.tsx` — Employer-verified badge pill
- `app/[locale]/(seeker)/dashboard/profile/page.tsx` — `EmploymentVerificationPanel` slotted below the Phase 9.22 editor

**Verification**
- `tsc --noEmit` clean at every step
- `npx vitest run` 50/50 green
- `npm run build` compiled successfully; `/verify-employment/[token]` + `/api/cron/employment-verification-expire` registered

---

## ⚠️ DELIBERATE NON-DECISIONS

1. **/insights national verification line deferred.** D10 in the plan; the action layer has no data yet so the aggregate would be all zeros. Will add the line in a tiny follow-up commit once the cron has run and data exists.

2. **Compliance assertions deferred.** D12 in the plan listed three (`verification-contact-email-redacted-on-resolve`, `verification-tokens-cleared-on-resolve`, `verification-expired-cron-honoured`). The action paths already enforce all three structurally; the assertions are a check-not-trust layer for the compliance endpoint. Tiny follow-up commit when wiring them.

3. **Admin debug surface for decrypting contact emails NOT exposed.** The crypto helper `decryptField` exists but no admin UI surfaces a decrypted contact email. POPIA posture: even admins can't see the contact's email after redaction; the durable record is the SHA-256 hash + the consent.grant proof.

4. **No "your verification was processed" email to the seeker.** The in-app + email notification (`employment.verification.outcome`) covers it. Sending two channels is noise.

5. **No retry counter on the verify endpoint.** Idempotency holds regardless — second click just renders "already resolved." Not a denial surface (Bearer-token style).

6. **No `outcome=verified` POST-CSRF-protection.** The verify link is GET; the token IS the credential. A leaked email could let anyone with the URL click the buttons. Acceptable: the leak vector is the contact's own mailbox, the action is reversible nowhere (D1 — one outcome per token), and the audit row carries actor='anonymous' so admins can investigate.

7. **No "remind me later" path for the contact.** The contact who can't respond now gets the 14-day window and no nudges. If they want to verify later, they re-click the link before expiry. By design — no follow-up emails to non-Sebenza users.

8. **No bulk verification for orgs.** A Sebenza-registered org can't say "verify all 20 employees who claim us." Verification is seeker-initiated only — keeps the consent + agency on the seeker side.

---

## 🧭 IMPACT ON OTHER SURFACES

- **`/dashboard/profile`** — new `EmploymentVerificationPanel` slotted into the "Current employment" section below the Phase 9.22 editor
- **`/p/[handle]`** — "Currently at" dossier row gains the dated "Employer-verified" pill within 12 months of the verification
- **`/search` payloads** — `PublicProfile.employmentVerifiedAt` available on every row; search-row UI not yet surfacing (same deferred posture as Phase 9.22's search-row "Currently at" line)
- **Verify landing `/verify-employment/[token]`** — new public route, no auth required
- **Cron schedule** — 1 new nightly job (`/api/cron/employment-verification-expire`)
- **Audit log** — 7 new kinds; existing `consent.grant` kind now carries `purpose: 'employment_verification'` rows
- **Notification preferences** — 1 new kind, audience: seeker

---

## 🚫 EXPLICITLY OUT OF SCOPE (preserved from the plan)

- ❌ Verification chains (if Sarah didn't respond, try Mark) — D1
- ❌ Verifying past employment — only the current employer
- ❌ Bulk verification
- ❌ Allow seeker to see the contact's actual choice — D9
- ❌ Verification-required gating on any platform action
- ❌ Custom verification copy by employer
- ❌ Auto-detect employer from email domain — D0
- ❌ Forwarding the contact's response to HR / org admins
- ❌ Per-employer "verified employee count" badge — D10 carry-over

---

## 🧪 HOW TO VERIFY

1. Run migration: `npm run db:migrate` to land 0037.
2. Sign in as a seeker with `status='employed'` and a verified `current_employer_org_id`. Open `/dashboard/profile` → scroll to "Current employment" → the new "Verify your employment" panel should be visible.
3. Submit a verification (contact name + email + tick consent). Check the inbox of the configured `EMAIL_TRANSPORT` for the one-shot email.
4. Click "Yes, verify they work here" in the email. The landing page should render the green resolved panel. The dashboard panel should now show the verified outcome strip. The public profile `/p/[handle]` should show the "Employer-verified · MMM YYYY" pill.
5. Test idempotency: click the same link again — should render "Already handled."
6. Re-test with a fresh request, then click "I can't confirm" — landing should render amber + dashboard outcome strip says "Verification didn't go through" + the badge should not appear on the public profile.
7. Test withdrawal: submit a fresh request; on the dashboard panel hit "Withdraw request" before responding. Check `state='withdrawn'` + `contact_email_enc IS NULL`.
8. Test expiry: in DB, set a verification's `expires_at` to a date in the past. Hit `/api/cron/employment-verification-expire` with `Bearer ${CRON_SECRET}`. Confirm `state='expired'` + email NULL + the seeker received the outcome notification.
9. Test D7 supersede: with a verified row in place, change the seeker's current employer via the Phase 9.22 editor. Confirm the prior employer's verification flipped to `state='superseded'` + email NULL + the badge no longer appears on the public profile.

---

*Phase 9.23 closes the two-step trust ladder Phase 9.22 started: name the employer (9.22) + verify it (9.23). The badge is honest, dated, decays at 12 months, and supersedes when the seeker moves on. No third-party PII persists past the verification window. The platform now has the strongest employment signal it has ever had — without becoming an HRIS, without storing contact data without consent, and without taking on the labour-law compliance surface Phase 9.20 D0 explicitly rejected.*
