# PHASE 22  AI CAREER COACH: SAFETY & WELLBEING (pre-production gate)

*Opened 2026-07-01. This is the one phase where **"the flag works and the tests pass" is not the bar.**
Every other feature is data plumbing; this one is an LLM addressing unemployed people  some stressed,
financially desperate, or vulnerable  so the risk isn't a data leak, it's a human on the other end.
This phase is the **gate the `feature_flag_seeker_ai_coach` switch must clear before it goes ON in
production.***

> **Companion:** `docs/completed/PHASE_17_SEEKER_GROWTH_SUITE_PLAN.md` (17.3 built the coach) ·
> `TO_START_EVERY_SESSION.md` (POPIA-First, No-Flash, human-translation rule) ·
> `lib/llm/seeker-coach.ts` (the current dispatcher + prompt).

---

## 🔎 HONEST CURRENT STATE (verified 2026-07-01, not from the roadmap)

The coach today (`lib/llm/seeker-coach.ts`) generates **5 interview practice questions** from a role
title + the seeker's profession/skills. What exists:

- **Access/data gates (good):** surface flag → PII-shape guard on the role title → active provider →
  decryptable creds → budget. Audited (`seeker.ai_coach.call` / `.skipped`). Never sends name/ID/contact.
- **Content/wellbeing guardrails (thin):** the **only** content rule is one system-prompt line 
  *"NEVER promise a job, an interview, or any outcome."* That is the whole safety layer.

**What is missing (the risk surface):**
1. **No refusal boundaries**  nothing stops the model giving financial, legal, medical, or
   mental-health advice if the role title / future free-text nudges it there.
2. **No distress detection**  a desperate or at-risk person typing into the free-text field is
   slugged straight into a prompt. There is no screen, no crisis pathway, no signposting.
3. **No output moderation**  the model's questions are shown as-is (length-capped only).
4. **No graceful human fallback**  off-scope / distress / provider-down all dead-end.
5. **False-opportunity framing is copy-only**  "practice, not a guarantee" is a subtitle + one
   prompt line; nothing structural stops a stressed user reading it as a real opportunity.

**Mitigating fact (don't over-state the current risk):** it is **single-shot question generation,
not an open-ended chat.** The conversational risk the framing implies is *not live yet.* But (a) the
gaps above are real even for question generation, and (b) the moment answer-feedback / back-and-forth
is added (a noted Phase-17 "future capability"), the risk class escalates  so **any move toward
conversation must re-run this phase.**

---

## 🎯 THESIS

Before the switch goes ON in production, the coach must: **stay strictly in scope, refuse the four
advice classes, detect distress and route to real human help, moderate its own output, and never
imply a real opportunity**  degrading gracefully to human resources at every edge. This phase builds
that layer and makes the production switch *require an explicit safety acknowledgement.*

---

## 🚫 SAFETY INVARIANTS (non-negotiable, every task inherits)

- **Scope lock:** interview *practice* only. The coach is not a careers advisor, not a lawyer, not a
  financial advisor, not a counsellor.
- **The four refusals:** no **financial**, **legal**, **medical**, or **mental-health** advice. On any
  such request → a short, kind refusal + a pointer to an appropriate resource. Never improvise advice.
- **No promises:** never state or imply a job, an interview, a callback, or an outcome. No pass/fail
  scoring, no "you nailed it," no simulated recruiter identity or employer branding.
- **Distress → humans, not the model:** a distress/self-harm/crisis signal must **never** be answered
  by the LLM. Screen *before* the call; on a hit, do not dispatch  show crisis resources.
- **POPIA:** never log the distressing content. Log only that the distress path fired (a counter +
  timestamp), same posture as the rest of the audit trail.
- **Human-translated crisis + refusal copy**  this is exactly the legal/safety/consent copy the
  translation rule protects. **Never machine-translate it.** English first; Tier-1 languages only when
  professionally translated.
- **Verified resources only:** crisis-line details must be **verified against a current authoritative
  source** and stored as **admin-editable data**, not hardcoded  a dead or wrong helpline number is
  itself a safety failure and must be correctable without a deploy.

---

## 🧩 TASKS

### 22.1  System-prompt hardening (refusal boundaries)
- Rewrite `coachSystemPrompt()` to state the scope lock + the four refusals explicitly, forbid
  outcome/promise language and pass/fail scoring, and require plain SA-workplace language.
- Keep the strict JSON output contract; add an instruction that if the request is out of scope, the
  model returns a typed `{ "refusal": "<short kind redirect>" }` instead of questions  so a refusal
  is structured, not a freeform paragraph.
- **Tests:** offline fixture tests asserting the prompt contains each refusal class + the no-promise
  rule (guards against silent prompt drift).

### 22.2  Distress detection + crisis pathway *(the critical task)*
- A **deterministic pre-LLM screen** (`lib/llm/coach-safety.ts`, pure + unit-tested) over the free-text
  input: self-harm / suicide / abuse / acute-crisis signal patterns (SA-aware, multi-lingual stems
  where safe). **No ML, no provider call**  it must work even when the LLM is down.
- On a hit: **do not dispatch to the provider.** Return a `distress` result. The surface renders a
  calm, non-clinical, human message ("You don't have to do this alone") + **verified SA crisis
  resources** (see the resources note below) + the human work-readiness help. Audit
  `seeker.ai_coach.distress` (a count + timestamp, **never the text**).
- Apply the **same screen** to any future answer-submission surface.
- **Tests:** unit tests (crisis phrases → distress path, benign role titles → pass-through); E2E
  (distress input → crisis resources rendered, **zero provider call**).

### 22.3  Output moderation + false-opportunity guard
- A post-LLM safety pass (`lib/llm/coach-safety.ts`): drop/regenerate if a "question" contains advice
  outside interview practice, a promise/outcome, or contact/opportunity language. Structured refusals
  (22.1) short-circuit to the off-scope message.
- **Structural anti-opportunity framing** on the surface: a persistent, unmissable "This is practice 
  not a real interview, and not a job offer" banner; no employer logos; no recruiter persona; no
  score. Copy reviewed as safety copy.
- **Tests:** unit (a planted bad line is dropped); E2E (the practice-not-a-promise banner is always present).

### 22.4  Graceful degradation + human resources
- Every non-ok path resolves to a **human resource, never a dead end**: distress → crisis resources;
  off-scope/unavailable/budget/no-provider → the Phase-15 work-readiness articles + "prepare for an
  interview" guide. Extend the existing `CoachPractice` reason→copy map accordingly.
- **Tests:** E2E for each reason (no-provider, off-scope) showing the human fallback.

### 22.5  Production safety gate (admin, Integrations) ✅ *shipped alongside this plan*
- The **system-wide AI-Coach switch lives on `/admin/llm` (Integrations)**, co-located with the LLM
  provider/budget config. It surfaces `feature_flag_seeker_ai_coach` and **requires an explicit
  "safety review complete" acknowledgement before it can be turned ON** (mirrors the s.72 cross-border
  ack). Default OFF; turning OFF is always immediate. A prominent warning links here.
- *(Delivered now as the concrete first step; 22.1–22.4 + 22.6 remain the pre-conditions the
  acknowledgement attests to.)*

### 22.6  Monitoring, audit, review cadence
- Audit kinds: `seeker.ai_coach.distress` + `seeker.ai_coach.moderation_drop` (counts only, no content).
- A lightweight admin view of those counts on `/admin/llm` (is the distress path firing? is moderation
  dropping a lot?). A **monthly human review** of a sample of generated questions for tone/quality.
- A documented incident path (who is notified, how the switch is pulled  one click OFF).

### 22.7  Verification (whole phase)
- `test:all` (unit: distress screen, output moderation, prompt-contract fixtures; compliance: no
  distress content ever logged) + build.
- E2E both flag states: OFF = coach absent; ON = practice works, **distress input → crisis resources
  with no provider call**, off-scope → redirect, banner always present, safety-ack gate blocks
  enabling without acknowledgement. Desktop + 360px.

---

## ☎️ CRISIS RESOURCES  HANDLING NOTE (read before writing any number)

**Do not hardcode helpline numbers from memory.** Before shipping 22.2:
1. Verify current South African crisis-support details against an **authoritative source** (e.g.
   SADAG  the South African Depression and Anxiety Group  official site; national emergency
   services). Numbers change; a wrong one is a safety failure.
2. Store them as **admin-editable data** (a small `crisis_resources` table or a platform setting) so
   they can be corrected/kept current **without a deploy**, and localised per the human-translation rule.
3. Include the universal emergency framing (SA emergency services) + a clear "if you are in immediate
   danger, call emergency services" line.
4. Have the copy reviewed by a human before the switch goes ON.

*(This plan intentionally does not print specific numbers  they must be sourced + verified at build
time, not copied from a roadmap.)*

---

## 🚫 OUT OF SCOPE
- Turning the coach into a general chatbot / open Q&A.
- Live back-and-forth conversation or answer-scoring (if pursued later, **re-run this phase**  higher
  risk class).
- Diagnosing, treating, or counselling mental-health conditions. We **signpost to humans**, we do not
  counsel.
- Any "you passed / you'd get this job" framing.

## 📌 STATUS  ✅ safety layer shipped 2026-07-01 (flag stays OFF pending operator sign-off)
- [x] 22.5  Production safety gate on `/admin/llm` (ack-gated switch).
- [x] 22.1  System-prompt hardening: scope-locked; refuses financial/legal/medical/mental-health advice;
  no promises/scoring; structured `{ "refusal": … }` output. Drift-guard unit test.
- [x] 22.2  Distress detection + crisis pathway: deterministic pre-LLM screen fires **before the provider
  gate**; on a hit the provider is never called, human crisis resources render, audit logs a count only
  (never the text). Crisis resources are **admin-editable data** (`/admin/crisis-resources`, migration
  `0056`); the seed ships ONE inactive template  no invented numbers.
- [x] 22.3  Output moderation (`moderateQuestions` drops promises/contact) + a persistent structural
  "practice, not a promise" banner.
- [x] 22.4  Graceful degradation: every non-ok, non-distress path offers the human "prepare for an
  interview" guide.
- [x] 22.6  Monitoring: `getCoachSafetyTelemetry` (call / distress / moderation-drop counts) on `/admin/llm`.
- [x] 22.7  Verification: `test:all` (354 vitest incl. 15 safety unit tests) + build + E2E both flag states
  (incl. the load-bearing `coach-distress.spec`) at desktop + 360px.

> **Code is done; the switch must still not go ON in production until an operator adds + VERIFIES real
> crisis resources (and activates them), and the safety copy is human-reviewed.** 22.5 makes enabling a
> deliberate, acknowledged act. Any move to live back-and-forth conversation must re-run this phase.
