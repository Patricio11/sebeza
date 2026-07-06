# Data retention policy

> POPIA Section 14  personal information must not be retained longer
> than is necessary for the purpose for which it was collected. Each
> data category has a documented retention window and an enforcement
> mechanism. Anything not on this table doesn't exist; if it appears,
> add a row.

Last updated 2026-06-01 (Phase 13 added 4 new rows + 1 special-handling block).

---

## Retention table

| Category | Where it lives | Retention | Enforcement |
|---|---|---|---|
| **User accounts** (active) | `app_user` | While the account is active | Self-erase via `/dashboard/privacy` triggers soft-delete |
| **Soft-deleted user accounts** | `app_user.deleted_at` set | 30-day grace window | `/api/cron/hard-delete-erased` purges past the window |
| **Profile + child tables** (experiences, qualifications, profile_skills, academic_profiles) | Tables linked by `profile_id` | Same lifecycle as the user account | CASCADE on `app_user` DELETE |
| **Placements** | `placements` | Same lifecycle as the user account | Manual DELETE inside `hard-delete-erased` cron (no CASCADE) |
| **Consents** | `consents` | Same lifecycle as the user account | CASCADE on `app_user` DELETE |
| **Notifications** | `notifications` | Same lifecycle as the user account | CASCADE on `app_user` DELETE. Read state never affects retention. |
| **Audit log** | `audit_log` | **5 years** from event date | Phase 9.x cron `/api/cron/audit-log-prune` (documented below) |
| **Search events** | `search_events` | 90 days raw; aggregated indefinitely in `skill_gap_snapshots` | Phase 9.x cron prunes raw rows; snapshots retained as policy asset |
| **Skill-gap snapshots** | `skill_gap_snapshots` | Indefinite (the trend signal compounds in value) | None  append-only |
| **Outcome snapshots** | `outcome_snapshots` | Indefinite (longitudinal cohort dataset) | None  append-only; cells already k-anonymised at capture |
| **Uploaded files** | Supabase Storage | Same lifecycle as the profile | Hard-delete cron also issues Supabase delete for the user's bucket prefix |
| **Sessions** | `session` | Better Auth default (30-day rolling) | Plugin handles expiry |
| **Two-factor secrets + backup codes** | `two_factor` | Same lifecycle as the user account | CASCADE on `app_user` DELETE |
| **KYC transaction id** | `app_user.kyc_transaction_id` | Same lifecycle as the user account | NULLed by `revokeMyKyc`; lives until user deletion |
| **Email rate-limit clock** | `app_user.notification_email_last_sent_at` | Same lifecycle as the user account | JSON, no separate retention |
| **Student academic context** (Phase 13.1) | `academic_profiles.current_modules` / `elective_chosen` / `project_topic` | Same lifecycle as the academic_profiles row (which is same lifecycle as the user account) | CASCADE on `app_user` DELETE via the existing profile_id FK chain |
| **Self-declared student milestones** (Phase 13.4) | `student_milestones` | Same lifecycle as the user account | CASCADE on `app_user` DELETE via `profile_id` FK with `ON DELETE CASCADE` |
| **Editorial module → skill catalogue** (Phase 13.2) | `module_skills` | Indefinite (editorial asset, not personal data) | None  append-only catalogue; monthly review re-validates rows older than 18 months per `PHASE_13_CATALOGUE_GUIDE.md` |
| **LLM provider configuration** (Phase 13.3) | `llm_providers` | Indefinite while in production use; admin-controlled lifecycle | Admin deactivates / reconfigures from `/admin/llm`; rows are 4 seeded slots, never deleted at the DB layer  the credentials_enc column is overwritten on rotation |
| **Learning items** (Phases 9.12 + 17) | `learning_items` (incl. `progress_percent`) | Same lifecycle as the user account | CASCADE via `profile_id` FK |
| **Seeker badges / follows / blocks** (Phase 11.x) | `seeker_badges`, `seeker_followed_employers`, `seeker_blocked_employers` | Same lifecycle as the user account | CASCADE via `profile_id` / `user_id` FKs |
| **Phone (encrypted) + SMS allowlist** (Phase 11.4) | `app_user.phone_e164_enc` / `phone_verified_at`, `seeker_sms_allowlist` | Same lifecycle as the user account | Deleted with the `app_user` row (hard-delete cron); AES-256-GCM at rest |
| **Learning-path catalogue + reviews** (Phase 18) | `learning_paths` (editorial), `learning_path_reviews` | Catalogue: indefinite editorial asset (90-day freshness cron nudges re-verification). Reviews: same lifecycle as the user account | Reviews CASCADE via `profile_id` FK; catalogue soft-deleted by admins |
| **Custom skills** (Phase 19) | `profile_skills_custom` | Same lifecycle as the user account | CASCADE via `profile_id` FK; canonicalization soft-retires the row |
| **Skill prerequisites / graduate programmes** (Phases 20 + 23) | `skill_prereqs`, `graduate_programmes` | Indefinite (editorial, not personal data) | Admin-curated (`/admin/skill-prereqs`; programmes seeded + editable) |
| **Crisis resources** (Phase 22) | `crisis_resources` | Indefinite (public support info, not PII)  admins must keep it CURRENT; a stale number is a safety failure | Admin-managed from `/admin/crisis-resources` |
| **Testimonials + prompt state** (Phase 24) | `testimonials`, `testimonial_prompt_state` | Testimonial: until author-requested removal or admin delete (display fields frozen at consent time). Prompt state: same lifecycle as the account | Testimonials `user_id` FK is `ON DELETE SET NULL`  a published quote survives account deletion ONLY under its recorded display consent, and admins delete on request. Prompt state CASCADEs |
| **Integration settings** (Phase 25) | `integration_settings` | Indefinite while in use; credentials overwritten on reconfigure | Admin-managed from `/admin/integrations`; AES-256-GCM at rest |

*(Addendum rows above added 2026-07-06, closing the Phase 11→25 gap flagged by the full-system audit.)*

## Audit-log retention rationale (5 years)

POPIA itself doesn't fix a number. We adopted 5 years because:

1. The **Financial Intelligence Centre Act** requires record retention
   for 5 years for KYC + transactional records  when our KYC adapter
   goes live, the audit log will need to match.
2. The **Promotion of Administrative Justice Act** envisages a
   reasonable look-back period for administrative decisions; 5 years
   gives a court enough history to interrogate any admin action a user
   challenges.
3. 5 years matches Stats SA's longitudinal study windows, which is the
   policy use case for our `outcome_snapshots`.

The audit-log-prune cron will live at `/api/cron/audit-log-prune` and
delete any row where `at < now() - interval '5 years'`. Not built yet
because we have less than a month of audit data  the cron is queued
for the launch checklist.

## Special handling

### National ID (`profiles.national_id_enc`)
- Stored as AES-256-GCM ciphertext only (`lib/crypto/encryptField`).
- Plaintext exists only in memory for the length of the request that
  decrypts it (e.g. the KYC `submitMyIdForVerification` call).
- Never returned in any read API.
- Cleared when the user removes their ID via
  `/dashboard/profile` → National ID → Remove.

### Documents in Supabase Storage
- Private bucket; reads are signed-URL only.
- Signed URL TTL is 60 seconds (`lib/storage/signed`).
- Bucket prefix follows `profiles/{profile_id}/...` so hard-delete can
  drop everything in one prefix delete call.

### Sub-processor data
- Resend stores delivery metadata for ~30 days (their default). We do
  not push PII to email bodies beyond display context (org name, role).
- Neon retains DB backups for 7 days (PITR window). When we migrate to
  AWS RDS Cape Town, retention is 35 days per default config  both
  windows are covered by our DPA.
- KYC SaaS provider retains their own transaction record indefinitely
  (regulatory requirement). The link is the `kyc_transaction_id` field;
  on user deletion we sever the link from our side but the provider's
  record persists per their own retention policy. Document this in the
  Privacy Policy when the partnership lands.

### LLM editorial pipeline (Phase 13.3)  cross-border data flow
- **No seeker PII is ever sent to the LLM.** The Phase 13.3 dispatcher
  enforces this at Gate 6 of the six-gate posture: the payload is
  refused server-side if it matches RSA 13-digit ID, email, or SA
  phone shapes. The intended payload is generic syllabus / module text
  from publicly available academic documents.
- **OpenAI + Anthropic** are US-based processors. Configuration is
  gated behind an explicit POPIA s.72 acknowledgement checkbox on
  `/admin/llm`; the acknowledgement timestamp is persisted on
  `llm_providers.s72_acknowledged_at` AND in the
  `admin.llm.provider.configured` audit row.
- **Mistral** hosts in the EU under GDPR (POPIA-equivalent regime);
  no s.72 acknowledgement step.
- **Self-hosted** is the POPIA-clean recommended path: inference
  inside the af-south-1 (Cape Town) residency boundary, no cross-
  border processing, no s.72 acknowledgement.
- The vendor's own retention of the syllabus prompt is governed by
  the vendor's terms (OpenAI: 30 days for abuse monitoring; Anthropic:
  30 days; Mistral: 30 days; self-hosted: under our control). The
  link from our side is the audit row carrying the syllabus SHA-256
  hash  the plaintext is NEVER persisted by Sebenza after the call
  completes.
