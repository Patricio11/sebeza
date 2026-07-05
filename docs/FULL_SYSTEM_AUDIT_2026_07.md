# FULL SYSTEM AUDIT — 2026-07-02

*Commissioned as a top-to-bottom check: mock/unseeded data residue, security, documentation
consistency, and market research into must-have features. Three parallel deep audits over the whole
tree + external research. This doc is the findings ledger + the proposed fix phases (23–26).*

---

## 1 · MOCK / UNSEEDED DATA — the direct question: "is anything still mock?"

**Verdict: mostly clean, but FOUR real leaks remain — two of them violate the honesty rules.**

### 1.1 CRITICAL — Student lane on `/dashboard/grow` is 100% fabricated ⚠️
`app/[locale]/(seeker)/dashboard/grow/page.tsx:193` still calls `getStudentSnapshot()` from
`lib/mock/academic.ts`, which returns one of TWO hardcoded snapshots (CS vs accounting). Every
student seeker sees the same invented data:
- Fake elective demand numbers (1240 searches etc.).
- Fake programmes ("Yoco Engineering Internship", "Discovery Graduate Programme — Closes 30 June")
  with fabricated application statuses.
- **Graduate destinations with invented shares rendered under "From confirmed placements" — a direct
  Placement-Truth-rule violation** (claims real provenance for fake numbers).
The same page ALSO renders genuine DB student data (ProgrammeVsMarketCard, progression timeline) —
so real and fake sit side by side. **Fix: rebuild the lane from DB (placements/destinations exist as
real queries) or remove/flag the fabricated sections until they're DB-backed.**

### 1.2 CRITICAL — Landing-page "Confirmed hires" testimonials are invented
`app/[locale]/page.tsx:704-741` — hardcoded `OUTCOMES` (Thandeka M. "Hired at La Colombe",
daysToHire 11/6/19…) rendered under **"Confirmed hires. Not screenshots."** — a Verification-Honesty
violation on the most public page. **Fix: derive from real `placements` (employer_confirmed,
anonymised, suppressed below a floor) or remove the section.**

### 1.3 Provider seam still defaults to `mock`
`lib/data/provider.ts:134` — `SEBENZA_DATA_PROVIDER ?? "mock"`, and unknown values fail TO mock.
Landing + `/insights` headline stats + `/search` + `/p/[handle]` flow through the seam; a prod
deploy that forgets the env var silently serves `mockAnalytics` (48,213 fake actives). Everything
else already bypasses the seam and hits `db/queries/*` directly. **Fix: default to `db`, fail loud
(throw) on `mock` in production, or delete the seam and keep mock only for tests.**

### 1.4 Hardcoded display numbers
- `app/[locale]/page.tsx:213,224` — hero trends "+8.2% MoM" / "+11% MoM" are hardcoded, never computed.
- `db/queries/career-compass.ts:204-208` — `rankIfLearned {current:0, projected:0}` leaks a
  **"#0 → #0" projected-rank card** on grow recommendations (headline is overridden with real rank,
  but the per-recommendation copy is not).

### 1.5 Taxonomy divergence — constants vs DB tables (functional bug!)
DB tables exist for skills/professions/provinces, and `/admin/taxonomy` + **Phase 19
canonicalization write to them** — but there is **no `getSkills()` DB reader**: `SkillsEditor`,
vacancy skill pickers, and `SearchBar`'s profession dropdown read the frozen constants. Concretely:
**a custom skill promoted via `/admin/custom-skills` (Phase 19) never appears in the skill picker.**
Only professions have a DB reader (`getProfessions()`), and even it is bypassed by `SearchBar`.
**Fix: add cached `getSkills()` (+ use `getProfessions()` everywhere); pickers read DB with constant
fallback — the pattern `SeekerSignUpForm` already uses.**

### 1.6 Verified clean
Career-compass core (recommendations, adjacent professions, city demand, learning paths), all of
`/insights` beyond the provider headline, dashboards, gov surfaces, vacancies, notifications — all
genuinely DB-backed. `lib/mock/helpers` (pure functions), type-only imports, and seed/test usage of
`mockProfiles`/`MOCK_COMPASS` are correct and should stay.

---

## 2 · SECURITY

**Overall: unusually disciplined** — enumerated public-payload redaction, AES-256-GCM done right,
all 23 cron routes fail-closed on `CRON_SECRET`, consistent IDOR scoping from session (spot-checked
across learning/custom-skills/follows/reviews), zero XSS sinks, hardened uploads (magic-byte sniff),
LLM creds never leave the server, role not client-settable. The gaps:

| Sev | Finding | Fix |
|---|---|---|
| **HIGH** | **Real credentials in `.env.local` on disk** (Neon password, `SEBENZA_ENCRYPTION_KEY` — the master key for every national ID — Better Auth secret, Supabase service-role JWT, live Resend key). *Verified NOT committed to git.* | **Rotate all six** (operator task); keep secrets only in the deploy platform env. Encryption-key rotation needs a re-encrypt plan (key-id prefix already supports it). |
| MED | Rate limiting is **entirely dormant** — buckets defined (`lib/rate-limit/`), zero call sites. Contact reveal is scrapeable by a verified org; the AI-coach has a global budget but **no per-user throttle** (one seeker can drain the shared budget). | Wire `enforce("reveal", org:profile)` in `revealContact`; per-user daily bucket in the coach dispatcher. |
| MED | Forced 2FA defaults OFF (`feature_flag_2fa_enforced: false`) — admins/employers can run password-only, and sign-in has (by documented choice) no lockout. | Default ON for `admin` at minimum. |
| MED | CSP has `unsafe-eval` (comment claims inline-only) and headers skip `/api` entirely. | Drop `unsafe-eval`; nonce CSP is already a tracked pre-launch item; add minimal headers on API. |
| MED | `sql.raw` array-literal building with manual quote-escaping in `db/queries/profiles.ts:216-232,534` — safe today, fragile pattern. | Bind arrays properly. |
| LOW | Non-constant-time `CRON_SECRET` compare; unescaped `%`/`_` in admin/gov LIKE searches; duplicated `EMAIL_TRANSPORT` in `.env.local`. | `timingSafeEqual`; escape wildcards. |
| LOW | **Cron drift: `seeker-demand-pulse` (17.2) + `learning-path-freshness` (18.2) are NOT in `vercel.json`** — routes exist + guarded but never scheduled. | Add both schedules. |

---

## 3 · DOCUMENTATION

| Doc | State |
|---|---|
| `CLAUDE.md` | **Most stale doc in the repo**: claims "Phase 1, mock-driven", "Drizzle 0.36 … not yet connected", `../` companion links resolve OUTSIDE the repo, auth described as stubs, commands section missing db/test scripts. Needs a rewrite. |
| `README.md` | Frozen at Phase 13.10; says Phase 12 "planned" (it shipped); "22 migrations through 0021" (57 through 0056); internally contradicts itself on cron count (16 vs 18); still says Resend (now SMTP). |
| `TO_START_EVERY_SESSION.md` | Current-state block **ends at Phase 17** — 18/19/20/21/22 missing; frames 18–21 as future; `SEBENZA_DATA_PROVIDER` default contradicts code. |
| `ROADMAP.md` | Body is current through 22 ✅ but the footer says "v2.5, synced through 17"; DEPLOYMENT CHECKLIST all-unchecked though several items are done; stale tool names (Resend/KMS/PostHog). |
| **`docs/popia/DPIA.md` + `RETENTION_POLICY.md`** | **Governance gap:** zero coverage of Phases 17–22. DPIA still asserts *"the student never talks to the LLM / no seeker data is sent"* — **no longer true** (coach sends seeker free-text cross-border). No entries for distress processing, `crisis_resources`, custom skills, city-level demand. Retention table missing every Phase 11+ table by its own "if it exists, add a row" rule. **This is a precondition for the AI-coach flag ever going ON.** |
| `.env.example` | Frozen at Phase 10 — missing `CRON_SECRET`, `DATABASE_DRIVER`, SMS/WhatsApp/KYC vars, `EMAIL_TRANSPORT_STRICT`, etc. |
| `docs/popia/ENCRYPTION_INVENTORY.md` | Names env vars (`ID_ENCRYPTION_KEY*`) that don't exist in code (`SEBENZA_ENCRYPTION_KEY`). |
| Structure | `POST_LAUNCH_BACKLOG_v1.md` orphaned (0 inbound references); `SEEKER_GROWTH_PHASES_18-21_PLAN.md` shipped → belongs in `docs/completed/`; `PHASE_22_*` stays in root only until the operator gate closes. |

---

## 4 · MUST-HAVE FEATURE OPPORTUNITIES (research-backed)

Market signals (2026): SA youth unemployment 60.9% (15–24); a **job-scam epidemic** (fake WhatsApp
recruiters, cloned portals); **~85% of employers now hire skills-based** with "skills passports"
emerging (Singapore has a national one); **USSD still carries ~9/10 mobile transactions in
sub-Saharan Africa**; government is expanding the ESSA/SAYouth/NYDA database ecosystem this year.

Ranked by impact ÷ effort, and by fit with what Sebenza already has:

1. **Scam-Shield (trust layer)** — *the* differentiator given the scam epidemic, and 90% of the
   machinery exists (verified orgs, report flow, audited contact). Ship: a public "how Sebenza will
   and will never contact you" page; a **"Verify this offer" checker** (seeker pastes a suspicious
   message/company → did it really come via a Sebenza-verified employer?); prominent verified-only
   contact guarantee; scam-warning education (Phase 15 article exists — surface it harder).
2. **Skills Passport export** — one-page, honest, printable skills profile (reuse the Phase-15
   print-CSS CV engine) with verification states shown truthfully + a QR link back to the LIVE
   profile (the live profile *is* the verification — no forgeable PDF claims). Rides the global
   skills-based-hiring wave; near-zero new infra.
3. **Employer accountability ("response index")** — median response time + response rate per
   employer, computed from the existing invitation lifecycle; shown to seekers on employer cards.
   No job board does honest employer accountability; it drives employer behaviour and seeker trust.
4. **USSD/SMS lane** — status re-confirm + invite alerts over USSD/SMS for feature phones (dormant
   Phase 11.4.4 SMS infra + Phase 14 zero-rating research pair with this). Highest reach, needs
   aggregator partnership + cost model → sequence behind 1–3.
5. **Gov ecosystem interop** — ESSA/SAYouth export-format alignment as a partnership wedge (the
   Phase 14 track already owns the relationship problem).

---

## 5 · PROPOSED FIX PHASES

- **Phase 23 — Truth & Data Integrity** *(highest urgency: honesty-rule violations live today)*
  23.1 Student lane → DB-backed or honestly removed (kills the fake "From confirmed placements").
  23.2 Landing outcomes → real anonymised placements (floor-gated) or removed; kill "+8.2% MoM".
  23.3 `rankIfLearned` #0→#0 leak fixed.
  23.4 `getSkills()`/DB-backed pickers (fixes the Phase-19 canonicalization bug); `SearchBar` → `getProfessions()`.
  23.5 Provider default → `db` (fail loud in prod); mock provider fenced to tests.
- **Phase 24 — Security Hardening**
  24.1 (operator) rotate all `.env.local` secrets. 24.2 wire rate limits (reveal + coach per-user).
  24.3 2FA default ON for admins. 24.4 CSP `unsafe-eval` out + API headers. 24.5 `sql.raw` arrays → bound.
  24.6 `timingSafeEqual` + LIKE-wildcard escaping. 24.7 add the 2 missing cron schedules to `vercel.json`.
- **Phase 25 — Docs & Governance Sync**
  25.1 CLAUDE.md rewrite (current architecture, fixed links). 25.2 README refresh to Phase 22.
  25.3 TO_START current-state 18–22. 25.4 ROADMAP footer + checklist truthing.
  25.5 **DPIA + retention addenda for 17–22** (seeker-LLM cross-border, distress, crisis_resources, custom skills, city demand) — precondition for the coach flag.
  25.6 `.env.example` + ENCRYPTION_INVENTORY correction. 25.7 file moves/dedupe.
- **Phase 26 — Must-Have Features** (flag-gated, ship-dark, same testing discipline)
  26.1 Scam-Shield → 26.2 Skills Passport → 26.3 Employer response index → 26.4 USSD/SMS (partnership-gated).

## 📌 STATUS
- [ ] Phase 23 — Truth & Data Integrity
- [ ] Phase 24 — Security Hardening (24.1 is an operator action)
- [ ] Phase 25 — Docs & Governance Sync
- [ ] Phase 26 — Must-Have Features
