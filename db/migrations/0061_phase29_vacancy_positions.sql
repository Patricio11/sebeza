-- Phase 29.1 ("Vacancy seats")  optional headcount on a vacancy.
-- NULL = unspecified: many SA vacancies (casual, seasonal, rolling intake)
-- genuinely have no fixed seat count, and the field must never fabricate
-- one. When set, the match page shows honest seat context ("2 positions ·
-- 8 invited") and offers "Select top N" as a convenience  invites still
-- go through the explicit, consent-gated bulk action.
--
-- Idempotent (IF NOT EXISTS).

ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS positions integer;
