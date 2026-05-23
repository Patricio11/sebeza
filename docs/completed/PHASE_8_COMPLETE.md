# Phase 8 — Verification & Integrations · ✅ COMPLETE (2026-05-23)

Opened + shipped on the same day. Full spec at `docs/completed/PHASE_8_PLAN.md` with every acceptance box ticked. KYC + SAQA adapters intentionally stay dormant behind admin-controlled feature flags until partnerships confirm.

---

## What shipped

### Schema (migration `0009_phase8`)
- `app_user.notification_email_last_sent_at` JSONB — per-kind email rate-limit clock
- `app_user.kyc_transaction_id` + `kyc_verified_at` — KYC verification anchor
- `profiles.status_stale_last_sent_at` — stale-warning idempotency anchor
- `saved_searches.last_match_hash` — drives the diff in `/api/cron/saved-search-matches`
- `outcome_snapshots` table + indices — Phase 7.5.4 hand-off for the longitudinal trend
- `qualification_kyc_jobs` table + `qualification_kyc_status` enum + indices — SAQA worker queue
- Two new feature flags seeded as **OFF** in `platform_settings`:
  `feature_flag_kyc_provider`, `feature_flag_saqa_worker`

### Cron infrastructure
- `lib/cron/auth.ts` — shared `Authorization: Bearer ${CRON_SECRET}` guard. Refuses all requests when `CRON_SECRET` is unset (fails closed).

### Cron jobs (all `CRON_SECRET`-guarded)
- **`/api/cron/hard-delete-erased`** — sweeps soft-deleted users past 30 days; audit-logs `account.hard_delete` BEFORE the DELETE so we always have legal proof of erasure.
- **`/api/cron/skill-gap-snapshot`** — calls `captureSkillGapSnapshot()` from Phase 6.5.
- **`/api/cron/outcome-snapshots`** — Phase 7.5.4 hand-off. Calls `outcomesQuery()` (suppression already applied) and writes one row per visible cohort to `outcome_snapshots`.
- **`/api/cron/status-stale-warning`** — fires `status.stale.warning` when `status_confirmed_at` is older than `freshness_band_days_ageing`. Idempotent via `status_stale_last_sent_at` so a re-run on the same day is a no-op.
- **`/api/cron/saved-search-matches`** — re-runs every saved search, hashes the sorted profile-id set, fires `saved_search.new_matches` notification (via `notifyOrgMembers`) when the hash changes.
- **`/api/cron/saqa-worker`** — claims up to 10 `queued` jobs per run. Gated on `feature_flag_saqa_worker` (no-ops when off). Stand-in `runSaqaCheck()` returns `verified` deterministically until partnership lands — real HTTP call is a one-function swap.

### Email channel
- `lib/email/templates/shell.ts` — factored email chrome (lifted from `lib/auth/server.ts`).
- `lib/email/templates/notifications.ts` — per-kind templates for `contact.revealed`, `document.downloaded`, `placement.confirmed`, `qualification.verified`, `qualification.rejected`, `account.suspended`, `org.verified`, `status.stale.warning`, `saved_search.new_matches`. Each takes the same `meta` JSONB the in-app notification stores → single source of truth.
- `createNotification` now dispatches email after the in-app write when ALL of: `feature_flag_email_notifications` is on, user's per-kind email pref is true, a template exists, and the per-(user × kind) 60 s rate-limit allows. Dispatch failures swallowed (audit log is system-of-record).
- `<NotificationPrefsPanel>` flips the Email column from "Phase 8" pill to live toggle when the master flag is on. Per-user defaults stay `false` — opt-in.

### KYC adapter (gated)
- `lib/kyc/types.ts` — `IdentityVerifier` interface with `verify({ idNumber, fullName, dob? })`.
- `lib/kyc/mock.ts` — `MockIdentityVerifier` (returns "pending"; admin manual flow handles the decision).
- `lib/kyc/provider.ts` — resolver. **Two gates**: `feature_flag_kyc_provider` must be ON AND `KYC_PROVIDER` env var must resolve to a registered provider. Off-by-default; falls back to Mock when either gate fails.
- `lib/kyc/actions.ts` — Server Actions: `submitMyIdForVerification` (seeker self-service), `adminVerifyIdManually` (admin escape hatch for the off-flag world), `revokeMyKyc`.
- `<KycPanel>` mounted on `/dashboard/profile` showing three states: no-ID / not-verified / verified. Copy reflects whether the real provider flag is on.
- Audit kinds: `kyc.verify`, `kyc.revoke` — both record provider name so admins can tell a SaaS verify from a manual one.

### SAQA adapter (gated)
- `approveQualification` Server Action now branches on `feature_flag_saqa_worker`:
  - **OFF** (default): flips `qualifications.verification = 'verified'` directly (Phase 7 behaviour).
  - **ON**: writes a `queued` row to `qualification_kyc_jobs`; the qualification stays in `pending` until the cron worker resolves it.
- **Force approve** override on `/admin/verifications` qualification rows (visible only when the SAQA flag is on). Audit-logs as `verification.approve.manual_override` — distinct from `verification.approve.saqa`.
- Admin verifications row now shows the latest SAQA job status with a coloured pill (queued / in_flight / verified / mismatch / error).
- Worker fires `qualification.verified` or `qualification.rejected` notification on resolution (uses the SAQA `actor = "system"` audit row).

### Misc polish (audit follow-ups, all unblocked now)
- **`/dashboard/profile`** — new read-only email field block at the top of the editor (just below the avatar section). Read from session via `MyProfile.email`.
- **`/api/dashboard/data-export`** — POPIA §23 streamed JSON dump of every row referencing the signed-in user (app_user sans password, profile, academic, skills, experiences, qualifications, placements, consents, audit_log filtered by actor/subject, notifications). National ID stays as ciphertext only. Audit-logged as `account.data_export`.
- **`<SelfEraseForm>`** on `/dashboard/privacy` — POPIA §24 self-service. Confirmation gate requires typing `ERASE` in capitals. Soft-deletes via `app_user.deleted_at` (the hard-delete cron sweeps after 30 days), signs the user out immediately. Audit-logged as `account.self_erase`.

### Audit kinds added
8 new kinds extending `lib/audit/index.ts`'s `AuditKind` union:

`account.hard_delete` · `account.self_erase` · `account.data_export` · `kyc.verify` · `kyc.revoke` · `verification.approve.saqa` · `verification.reject.saqa` · `verification.approve.manual_override`

---

## How the gating works (per user standing instruction)

> "Home Affairs KYC adapter and SAQA will not really be available until the admin turns them after confirming partnership."

Both adapters ship behind admin-controlled platform flags:

| Flag | Default | Effect when OFF | Effect when ON |
|---|---|---|---|
| `feature_flag_kyc_provider` | **OFF** | `resolveIdentityVerifier()` returns `MockIdentityVerifier` — admin manual approval is the only path to a "verified" KYC mark. | `KYC_PROVIDER` env picks one of the registered SaaS providers; real HTTP call runs. |
| `feature_flag_saqa_worker` | **OFF** | `approveQualification` flips `qualifications.verification = 'verified'` directly (Phase 7 behaviour). The worker cron no-ops. | `approveQualification` enqueues a job; cron worker calls SAQA and writes the result back; admin gets a "Force approve" override for the SAQA-down case. |

Admins flip both from `/admin/settings`. Every flip is audit-logged as `setting.update`.

---

## How the email channel works

`createNotification` is unchanged for in-app writes. Email dispatch is a new tail step gated on **all four** of:

1. `feature_flag_email_notifications` is ON (master switch — admin flips after Resend domain auth lands).
2. User's per-kind email pref is `true` (catalog defaults all `false`).
3. A template exists for this kind (`profile.viewed` etc. are in-app-only by policy).
4. Per-(user × kind) rate limit allows — max 1 email per 60 s.

Dispatch failures are swallowed: the audit log is the system-of-record, never break the request path.

---

## Files added / changed

**Schema + migrations**
- `db/schema.ts` (KYC + status-stale + last-match-hash columns; `outcome_snapshots` + `qualification_kyc_jobs` tables; `qualification_kyc_status` enum)
- `db/migrations/0009_phase8.sql`
- `db/migrations/meta/_journal.json`

**Settings**
- `lib/admin/settings.ts` + `lib/admin/settings-actions.ts` — two new flags + Zod schemas
- `components/feature/admin/SettingsForm.tsx` — two new rows in the feature-flags section

**Audit + cron infrastructure**
- `lib/audit/index.ts` — 8 new kinds
- `lib/cron/auth.ts` — shared `CRON_SECRET` guard
- 6 new `app/api/cron/*` routes

**Email**
- `lib/email/templates/shell.ts`
- `lib/email/templates/notifications.ts`
- `lib/notifications/server.ts` — email dispatch tail in `createNotification`
- `components/feature/notifications/NotificationPrefsPanel.tsx` — email column wired

**KYC**
- `lib/kyc/types.ts` · `lib/kyc/mock.ts` · `lib/kyc/provider.ts` · `lib/kyc/actions.ts`
- `components/feature/profile/KycPanel.tsx`
- `app/[locale]/(seeker)/dashboard/profile/page.tsx` — KycPanel mounted; email field added

**SAQA**
- `lib/admin/verifications.ts` — `approveQualification` enqueue/direct branch + `forceApprove` path
- `lib/admin/verifications-query.ts` — latest job status per qualification surfaced
- `components/feature/admin/VerificationActions.tsx` — "Force approve" affordance
- `app/[locale]/(admin)/admin/verifications/page.tsx` — pill + override wiring
- `app/api/cron/saqa-worker/route.ts`

**POPIA misc**
- `lib/profile/me.ts` — surfaces email + kycVerifiedAt
- `lib/profile/erase.ts` — `eraseMyAccount` Server Action
- `app/api/dashboard/data-export/route.ts`
- `components/feature/profile/SelfEraseForm.tsx`
- `app/[locale]/(seeker)/dashboard/privacy/page.tsx` — both wired live

**Three notification prefs pages**
- `app/[locale]/(seeker)/dashboard/account/page.tsx`
- `app/[locale]/(employer)/employer/account/page.tsx`
- `app/[locale]/(admin)/admin/account/page.tsx`

(all now pass `emailChannelEnabled` to the prefs panel)

---

## Verification

`npm run db:migrate` ✓ — `0009_phase8` applied to Neon (PG 16).
`npm run typecheck` ✓ clean.
`npm run build` ✓ compiled.

---

## How to activate the gated adapters (operator runbook)

### KYC (Home Affairs via SA SaaS)
1. Sign a DPA + commercial agreement with one of: truID, Smile ID, iiDENTIFii.
2. Set provider creds in env: `KYC_PROVIDER=truid` + `TRUID_API_KEY=…` (or similar per provider).
3. Add a `lib/kyc/providers/truid.ts` implementing `IdentityVerifier`.
4. Register it in `KNOWN_PROVIDERS` in `lib/kyc/provider.ts`.
5. **Visit `/admin/settings`, flip `feature_flag_kyc_provider` to ON.**
6. Verify by submitting an ID from `/dashboard/profile` — the audit log should show `kyc.verify` with `meta.provider=truid`.

### SAQA (qualifications NLRD)
1. Sign the SAQA partnership / API access agreement.
2. Set creds in env: `SAQA_BASE=…` + `SAQA_API_KEY=…`.
3. Replace the body of `runSaqaCheck()` in `app/api/cron/saqa-worker/route.ts` with the real fetch.
4. Tune the rate limit (`MAX_PER_RUN`) for SAQA's actual throttle.
5. **Visit `/admin/settings`, flip `feature_flag_saqa_worker` to ON.**
6. Set up the Vercel Cron schedule for `/api/cron/saqa-worker` (every 5 min recommended).
7. Verify by clicking Approve on a pending qualification — admin UI should show "SAQA: queued" → resolve to "SAQA: verified" within minutes.

### Email channel
1. Configure Resend domain (SPF + DKIM + DMARC).
2. Set env: `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY=…`, `EMAIL_FROM="…@yourdomain"`.
3. **Visit `/admin/settings`, flip `feature_flag_email_notifications` to ON.**
4. Users start opting in via their `/account` panels.

### Cron schedule (Vercel)
Add to `vercel.json` (not committed yet):

```json
{
  "crons": [
    { "path": "/api/cron/hard-delete-erased",   "schedule": "0 3 * * *" },
    { "path": "/api/cron/status-stale-warning", "schedule": "0 5 * * *" },
    { "path": "/api/cron/saved-search-matches", "schedule": "0 7 * * *" },
    { "path": "/api/cron/skill-gap-snapshot",   "schedule": "0 2 * * *" },
    { "path": "/api/cron/outcome-snapshots",    "schedule": "30 2 * * *" },
    { "path": "/api/cron/saqa-worker",          "schedule": "*/5 * * * *" }
  ]
}
```

---

## What's next

Phase 9 — production hardening (Upstash rate limiting · CSP · Sentry · loading.tsx · robots · sitemap · Privacy/PAIA · Postgres → AWS Cape Town `af-south-1` for in-country residency · `/gov` route group + Phase 9 strategic adds queued in `docs/PHASE_9_PLAN.md`).
