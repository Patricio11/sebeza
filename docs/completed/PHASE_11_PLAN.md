# PHASE 11 PLAN  SEEKER RETENTION & SKILL-GROWTH CONVERSION
*Opens after Phase 10 (Public launch) ships. Companion docs: `TO_START_EVERY_SESSION.md` · `ROADMAP.md` · `UX_UI_SPEC.md` · `PHASE_11_{1,2,3,4,5}_PLAN.md`.*

> **Stop signal:** the surface is in front of real seekers. Every change here is measured against one question: *"does this make seekers come back next week?"* Risk-bias is conservative; nothing destabilises the consent / audit / status-freshness invariants from Phases 9.x.

> **UX/UI quality bar (non-negotiable):** smooth, beautiful, consistent with the Civic Editorial aesthetic, **mobile-first** by construction. No-Flash Rule still applies: works on a low-end Android over 3G; JS budget ~150 KB on key routes; no heavy animation. Every list, form, and modal in this phase renders cleanly at 360 px wide before it ships.

---

## 🎯 GOAL

Sebenza's seeker side is **architecturally sound**. Career Compass is a genuinely innovative wedge feature for retention; consent is granular and POPIA-honest; status freshness drives rank-quality coupling that works; the invitation lifecycle has dignity. The data, the cron jobs, the audit-log honesty are all in place.

**The gap is engagement velocity.** A seeker signs up, sees their rank, reads a recommendation, and then nothing tells them their effort matters. Week 2 they're still #7, no invites, no emails reminding them why. They stop checking.

Phase 11 closes that gap. The thesis is: **most fixes are surfacing problems, not missing-feature problems**  the data exists, the cron jobs run, the audit log records the events. We just don't tell the seeker. Phase 11 makes existing effort visible and felt; it also closes the conversion gap on the Learning Loop (Phase 9.12) so skill growth actually produces credentials, not just intent.

Five sub-phases, ordered by ROI per LOC:

1. **Phase 11.1  Engagement velocity** *(retention surfacing)*
2. **Phase 11.2  Learning loop completion** *(skill-growth conversion)*
3. **Phase 11.3  Seeker control + trust posture** *(safety + agency)*
4. **Phase 11.4  SA distribution surface** *(WhatsApp / SMS / share-card)*
5. **Phase 11.5  Profile depth + mobile polish** *(form ergonomics + a11y)*

The umbrella priority is **11.1 first, then 11.2**. Together they're the single biggest retention lift available: ~5–7 days of work, near-zero risk, surface-level mostly. The remaining three sub-phases can ship in any order based on operator capacity.

---

## 📐 STRUCTURAL POSTURE (shared across all five sub-phases)

These invariants land once at the top of the phase and are inherited everywhere below. Every task in 11.1–11.5 honours them.

- **No new charts.** Recharts stays the only chart library; if a sub-phase needs visualisation it uses mount-gated client islands or static SVG, never a new dep.
- **POPIA-first invariants preserved.** Consent gates do not relax; audit-log writes are not skipped; soft-delete is reversible for 30 days; `account.data_export` continues to write on every export. Nothing in Phase 11 introduces a new data category without a DPIA line.
- **Email channel respects per-user prefs.** No bulk sends without the per-user `email_enabled` flag and the per-kind preference both true.
- **Mobile-first by construction.** Every new surface is designed at 360 px first, then progressively enhanced.
- **English deepMerge fallback honoured.** Tier-1 catalogs (`zu`, `xh`, `af`) gain new keys from the English base via the merge in `i18n/request.ts`; Tier-2 / Tier-3 stubs from Phase 10.7 are unaffected.
- **Civic-Editorial typography stays.** Fraunces × Hanken Grotesk; no new font families.

---

## 🧱 WHAT ALREADY EXISTS (build on, don't rebuild)

The Phase 9.x + 10 work shipped the substrate Phase 11 is going to lean on. Each sub-phase plan references the specific surfaces; the umbrella highlights:

- **Career Compass** (`/dashboard/grow`)  Phase 9.12 / 9.13. Recommendations + learning paths + adjacent professions + city demand + student lane.
- **Learning Loop** (`lib/seeker/learning.ts`)  Phase 9.12. `acceptRecommendation` → `startLearningItem` → `completeLearningItem` (+ provenance upgrade) / `abandonLearningItem` (+ structured reason).
- **Activity Ledger** (`/dashboard/activity`)  Phase 7. Audit-log-backed PII-event view + four KPIs (viewers / contacts / reveals / downloads).
- **Notification Catalog** (`lib/notifications/catalog.ts`)  Phase 7. Nine kinds, dedupe windows, in-app + email channels. Defaults conservative (`defaultEmail: false`).
- **Consent Surface** (`/dashboard/privacy`)  Phase 2 / 9.x. Six purposes, default-off on the consequential ones, version-tracked.
- **Status Freshness**  Phase 6. 90-day stale band + nightly cron + dashboard nudge banner.
- **Audit log infra** (`lib/audit/`)  Phase 0. Every PII-touching path writes a row.
- **Email transport**  Phase 8 / 9.18. SMTP (Resend / Sendgrid / Postmark / AWS SES) abstracted behind `SMTP_*` env vars; loud-fail when misconfigured.
- **Help centres** (`/dashboard/help`)  Phase 10.2. Article links from product surfaces; deep-link chips (`HelpLink`).
- **Multi-select skill picker**  recent post-Phase-10 commit (`b710428`). `MultiSelectComboboxField` with profession-scoped suggestions, "Other" path with admin promotion.

---

## 📋 SUB-PHASE ROUTING

| # | Sub-phase | Plan doc | Headline tasks | Effort | Risk |
|---|---|---|---|---|---|
| 11.1 | Engagement velocity | `PHASE_11_1_PLAN.md` | Weekly digest email · "Why no invites?" diagnostic · Welcome-back delta card · Achievement badges · Invitation urgency chip · Audit-log link prominence | M | Low |
| 11.2 | Learning loop conversion | `PHASE_11_2_PLAN.md` | LearningPath `url` field · Free-alternative on cost-abandon · Completion → cert upload bridge · "Interested" parking-lot state · Skill journey timeline · City-demand → search drill-down · Compass auto-revalidate · Adjacent profession CTA · Student-lane discoverability | M/L | Low |
| 11.3 | Seeker control + trust | `PHASE_11_3_PLAN.md` | Pause searchability · Block this employer (private) · Report this invite · Vacancy snapshot in invitation detail · Employer verification badge on invite card · Employment-verification audit-trail visibility | M | Low |
| 11.4 | SA distribution | `PHASE_11_4_PLAN.md` | Profile shareable summary card (PNG + WhatsApp deep-link) · Follow employer (save list) · Data-saver mode · SMS / WhatsApp notification channel · Recommended employers by profession | M/L | Medium (SMS adds external dep + ongoing cost) |
| 11.5 | Profile depth + mobile polish | `PHASE_11_5_PLAN.md` | "Open to ___" tags · CV upload fallback · Profile-editor jump-to-section on mobile · Avatar `sizes` + responsive images · Career-compass lazy-load below fold · A11y fixes (ordinal numerals, MultiSelect group roles, audit-log link, modal focus return) | S/M | Low |

---

## 🪜 EXECUTION ORDER (the founder read)

If you have **3 days**: ship **Phase 11.1** alone. The weekly digest email + "Why no invites?" diagnostic + welcome-back delta + LearningPath `url` (the one task from 11.2 that fits this window) together change the engagement curve more than anything else on this list. Near-zero risk; mostly surfacing existing data.

If you have **2 weeks**: ship **Phase 11.1 + 11.2 + the trust trio from 11.3** (pause searchability, block employer, report invite). This is the platform's quality-bar moment  retention surfacing + skill-growth conversion + seeker agency over their own visibility. Together they answer the three biggest questions a thoughtful seeker asks in week 4: *"Is this working? Can I see why? Do I have control?"*

If you have **6 weeks**: full Phase 11. The SA distribution work in 11.4 (profile share card + WhatsApp deep-link) is the one feature most likely to drive organic growth from your friends' networks  but it's also the riskiest because it touches a public surface (the share image is rendered server-side and indexed). Treat 11.4 as the gated rollout.

The mobile polish in 11.5 is **always do** but not always urgent. Bundle it with whichever sub-phase happens to touch the relevant surfaces.

---

## 🚫 OUT OF SCOPE FOR PHASE 11 (explicit guardrails)

- ❌ **New consent purposes.** The six purposes from Phase 2 / 9.x are the contract. New product features wrap existing consents; they don't add new ones.
- ❌ **PWA / offline reading of invitations.** Genuinely valuable for SA seekers; carefully deferred to **Phase 12+** because service-worker setup + cache strategy + sync API risk blowing the JS budget. See `POST_LAUNCH_BACKLOG.md`.
- ❌ **Skill micro-tests.** SETA-aligned skill verification is a feature wedge but requires content investment + cheating prevention + partnership validation. **Phase 12+**.
- ❌ **AI-driven matching / recommendations.** Career Compass is data-grounded by design (real search-event demand, controlled taxonomy). Phase 11 does not introduce ML scoring or LLM-driven copy.
- ❌ **New chart libraries.** Recharts mount-gated is the only chart engine.
- ❌ **Marketing surfaces** (landing page, blog, sebenzasa.com homepage). Those belong to the marketing-site repo, not the product.
- ❌ **Schema changes unrelated to a task.** Pure migration work waits for a phase that has a feature reason to touch the schema.
- ❌ **Public profile redesign.** `/p/[handle]` stays as Phase 1 / 9.x shipped it. Share-card rendering in 11.4 reads from that data; it does not edit it.

---

## 🧪 HOW WE'LL KNOW PHASE 11 WORKED

Three measurable signals at +30 days post-ship. We don't need an analytics stack to read them  the audit log + the activity table + Sentry / Resend logs give us all of this.

1. **Week-4 retention**  share of seekers who sign up and have at least one dashboard-view event in the 22–28 day window after sign-up. Pre-Phase-11 baseline: estimate ≤30% (we don't have the data yet because we don't have the seekers yet). Post-Phase-11 target: **≥55%**.
2. **Weekly digest open rate**  Resend / Sendgrid / Postmark log the opens. Target: **≥35%** of digests open + at least one link click. Anything below 20% means the digest copy is wrong.
3. **Learning-item completion rate**  `learning_items` rows in `completed` state divided by rows ever in `planned` state. Pre-Phase-11 baseline: estimate <10% (the conversion gap is the whole point). Post-Phase-11 target: **≥35%**.

The numbers are honest estimates. The point is the direction.

---

## 🧭 IMPACT ON OTHER SURFACES

- **No employer-side changes** in Phase 11.1–11.3 except where 11.3 surfaces employer verification badge on the invitation card (read-only).
- **Phase 11.4** adds a share-card route that's public (no auth) so it can be opened from a WhatsApp link. Subject to the same redaction / consent rules as `/p/[handle]`.
- **Phase 11.5** touches several shared form components (`MultiSelectComboboxField`, `MonthYearPicker`). Verify employer + admin + gov surfaces still render correctly after the changes.
- **POPIA documents** (`/privacy`, `/paia`) updated where Phase 11 adds new processing (SMS channel) or new third-party sub-processors (Twilio / AWS SNS / image-gen service).
- **Help articles**  Phase 11 adds new surfaces (digest email link, share card, pause toggle, block list). Each new surface gets at least one help article in `/dashboard/help`.

---

## 🧾 DOC + COMMS CONVENTION

On ship of each sub-phase: `docs/completed/PHASE_11_X_COMPLETE.md` (sibling of the Phase 10.x completion docs). Update `ROADMAP.md` Phase 11 section with the ✅ + date for each shipped sub-phase. Tag the release `phase-11-X-YYYY-MM-DD`.

The umbrella `PHASE_11_COMPLETE.md` lands when all five sub-phases have shipped (or are explicitly punted with rationale).

---

*Plan opened 2026-05-31. Target: ship the high-ROI surfacing work (11.1 + 11.2) within 6 weeks of opening. The remaining sub-phases follow capacity.*
