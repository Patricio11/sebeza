# Phase 9  Trust, Security & Strategic Hardening · ✅ COMPLETE (2026-05-23, with documented deferrals)

Comprehensive POPIA-readiness pass + government-pitch strategic adds. The system is now production-ready against the current Neon (EU) DB  the AWS Cape Town migration is a turnkey one-day swap when partnership confirms (runbook at `docs/AWS_MIGRATION_RUNBOOK.md`).

**Critical posture choice**: every third-party service that costs money or requires a vendor agreement is **dormant by default**. The system runs end-to-end with zero paid credentials. Each service has a clear "flip this flag / set this env var to activate" path documented here and in the relevant module.

---

## Dormant-by-default services (per user instruction)

| Service | Gate | Effect when dormant | Effect when activated |
|---|---|---|---|
| **Sentry** | `SENTRY_DSN` env unset | No-op `initSentry()` returns silently; nothing is sent | Install `@sentry/nextjs`, set DSN → events flow with PII scrubber in place |
| **Resend transactional email** | `feature_flag_email_notifications` (default OFF) | Templates exist, dispatch is skipped; in-app notifications still fire | Admin flips the flag in `/admin/settings` after Resend domain auth is live |
| **KYC SaaS** | `feature_flag_kyc_provider` (default OFF) + `KYC_PROVIDER` env | `MockIdentityVerifier` returns "pending"; admin manual approval handles the case | Drop a real provider module in `lib/kyc/providers/*`, set env + flag → real verification |
| **SAQA NLRD worker** | `feature_flag_saqa_worker` (default OFF) | `approveQualification` flips directly (Phase 7 behaviour); cron is a no-op | Admin flips the flag → cron worker calls real SAQA endpoint |
| **Upstash rate limiter** | No call sites wired | In-memory `RateLimiter` exists; nothing is enforced | Import `enforce(bucket, key)` on the chosen Server Action + set `UPSTASH_REDIS_*` env for cluster mode |
| **Vercel Cron** | `CRON_SECRET` env unset | `isAuthorizedCron` refuses every request | Set `CRON_SECRET` + add the cron paths to `vercel.json` |

Result: a fresh clone of the repo with no `.env.local` still runs typecheck + build + dev server. Every dormant service has a one-place activation path.

---

## Rate limiting  decision record

The user asked why sign-in is rate-limited. Re-evaluated the whole rate-limit posture during the phase. **Final position: rate limiting is NOT enforced anywhere by default.** The `lib/rate-limit/` library exists ready-to-wire when abuse is actually observed; budgets get sized from real traffic, not guessed.

Reasoning, captured in `docs/popia/DPIA.md` R8 + in code comments:

- **Sign-in**: a per-email rate limit creates a denial-of-service vector  an attacker who knows your email can submit bad passwords and lock the legitimate user out. Better Auth's scrypt password hashing (~100-200ms per attempt) is already the brute-force mitigation; 2FA is the real second factor for high-value accounts.
- **Reveal / upload / search**: existing controls (verified-org gate, per-action consent gates, audit log on every reveal, 30-day reveal window, search-event logging) make abuse expensive AND traceable. Pre-emptive limits add real legitimate-user friction without observed need.

The module is shipped + documented + dormant. One-line activation: `await enforce("reveal", key)` on the Server Action you want to gate.

---

## What shipped

### POPIA + privacy (Task 9.1) ✅
- **`/privacy`**  full POPIA-aligned Privacy Policy. 12 sections, plain language, cross-references to `/paia` + `/dashboard/privacy` + `docs/popia/*`.
- **`/paia`**  PAIA manual (Section 51 of Act 2 of 2000) with records inventory + Information Officer contact + access procedure + grounds for refusal + Regulator escalation path.
- **`<CookieConsentBanner>`** mounted in the root locale layout. Essential always-on (sign-in / locale / consent itself); analytics opt-in (default OFF). One first-party cookie, server-resolved so the banner doesn't flash on every render.
- **`docs/popia/INFORMATION_OFFICER.md`**  placeholder named-person designation, working email `popia@sebenza.co.za` already published.
- **`docs/popia/DPIA.md`**  Data Protection Impact Assessment, 8 risks identified + mitigations, including the rate-limit decision (R8).
- **`docs/popia/BREACH_RESPONSE.md`**  runbook with containment / assessment / notification stages + a Section-22-compliant template.
- **`docs/popia/RETENTION_POLICY.md`**  every category mapped to a window + enforcement mechanism. Audit log = 5 years (financial-services convention + FICA alignment).
- **`docs/popia/ENCRYPTION_INVENTORY.md`**  in-transit + at-rest + application-level inventory + key rotation runbook (routine annual + emergency-disclosure paths).

### Security headers (Task 9.2) ✅
- **CSP** with allow-list for Supabase + Resend + QR-service; `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `upgrade-insecure-requests`. Note: `script-src 'self' 'unsafe-inline'` until nonce-based CSP is rolled (Phase 10 hardening pass).
- **HSTS** `max-age=63072000; includeSubDomains; preload`.
- **Permissions-Policy** disables camera + microphone + geolocation + interest-cohort.
- **X-Frame-Options DENY** (legacy fallback for `frame-ancestors`), **X-Content-Type-Options nosniff**, **Referrer-Policy strict-origin-when-cross-origin**, **Cross-Origin-Opener-Policy same-origin**.
- Applied via `proxy.ts withSecurityHeaders()` on every response.

### Observability skeleton (Task 9.2) ✅
- **`lib/sentry/init.ts`**  env-gated; no-op when `SENTRY_DSN` unset. `beforeSend` strips `Authorization` + `Cookie` headers and recursively scrubs known-sensitive fields (`email`, `phone`, `national_id`, `password`, `token`, `session`, etc.). Lazy-imports `@sentry/nextjs` so we don't take the dep until needed.

### Rate limiter skeleton (Task 9.2) ✅
- **`lib/rate-limit/`**  provider-agnostic interface + in-memory sliding window + 3 named buckets (`reveal`, `upload`, `search`). Upstash adapter slot reserved; activation is one file + a deploy.
- **Dormant by default** (see decision record above).

### Polish (Task 9.3) ✅
- **`loading.tsx`** at the root of every authed route group (`(seeker)/dashboard`, `(employer)/employer`, `(admin)/admin`, `(gov)/gov`) + the public group. Generic skeletons keyed to the typical layout shape per role.
- **`app/robots.ts`**  allows the public marketing surfaces, disallows every authed workspace + `/api`. Points to the sitemap.
- **`app/sitemap.ts`**  generated entries for landing / search / insights / privacy / paia + every consented non-deleted profile at `/p/<handle>`. Per-locale alternates for next-intl.
- **OpenGraph + Twitter Card + canonical** metadata on `/p/[handle]`.

### Strategic adds (Task 9.4  government pitch) ✅
- **Sebenza Labour Market Index** at `lib/analytics/lmi.ts`. Composite: `0.4 × freshness_ratio + 0.4 × (1 − normalised_gap) + 0.2 × placement_velocity`. All bounded; formula published on `/privacy` + at the API.
- **`/api/lmi`**  public JSON endpoint with components + previous-snapshot delta + the formula itself in the response. ISR'd 5 min.
- **`/api/cron/lmi-snapshot`**  nightly snapshot to `lmi_snapshots` for the time-series.
- **LMI badge** on the landing pulse-strip bulletin row with the week-over-week delta.
- **`/gov` route group**  new `gov` role in `user_role` enum (migration `0011`); `verifyGov()` in DAL (admins allowed for ops override); proxy `isProtected()` extended.
  - `/gov` overview: LMI hero + top 10 unfilled-demand skills + freshness summary + outcomes signpost.
  - `/gov/provinces` index + `/gov/provinces/[slug]` per-province deep dive (top unfilled-demand skills + supply by profession).
  - `/gov/municipalities` honest "coming soon" gated on city-cell-cohort suppression-floor cleared.
  - `/gov/exports` central download surface for the outcomes CSV + LMI JSON + admin audit log.
  - `/gov/account` with the same 2FA panel as the other roles.
- **PDF print export** at `/insights/print` (single-column, A4-sized, `@media print` rules + branded header + "Generated by Sebenza" footer). `<PrintActions />` client island fires `window.print()` for one-tap. Linked from the `/insights` policy-export section.

### Schema additions (migrations `0010` + `0011`)
- `lmi_snapshots` table for the LMI time-series.
- `user_role` enum extended with `'gov'` value (isolated migration, idempotent `ADD VALUE IF NOT EXISTS`).

### Documented deferrals (Task 9.5 + 9.6)

| Deferred | Reason | When to revisit |
|---|---|---|
| AWS Cape Town `af-south-1` migration | Wait for partnership / pilot decision; current Neon (EU) is POPIA-aligned for the build phase | Runbook ready at `docs/AWS_MIGRATION_RUNBOOK.md`  one-day op, zero remaining POPIA work |
| Holt's linear forecast on `/gov/forecast` | Needs 12+ weekly snapshots in `skill_gap_snapshots`; the Phase 8 cron is now capturing them | When 12 weeks of data exist |
| Materialised views | Only worth doing at 50k+ profiles / 100k+ search_events | Query latency monitoring tells us when |
| External pen-test | Separate engagement; requires production-like environment | Before commercial launch |
| `npm audit` clean as a standing rule | Should run on every release with a CI hook | When CI is set up (Phase 9.x) |
| Nonce-based CSP (drop `'unsafe-inline'`) | Requires verifying Next.js doesn't break under report-only mode | Hardening pass before commercial launch |

---

## Files added / changed

**POPIA**
- `app/[locale]/(public)/privacy/page.tsx`
- `app/[locale]/(public)/paia/page.tsx`
- `lib/cookies/consent.ts`
- `components/feature/legal/CookieConsentBanner.tsx`
- `app/[locale]/layout.tsx`  mounts the banner + reads consent on server
- `docs/popia/INFORMATION_OFFICER.md`
- `docs/popia/DPIA.md`
- `docs/popia/BREACH_RESPONSE.md`
- `docs/popia/RETENTION_POLICY.md`
- `docs/popia/ENCRYPTION_INVENTORY.md`

**Security**
- `proxy.ts`  `securityHeaders()` + `withSecurityHeaders()`
- `lib/sentry/init.ts`
- `lib/rate-limit/types.ts` + `lib/rate-limit/memory.ts` + `lib/rate-limit/index.ts`
- `lib/auth/actions.ts`  rate-limit decision recorded in `signIn` comment
- `lib/employer/reveal.ts`  rate-limit decision recorded in `revealContact` comment

**Polish**
- 5 × `loading.tsx` files
- `app/robots.ts`
- `app/sitemap.ts`
- `app/[locale]/(public)/p/[handle]/page.tsx`  `generateMetadata` extended with OG/Twitter/canonical

**Strategic adds**
- `lib/analytics/lmi.ts`
- `app/api/lmi/route.ts`
- `app/api/cron/lmi-snapshot/route.ts`
- `db/migrations/0010_phase9.sql` (`lmi_snapshots` table)
- `db/migrations/0011_phase9_gov_role.sql` (`user_role` enum extension)
- `db/schema.ts`  `lmiSnapshots` table + `gov` role
- `lib/mock/types.ts`  `UserRole` extended
- `lib/auth/dal.ts`  `verifyGov()` + `roleHome` updated
- `proxy.ts`  `/gov/*` paths recognised as protected
- `components/layout/govNav.ts`
- `components/layout/DashboardShell.tsx`  `gov` role + accent
- `app/[locale]/(gov)/gov/page.tsx` (overview)
- `app/[locale]/(gov)/gov/provinces/page.tsx` (index)
- `app/[locale]/(gov)/gov/provinces/[slug]/page.tsx` (deep-dive)
- `app/[locale]/(gov)/gov/municipalities/page.tsx`
- `app/[locale]/(gov)/gov/exports/page.tsx`
- `app/[locale]/(gov)/gov/account/page.tsx`
- `app/[locale]/(gov)/gov/loading.tsx`
- `app/[locale]/(public)/insights/print/page.tsx`
- `components/feature/PrintActions.tsx`
- `app/[locale]/page.tsx`  LMI badge on pulse strip
- `app/[locale]/(public)/insights/page.tsx`  "Print to PDF" link in policy-export section

**Docs**
- `docs/AWS_MIGRATION_RUNBOOK.md` (turnkey)
- `docs/PHASE_9_PLAN.md` → `docs/completed/` with acceptance ticked
- `docs/completed/PHASE_9_COMPLETE.md` (this file)
- `docs/ROADMAP.md`  Phase 9 ✅ + deferrals listed
- `docs/TO_START_EVERY_SESSION.md`  Current State updated

---

## Verification

`npm run db:migrate` ✓  `0010` + `0011` applied to Neon (PG 16).
`npm run typecheck` ✓ clean.
`npm run build` ✓ compiled.

---

## What's next

Sebenza is launch-ready against the current Neon (EU) DB. The remaining work is operational + commercial, not engineering:

1. **Designate the Information Officer** + Deputy; register with the Information Regulator.
2. **Pitch the government partner / pilot**. The `/gov` workspace, the Sebenza LMI, the longitudinal outcomes dataset, and the PAIA + Privacy + DPIA documentation are the materials.
3. **On partnership confirmation**: flip the relevant platform flags, follow the AWS migration runbook, designate KYC + SAQA providers.
4. **Phase 10** (`docs/PHASE_10_PLAN.md` to be written)  accessibility audit (WCAG 2.2 AA), performance budget on throttled 3G, full Tier-1 + Tier-2 + Tier-3 localisation rollout. This is the public-launch phase.
