# PHASE 9.5 PLAN — NATIONALITY ANALYTICS & LOCAL-HIRING INTELLIGENCE
*Side-phase between Phase 9 and Phase 10, mirroring the 6.5 / 7.5 pattern. Opened 2026-05-23.*
*Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `docs/SECURITY.md` · `docs/popia/`.*

> **Why 9.5 and not Phase 10:** Phase 10 is the public-launch phase (WCAG 2.2 AA audit, 3G perf budget,
> full localisation). This is analytics enrichment on **already-shipped** infrastructure (the `/gov`
> route group + `gov` role, the k=10 + complementary suppression engine from 7.5.4, the skills-gap engine
> + supply heatmap from 6/6.5, the LMI from 9.4). It belongs *before* launch but must not muddy the
> launch phase. Self-contained side-phase, exactly like 6.5 and 7.5.

---

## 🎯 GOAL

Turn nationality from a *search filter* (already shipped, unchanged) into a *governed policy lens*. The
strategic insight driving this phase: **nationality data, used honestly, is an anti-xenophobia tool, not
a targeting one.** It shows *where* South Africans can fill demand (→ local-hiring incentives are viable)
and *where* a genuine local skills shortage means foreign nationals are filling a real gap (→ training
investment, not blame). Same dataset, both truths, in the language government acts on: evidence.

Everything in this phase is **`gov` / `admin`-gated**, **suppression-floored**, and **audit-logged**.
Nothing public-facing changes.

### The access model (the spine of this phase — read first)
| Tier | Capability | Who | Verdict |
|------|-----------|-----|---------|
| Market | Aggregate nationality breakdowns by skill × province × status | `gov`, `admin` | ✅ build (inherits k=10) |
| Market | Skills-Shortage Justification Index + Local-Hiring Opportunity Map | `gov`, `admin` | ✅ build (the centerpiece) |
| Self | An employer sees **their own** confirmed-placement nationality mix | that `employer` | ✅ build (their own data, low risk) |
| Regulated | `gov` looks up **a specific employer's** mix as a compliance check | `gov` only, purpose-bound | ⚠️ build with small-numbers guard + audit + reason; **never ranked, never browsable as a leaderboard** |
| — | Public / cross-employer "who hires the most foreigners" league table | nobody | 🚫 **explicit out of scope** (§ guardrails) |

---

## ✅ PRE-FLIGHT RECHECK (run before writing code)

- [ ] Confirm `profiles.nationality` + `is_citizen` (or equivalent) shape and that `citizen_boost` in the
      Phase 4 ranking SQL reads from it. 9.5 **reads** these; the search filter itself is **unchanged**.
- [ ] Confirm `outcomesQuery()` + the suppression helpers (`outcomes_min_cohort_size`, complementary
      suppression across row+column groups) are exportable/reusable as a generic
      `suppress(rows, dims, k)` — 9.5 reuses this verbatim. If it's currently inlined to outcomes, the
      first task is to extract it (no behaviour change).
- [ ] Confirm `placements` columns + `placement_source` (`employer_confirmed` / `seeker_reported`) and
      that only `employer_confirmed` feeds official aggregates (the 7.5.5 honesty rule). 9.5 inherits this.
- [ ] Confirm `verifyGov()` DAL guard + `gov` role + `/gov` route group + proxy entries from 9.4.
- [ ] Confirm `platform_settings` key/value pattern (used for `outcomes_min_cohort_size`) — 9.5 adds
      `employer_mix_min_placements`.
- [ ] Confirm the audit-log write helper + action-naming convention (e.g. `placement.self_report`).
      9.5 adds new audited actions (below).
- [ ] Confirm the hardened CSV export path (injection guard + CRLF + row cap) — all 9.5 exports reuse it.

---

## 🧩 DEPENDENCY NOTE

The honesty of every number here rests on **employer-confirmed placements** (7.5.5). A nationality mix is
only meaningful if hires are logged. Lever C (the day-≥21 dossier nudge) is shipped; **Lever A** (analytics
value-exchange via the employer hiring funnel) is still deferred to Phase 9 and remains the main lever for
volume. 9.5 does not depend on Lever A landing, but the richness of 9.5.4/9.5.5 scales with placement
logging — note the coupling, don't block on it.

**Recommended order:** 9.5.1 (extract/confirm suppression util) → 9.5.2 (market nationality dimension)
→ 9.5.3 (Justification Index) → 9.5.4 (Opportunity Map) → 9.5.5 (employer self-view) → 9.5.6 (governed
per-employer lookup, last — highest sensitivity) → 9.5.7 (oversight log) → 9.5.8 (wiring/verification).

---

## 📋 TASKS

### Task 9.5.1: Reusable suppression utility (groundwork, zero behaviour change)
- [ ] Extract the 7.5.4 suppression logic into a generic `lib/analytics/suppress.ts`:
      `suppress(rows, { dims, countKey, k })` applying the k-floor **and** complementary suppression across
      the given dimension groups. Outcomes query refactored to call it (identical output — assert via the
      existing `outcomes-compliance` checks).
- [ ] Unit test: known fixtures in → same suppressed result the outcomes path already produces.

### Task 9.5.2: Nationality dimension on market analytics (`/gov`, `/insights`)
- [ ] Add a `nationality_class` derivation (`sa_citizen` / `foreign_national`) — a 2-class split, **not**
      raw country, for analytics. (Raw `nationality` stays available only on the individual profile under
      existing redaction; analytics never needs country-level granularity and country-level cells
      re-identify faster.)
- [ ] Extend the existing `/gov` aggregate views (supply by province × profession, placement rate,
      time-to-hire, status mix) with an optional citizen/foreign-national split. **All cells run through
      `suppress()` (k=10).** Default view stays un-split; the split is a toggle.
- [ ] Freshness-weighted via `sebenza_freshness_confidence()` like every other analytic.
- [ ] CSV export reuses the hardened path; suppression applies to exports identically (assert no bypass).

### Task 9.5.3: Skills-Shortage Justification Index (the centerpiece)
For each `profession × province` cell, combine three already-collected signals:
- [ ] **Demand** from `search_events` (the skills-gap engine source).
- [ ] **Local supply** = count of SA-citizen profiles available for that profession/province.
- [ ] **Fill pattern** = nationality_class split of `employer_confirmed` placements for that cell.
- [ ] Derive an honest, human-readable classification per cell, e.g.:
  - *Genuine local shortage* — high demand, low SA supply, foreign-national fill (→ training signal).
  - *Local supply available* — demand met or meetable by SA citizens (→ local-hiring incentive viable).
  - *Insufficient data* — below k; shown as blank/"too few" (never guessed).
- [ ] Surface on `/gov` as a sortable, suppressed table + on the province deep-dive. Plain-language legend
      that frames shortages as *training/opportunity signals*, never as blame. (Tone rule applies: this is
      policy intelligence, not a foreigners-vs-locals scoreboard.)
- [ ] Every classification cell is suppressed (k=10) and freshness-weighted.

### Task 9.5.4: Local-Hiring Opportunity Map (the actionable flip side)
- [ ] A `/gov` view highlighting `profession × province` cells classified *Local supply available* —
      i.e. where government can push local-hiring incentives **without** harming employers who genuinely
      can't find local talent.
- [ ] Reuse the existing supply-heatmap component pattern (no new map libs — No-Flash Rule).
- [ ] Drill-down links to `/search?q=<profession>&province=<slug>` (reuse 6.5 heatmap drill pattern), so a
      policy user can see the actual available local talent behind the number.
- [ ] Suppressed + freshness-weighted.

### Task 9.5.5: Employer self-view — "Your hiring on Sebenza" (low-risk, genuinely useful)
- [ ] On the employer dashboard: a card showing **the employer's own** `employer_confirmed` placement mix
      (e.g. "14 placements: 11 SA citizens · 3 foreign nationals"), plus role/location breakdown.
- [ ] **Their own data only** — scoped to `organizationId = session.org`. No cross-employer comparison,
      no ranking, no benchmark-against-others.
- [ ] Useful framing: "for your own equity/compliance records and incentive applications." **Do not assert
      a specific legal reporting requirement** (EEA nationality specifics unconfirmed — see open Q3).
- [ ] Audit-logged read (`employer.own_mix.view`) for symmetry, though it's self-data.

### Task 9.5.6: Governed per-employer compliance lookup (`gov` only — highest sensitivity)
The legitimate version of "how many nationals/non-nationals has *this* company hired" — built so it can't
become surveillance or a leaking individual record.

- [ ] **Access:** `verifyGov()` only. Not on any employer or public surface.
- [ ] **Small-numbers guard (hard):** show the citizen/foreign-national split for an employer **only if**
      their `employer_confirmed` placement count ≥ `employer_mix_min_placements` (new `platform_settings`
      key, default **5**, tunable from `/admin/settings`). Below it: "Too few platform-confirmed placements
      to break down" — never the raw split. *(Rationale: at employer granularity, cells are tiny; a 2-hire
      company with 1 foreign national + audited dossier reveals can re-identify the individual.)*
- [ ] **Purpose-bound:** the lookup requires selecting a reason (compliance check / incentive verification
      / mandated audit); reason + actor + employer + timestamp written to the audit log as
      `gov.employer_mix.lookup`. No reason → no result.
- [ ] **Not a leaderboard:** single-employer lookup by explicit selection only. **No ranked list, no
      "sort employers by foreign-national count," no bulk export of employers by mix.** (Enforced in the
      query layer — there is no endpoint that returns employers ordered by nationality mix.)
- [ ] Freshness note shown alongside (placements age).

### Task 9.5.7: Sensitive-query oversight log (watch the watchers)
- [ ] An `/admin` view surfacing all `gov.employer_mix.lookup` + nationality-split export events from the
      audit log — who ran a sensitive nationality query, when, against whom, with what stated reason.
- [ ] Filterable (actor, date, employer) + reuses the Phase 7 audit-log-filter + CSV pattern.
- [ ] **Trust rationale:** giving `gov` a powerful lens is safe *because* its use is itself observable.
      This is the governance signal that makes the Department comfortable adopting it — and the honest
      answer to "couldn't this be abused?" is "every use is logged and reviewable."

### Task 9.5.8: Scheduled LMI / nationality brief for `gov` (optional, mostly wiring)
- [ ] Reuse `/insights/print` print-CSS + the LMI cron infra to generate a monthly `gov`-only PDF brief:
      LMI headline + shortage/opportunity highlights + suppressed nationality dimension. No new infra; a
      compose-and-schedule on existing pieces. Drop to a fast-follow if 9.5.1–9.5.7 run long.

### Task 9.5.9: Wiring, verification, doc convention
- [ ] All new strings in `messages/en.json`; `zu/xh/af` deepMerge fallback (full translation Phase 10).
- [ ] Extend `lib/analytics/*-compliance.ts` assertions: (a) no nationality cell below k anywhere,
      including exports; (b) no endpoint returns employers ranked/sorted by nationality mix; (c)
      per-employer split never returned below `employer_mix_min_placements`; (d) every `gov.employer_mix.lookup`
      carries a reason. Exposed via the admin-only compliance endpoint; wired into the Phase 11.4 runner.
- [ ] `npm run build` clean (typecheck + lint + static gen × 4 locales). Smoke-test new `/gov` + `/admin` routes 200.
- [ ] Seed: a couple of foreign-national profiles + a mixed-nationality placement set on a seeded org so
      the Justification Index, self-view, and governed lookup all render a real (suppressed) row out of the box.
- [ ] On ship: `docs/completed/PHASE_9_5_COMPLETE.md`; tick the 9.5 header in `ROADMAP.md` ✅ + date;
      refresh **Current State** in `TO_START_EVERY_SESSION.md`; confirm `docs/PHASE_10_PLAN.md`; commit
      `Phase 9.5 complete + Phase 10 opens`.

---

## 🔓 OPEN QUESTIONS (decide before / during build)
1. **`employer_mix_min_placements` default** — 5 to start? Higher is safer against re-identification but
   blanks more employers early when placement volume is low. Tunable from `/admin/settings`.
2. **Justification Index thresholds** — what demand-vs-supply ratio flips a cell from "local supply
   available" to "genuine shortage"? Start simple and transparent (documented ratio), tune on real data.
   Avoid a black-box score — government must be able to explain the classification.
3. **EEA / nationality legal mapping** — what (if anything) SA employment-equity law actually requires re:
   *nationality* (vs race/gender/disability) is **unconfirmed**. Verify with someone across the Employment
   Equity Act before any pitch claims a legal reporting mandate. The feature is useful regardless; the
   *claim* must not outrun the law.
4. **`gov` per-employer lookup — mandate scope** — should this be gated behind an additional feature flag
   (`feature_flag_employer_mix_lookup`, default OFF) until an actual regulatory mandate exists, mirroring
   the dormant-by-default KYC/SAQA pattern? (Leaning **yes** — ship dormant, flip on mandate.)

## 🚫 OUT OF SCOPE FOR 9.5 (explicit guardrails — do not build)
- ❌ **Any public or cross-employer "nationality league table"** or endpoint that ranks/sorts employers by
  foreign-national count. This is the xenophobia-weapon artifact; it does not exist in the codebase.
- ❌ **Country-level nationality analytics** — analytics use the 2-class `sa_citizen` / `foreign_national`
  split only; raw country stays on the redacted individual profile.
- ❌ **Per-employer mix below the small-numbers floor** — no exceptions, including for `gov`/`admin`.
- ❌ Changing the **search-side nationality filter** — it is shipped and correct; this phase does not touch it.
- ❌ Surfacing nationality analytics on any **seeker/employer/public** surface (gov/admin only).
- SAQA/Home Affairs nationality verification — stays with the dormant Phase 8 adapters.

---

## 🧭 WHY THIS IS THE SEBENZA VERSION
The naive build is "filter and rank employers by how many foreigners they hire." That's a targeting tool.
This phase keeps the genuine value the operator asked for — local-hiring intelligence, the shortage
justification that *defends* both local hiring and necessary foreign hiring with evidence, and an
employer's legitimate view of their own mix — while structurally preventing the weaponised version through
four mechanisms: the **2-class split** (no country-level targeting), the **inherited k=10 + complementary
suppression** (no individual re-identification), the **small-numbers floor at employer granularity** (the
sharp edge the market views don't have), and the **oversight log** (every sensitive query is itself
watched). The capability serves policy; it cannot become a list.

*Plan opened 2026-05-23. Target: complete before Phase 10 (public launch) opens.*
