-- Phase 9.14  Seeker profile verification roll-up.
--
-- Backfill `profiles.verification` from the current qualification
-- state per profile, matching the Phase 9.14 roll-up contract:
--
--   verified   ⇔ at least one qualification.verification = 'verified'
--   pending    ⇔ no verified, but at least one qualification.verification = 'pending'
--   unverified ⇔ otherwise (no quals OR every qual is unverified/rejected)
--
-- `rejected` is intentionally NEVER auto-applied to the profile  per
-- the Verification-Honesty Rule, rejection is a per-document signal,
-- not a per-seeker judgement.
--
-- This is a one-time backfill. After this migration, the
-- `recomputeProfileVerification()` helper (called from
-- approveQualification / rejectQualification /
-- uploadQualificationDocument / deleteQualification) keeps the column
-- consistent on every subsequent change. Idempotent: re-running this
-- migration produces the same result.

UPDATE profiles p
SET verification = CASE
  WHEN EXISTS (
    SELECT 1 FROM qualifications q
    WHERE q.profile_id = p.id AND q.verification = 'verified'
  ) THEN 'verified'::verification_status
  WHEN EXISTS (
    SELECT 1 FROM qualifications q
    WHERE q.profile_id = p.id AND q.verification = 'pending'
  ) THEN 'pending'::verification_status
  ELSE 'unverified'::verification_status
END
WHERE p.deleted_at IS NULL;
