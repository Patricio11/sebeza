# PHASES 23–27 — TRUTH, TESTIMONIALS, INTEGRATIONS, SECURITY, GOVERNANCE

*Opened 2026-07-02. Executes `docs/FULL_SYSTEM_AUDIT_2026_07.md` + the founder's additions
(showcase seed, screenshot E2E, admin-managed integrations, the testimonials system). Confirmed
decisions: landing page replaces fake "confirmed hires" with real aggregate stats + the (Phase 24)
testimonials rail; Bulk SMS is opt-in consent-gated only.*

> **Discipline (unchanged, non-negotiable):** every task lands with `test:all` green + E2E (both
> flag states where flagged) at desktop + 360px + clean migrations before its commit. Every rule
> (No-Flash, POPIA-First, Verification-Honesty, Placement-Truth, human-translated legal copy) holds.

---

## 🩺 PHASE 23 — TRUTH & DATA INTEGRITY + SHOWCASE SEED

**Thesis: nothing user-visible may be fabricated or hardcoded. Everything reads the DB; everything
the DB needs is seeded.**

- **23.1 Student lane → DB.** New `graduate_programmes` table (migration; seeded from the current
  mock constants; admin-editable later). Destinations computed from **real `placements`**
  (7.5 outcomes machinery) — k-floor suppressed, honestly labelled; below floor → section hidden.
  Electives → real demand-vs-curriculum signal. `lib/mock/academic.ts` demoted to seed-source/types.
- **23.2 Landing truth.** Real aggregate stats via DB (actives, confirmed hires) + **computed** MoM
  trends (this month vs last, hidden when previous month is empty — never invented). Fake
  `OUTCOMES` testimonial cards **removed** (Phase 24 replaces the section with real testimonials).
- **23.3 Rank-leak fix.** `rankIfLearned {0,0}` no longer emitted/rendered; the real
  `rankInPoolQuery` projection feeds the top recommendation.
- **23.4 DB-backed pickers.** New cached `getSkills()` (mirrors `getProfessions()`: DB + constant
  fallback). Wire: `SkillsEditor`, vacancy skill pickers, `SearchBar` professions. Fixes the real
  bug where Phase-19 canonicalized skills never appear in pickers.
- **23.5 Provider default.** `SEBENZA_DATA_PROVIDER` defaults to `db`; explicit `mock` allowed only
  outside production (prod + mock → throw loud at startup, never silently fake).
- **23.6 Showcase seed.** Flagship log-in-able accounts (documented in the seed header):
  2–3 seekers with EVERYTHING (skills+years, experience, quals, in-progress learning w/ progress,
  badges, custom skill, one student-mode), an employer org with an **open vacancy (live invites)**
  and a **closed vacancy with the hired seeker's confirmed placement + `vacancy.outcome.other-hired`
  feedback notifications to the not-hired invitees** (9.11 machinery, seeded end-to-end).
- **23.7 Showcase E2E + screenshots.** New spec walking the flagship flows (seeker login →
  dashboard → grow; employer → vacancy → hired/feedback; admin surfaces), capturing screenshots at
  each key step to `test-results/screenshots/`, desktop + 360px, additive to the 86-test suite.

## 💬 PHASE 24 — TESTIMONIALS (admin-run, never a page)

- **24.1 Schema:** `testimonials` (id, user_id nullable-for-admin-created, author_role
  seeker|employer|admin, quote ≤ 280, display_name, display_context, consent_display bool, state
  pending|approved|hidden, sort_order, created_at) + `testimonial_prompt_state` per user (snoozed_until,
  submitted_at) + a `testimonial_campaign_active` platform setting.
- **24.2 Collection moment:** while the campaign is ON, eligible seekers + employers (active; not
  snoozed; never submitted) see a **small dismissible card** on their dashboard — one quote field +
  explicit public-display consent line. Dismiss → snooze 30 days; submit → never asked again.
  Smooth, No-Flash, not a modal, not a page.
- **24.3 Admin `/admin/testimonials`:** campaign toggle, approve/hide, reorder, **create manually**,
  audit-logged. POPIA: display consent recorded; revocation honoured.
- **24.4 Landing rail:** approved testimonials render in the section 23.2 emptied (quotes labelled
  as quotes beside the real aggregate stats); zero approved → section hidden.

## 🔌 PHASE 25 — INTEGRATIONS HUB (`/admin/integrations`)

- **25.1 Hub page:** cards for LLM (links to `/admin/llm`), Email/SMTP, SMS, WhatsApp, Storage,
  Database, KYC — each with live status.
- **25.2 Admin-managed channel creds:** `integration_settings` table (LLM pattern: encrypted creds,
  test-connection, enable/disable, audited) for **SMS / WhatsApp / Email**; env stays as fallback.
- **25.3 DB + Storage = health monitoring only** (connection, migration head, bucket reachability) —
  the app cannot bootstrap its own DB creds from the DB; that boundary is documented on the card.
- **25.4 Bulk SMS (announcements):** admin composes → goes ONLY to users with a new opt-in
  `announcements` consent purpose + a working channel; per-send audit + cost estimate; killswitch.
- **25.5 Existing SMS/WhatsApp channel flags integrate into the hub view.**

## 🔒 PHASE 26 — SECURITY HARDENING (audit §2)

- 26.1 *(operator)* rotate every `.env.local` secret. 26.2 wire rate limits (contact reveal;
  per-user AI-coach bucket). 26.3 2FA default ON for admins. 26.4 CSP: drop `unsafe-eval`, headers
  on API routes. 26.5 `sql.raw` arrays → bound params. 26.6 `timingSafeEqual` cron compare +
  LIKE-wildcard escaping. 26.7 add `seeker-demand-pulse` + `learning-path-freshness` to `vercel.json`.

## 📚 PHASE 27 — DOCS & GOVERNANCE SYNC (audit §3)

- 27.1 CLAUDE.md rewrite (true current state, fixed links). 27.2 README → Phase 22+, correct
  migration/cron counts. 27.3 TO_START current-state 18–23+. 27.4 ROADMAP footer + deployment
  checklist truthing. 27.5 **DPIA + retention addenda (17–22)** — seeker-LLM cross-border, distress,
  crisis_resources, custom skills, city demand (precondition for the coach flag). 27.6 `.env.example`
  completion + ENCRYPTION_INVENTORY env-var fix. 27.7 move shipped plan docs; dedupe backlog files.

## 📌 STATUS
- [x] **23 Truth & Data + Showcase** ✅ 2026-07-02 — 23.1 student lane → DB (migration `0057`
  `graduate_programmes`; real destinations from 11 confirmed placements; real electives) · 23.2
  landing (computed MoM; fake outcomes removed) · 23.3 rank-leak fixed (real boost-1 projection) ·
  23.4 `getSkills()` + DB pickers everywhere (canonicalized skills now appear + save) · 23.5 provider
  default `db`, mock throws in prod · 23.6 showcase seed (filled-vacancy feedback via consented
  invitees; flagship learning/badges; `docs/SHOWCASE_ACCOUNTS.md`) · 23.7 showcase E2E with 16
  screenshots. **Verified:** test:all 358 vitest (incl. 30 compliance — which caught + forced the
  consent-correct seed design) · **full E2E 96/96, 0 flaky** (root-caused the recurring strict-mode
  flake: Next streaming-nav DOM duplication → main-scoped locators).
- [x] **24 Testimonials** ✅ 2026-07-02 — migration `0058` (`testimonials` + `testimonial_prompt_state`) ·
  campaign setting (`testimonial_campaign_active`, managed from `/admin/testimonials`) · dismissible
  collection card on seeker + employer dashboards (consent-required submit; dismiss = 30-day snooze;
  submit = never again) · admin curation (campaign toggle, approve/hide/delete, manual create, audited)
  · landing rail renders ONLY approved consented quotes (hidden when none; display fields captured at
  submission — never live PII). **Verified:** 358 vitest · E2E full loop 4/4 (campaign off → nothing;
  on → submit-with-consent → thanked → never re-asked → admin approve → landing rail), desktop + 360px.
- [x] **25 Integrations Hub** ✅ 2026-07-05 — migration `0059` `integration_settings` (encrypted creds,
  llm_providers posture) · `/admin/integrations`: health row (live DB latency + migration count,
  storage/LLM/KYC status) + channel cards (SMS/WhatsApp/Email: configure → encrypted save → EXPLICIT
  enable; env stays the fallback — `resolveIntegration` overlay wired into `sendSms`/`sendWhatsApp`/
  `sendEmail` with the historical env path unchanged) · **Bulk announcements** (25.4): new opt-in
  `announcements` consent purpose (migration `0060`, privacy-page copy, non-degrading), fan-out ONLY to
  consented + verified-phone users, 500-per-send cap, per-send audit (count only), graceful skip on
  undecryptable phones. **Verified:** vitest (consent catalogue updated) + build + E2E 2/2 (health →
  configure console SMS → enable → eligible-count → send reports honestly), desktop + 360px.
- [x] **26 Security Hardening** ✅ 2026-07-06 (code items) — 26.2 rate limits wired: contact reveal
  (20/hr per org) + a new per-user AI-coach bucket (10/day, placed AFTER the distress screen so crisis
  routing is never throttled) · 26.3 admins hard-require 2FA **in production** regardless of the flag
  (dev/test keep flag behaviour for seeded flows) · 26.4 CSP: `unsafe-eval` is now DEV-ONLY · 26.5 the
  `sql.raw` hand-escaped array literals → individually bound `ARRAY[$1,…]` params (caught + fixed a
  drizzle binding subtlety via the existing filter test) · 26.6 constant-time `CRON_SECRET` compare +
  `escapeLike` on admin/audit/gov searches · 26.7 `vercel.json` gains the two missing schedules
  (`seeker-demand-pulse`, `learning-path-freshness`) → 20 crons. **26.1 (operator): rotate every
  `.env.local` secret — still yours.** Verified: 358 vitest + build green.
- [ ] 27 Docs & Governance (27.1–27.7)
