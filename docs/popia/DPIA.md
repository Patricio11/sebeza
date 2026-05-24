# Data Protection Impact Assessment (DPIA)

> POPIA does not mandate a formal DPIA the way GDPR does, but the
> Information Regulator's guidance is unambiguous: any system processing
> special-category personal information (ID numbers, qualifications)
> should document a risk assessment. This is ours.

Last updated 2026-05-23. Review cadence: every phase that touches PII
columns or adds a sub-processor.

---

## 1. Processing being assessed

Sebenza is a national talent-intelligence platform. The processing
covered by this DPIA:

- **Identity capture + storage** (national ID, name, email, phone).
- **Profile publishing**  making a redacted version of the profile
  searchable to verified employers.
- **Contact reveal**  disclosing email/phone to a verified employer
  who has the seeker's active consent.
- **Document sharing**  releasing uploaded qualification documents
  via short-lived signed URLs.
- **Aggregate analytics**  counting profiles in anonymised national
  statistics + the longitudinal outcomes dataset (k-anonymity floor =
  10, with complementary suppression).
- **Employment-outcome tracking**  confirmed placements as a
  data-quality signal (Placement-Truth Rule).

## 2. Necessity + proportionality

| Purpose | Data needed | Why we need it | Could we do less? |
|---|---|---|---|
| Search | Name (display only), profession, city, skills, status | The platform is "find skilled people near you." | No  we already redact surname, never expose ID. |
| Contact reveal | Email, phone | An employer cannot offer a job without contact. | No  gated on org verification + consent + audit. |
| Document sharing | Qualification PDFs | Hiring is document-heavy in regulated industries. | Could ship in Phase 9.x: per-document expiry. |
| Aggregate analytics | Profession × province × status counts | Stats SA / Department of Higher Education use case. | No  already cohort-level only. |
| Outcomes research | Programme × institution × province × graduation year | Department of Higher Education pitch. | Already k=10 floor + complementary suppression. |
| Placement tracking | Confirmed hire records | Distinguishes self-report from official signal. | No  that's the whole point. |

## 3. Risks identified + mitigations

### R1  Re-identification of small cohorts in `/insights` / `/gov`
- **Risk**: A BSc Computer Science cohort at a small institution in a
  small province might be 3 people. Surfacing the cell exposes them.
- **Mitigation (Phase 7.5.4)**: hard k-anonymity floor of 10 distinct
  individuals + complementary suppression to stop derivation from
  row/column totals. Floor is admin-tunable but schema enforces ≥ 5.
- **Residual risk**: low. Asserted in
  `lib/analytics/outcomes-compliance.ts`.

### R2  ID number theft via DB compromise
- **Risk**: An attacker who gets DB read access could exfiltrate ID
  numbers in bulk.
- **Mitigation**: AES-256-GCM at write time (`lib/crypto`); only
  ciphertext lives in the DB; key in env. DB credentials rotated on
  every release.
- **Residual risk**: medium-low. Mitigated further by the AWS Cape Town
  migration (in-country residency, smaller blast radius).

### R3  Surveillance via employer-side metadata
- **Risk**: An employer shortlisting a seeker is information the seeker
  might not want broadcast.
- **Mitigation (Phase 7.6)**: notification catalog deliberately omits
  `profile.shortlist.add`. Seekers don't see "Discovery Bank shortlisted
  you." The audit log records it for accountability, but it's not
  pushed.

### R4  Stale data driving wrong policy decisions
- **Risk**: An employer hires a seeker who is no longer available
  because their status hasn't been re-confirmed in 90 days.
- **Mitigation (Phase 7 status-stale cron  Phase 8)**: nightly
  `status.stale.warning` to the seeker; freshness-weighted ranking
  down-ranks stale records in search; `/insights` surfaces
  freshness band counts so policy-makers know what they're looking at.

### R5  Notification channel becoming a disclosure channel
- **Risk**: A push notification "Discovery Bank revealed your contact"
  contains information the seeker hadn't yet seen.
- **Mitigation**: notification meta carries only display context (org
  name, role title)  never raw PII. The reveal happens in the dossier
  flow; the notification is just a heads-up of an event the audit log
  already recorded.

### R6  Two-factor bypass
- **Risk**: Admin or employer account compromise.
- **Mitigation (Phase 7.2)**: forced 2FA on admin + employer roles
  (gated on `feature_flag_2fa_enforced`); backup codes hashed at rest;
  admin escape hatch via `reset2faForUser` is audit-logged distinctly.

### R7  Cross-purpose data leak via the outcomes dataset
- **Risk**: A profile granted `searchability` consent but NOT
  `outcomes_research` ends up in the longitudinal cohort.
- **Mitigation (Phase 7.5.3)**: separate consent purpose, INNER JOIN
  in the source query, runnable assertion at
  `/api/admin/outcomes-compliance` confirms it.

### R8  Abuse paths (scraping, mass reveal, sign-in stuffing)
- **Risk**: Without per-action rate limits, a misbehaving employer
  could bulk-reveal contacts; a credential-stuffer could hammer the
  sign-in endpoint.
- **Decision (Phase 9 review, 2026-05-23)**: rate limiting is **not
  enforced by default**. Deliberate trade-off:
  - **Sign-in**: a per-email limit creates a denial-of-service vector
    (attacker submits bad passwords for a target email → locks the
    legitimate user out). Better Auth's scrypt password hashing
    (~100-200ms per attempt) is already the brute-force mitigation;
    2FA is the real second factor for high-value accounts.
  - **Reveal / upload**: legitimate use rarely hits any sensible
    budget. The existing controls  verified-org check, per-reveal
    consent gate, 30-day reveal window, audit log on every reveal 
    already make abuse expensive and traceable.
- **What we DO have ready**: `lib/rate-limit/` is a complete provider-
  agnostic module (in-memory + Upstash-ready) with no call sites
  wired. Re-enable by importing `enforce("reveal", key)` on the
  Server Actions when abuse is actually observed; the right budgets
  are sized from real traffic, not guessed.
- **Residual risk**: low at pre-launch traffic. Mandatory re-assessment
  before public launch and at every phase boundary thereafter.

### R9  Drift into specific legal-mandate or racial-framing claims on policy surfaces
- **Risk**: Phase 9.7 (nationality analytics & local-hiring intelligence)
  ships nationality-aware analytics. The earliest draft framed those
  surfaces around the Employment Equity Act §1 designated-group
  qualification (which references "Black people") and the Employment
  Services Act §8 reasonable-efforts obligation. Both are real,
  current South African statutes, but two distinct risks emerge from
  citing them in the platform copy:
    1. **Racial framing on a national platform.** Sebenza is for every
       South African worker. Pulling the EEA §1 "Black people"
       definition into the platform's framing drags racial categories
       into a tool whose product line is non-racial by design.
    2. **Overclaiming a regulatory relationship.** Citing ESA §8 +
       Department of Employment & Labour by name implies a partnership
       or sanctioned-evidence-trail role that does not, in fact, exist.
- **Decision (operator review, 2026-05-24)**: **REFRAMED.** Both
  surfaces (employer self-view, gov per-employer lookup) and the
  policy-intelligence views (`/gov/shortage`, `/gov/opportunity`,
  `/gov/brief`) now ship with **neutral copy**: "for your own records,"
  "bounded compliance query," "local-hiring policy intelligence."
  No EEA §1 / ESA §8 / DEL references in user-facing copy. The
  reason-enum on the per-employer lookup uses generic values
  (`compliance_check`, `incentive_verification`, `mandated_audit`,
  `other`)  not statute-specific.
- **What's preserved**: every structural defence (2-class split,
  k-floor, complementary suppression, employer-min-placements floor,
  dormant-by-default flag, audit log on every gov query, oversight log).
  Those don't depend on the legal framing; they remain the trust
  posture.
- **What's gone**: any user-facing claim that ties Sebenza data to a
  specific regulatory mandate or quotes a statute. If a regulator ever
  formally asks for tailored framing, that lands as its own
  intentional, counsel-reviewed change rather than as a default copy
  choice.
- **Residual risk**: low. The platform now describes itself honestly
  as policy intelligence, not a regulatory enforcement tool. The
  per-employer lookup remains dormant by default; activation is paired
  with a concrete operational need rather than a hypothetical
  partnership.

## 4. Sign-off

To be signed by the Information Officer once designated. Until then,
the engineering team owns the open risks above and reviews this
document at every phase-completion checkpoint.
