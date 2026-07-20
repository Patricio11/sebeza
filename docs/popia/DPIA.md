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

### R10  Identity document at-rest exposure & DOB linkability (Phase 9.16)

- **Risk**: Phase 9.16 captures **date of birth + nationality** at
  sign-up and introduces an **admin-mediated ID-document upload** path
  (SA ID book or passport bio page) for the verification flow because
  the planned KYC-SaaS partnership did not land. Three new exposure
  surfaces:
    1. **DOB**. Now stored on `profiles.date_of_birth`. With DOB +
       province + handle, an attacker who scraped the public profile
       can attempt linkage attacks against electoral roll or social
       graph data sources.
    2. **Nationality**. Captured via a country-picker at sign-up;
       persisted as country label on `profiles.nationality` + derived
       boolean `profiles.is_citizen = (code === "ZA")`. Already a
       displayable field on the existing schema; sign-up just makes
       sure it's set rather than NULL for fresh accounts. Low new
       linkage risk on its own  category-level data, not a unique
       identifier.
    3. **ID document scan**. When the seeker opts into KYC
       verification from `/dashboard/profile`, a private object lives
       at `{userId}/id-documents/{profileId}.{ext}` in the Supabase
       private bucket. A scan typically reveals: full names, SA ID
       number (in `national_id_enc` only if the seeker also typed it
       in), photograph, date of birth, place of birth. A bucket-level
       compromise would expose the document directly.

  Note (post-trim, 2026-05-27): SA ID and passport NUMBERS are NOT
  collected at sign-up  the field moved off the form during operator
  review on the day of ship. They are captured later from
  `/dashboard/profile` only if and when the seeker chooses to be
  KYC-verified. This reduces the data we hold for accounts that never
  reach KYC review and is consistent with POPIA's data-minimisation
  principle (§19): collect only what's needed for the active purpose.
- **Decision (operator review, 2026-05-26)**: **PROCEED with the
  controls listed below.** Identity-confirmation is a precondition for
  the platform's verification posture (Verification-Honesty Rule). The
  admin-mediated path is the necessary fallback while the KYC-SaaS
  partnership is dormant.
- **Controls**:
  - **DOB is never published.** The `PublicProfile` projection on the
    `dataProvider` seam does not carry `dateOfBirth`. A compliance
    assertion (`dob-never-in-public-payload`) samples 50 random
    profiles via the public seam on every `runAll()` and fails the
    suite if the field leaks. DOB is visible only to the owner
    (`/dashboard/profile`) and to admins on `/admin/verifications`.
  - **ID document objects are owner-prefixed.** The storage path
    convention `{userId}/id-documents/...` is asserted by the
    `kyc-document-private` compliance check so admin oversight can
    scope audits by prefix and a regression in the path layout fails
    loudly.
  - **Signed-URL reads only.** Admin reviewers fetch the document via
    a short-TTL signed URL minted by `signedDocumentUrl()`. No
    permanent public URL exists. Every reviewer fetch is paired with a
    `kyc.review.approve` / `kyc.review.reject` audit row (subject =
    profile id; meta = reviewer user id + reason text on rejection).
  - **Magic-byte sniff + 10 MB cap + 5-upload-per-10-min rate limit**
    on the upload Server Action  identical posture to the qualification
    + org KYC paths (Phase 3 / 9.10).
  - **Encryption stays as-is.** SA IDs and passport numbers continue
    to be encrypted at-rest in `profiles.national_id_enc` under
    AES-256-GCM (`v1.` prefix). The `id-encryption-mandatory` compliance
    assertion samples 500 rows on every `runAll()` and fails if any
    non-null payload is missing the prefix.
  - **Passport issuer is validated server-side.** The
    `passport-country-when-passport` assertion confirms every passport
    profile carries a valid ISO 3166-1 alpha-2 issuer code, so
    rendering and audit trails never have to handle the empty-string
    edge case.
  - **Three new audit kinds**: `kyc.document.upload`,
    `kyc.review.approve`, `kyc.review.reject`. The seeker receives an
    in-app notification on every admin action (`kyc.approved` /
    `kyc.rejected` catalog kinds) so trust runs both ways.
  - **Defence in depth** on the sign-up Server Action: every
    client-side validator (`validateDob`, `validateSaId` with Luhn +
    DOB cross-check, `validatePassport` with ISO issuer check) is
    re-run server-side before the row is written. A tampered request
    cannot backdoor through the 14100 age gate.
- **Residual risk**: low-to-moderate. A bucket-level compromise of
  Supabase storage remains the main outstanding concern; this is
  shared with the existing qualification + org KYC documents and is
  addressed by Supabase's at-rest encryption + the Phase 9 migration
  to the `af-south-1` Cape Town region for POPIA in-country residency.
  When the KYC-SaaS partnership lands, the seeker-facing path swaps
  to provider verification and admin-mediated upload becomes the
  break-glass.

### R11  Employer-initiated seeker invitations (Phase 9.17)

- **Risk**: Phase 9.17 lets a verified-org employer (or staffing agent
  acting through a verified org) send a Sebenza sign-up invitation to
  an email address that has not yet consented to anything on the
  platform. Three distinct exposure surfaces:
    1. **Email harvesting**. A bad-actor org could submit emails as
       a discovery probe ("does this person exist on Sebenza?") or as
       an unsolicited outreach blast.
    2. **The personal-note field**. Up to 200 characters of free text
       written by the inviter and rendered verbatim in the recipient's
       inbox. Anything that quotes the recipient by name or context
       is POPIA personal information.
    3. **The invitation token**. Bearer credential for the
       /sign-up/invited/[token] flow. Possession of the token grants
       the ability to create an account with the invite's email as
       the lookup key.
- **Decision (operator review, 2026-05-27)**: **PROCEED with the
  controls listed below.** Phase 9.17 closes a real workflow gap for
  SA staffing agencies (their existing process is WhatsApp + Excel
  rosters outside the platform); leaving them outside the platform
  loses the audit trail + the LMI signal entirely.
- **Controls** (every one server-side enforced, audit-logged on every
  block):
  - **Verified-orgs-only gate** (D1) via the existing
    `verifyOrgVerified()` helper. Unverified orgs cannot send a
    single invitation. The org must have already passed Phase 9.10
    admin KYC review  CIPC certificate, tax clearance, proof of
    address, bank confirmation.
  - **Per-org daily cap** (D7.1) of 50 invite attempts, counting
    EVERY outcome  successful sends, D4 dedupe-hits, D7.2 cooldown
    blocks, validation failures. An enumeration attacker has the
    same ceiling whether they hit valid emails or not.
  - **Platform-wide daily cap** (D7.3) of 500 attempts for the first
    30 days post-launch, raised on observation.
  - **Per-(org, email) 90-day decline cooldown** (D7.2). POPIA §11
    right-to-object: once a recipient declines, the same org cannot
    re-invite that address for 90 days. Server-side enforced via the
    `seeker-invite-cooldown-honoured` compliance assertion.
  - **Transparent dedupe with rate-limit defence** (D4). When the
    email already has a Sebenza account, we return
    `"this email already has a Sebenza account"` rather than the
    silent "invitation sent" oracle defence. The product reason:
    legitimate agents need actionable feedback ("search for them
    instead"); they shouldn't be left re-sending invitations that
    were silently swallowed. The structural defence is the 50/day
    rate limit  including dedupe-hits, so brute-enumeration of who
    exists on the platform is throttled. Assertion
    `seeker-invite-no-orphan-when-user-exists` verifies the dedupe
    never persists a row when the user already exists.
  - **PII flag on the personal note** (D6). The audit row's
    `meta.note` field is treated as PII for any future
    data-export sweep. Limited to 200 chars to keep the surface
    area bounded.
  - **Signed HMAC-SHA256 tokens** (D8), 14-day expiry, single-use
    enforced at the DB layer (the row's `state` flips on accept /
    decline / withdraw / expire). Signing secret is its own env var
    (`SEBENZA_INVITE_SIGNING_SECRET`)  a leak of the password-reset
    signing key does not compromise invitation tokens, and vice versa.
    Tokens are opaque: the email never appears in the URL.
  - **POPIA §16 transparency** (D13). Every invitation email carries
    a footer with (a) "Why did I get this?" plain-language paragraph
    and (b) a token-gated "Report this invite" link that requires no
    Sebenza account. Reports fire an `all_admins` notification + an
    `org.seeker_invite.reported` audit row; admins can suspend the
    inviting org if the pattern looks abusive.
- **Residual risk**: low. A malicious verified org could theoretically
  burn its rate limit each day for as long as it stays verified, but
  (a) the verified-org gate already filtered most bad actors at the
  KYC review stage, (b) the report-this-invite path surfaces abuse
  to admins out-of-band, (c) the platform-wide cap caps the total
  blast radius. When the KYC-SaaS partnership lands (Phase 8 flag
  flip), the verifier upgrades from admin-mediated to provider-
  mediated and the trust posture strengthens further.

### R-13.1  New educational PII categories
- **Risk**: Phase 13.1 adds three new fields on `academic_profiles`:
  `current_modules` (text[]), `elective_chosen` (text),
  `project_topic` (text). Module names + dissertation topics carry
  identifying detail; a sufficiently specific project topic ("the
  Lerato N. dissertation on Yoco POS reconciliation") can re-identify
  a small-cohort student even with surname suppression.
- **Mitigation**:
  - **Default-private**: none of these three fields surface on
    `/p/<handle>`. The `PublicProfile` redaction type does not carry
    them. The matcher uses them; the public profile doesn't expose
    them.
  - **Field-length caps**: modules max 8 entries, elective ≤ 100
    chars, project topic ≤ 200 chars. Limits the surface area of a
    single field from carrying a full identifying paragraph.
  - **POPIA s.23 export**: the dashboard data-export bundle includes
    all three fields so the seeker can audit what the platform holds.
  - **POPIA s.24 erasure**: account deletion cascades through
    `academic_profiles` and removes the three columns alongside the
    rest of the row. No retention.
- **Residual risk**: low. The default-private posture is the
  load-bearing mitigation; absent that the project topic alone would
  be the highest re-identification vector in the system.

### R-13.2  Admin-managed LLM provider sending syllabus text cross-border
- **Risk**: Phase 13.3 adds an admin-side editorial pipeline that
  optionally calls external LLM providers (OpenAI / Anthropic in the
  US, Mistral in the EU) to suggest module → skill mappings. The
  request body contains generic syllabus / module text from publicly
  available academic documents; the provider response contains skill
  slugs constrained to the controlled taxonomy. **No seeker PII
  crosses the provider boundary.**
- **Mitigation (six gates, every gate must be open before zero spend
  becomes some spend)**:
  1. A row exists in `llm_providers` with `active = true`.
  2. `credentials_enc` decrypts successfully.
  3. `monthly_budget_zar > 0` AND `total_spend_zar < monthly_budget_zar`.
  4. Caller has `admin` role.
  5. Platform flag `feature_flag_llm_curriculum_enabled` is ON.
  6. Payload doesn't match obvious PII shapes (RSA 13-digit IDs,
     email-shaped strings, SA phone-shaped strings). The dispatcher
     refuses with `llm.curriculum.skipped` + `gate: 'payload_unsafe'`
     when any of those patterns appear in the syllabus text.
- **Cross-border processing (POPIA s.72)**:
  - OpenAI + Anthropic configure flow gates configuration behind an
    explicit s.72 acknowledgement checkbox; the timestamp lands in
    `llm_providers.s72_acknowledged_at` AND in the
    `admin.llm.provider.configured` audit row's `s72Acknowledged`
    meta key.
  - Mistral EU is treated as POPIA-equivalent (GDPR regime) so the
    s.72 step is skipped per legal review.
  - **Self-hosted is the POPIA-clean recommended path**: inference
    inside the af-south-1 (Cape Town) residency boundary, no s.72
    acknowledgement required, no per-call vendor invoice.
- **Hallucination guard**: the dispatcher filters response slugs
  against `skills.slug`. Any response slug outside the controlled
  taxonomy is dropped silently with the count surfaced in the audit
  row's `droppedHallucinationCount`. New skill tags stay on the
  Phase 9.15 admin human-only suggestion queue; the LLM operates
  downstream of the canonical taxonomy, never on it.
- **Per-call audit**: `llm.curriculum.suggest` carries token count,
  suggestion count, dropped hallucination count, estimated ZAR cost,
  modelId, and the SHA-256 hash of the syllabus text (the plaintext
  is never logged). `.skipped` carries the gate that refused.
  `.failed` carries the error category (auth / network / rate_limit
  / other) but never the upstream error body.
- **No new consent purpose**: students do not consent to anything new
  here  no seeker data is sent to the LLM. POPIA s.11(1)(b)
  (performance of contract) covers the editorial catalogue work
  itself.
- **Residual risk**: low. The six-gate posture is by design hard to
  bypass: the partial unique index `llm_providers_one_active` is the
  DB-layer enforcement; the kill-switch lives on `/admin/settings`
  one level above the per-provider configuration so an admin can
  pause the entire pipeline in one click without losing
  configuration.

### R-13.3  Student self-declared milestones leaking onto public surface
- **Risk**: Phase 13.4 adds `student_milestones` for self-declared
  events (dissertation submitted, graduation confirmed, first job
  offer accepted, studies paused, plus 'other' with a free-text
  note). A leak onto `/p/<handle>` would expose the seeker's career
  state alongside specific dates  more identifying than the public
  profile is designed to be.
- **Mitigation**: the `loadStudentProgressionTimeline` query is
  invoked ONLY from `/dashboard/grow` (the private surface). The
  PublicProfile read path (`db/queries/profiles.ts → publicProfile`)
  does not touch `student_milestones`. The component file lives
  under `components/feature/analytics/` and is only imported from
  the seeker dashboard route. The Phase 13.4 commit message + the
  help article both reiterate "private surface only".
- **POPIA s.23/s.24**: included in the existing export + erasure
  paths via the `profile_id` FK with `ON DELETE CASCADE`.
- **Verification-Honesty Rule (R-9.10)**: a self-declared
  `first_job_accepted` milestone does NOT flip `placements` to
  `employer_confirmed`. Only employer Mark-as-Hired does that. The
  timeline shows the milestone with a "Self-declared" provenance chip
  alongside auto-derived rows so the student sees how the platform
  knows what it knows (D6 in the Phase 13 plan).
- **Residual risk**: very low. The default-private posture + the
  no-public-read-path guarantee + the audit kinds
  (`student.milestone.added` / `.removed`) collectively make this
  the lowest-surface-area new data category in Phase 13.

### R-17→25  Addendum (2026-07-06): seeker-growth, AI-coach safety, testimonials, integrations

**R-17.1  Seeker-facing LLM (AI Career Coach, Phases 17.3 + 22).**
R-13.2's mitigating claim *"the student never talks to the LLM / no seeker
data is sent to the LLM"* is **superseded**: the flag-gated coach
(`feature_flag_seeker_ai_coach`, default OFF) sends a seeker-typed **role
title** plus profession + skill labels cross-border to the active provider.
Mitigations: never name/ID/contact (structural  the dispatcher assembles
the payload from safe fields only); PII-shape guard refuses ID/email/phone-
shaped input; a **deterministic distress screen runs BEFORE any provider
call** (a crisis input is never sent  the user is routed to admin-verified
crisis resources, and only a COUNT is audited, never the text); per-user
rate limit (10/day) + shared monthly budget; output moderation strips
promises/contact; the enable switch is acknowledgement-gated on /admin/llm.
Lawful basis: the seeker initiates each request (performance of the service
they invoke); provider cross-border terms follow R-13.2's s.72 treatment.
Residual risk: medium until the operator verifies live crisis resources
the switch must stay OFF until then (Phase 22 plan §status).

**R-17.2  Distress signals (special-category-adjacent).** The screen
necessarily *evaluates* text that may reveal mental state. Posture: the
evaluation is in-memory and deterministic (no ML, no third party); the text
is never persisted or logged; only `seeker.ai_coach.distress` (timestamp,
count) is recorded for safety monitoring. No profiling, no follow-on use.

**R-19.1  Custom skills (user-authored strings).** `profile_skills_custom`
holds free-text labels a seeker writes. Mitigations: 60-char cap, never
searchable or public until an admin canonicalizes; the admin leaderboard is
aggregate-only (label × distinct-seeker COUNT). Erasure: CASCADE on profile.

**R-21.1  City-level demand cuts.** Demand-side only (employer searches,
never a seeker cohort); surfaced exclusively to top-5-metro seekers holding
`outcomes_research` consent, above a k-anonymity floor; silent province
fallback otherwise. No new PII captured (city was already in search filters).

**R-24.1  Testimonials.** Publication of a first name + role context +
quote under an **explicit public-display consent captured at submission**
(display fields frozen at that moment  no live PII joins). Admin curation
gate before anything renders; deletion honoured on request via
/admin/testimonials; audit rows never carry the quote body.

**R-25.1  Announcements (bulk SMS) + admin-managed channel credentials.**
Bulk sends require the dedicated opt-in `announcements` consent purpose
(default-off, non-degrading) AND a verified phone; hard cap 500/send; the
audit records the recipient COUNT only. Channel credentials
(`integration_settings`) are AES-256-GCM encrypted at rest, admin-only,
never returned to any client; phone numbers are decrypted in-memory during
a fan-out only.

**Crisis resources (`crisis_resources`).** Not PII  public support-line
information, admin-verified before activation (a wrong number is treated as
a safety failure; see the Phase 22 plan).

### R-26  Addendum (2026-07-19): Phase 31 data minimisation  ID collection dormant by default

**This is a RISK REDUCTION  the largest one since the register opened.**
The responsible party making this POPIA representation is **Yetotec (Pty)
Ltd**. Decision (operator, 2026-07-08; plan `docs/PHASE_9_19_PLAN.md`,
shipped as Phase 31):

**R-26.1  ID/passport collection is OFF by default.** The entire
collection surface (profile-editor ID field, document upload,
submit-for-verification) is gated behind
`feature_flag_id_verification_enabled` (default OFF; enabling is an
acknowledged admin act on /admin/verifications that requires a confirmed,
lawful verification partnership). While OFF  the launch posture  Sebenza
holds ZERO newly-collected ID/passport numbers: profiles are self-reported,
which supersedes every register entry that assumed ID capture at profile
time (R2 blast-radius shrinks to legacy rows only; R-13.x and the 9.16
addendum apply only when the flag is ON). Structural backstops: the Server
Actions refuse while OFF (not just hidden UI), covered by integration
tests. **Removal paths are never gated**  a data subject's erasure rights
(remove ID, revoke KYC) work regardless of the flag.

**R-26.2  Nationality capture reduced to the two-class signal.** The
191-country picker is retired; sign-up and the profile editor now ask a
single "South African citizen? Yes/No"  exactly the one bit the Phase 9.7
analytics and Citizen-Visibility ranking consume. No granular immigration
status (asylum / refugee / permit / PR) is collected  a structural test
fails the build if such a column ever appears. The legacy
`profiles.nationality` label column stays read-only for one release
(display of previously-stored values only; write path retired), then
drops in a follow-up. The citizen question is analytics + highlight only,
NEVER a gate (Location-Not-Nationality rule holds; non-citizens are
first-class users).

**R-26.2a  Amendment (2026-07-20, operator feedback after live testing).**
Capture is a HYBRID: citizens answer only the Yes/No; a **non-citizen
additionally picks their country** from the canonical ISO catalogue (ZA
excluded), because the nationality label displays on the public profile
and search rows and is legitimate product information. The label is always
DERIVED server-side from the flag/code (citizens → "South Africa"); free
text remains retired; analytics and ranking still consume only the
two-class `is_citizen` flag; the k=10 suppression and the no-granular-
status structural guard are unchanged. The `nationality` column is no
longer scheduled for removal  it carries the derived display label.
Purpose-limitation note: country-of-origin is collected ONLY for
non-citizens, for display/transparency  never as a matching or access
criterion (Location-Not-Nationality rule holds).

**R-26.3  ON-state design commitment.** When a partnership lands and the
flag is turned ON, the target posture is **verify-and-discard** (store the
verification RESULT, not the raw number) wherever the provider allows;
where a raw value is unavoidable it stays AES-256-GCM encrypted-at-rest
under the existing key + strict redaction. This commitment is recorded now
so the activation phase implements the dormant path honestly; the final
choice is confirmed with POPIA counsel at activation and recorded here.

## 4. Sign-off

To be signed by the Information Officer once designated. Until then,
the engineering team owns the open risks above and reviews this
document at every phase-completion checkpoint.

---

## Appendix A  Phase 13 audit-kind catalogue

For the auditor: the complete enumeration of audit kinds added by
Phase 13 so the oversight log shape is documented in one place.

### Student-side (Phase 13.1 + 13.4)
- `profile.update` (re-used; meta carries `academic.currentModules` /
  `academic.electiveChosen` / `academic.projectTopic` field names
  when the student-context action fires).
- `student.milestone.added`  per-row self-declared milestone insert.
- `student.milestone.removed`  per-row milestone delete.

### Admin LLM-provider lifecycle (Phase 13.3)
- `admin.llm.provider.configured`  credentials + budget written.
  Meta: `modelId`, `monthlyBudgetZar`, `s72Acknowledged`,
  `keyFingerprint`.
- `admin.llm.provider.activated`  transactional swap; meta carries
  `previousActiveProviderId`.
- `admin.llm.provider.deactivated`  pause posture.
- `admin.llm.provider.tested`  probe call; meta carries
  `ok: boolean`, `latencyMs` or `errorCategory`.
- `admin.llm.credentials.rotated`  separate kind so the ledger
  surfaces credential rotations distinctly. Meta carries the new
  `keyFingerprint`.

### LLM dispatch (Phase 13.3)
- `llm.curriculum.suggest`  successful call. Meta: `modelId`,
  `tokenCount`, `suggestionCount`, `droppedHallucinationCount`,
  `estZarCost`, `syllabusSha256`.
- `llm.curriculum.skipped`  refused by one of the six gates. Meta:
  `gate` (one of: `no_active`, `kill_switch`, `no_credentials`,
  `budget_exhausted`, `budget_zero`, `not_admin`, `payload_unsafe`),
  `syllabusSha256`.
- `llm.curriculum.failed`  provider call threw. Meta: `modelId`,
  `errorCategory` (auth / network / rate_limit / other),
  `syllabusSha256`. Upstream error body NEVER in meta.
- `admin.llm.budget.alert`  fires when total_spend_zar crosses 80%
  of monthly_budget_zar. Meta: `spentZar`, `budgetZar`, `percent`.

### Admin curriculum curation (Phase 13.3)
- `admin.curriculum.module_skill.approved`  meta:
  `moduleSlug`, `skillSlug`, `fromSource` ('llm_suggested' | 'manual').
- `admin.curriculum.module_skill.rejected`  meta: `moduleSlug`,
  `skillSlug`, optional `reason`.
- `admin.curriculum.module_skill.edited`  meta: `moduleSlug`,
  `skillSlug`, `changedFields` array.

### Gov-side export (Phase 13.6)
- `analytics.export` (re-used; meta carries `grain: 'module'` to
  distinguish the module-grain CSV from the existing programme-grain
  export on the same surface `/gov/curriculum`).

---

## Appendix B  Provenance display contract (Phase 13.7 D7)

Every recommendation surfaced on the student's Career Compass that
originated from a `module_skills` row carries a small inline
provenance annotation: `via module "<label>"`. The student sees
*how* the recommendation was derived; the auditor can trace which
catalogue entry was load-bearing for which seeker-facing surface.

The annotation lives on `<ProgrammeVsMarketCard>` inside the
`ModuleSkillsSection` rendered when `moduleSkills` is non-null. Each
inferred skill row carries the originating module label so the
attribution is one line away, never indirected through a separate
detail view.

Catalogue versioning at row granularity is documented in
`PHASE_13_CATALOGUE_GUIDE.md` (monthly review with the 18-month
re-validation flag). Per-row catalogue version strings are out of
scope for Phase 13 ship; the catalogue review process gives us the
operational equivalent without the schema cost.

