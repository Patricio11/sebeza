# PHASE 9.23 PLAN  Opt-in employment verification (consent + one-shot email)

*Plan opened 2026-05-29. Companion: `docs/ROADMAP.md`. Targets sign-off before code lands.*

---

## 🎯 WHAT THIS PHASE IS

Phase 9.22 grew the platform's employer coverage organically  seekers picking `employed` declare WHERE they work, admin verifies the org name + city. But the platform still can't tell whether a given seeker actually works at the org they claim. The label sits on their profile as "self-declared," weaker than the Phase 5 / 9.11 employer-confirmed signal.

Phase 9.23 closes that loop without dragging the platform into third-party PII without consent. The shape:

- A seeker on their dashboard (or step 3 of sign-up) opts into employment verification by ticking a checkbox and entering a **single contact at their employer** (name + work email).
- The platform sends **one transactional email** to that contact with a clear opt-out link, a "verify" link, and a "I'm not this person's employer" link.
- The contact's response writes one of three outcomes onto the seeker's placement record: **verified** / **declined** / **expired** (no response in 14 days).
- On verification, the seeker's public profile gains an **"Employer-verified"** badge alongside the existing "Currently at" line. The contact's email is **redacted from durable storage** post-response (kept only in audit meta with the PII flag for the export sweep).
- Re-verification is allowed once per (seeker, employer) pair every 12 months  verification posture decays, doesn't ossify.

POPIA design: the seeker explicitly opts in to share a third party's contact; the third party gets a one-shot transactional email with explicit opt-out + their data is redacted from the durable record after a single use; the platform never stores the contact email past response/expiry.

One shippable phase, no tiers. The schema is small (one new table, one verification kind, a couple of audit kinds, one cron); the surfaces are tight (one consent UI on the dashboard, one verification landing page, one /insights line).

---

## 🔒 LOCKED DECISIONS

### D0  Seeker initiates explicit consent; no path captures the contact without it

The seeker must (a) tick a clearly-worded consent checkbox and (b) personally enter the contact's name + work email. The platform never *infers* a contact (e.g. from email domains). No "do you want to verify this?" prompts from the system pushing the seeker into it; the affordance is on the dashboard editor only and is opt-in.

The consent checkbox text is structured (Phase 9.10's `consent.grant` audit pattern): *"I want Sebenza to email this person ONCE to confirm I work at {Org Name}. They can decline and their email will be deleted from our durable records after their response."*

A consent record lands as a `consent.grant` audit row keyed `employment_verification`, with `meta.contact_email_hash` (SHA-256 of the email, *not* the email) so the audit trail proves consent existed at submission without storing the contact's identifier durably.

### D1  One contact, one email, one outcome

No "I'll send Sarah and if she doesn't respond, then try Mark." Per submission: exactly one contact, exactly one email, exactly one verification outcome.

If the seeker wants to retry with a different contact after a rejection or expiry, that's a fresh consent + fresh email. The previous record stays in the audit log with `state='expired'` or `state='declined'`; the seeker's public badge updates accordingly.

### D2  Only `status='employed'` can verify; self-employed can't

Self-employed seekers ARE the employer; emailing themselves to verify themselves is theatre. The form gates on `status='employed'` only. Self-employed seekers continue to declare their employer (Phase 9.22) but the "Verify" affordance is hidden + the action rejects them server-side.

### D3  Verification has a **fixed 14-day window**

The transactional email reaches the contact with a verify / decline / not-me link valid for 14 days. After that the verification request expires automatically (nightly cron). The seeker can re-request after expiry  but the prior expired record stays in audit.

14 days is the same posture as Phase 9.8.4 chose for the vacancy invite default  long enough that holiday / out-of-office doesn't kill every request, short enough that "I'll do it next month" doesn't drift.

### D4  Contact email is durable for **at most 14 days** (the verification window)

While a verification is in flight, the contact email lives in encrypted form on the verification row. As soon as one of these happens:

- contact responds (verify / decline / not-me)
- 14 days elapse without response
- seeker withdraws the verification request

…the encrypted email is **redacted** (overwritten with NULL) and only a hash + a `consent.grant` audit-meta entry survives. POPIA Right to be Forgotten honoured by construction  there's nothing to forget after day 14.

### D5  One-shot transactional email, opt-out on every action

The contact gets a single attributed email:

> *Hi {Contact Name},*
> *{Seeker Name} listed you as their manager at {Org Name} on Sebenza, South Africa's national talent-intelligence platform, and asked us to email you once to confirm they currently work there.*
> *[Verify they work here] [Decline this] [I'm not this person's employer]*
> *This is the only email you'll receive about {Seeker Name}'s verification. If you do nothing, the request expires in 14 days and your email is deleted from our records.*

Each of the three buttons writes a different outcome; the "I'm not this person's employer" button is treated as a strong negative signal (the seeker may have impersonated; the audit kind is `employment.verification.contact_disputed`).

The email is sent via the existing email pipeline. No new transport / template system.

### D6  Verification posture is honest + decays over time

When the contact verifies, the seeker's profile gains a small **"Employer-verified"** badge alongside the existing "Currently at" line. The badge carries a date: *"Employer-verified · Mar 2026."*

After **12 months** the badge silently downgrades back to the Phase 9.22 honest-label posture ("Sebenza employer" / "Verified employer")  the seeker can re-request verification any time. The badge never says "Verified" without showing how recently. Status-Freshness Rule applies to verification, not just status.

### D7  Cross-employer transfer disables prior verification

When the seeker changes `current_employer_org_id`, any active verification for the prior employer is automatically marked `state='superseded'` and the badge drops. The new employer needs a new verification request. The seeker can't carry a "verified" badge across employers.

### D8  Rate-limit: one open verification per seeker at a time, two per 12-month period

A seeker can have one verification request in flight at a time. Once it resolves (verified / declined / expired / superseded), they can submit a new one. Per (seeker × employer) pair, max 2 verifications per 12 months  prevents pressure-spam at the contact.

If the contact "declines" or "not me", the seeker can't immediately re-request at the same contact; they need a different contact (different email) for a re-submission.

### D9  No retaliation surface for the contact

The contact's response choice is recorded in audit but **NEVER surfaced to the seeker** beyond the binary outcome (verified vs not). The contact can't see what the seeker submitted; the seeker can't see what the contact said. The platform mediates honestly.

Specifically: if the contact picks "I'm not this person's employer," the seeker sees *"Verification didn't go through. The contact wasn't able to confirm."*  never *"The contact said they're not your manager."* Audit-only.

### D10  Aggregate on /insights, never per-employer

Phase 9.20 set the posture: aggregates at k ≥ 10, never per-employer. Phase 9.23 follows: a new line on /insights  *"N% of currently-employed seekers have an employer-verified badge"*  national only, never sliced by employer.

### D11  Schema: one new table, one new enum

Migration `0037_phase9_23_employment_verifications.sql`:

- `employment_verification_state` enum: `pending` / `verified` / `declined` / `disputed` / `expired` / `superseded` / `withdrawn`
- `employment_verifications` table:
  - `id`
  - `profile_id` FK
  - `employer_org_id` FK
  - `contact_name`
  - `contact_email_enc` (AES-GCM, nullable after redaction)
  - `contact_email_hash` (SHA-256 hex, durable for audit dedupe)
  - `state`
  - `requested_at` / `responded_at` / `expires_at`
  - `verification_token` (URL-safe random; cleared after response)
  - `superseded_by_id` (NULL unless `state='superseded'` due to D7 employer change)
  - Indices: `(profile_id, state)`, `(verification_token)`, `(expires_at) WHERE state='pending'`

No new column on `profiles`  the "currently verified" state is computed by joining the latest non-expired verification row.

### D12  New audit kinds + notification kinds

Audit:
- `employment.verification.request`  seeker submitted
- `employment.verification.contact_verified`  contact confirmed
- `employment.verification.contact_declined`  contact declined
- `employment.verification.contact_disputed`  contact said not me
- `employment.verification.expired`  cron flipped on day 14
- `employment.verification.superseded`  D7 employer change
- `employment.verification.withdrawn`  seeker pulled the request

Notification:
- `employment.verification.outcome` (audience: seeker)  fires once when state transitions to verified / declined / disputed / expired. Body honest per D9 (binary outcome only).

No notification to the contact post-response (the email IS the only contact channel; we don't keep contacting them).

---

## 📦 TASK LIST

- **9.23.1 Migration** `0037_phase9_23_employment_verifications.sql`  enum + table + indexes.
- **9.23.2 Schema**  extend Drizzle with `employmentVerificationState` enum + `employmentVerifications` table.
- **9.23.3 Server actions** in `lib/profile/employment-verification.ts`:
  - `requestEmploymentVerification({ employerOrgId, contactName, contactEmail })`  gated on status='employed', rate-limited per D8, generates token, sends email, writes audit + consent.grant row
  - `withdrawEmploymentVerification({ verificationId })`  seeker pulls; redacts email
  - `respondToVerification({ token, outcome: 'verified' | 'declined' | 'disputed' })`  public endpoint (no session); writes outcome, redacts email, fires `employment.verification.outcome` notification
- **9.23.4 Verification landing page**  `/verify-employment/[token]` (no auth required). Renders a thin attribution panel + three buttons (verify / decline / not me) + a small POPIA explainer. Invalid / expired token → friendly "this link has expired" page.
- **9.23.5 Email template**  minimal text + HTML. Lives in `lib/email/templates/employment-verification.ts`.
- **9.23.6 Dashboard surface**  on `/dashboard/profile`, the Phase 9.22 `CurrentEmploymentEditor` gets a small "Verify employment" affordance when `status='employed'` AND there's no in-flight verification. Renders the consent UI (checkbox + contact name + contact email) + Submit. After submit, shows "Verification in flight  contact has 14 days to respond" with a Withdraw button.
- **9.23.7 Public profile badge**  `/p/[handle]` `<DossierRow>` "Currently at" gets an additional small line when there's a verified-and-within-12-months verification: *"Employer-verified · Mar 2026."*
- **9.23.8 Public profile reader**  `PublicProfile` gains `employmentVerifiedAt: string | null` (NULL if not verified or older than 12 months). The reader joins the latest verification row.
- **9.23.9 Cron**  `/api/cron/employment-verification-expire` runs nightly. Flips `state='pending'` rows past `expires_at` to `state='expired'`; redacts the encrypted email; fires `employment.verification.outcome` notification to the seeker.
- **9.23.10 D7 hook**  `updateCurrentEmployment` (from Phase 9.22) gets a new branch: when the seeker changes their employer, any `state IN ('pending', 'verified')` verification for the prior employer gets flipped to `state='superseded'` + email redacted + the verification fanout notification fires.
- **9.23.11 /insights**  add the national "N% employer-verified" line below the retention card (k=10 floor inherited from Phase 9.20 D8).
- **9.23.12 Compliance assertions**  three new:
  - `verification-contact-email-redacted-on-resolve`  every non-pending verification row has `contact_email_enc IS NULL`
  - `verification-tokens-cleared-on-resolve`  every non-pending row has `verification_token IS NULL`
  - `verification-expired-cron-honoured`  no `state='pending'` rows past `expires_at + 24h` (cron is alive)
- **9.23.13 Typecheck + tests + build + commit**.

---

## 🚫 OUT OF SCOPE

- ❌ **Verification chains** ("if Sarah didn't respond, try Mark"). One contact, one shot (D1).
- ❌ **Verifying past employment**  only the *current* employer. Past-job verification is a separate, far harder design.
- ❌ **Bulk verification** ("verify all my listed employers in one go"). The seeker has at most one current employer at a time.
- ❌ **Allow the seeker to see the contact's response choice beyond binary outcome**  retaliation surface (D9).
- ❌ **Verification-required gating**  having a verified employer is never a prerequisite for invites / dossier views / placement logging. Status-Freshness Rule informs ranking; verification informs trust display.
- ❌ **Custom verification copy / branding by employer**  the email template is platform-standard.
- ❌ **Auto-detect employer from email domain**  D0 explicitly rejects this.
- ❌ **Forwarding the contact's response to HR / org admins**  the contact's response stays between them and the platform.
- ❌ **Per-employer "verified employee count" badge**  D10 holds (aggregate only, k ≥ 10).

---

## 🧭 WHY THIS IS THE RIGHT SCOPE

1. **POPIA-clean by construction.** The contact's email exists at most 14 days; consent is explicit; the contact can opt out with one click. No prediction, no inference, no third-party PII without the third party's response. If POPIA review at Phase 10 launch asks "what about contact emails," the answer is "they don't persist past the verification window."

2. **It builds the *trust* signal the platform's been missing.** Phase 9.22 grew employer coverage; Phase 9.23 distinguishes "the seeker says they work here" from "their manager confirms it." Two-step ladder: name the employer (9.22), verify it (9.23). The badge on the public profile is honest, dated, and decays.

3. **Compatible with the Phase 9.20 lifecycle.** D7 wires the verification into the Phase 9.20 departure flow: when a placement is marked departed (or the seeker changes current employer), the verification supersedes automatically. No drift; no stale "Verified at Acme" badge on someone who moved to Capitec.

---

*Plan opened 2026-05-29. Target: complete within one focused day. Bounded scope (~13 edits + 1 migration + 1 cron + 1 email template), one new table, three new audit kinds, one new notification kind, three new compliance assertions.*
