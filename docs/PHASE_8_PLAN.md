# Phase 8 — Verification & Integrations · 📋 PLAN (opened 2026-05-23)

> Active plan, lives at the top of `docs/`. Moves to `docs/completed/` when this phase ships.

**Goal:** Turn the deferred Phase-7 hooks into real work — flip on transactional email, run the cron jobs that close every "Phase 8 follow-up" comment we left in the code, and stand up the KYC / SAQA adapters so an admin's "Verified" decision can be machine-confirmed first.

After Phase 8 ships:
- Notifications also reach inboxes.
- Soft-erased users actually get deleted on their 30-day clock.
- Saved searches notify when new matches appear.
- "Verified" badges on qualifications + IDs are backed by real authority signals (not just an admin's eyeball).

---

## Re-checks (decide before kickoff)

### Re-check #1 — Resend SDK over `nodemailer` in production
We already env-switch between Mailtrap (`nodemailer` SMTP for dev) and Resend (HTTP API for prod). The transport boundary lives at `lib/email/send.ts`. Phase 8 doesn't move that boundary — it just adds new templates that flow through it. Verify Resend domain auth (SPF + DKIM + DMARC) lives in `.env.example` as a runbook, not as live creds.

### Re-check #2 — Cron host
Three options:
1. **Vercel Cron** — declarative `vercel.json` blocks, zero infra. Best for the simple nightly tasks.
2. **A `pg_cron` extension on Neon** — pure SQL, no HTTP. Best for the 30-day hard-delete (single query).
3. **A small Node cron worker** in the AWS Cape Town move (Phase 9).

For Phase 8 we pick (1) — Vercel Cron — for portability, and migrate to (3) in Phase 9 when we leave Neon. Every cron task ends up as a `/api/cron/<task>` route guarded by `CRON_SECRET` header.

### Re-check #3 — KYC adapter shape
We do NOT call Home Affairs directly. We design an `IdentityVerifier` interface with one method (`verify({ idNumber, fullName, dob }): VerificationResult`) and ship two implementations: `MockIdentityVerifier` (current behaviour, returns pending) and `ThirdPartyKycVerifier` (a paid KYC SaaS that already has the Home Affairs eHANIS integration — most SA fintechs go this route).

The point: the adapter contract is what we build. Swapping to a direct Home Affairs API later is a one-file change.

### Re-check #4 — SAQA adapter has stricter latency
SAQA's National Learners' Records Database (NLRD) is slow and rate-limited. We don't call it on demand from `/admin/verifications` — we call it asynchronously via a cron + a `qualification_kyc_jobs` queue table. Admin sees a "Submitted to SAQA — checking…" state; result comes back minutes later.

### Re-check #5 — Email-channel default state stays "off" for now
The notification prefs panel ships the email toggle disabled with a Phase-8 pill. When Phase 8 ships, we flip the toggle to enabled — but the **default** for each kind stays `false` so existing users opt-in rather than getting blasted. Admins can opt themselves in immediately via /admin/account.

---

## Implementation plan

### A. Email channel (Task 7.6 follow-through)

#### A.1 Resend templates
- Reuse the existing `shell()` HTML helper in `lib/auth/server.ts` (factor it into `lib/email/templates/shell.ts` first).
- One template per notification kind that has `defaultEmail: true (Phase 8)` in the catalog: `contact.revealed`, `document.downloaded`, `placement.confirmed`, `qualification.verified`, `qualification.rejected`, `account.suspended`, `org.verified`, `status.stale.warning`, `saved_search.new_matches`.
- Templates take the same `meta` JSONB the in-app notification gets — single source of truth for copy.

#### A.2 Email dispatch in `createNotification`
- After the in-app insert, check `effectivePref(kind).email`. If `true` AND we have a working transport, call `sendNotificationEmail({ userId, kind, meta })`.
- Failure is silent (audit log is the system of record). Wrapped in its own try/catch so a Resend hiccup doesn't break the action.
- Rate-limited per user (max 1 email per kind per 60 s) so a burst of dossier views can't spam the inbox.

#### A.3 Flip the prefs panel
- Remove the `disabled` + Phase-8 pill from the email column.
- Defaults stay `email: false` per catalog; users opt in.

### B. Cron jobs (`/api/cron/*` routes, each guarded by `CRON_SECRET`)

#### B.1 Nightly hard-delete (`/api/cron/hard-delete-erased`)
- Selects `app_user` rows with `deleted_at < now() - interval '30 days'`.
- For each: DELETE cascade through `profiles`, `experiences`, `qualifications`, `placements`, `consents`, `notifications`, `audit_log` rows where `subject = user.id`. Better Auth's `session`, `account`, `verification`, `twoFactor` cascade automatically via FK.
- Writes a single `account.hard_delete` audit row per user (the only audit record that survives, by design — we keep the tombstone for legal proof of erasure).

#### B.2 Status-stale nudges (`/api/cron/status-stale-warning`)
- Daily. For every seeker whose `status_confirmed_at` crossed `freshness_band_days_ageing` since the last cron run (idempotent via a `status_stale_last_sent_at` column on `profiles`), fire `status.stale.warning` notification.
- Honours the user's `notification_prefs[status.stale.warning]`.

#### B.3 Saved-search match rollup (`/api/cron/saved-search-matches`)
- Daily. For every saved search, re-run the query, diff against the previous run's result set (stored as a hash of profile IDs in `saved_searches.last_match_hash`).
- New IDs → fire `saved_search.new_matches` notification to every org member of the owner org with the count + a link.

#### B.4 Skill-gap snapshot (`/api/cron/skill-gap-snapshot`)
- Calls `captureSkillGapSnapshot()` (already shipped Phase 6.5, currently triggered manually). Daily.

#### B.5 Reveal-gate cleanup (optional)
- Phase 5 reveal-gate is computed live from `audit_log`. No cleanup needed — keeps the system stateless. Skip.

### C. KYC adapter (Task 8.1)

#### C.1 Interface + Mock
- `lib/kyc/types.ts` defines `IdentityVerifier`, `VerificationResult` (`{ ok: true; status: 'verified' | 'mismatch' | 'pending' | 'unknown' } | { ok: false; message: string }`).
- `lib/kyc/mock.ts` ships the current "always returns pending" behaviour for dev.
- `lib/kyc/provider.ts` env-switches between mock and the real provider based on `KYC_PROVIDER=mock|truid|smileid|…`.

#### C.2 Real provider (one of)
- **truID, Smile ID, or iiDENTIFii** — all have SA Home Affairs eHANIS as their backend. Pick one based on price + DPA terms. Whichever we pick, the wrapper module is < 100 lines.
- Encrypt + store the provider's transaction ID in `app_user.kyc_transaction_id` for audit trail.

#### C.3 Wire into sign-up + `/dashboard/account → ID verification`
- Optional during sign-up (not blocking — seekers can complete sign-up without verifying ID).
- Surfaced as a banner on the dashboard: "Verify your ID — 2 minutes, increases your profile completeness by 15%."
- Admin can no longer manually flip ID to verified — the only `verified` state has to carry a provider transaction ID.

### D. SAQA / qualifications adapter (Task 8.2)

#### D.1 Job queue table
- `qualification_kyc_jobs`: `id`, `qualification_id`, `submitted_at`, `submitted_by_user_id`, `status enum (queued|in_flight|verified|mismatch|error)`, `result_json`, `completed_at`.
- An admin clicking "Approve" on `/admin/verifications` writes a `qualification_kyc_jobs` row in `status = queued` instead of immediately flipping `qualifications.verification = 'verified'`. The qualification stays in `pending` until the cron returns.

#### D.2 SAQA worker (`/api/cron/saqa-worker`)
- Every 5 min. Claims one `queued` row at a time (limit 10 per run to respect SAQA's rate limit).
- POSTs to SAQA NLRD search endpoint with the qualification's `institution` + `title` + `awardedYear`.
- On `verified` → flips `qualifications.verification = 'verified'` + audit-logs `verification.approve.saqa` (new audit kind).
- On `mismatch` → flips to `rejected` + the admin sees the SAQA `result_json` reason in `/admin/verifications`.

#### D.3 Admin UI change
- `/admin/verifications` qualification row now shows the SAQA job status ("Submitted to SAQA — 4 min ago") instead of immediately reflecting the admin's click.
- Admin can override with "Force approve" (skips SAQA — audit-logged as `verification.approve.manual_override`).

### E. Misc polish & follow-ups

#### E.1 `/dashboard/profile` email field
- Audit follow-up: surface the user's email read-only on the profile editor for clarity. Wired from `getSessionUser()`.

#### E.2 "Request data export" + "Erase me" Server Actions
- Audit follow-up: the seeker /privacy page has these buttons stubbed. Phase 8 wires them:
  - **Request data export** → generates a JSON dump of every row referencing the user (profile, experiences, qualifications, consents, audit_log, notifications). Streams as a download.
  - **Erase me** → calls the same `eraseUser` action admins use, but self-service. Soft-delete; the Phase 8 cron does the hard-delete.

#### E.3 Seed top-up
- Phase 7 audit left these as "nice-to-have": 2 saved searches for Discovery Bank, 2 shortlist pools, a prior reveal for Naledi → Andile, `salaryBand` backfill on the placements. Ship now so the employer demo has interesting state.

---

## Acceptance criteria

### Email channel
- [ ] Admin approves a qualification → seeker gets an in-app notification AND an email (within 60 s, if user opted in for the kind)
- [ ] Email link goes to `/dashboard/qualifications` with the verified badge visible
- [ ] Disabling email for a kind via the prefs panel stops the next email instantly
- [ ] Rate-limit holds: 5 dossier reloads inside 60 s produce 1 email, not 5

### Cron
- [ ] User soft-deleted on day 0 is gone from `app_user` on day 31 (verified via audit-log tombstone)
- [ ] Seeker who hasn't confirmed status in 91 days gets a `status.stale.warning` notification on the next nightly cron run
- [ ] A saved search with 3 new matching profiles since yesterday fires one `saved_search.new_matches` notification per org member with the count "3 new matches"

### KYC
- [ ] Seeker enters ID number + name + DOB → `MockIdentityVerifier` returns pending → status is "submitted" with no flag
- [ ] Swapping `KYC_PROVIDER=truid` (with creds) → same input now returns `verified` synchronously
- [ ] Admin /admin/users surface shows ID-verified vs unverified

### SAQA
- [ ] Admin clicks Approve on a qualification → row state = "Submitted to SAQA"; the qualification.verification stays `pending` until the cron resolves it
- [ ] SAQA mismatch result auto-flips to `rejected` with the mismatch reason in the body
- [ ] "Force approve" works for admin escape

---

## Out of scope for Phase 8

- **Real-time delivery (WebSocket / SSE)** — Phase 9 if traffic justifies
- **Push notifications (web push / native)** — out of scope entirely until product validates demand
- **Rate limiting via Upstash** → Phase 9 (Better Auth's in-memory limit + 2FA brute-force protection holds for Phase 8)
- **Postgres → AWS Cape Town migration** → Phase 9
- **CSP / Sentry / loading.tsx / robots / sitemap** → Phase 9

---

## Risks to flag at kickoff

- **Resend domain auth.** SPF + DKIM + DMARC must be live before we send the first user-facing email. Add the records to the deployment runbook BEFORE flipping the prefs-panel toggle.
- **`pg_cron` vs Vercel Cron drift.** If we end up using both (Vercel for HTTP-triggered tasks, `pg_cron` for the hard-delete SQL), make sure exactly one schedules each task. Document in `lib/cron/README.md`.
- **KYC provider DPA.** Whichever provider we pick, their data-processing agreement must explicitly support POPIA. Add as a contract checkbox in the launch checklist.
- **SAQA rate limiting.** The NLRD endpoint is not well-documented; we may need to throttle harder than 10/run. Make the per-run cap a `platform_settings` key so ops can tune without a deploy.
- **Email-template translation.** Templates need the same Tier-1 locale coverage (`en` / `zu` / `xh` / `af`) as the UI. POPIA/legal language must be human-translated — don't ship the password-reset template in machine-translated isiZulu.
- **Hard-delete is permanent.** Triple-check the cron's `WHERE deleted_at < now() - interval '30 days'` filter — accidentally dropping the interval comparator deletes every active user. Add an `INSERT INTO audit_log` BEFORE the DELETE so we always have proof of what we removed.

---

*When this ships: write `docs/completed/PHASE_8_COMPLETE.md` and open `docs/PHASE_9_PLAN.md` (already partially written — the Tier 3 strategic adds from Phase 6.5 audit are queued there).*
